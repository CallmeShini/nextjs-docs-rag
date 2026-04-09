"""
FastAPI — A-RAG API
POST /ask  →  { answer, citations, evidence_score, best_evidence_score, current_evidence_score, from_cache }
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.graph.builder import get_graph, run_query
from app.utils.logger import get_logger
from app.utils.model_registry import preload_runtime_models

log = get_logger(__name__)

# ── Rate Limiter ─────────────────────────────────────────────────────────────
RATE_LIMIT = os.getenv("RATE_LIMIT", "10/minute")
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])

# ── CORS Origins ─────────────────────────────────────────────────────────────
_raw_origins = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS: list[str] = (
    ["*"] if _raw_origins.strip() == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)
NEXTJS_REPO_ROOT = Path(os.getenv("NEXTJS_REPO_PATH", "./data/nextjs-repo")).resolve()

PRELOAD_MODELS_ON_STARTUP = os.getenv("PRELOAD_MODELS_ON_STARTUP", "true").lower() == "true"


@asynccontextmanager
async def lifespan(_: FastAPI):
    if PRELOAD_MODELS_ON_STARTUP:
        try:
            log.info("api.startup.preload.begin")
            get_graph()
            preload_runtime_models()
            log.info("api.startup.preload.done")
        except Exception as e:
            log.warning("api.startup.preload.error", error=str(e))
    yield

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="A-RAG — Next.js Documentation Assistant",
    description="Agentic RAG system answering questions about Next.js with citations.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    answer: str
    citations: list[str]
    evidence_score: float
    best_evidence_score: float
    current_evidence_score: float
    from_cache: bool


def _resolve_repo_file(relative_path: str) -> Path:
    """Resolve a repo-relative file path safely within the cloned Next.js repository."""
    normalized = relative_path.strip().lstrip("/")
    if not normalized:
        raise HTTPException(status_code=400, detail="Path cannot be empty.")

    candidate = (NEXTJS_REPO_ROOT / normalized).resolve()
    try:
        candidate.relative_to(NEXTJS_REPO_ROOT)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid path.") from exc

    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    return candidate


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "version": app.version}


@app.get("/source/download")
def download_source(path: str):
    source_file = _resolve_repo_file(path)
    return FileResponse(
        source_file,
        media_type="text/markdown; charset=utf-8",
        filename=source_file.name,
    )


@app.post("/ask", response_model=QueryResponse)
@limiter.limit(RATE_LIMIT)
def ask(request: Request, body: QueryRequest):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    log.info("api.ask.request", query_preview=body.query[:80])

    try:
        result = run_query(body.query)
    except Exception as e:
        log.error("api.ask.error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal error processing your query.")

    current_evidence_score = round(float(result.get("evidence_score", 0.0)), 4)
    best_evidence_score = round(
        float(result.get("best_evidence_score", result.get("evidence_score", 0.0))),
        4,
    )

    log.info(
        "api.ask.response",
        evidence_score=best_evidence_score,
        current_evidence_score=current_evidence_score,
        best_evidence_score=best_evidence_score,
        from_cache=bool(result.get("_from_cache", False)),
        citations=len(result.get("citations", [])),
    )

    return QueryResponse(
        answer=result.get("final_answer", ""),
        citations=result.get("citations", []),
        evidence_score=best_evidence_score,
        best_evidence_score=best_evidence_score,
        current_evidence_score=current_evidence_score,
        from_cache=bool(result.get("_from_cache", False)),
    )
