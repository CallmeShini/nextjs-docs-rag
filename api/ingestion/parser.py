"""
Step 2 — Parse .md and .mdx files from the Next.js docs directory.
Splits files into sections based on headings (H1, H2, H3).
"""

import os
import re
from pathlib import Path
from app.utils.logger import get_logger

log = get_logger(__name__)


def _extract_frontmatter_title(content: str) -> tuple[str, str]:
    """Strip YAML frontmatter and return (title, remaining_content)."""
    title = ""
    if content.startswith("---"):
        end = content.find("---", 3)
        if end != -1:
            frontmatter = content[3:end]
            for line in frontmatter.splitlines():
                if line.startswith("title:"):
                    title = line.split("title:", 1)[1].strip().strip('"').strip("'")
            content = content[end + 3:].strip()
    return title, content


def _split_by_headings(content: str) -> list[tuple[str, str]]:
    """
    Split markdown content by headings.
    Returns list of (heading, body) tuples.
    """
    heading_pattern = re.compile(r'^(#{1,3})\s+(.+)$', re.MULTILINE)
    matches = list(heading_pattern.finditer(content))

    if not matches:
        return [("", content.strip())]

    sections = []
    for i, match in enumerate(matches):
        heading_text = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        body = content[start:end].strip()
        if body:
            sections.append((heading_text, body))

    return sections


def parse_docs(repo_path: str) -> list[dict]:
    """
    Walk the /docs directory of the Next.js repo and parse all .md/.mdx files.
    Returns a list of raw section dicts (pre-chunking).
    """
    docs_dir = os.path.join(repo_path, "docs")
    if not os.path.isdir(docs_dir):
        raise FileNotFoundError(f"Docs directory not found: {docs_dir}")

    raw_sections = []
    doc_files = list(Path(docs_dir).rglob("*.md")) + list(Path(docs_dir).rglob("*.mdx"))

    log.info("parser.docs_discovered", files=len(doc_files), docs_dir=docs_dir)

    for file_path in doc_files:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            log.warning("parser.read_error", file_path=str(file_path), error=str(e))
            continue

        fm_title, cleaned = _extract_frontmatter_title(content)
        rel_path = str(file_path.relative_to(repo_path))
        file_title = fm_title or file_path.stem.replace("-", " ").title()

        sections = _split_by_headings(cleaned)
        for heading, body in sections:
            raw_sections.append({
                "title": file_title,
                "section": heading or file_title,
                "content": body,
                "file_path": rel_path,
            })

    log.info("parser.done", sections=len(raw_sections))
    return raw_sections


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    repo = os.getenv("NEXTJS_REPO_PATH", "./data/nextjs-repo")
    sections = parse_docs(os.path.abspath(repo))
    log.info("parser.sample", sections=len(sections), sample=sections[0] if sections else "none")
