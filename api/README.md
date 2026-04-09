# A-RAG Next.js API

Core application runtime for A-RAG Next.js.

Created by Gabriel R. ([CallmeShini](https://github.com/CallmeShini)).

## About

A-RAG Next.js is a domain-specific assistant that answers questions about Next.js using a cloned copy of the official documentation repository, a hybrid retrieval stack, and an explicit LangGraph evidence loop.

The project is intentionally narrow in scope:

- it is optimized for Next.js documentation questions
- it keeps the retrieval and reasoning pipeline explicit
- it favors traceability, observability, and evaluation over black-box behavior

This module contains the core engineering logic of the project. It is designed as a portfolio-grade, locally reproducible Agentic RAG system with citations, source traceability, and measurable cold vs warm behavior.

## What The System Does

1. Clones and parses the Next.js documentation from GitHub
2. Chunks the parsed MDX content
3. Indexes the corpus into:
   - BM25 for keyword retrieval
   - ChromaDB for vector retrieval
4. Accepts a user query through FastAPI
5. Runs a LangGraph orchestration loop to decide whether more evidence is needed
6. Synthesizes a grounded answer with citations
7. Caches finalized answers semantically for fast repeated queries

## Architecture

The API/runtime module follows the project diagram directly.

```text
User Query
  -> Semantic Cache Intercept
  -> Planner / Orchestrator
  -> Decomposition Router
  -> Retrieval Specialist
  -> BM25 + Vector Retrieval
  -> Reranker
  -> Chunk Reader
  -> Evidence Memory (state)
  -> Planner / Final Synthesizer
```

Implemented graph path:

```text
START
  -> planner
      -> enough_evidence=True  -> final_synthesizer -> END
      -> enough_evidence=False -> decomposition_router
                                   -> retrieval_specialist
                                   -> retriever
                                   -> reranker
                                   -> chunk_reader
                                   -> decomposition_router / planner
```

Current runtime nodes:

- `planner`
- `decomposition_router`
- `retrieval_specialist`
- `retriever`
- `reranker`
- `chunk_reader`
- `final_synthesizer`

## Core Design Decisions

### 1. Explicit agentic loop instead of hidden orchestration

LangGraph was chosen because the project needs a visible, stateful loop:

- planner decides whether evidence is sufficient
- decomposition router manages sub-question execution
- chunk reader writes structured evidence into memory
- final synthesizer only runs after retrieval is judged sufficient

This makes the reasoning path inspectable and testable.

### 2. Hybrid retrieval instead of vector-only retrieval

The system uses both BM25 and vector search because Next.js documentation mixes:

- exact API names and file conventions
- versioned options and config keys
- conceptual explanations

BM25 helps with exact terms like `generateStaticParams`, `revalidateTag`, or `loading.tsx`. Vector search helps with conceptual questions like caching, rendering, or streaming.

### 3. Chunk Reader as a dedicated evidence layer

Retrieved chunks are not treated as evidence by default. The Chunk Reader converts reranked chunks into structured evidence items, which gives the planner a cleaner basis for deciding whether to continue retrieving or synthesize.

This separation matters because a relevant chunk is not always an answerable chunk.

### 4. Semantic cache before the graph

Repeated or semantically equivalent questions should not pay the full orchestration cost. The semantic cache intercepts the query before LangGraph execution and returns a previous grounded answer when similarity is high enough.

This is the main reason the warm path is dramatically faster than the cold path.

### 5. Local retrieval models, configurable generation layer

Embeddings and reranking run locally:

- embeddings: `sentence-transformers/all-MiniLM-L6-v2`
- reranker: `cross-encoder/ms-marco-MiniLM-L-6-v2`

The LLM layer is configurable through the OpenAI SDK interface and currently supports:

- Azure AI Foundry
- xAI
- OpenAI

This keeps retrieval cost low while leaving generation provider selection flexible.

### 6. Source traceability as a product feature

Every answer is returned with citations. In the web app, citation cards can:

- open the official source on GitHub
- download the local `.mdx` file through the API

This makes the assistant more credible for portfolio and demo use because the answer can be audited quickly.

## Runtime Stack

| Layer | Technology |
|---|---|
| Orchestration | LangGraph |
| API | FastAPI + Uvicorn |
| Rate limiting | SlowAPI |
| Logging | structured logging with text/json formats |
| Vector store | ChromaDB |
| Keyword retrieval | BM25 (`rank-bm25`) |
| Embeddings | `all-MiniLM-L6-v2` |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| LLM client | `openai` SDK with provider adapters |
| Primary LLM path | Azure AI Foundry compatible endpoint |

## API Surface

### `GET /health`

Basic health check.

### `POST /ask`

Accepts:

```json
{
  "query": "How does caching work in the Next.js App Router?"
}
```

Returns:

```json
{
  "answer": "...",
  "citations": ["[Source: docs/... ]"],
  "evidence_score": 0.869,
  "best_evidence_score": 0.869,
  "current_evidence_score": 0.75,
  "from_cache": false
}
```

Metric meaning:

- `evidence_score`: public score exposed by the API and aligned with planner output
- `best_evidence_score`: best evidence score seen during the retrieval loop
- `current_evidence_score`: score from the last retrieval cycle before synthesis
- `from_cache`: whether the response came from semantic cache

### `GET /source/download`

Downloads a cited source file from the local Next.js repo clone:

```text
/source/download?path=docs/01-app/02-guides/streaming.mdx
```

The route is path-safe and only serves files inside the configured Next.js repository root.

## Observability And Evaluation

The project intentionally includes observability and evaluation primitives:

- structured logs across graph nodes and API
- rate limiting on `/ask`
- deterministic benchmark script for cold vs warm measurements
- unit and integration tests around graph behavior and API behavior
- explicit evidence metrics in the response payload

### Local benchmark snapshot

Benchmark outputs are written to:

- `api/data/eval/benchmark_<timestamp>.json`

Measured locally on `2026-04-09`:

| Mode | Average | Median | Min | Max |
|---|---:|---:|---:|---:|
| Cold | `24.03s` | `18.56s` | `15.74s` | `37.81s` |
| Warm | `0.01s` | `0.01s` | `0.01s` | `0.01s` |

Observed warm-path speedup: `2054.06x`

This is a local development benchmark, not a universal SLA. Its value is comparative: it shows the impact of semantic cache and the current cost of the cold agentic path.

## Current Product Boundaries

The current version is strong as a portfolio-grade v1.0, but it is still intentionally limited:

- no authentication on `/ask`
- no streaming response transport yet
- no conversation persistence
- no multi-user tenancy model
- web fallback exists, but the primary trust path remains the local documentation corpus

## Local Setup

### Runtime

- recommended Python: `3.12`
- current local warning: Python `3.14` runs, but some dependencies still emit compatibility warnings

The module includes [.python-version](./.python-version) with `3.12` as the recommended target.

### API install

```bash
cd api
cp .env.example .env
source ../.venv/bin/activate
pip install -r requirements.txt
```

Environment notes:

- configure `LLM_PROVIDER`, model, endpoint, and credentials in `.env`
- set `HF_TOKEN` if you want to avoid anonymous Hugging Face download limits
- keep `PRELOAD_MODELS_ON_STARTUP=true` if you want the model load cost moved to API startup

### Ingestion

```bash
cd api
source ../.venv/bin/activate
python -m ingestion.indexer
```

This runs the explicit ingestion pipeline:

```text
clone repo -> parse mdx -> chunk -> BM25 index -> Chroma upsert
```

### API

```bash
cd api
source ../.venv/bin/activate
uvicorn api.main:app --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

### Benchmark

```bash
cd api
source ../.venv/bin/activate
python eval/benchmark_api.py
```

The benchmark:

- runs `cold`, `warm`, or both
- clears only the `semantic_cache` collection before the cold phase by default
- preserves the main documentation index
- writes a JSON report under `data/eval/benchmark_<timestamp>.json`

## Docker Demo Runtime

A root-level Compose file exists at:

- [../docker-compose.yml](../docker-compose.yml)

### What it does

- builds a Python 3.12 API image from [Dockerfile](./Dockerfile)
- builds a standalone Next.js web image from [../web/Dockerfile](../web/Dockerfile)
- persists API retrieval artifacts in a named Docker volume
- persists Hugging Face model cache in a named Docker volume
- can bootstrap ingestion automatically on the first API startup

The Docker setup exists to make the project easy to demo and reproduce locally. It is not positioned here as a permanently hosted service blueprint.

### First-time run

1. Configure the API environment:

```bash
cd api
cp .env.example .env
```

2. From the workspace root, start both services:

```bash
docker compose up --build
```

The API container is configured with `AUTO_INGEST_ON_BOOT=true`, so on the first run it will:

- clone the Next.js repository into the container volume
- parse and chunk the docs
- build BM25 and ChromaDB artifacts
- then start the API

This first startup is intentionally slower because it includes model downloads and ingestion.

### Manual ingestion mode

If you want explicit control, disable `AUTO_INGEST_ON_BOOT` in the compose file and run ingestion manually:

```bash
docker compose run --rm api python -m ingestion.indexer
docker compose up --build
```

### Ports

- web app: `http://localhost:3000`
- API: `http://localhost:8000`

### Web app API target

The web image accepts a build-time `NEXT_PUBLIC_API_BASE_URL`. By default, the compose file uses:

```bash
http://localhost:8000
```

For a VPS or public deployment, override it before build:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com docker compose up --build
```

## Tests

```bash
./.venv/bin/python -m pytest api/tests -q
```

## Repository Structure

```text
api/
├── api/             # FastAPI app and HTTP contract
├── app/
│   ├── graph/       # LangGraph builder and runtime entrypoint
│   ├── memory/      # evidence scoring helpers
│   ├── nodes/       # planner, router, specialist, retrieval, rerank, reader, synthesis
│   ├── retrievers/  # BM25 and vector retrieval
│   ├── state/       # shared graph state schema
│   └── utils/       # llm, logger, semantic cache, model registry
├── data/            # cloned docs, vector store, bm25 corpus, evaluation outputs
├── eval/            # local evaluation and benchmarking helpers
├── ingestion/       # clone, parse, chunk, index
└── tests/           # graph, API, and regression coverage
```

## Web Module

The companion web module lives in:

- [../web](../web/)

It provides:

- chat interface over `/ask`
- cache and evidence badges
- citation cards with GitHub/source download actions
- `/docs` route with product and architecture documentation

## Author

Built by Gabriel R.

- GitHub: [CallmeShini](https://github.com/CallmeShini)

The project is designed as an AI Engineer portfolio system: explicit architecture, measurable retrieval behavior, strong traceability, and production-minded implementation choices.
