"""
LangGraph Graph Builder — Agentic A-RAG System.

Architecture (faithful to A-rag.png diagram + decomposition):

  START
    └→ planner (The Orchestrator Brain)
         ├─ [enough_evidence=True] → final_synthesizer → END
         └─ [enough_evidence=False] → decomposition_router (Tools)
                                            ├─ [queue has items] → retrieval_specialist → retriever → reranker → chunk_reader
                                            │                      └──────────────────────────────────────────────────────┘
                                            │                                        (loops back to decomposition_router)
                                            └─ [queue empty] → planner (iterate back to orchestrator)
"""

from langgraph.graph import StateGraph, START, END

from app.state.schema import GraphState
from app.nodes.planner import planner_node
from app.nodes.decomposition_router import decomposition_router_node, route_from_decomposition
from app.nodes.retrieval_specialist import retrieval_specialist_node
from app.nodes.retriever import retriever_node
from app.nodes.reranker import reranker_node
from app.nodes.chunk_reader import chunk_reader_node
from app.nodes.final_synthesizer import final_synthesizer_node
from app.utils.semantic_cache import check_semantic_cache, save_to_semantic_cache


def _route_from_orchestrator(state: GraphState) -> str:
    """Conditional edge from the Orchestrator (planner): synthesize if enough evidence, else go to tools."""
    if state.get("enough_evidence", False):
        return "synthesize"
    return "tools"


def build_graph() -> StateGraph:
    """Build and compile the Agentic A-RAG LangGraph."""
    graph = StateGraph(GraphState)

    # ── Register all nodes ───────────────────────────────────────
    graph.add_node("planner", planner_node)
    graph.add_node("decomposition_router", decomposition_router_node)
    graph.add_node("retrieval_specialist", retrieval_specialist_node)
    graph.add_node("retriever", retriever_node)
    graph.add_node("reranker", reranker_node)
    graph.add_node("chunk_reader", chunk_reader_node)
    graph.add_node("final_synthesizer", final_synthesizer_node)

    # ── Linear edges ─────────────────────────────────────────────
    graph.add_edge(START, "planner")

    # Orchestrator decides whether to synthesize or retrieve
    graph.add_conditional_edges(
        "planner",
        _route_from_orchestrator,
        {
            "synthesize": "final_synthesizer",
            "tools": "decomposition_router",
        },
    )

    # Decomposition conditional: route to specialist OR loop back to orchestrator
    graph.add_conditional_edges(
        "decomposition_router",
        route_from_decomposition,
        {
            "retrieve": "retrieval_specialist",  # sub-question was popped → retrieve it
            "judge":    "planner",               # queue empty → back to orchestrator logic
        },
    )

    # Retrieval pipeline (linear tools loop)
    graph.add_edge("retrieval_specialist", "retriever")
    graph.add_edge("retriever", "reranker")
    graph.add_edge("reranker", "chunk_reader")

    # After reading chunks, pop the next item from the queue
    graph.add_edge("chunk_reader", "decomposition_router")

    graph.add_edge("final_synthesizer", END)

    return graph.compile()


_compiled_graph = None


def get_graph():
    """Return the compiled graph, building it once (singleton)."""
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


def run_query(user_query: str) -> dict:
    """
    Execute the A-RAG graph for a single query.
    Returns the final state dict.
    Intercepts the query using Semantic Cache to save execution time.
    """
    # 1. Semantic Cache Interception
    cached = check_semantic_cache(user_query)
    if cached:
        return cached

    graph = get_graph()

    initial_state: GraphState = {
        "user_query": user_query,
        "rewritten_queries": [],
        "sub_questions": [],
        "retrieval_routes": [],
        "pending_sub_questions": [],
        "processed_sub_questions": [],
        "_active_sub_question": None,
        "retrieval_plan": {
            "strategy": "hybrid",
            "bm25_queries": [],
            "vector_queries": [],
            "rationale": "",
        },
        "candidate_chunks": [],
        "ranked_chunks": [],
        "evidence_items": [],
        "evidence_score": 0.0,
        "best_evidence_score": 0.0,
        "last_retrieval_new_items": 0,
        "last_retrieval_evidence_delta": 0.0,
        "consecutive_stalled_cycles": 0,
        "enough_evidence": False,
        "iteration_count": 0,
        "citations": [],
        "final_answer": "",
    }

    final_state = graph.invoke(initial_state)
    
    # 2. Save successful result to Cache
    save_to_semantic_cache(user_query, final_state)
    
    return final_state
