# A-RAG Next.js Launch Copy

This file contains ready-to-post copy for sharing the project publicly.

## LinkedIn Version

I just open-sourced **A-RAG Next.js**: an Agentic RAG system built on top of the **official Next.js documentation**.

The goal was not to build a generic chatbot. I wanted to build a portfolio-grade AI system with:

- explicit retrieval orchestration
- hybrid search (`BM25 + vector`)
- evidence memory
- source-grounded citations
- measurable cold vs warm performance

The full pipeline is visible end to end:

`ingestion -> chunking -> retrieval -> reranking -> evidence writing -> synthesis -> evaluation`

Some details I care about as an AI engineer:

- LangGraph planner loop instead of hidden orchestration
- semantic cache before graph execution
- local embeddings and reranking
- FastAPI API + Next.js web app
- reproducible local demo with Docker

Current benchmark snapshot:

- Cold avg: `24.03s`
- Warm avg: `0.01s`
- Warm-path speedup: `2054.06x`

Repo:
[https://github.com/CallmeShini/nextjs-docs-rag](https://github.com/CallmeShini/nextjs-docs-rag)

Would appreciate feedback from people working on RAG systems, developer tools, or AI infrastructure.

#AIEngineering #RAG #AgenticAI #LangGraph #FastAPI #NextJS #OpenSource #RetrievalAugmentedGeneration

## GitHub / Long-form Version

I’m sharing **A-RAG Next.js**, an open-source Agentic RAG project focused on the **official Next.js docs**:

[https://github.com/CallmeShini/nextjs-docs-rag](https://github.com/CallmeShini/nextjs-docs-rag)

### What it is

A domain-specific question-answering system for Next.js documentation with:

- hybrid retrieval (`BM25 + vector`)
- explicit LangGraph orchestration
- reranking + chunk reading
- evidence memory
- semantic cache
- source-linked citations

### Why I built it this way

I wanted the system to be:

- **traceable**
- **testable**
- **observable**
- **easy to explain in a technical review**

So instead of collapsing everything into a black-box chain, I kept the pipeline explicit:

`ingestion -> chunking -> retrieval -> reranking -> evidence writing -> synthesis -> evaluation`

### Stack

- LangGraph
- FastAPI
- ChromaDB
- BM25
- sentence-transformers
- cross-encoder reranking
- Next.js
- Docker Compose

### Measured behavior

Local benchmark snapshot:

- Cold avg: `24.03s`
- Warm avg: `0.01s`
- Warm-path speedup: `2054.06x`

### What’s next

Potential next improvements:

- response streaming
- conversation persistence
- tighter evaluation dataset and regression checks

If you work on RAG systems, AI infra, or developer tooling, I’d love feedback.

## Suggested media

If you want a visual post, attach:

- `assets/home.png`
- `assets/docs.png`
- `Diagrama/A-rag.png`
