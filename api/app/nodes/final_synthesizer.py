"""
Node 6 — Final Synthesizer
Generates the final answer grounded exclusively in collected evidence.
Produces citations from evidence file paths.
"""

import os
import re
from app.state.schema import GraphState
from app.utils.llm import chat
from app.utils.logger import get_logger

log = get_logger(__name__)

_EVIDENCE_MAX_WORDS = int(os.getenv("EVIDENCE_MAX_WORDS", "500"))

# RESPONSE_LANGUAGE controls the output language of the final answer.
# "english" (default) — always respond in English regardless of query language.
# "match_query"       — respond in the same language as the user's question.
# Any other value     — treated as an explicit BCP-47 language tag (e.g. "pt", "es", "fr").
_RESPONSE_LANGUAGE = os.getenv("RESPONSE_LANGUAGE", "english").lower()


def _language_instruction() -> str:
    if _RESPONSE_LANGUAGE == "english":
        return "IMPORTANT: Always respond in English, regardless of the language of the user question."
    if _RESPONSE_LANGUAGE == "match_query":
        return "IMPORTANT: Respond in the same language as the user's question."
    return f"IMPORTANT: Always respond in {_RESPONSE_LANGUAGE}, regardless of the language of the user question."


def _build_system_prompt() -> str:
    return _SYNTHESIZER_SYSTEM_TEMPLATE.format(
        language_instruction=_language_instruction()
    )


def _truncate_to_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + " …"


_SYNTHESIZER_SYSTEM_TEMPLATE = """You are a Next.js documentation expert.
You will receive a user question and structured evidence extracted from the official Next.js docs.

Your task:
1. Write a clear, accurate, and complete answer using ONLY the provided evidence.
2. {language_instruction}
3. Do NOT add information not present in the evidence.
4. At the end, list citations as: [Source: <file_path>]
5. Do NOT wrap the answer in XML or HTML tags such as <answer>, <response>, or <final_answer>.

Format your response as:
<answer text>

---
**Citations:**
- [Source: docs/...]
- [Source: docs/...]
"""


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    """Remove duplicate citations while preserving their first appearance order."""
    seen: set[str] = set()
    deduped: list[str] = []
    for item in items:
        if item in seen:
            continue
        deduped.append(item)
        seen.add(item)
    return deduped


_ANSWER_WRAPPER_RE = re.compile(
    r"^\s*<(?P<tag>answer|response|final_answer)\b[^>]*>\s*(?P<body>.*)\s*</(?P=tag)>\s*$",
    re.IGNORECASE | re.DOTALL,
)


def _strip_artificial_answer_wrapper(text: str) -> str:
    """Remove synthetic outer wrappers like <answer>...</answer> without touching inline doc tags."""
    cleaned = text.strip()

    while True:
        match = _ANSWER_WRAPPER_RE.match(cleaned)
        if not match:
            break
        cleaned = match.group("body").strip()

    return cleaned


def final_synthesizer_node(state: GraphState) -> GraphState:
    """
    Synthesizes the final answer from evidence_items.
    Extracts citations and populates final_answer and citations.
    """
    user_query = state["user_query"]
    evidence_items = state.get("evidence_items", [])

    if not evidence_items:
        return {
            **state,
            "final_answer": "I could not find sufficient documentation to answer this question.",
            "citations": [],
        }

    # Build evidence context (sorted by confidence, top 8)
    sorted_evidence = sorted(evidence_items, key=lambda e: e["confidence"], reverse=True)[:8]

    evidence_text = ""
    seen_sources: list[str] = []
    web_fallback_sources: list[str] = []
    for i, ev in enumerate(sorted_evidence):
        content = _truncate_to_words(ev["content"], _EVIDENCE_MAX_WORDS)
        is_web = ev.get("source_type") == "web_fallback" or ev.get("source", "") == "web_fallback"
        source_label = f"{ev['file_path']} [web]" if is_web else ev["file_path"]
        evidence_text += (
            f"\n[Evidence {i+1}] Source: {source_label}\n"
            f"Content: {content}\n"
            f"Key claims: {'; '.join(ev['claims'])}\n"
        )
        if ev["file_path"] not in seen_sources:
            seen_sources.append(ev["file_path"])
            if is_web:
                web_fallback_sources.append(ev["file_path"])

    messages = [
        {"role": "system", "content": _build_system_prompt()},
        {
            "role": "user",
            "content": f"Question: {user_query}\n\nEvidence:\n{evidence_text}",
        },
    ]

    try:
        answer_text = chat(messages, temperature=0.1)
    except Exception as e:
        log.error("synthesizer.llm_error", error_type=type(e).__name__, error=str(e))
        # Assemble answer from raw evidence claims
        lines = [f"**Based on Next.js documentation:**\n"]
        for i, ev in enumerate(sorted_evidence):
            if ev["claims"]:
                lines.append(f"- {ev['claims'][0]}")
            else:
                lines.append(f"- {ev['content'][:300]}")
        answer_text = "\n".join(lines)

    # Parse citations block
    citations: list[str] = []
    if "---" in answer_text:
        parts = answer_text.split("---", 1)
        answer_body = _strip_artificial_answer_wrapper(parts[0].strip())
        citation_block = parts[1] if len(parts) > 1 else ""
        for line in citation_block.splitlines():
            line = line.strip()
            if line.startswith("- [Source:") or line.startswith("[Source:"):
                raw_citation = line.lstrip("- ").strip()
                # Mark web fallback citations so consumers can display them differently
                if any(wf in raw_citation for wf in web_fallback_sources):
                    raw_citation = raw_citation.rstrip("]") + " — web search]"
                citations.append(raw_citation)
        citations = _dedupe_preserve_order(citations)
    else:
        answer_body = _strip_artificial_answer_wrapper(answer_text.strip())
        citations = [
            f"[Source: {p} — web search]" if p in web_fallback_sources else f"[Source: {p}]"
            for p in seen_sources
        ]
        citations = _dedupe_preserve_order(citations)

    if web_fallback_sources:
        log.warning(
            "synthesizer.web_fallback_in_response",
            web_sources=len(web_fallback_sources),
            total_citations=len(citations),
        )

    log.info("synthesizer.done", citations=len(citations))

    return {
        **state,
        "final_answer": answer_body,
        "citations": citations,
    }
