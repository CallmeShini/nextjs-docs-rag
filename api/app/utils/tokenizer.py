"""
Shared BM25 tokenizer — used at both index time (ingestion) and query time (retrieval).

Consistency is critical: the same tokenization logic MUST be applied to corpus chunks
and search queries, otherwise BM25 scores become meaningless.

Improvements over naive `.lower().split()`:
  1. Lowercase normalization
  2. Punctuation stripping (preserves hyphenated terms like "app-router")
  3. English stopword removal (reduces index noise, improves IDF weights)
  4. Next.js-specific token preservation: keeps identifiers like
     "use-client", "layout.js", "page.tsx", "next.config.js", etc.
"""

import re

# Minimal English stopword set — covers the most common noise without over-pruning.
# Deliberately kept small to avoid removing Next.js-relevant short words (e.g. "use",
# "get", "set", "app", "id") that carry meaning in technical queries.
_STOPWORDS: frozenset[str] = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "it", "its", "this", "that", "these", "those", "i", "you", "he",
    "she", "we", "they", "what", "which", "who", "how", "when", "where",
    "there", "here", "not", "no", "if", "then", "than", "so", "also",
    "into", "out", "up", "about", "after", "before", "between", "through",
    "during", "each", "all", "any", "both", "just", "more", "other",
    "your", "our", "their", "my", "his", "her",
})

# Pattern: strip leading/trailing punctuation but keep internal hyphens and dots
# (preserves "app-router", "layout.js", "next.config.js")
_STRIP_PUNCT = re.compile(r"^[^\w\-\.]+|[^\w\-\.]+$")


def tokenize(text: str) -> list[str]:
    """
    Tokenize text for BM25 indexing and querying.

    Steps:
      1. Lowercase
      2. Split on whitespace
      3. Strip leading/trailing punctuation (keeps internal hyphens and dots)
      4. Remove stopwords
      5. Drop empty tokens and single-character noise

    Returns a list of tokens.
    """
    tokens = []
    for raw_token in text.lower().split():
        token = _STRIP_PUNCT.sub("", raw_token)
        if not token:
            continue
        if token in _STOPWORDS:
            continue
        if len(token) < 2:
            continue
        tokens.append(token)
    return tokens
