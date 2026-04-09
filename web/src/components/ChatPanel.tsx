"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { AlertCircle, ArrowUp, Download, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatContext, Message } from "@/context/ChatContext";
import OrbCanvas from "@/components/OrbCanvas";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const NEXTJS_GITHUB_BLOB_BASE = "https://github.com/vercel/next.js/blob/canary";

interface AskResponse {
  answer: string;
  citations: string[];
  evidence_score: number;
  best_evidence_score: number;
  current_evidence_score: number;
  from_cache: boolean;
}

interface CitationMeta {
  raw: string;
  fullPath: string;
  compactPath: string;
  filename: string;
  isWebSearch: boolean;
  sourceHref: string | null;
  downloadHref: string | null;
}

function parseCitation(citation: string): CitationMeta {
  const clean = citation.replace("[Source: ", "").replace("]", "").trim();
  const isWebSearch = clean.endsWith("— web search");
  const path = isWebSearch ? clean.replace(" — web search", "").trim() : clean;
  const segments = path.split("/").filter(Boolean);
  const filename = segments.at(-1) ?? path;
  const compactPath =
    segments.length <= 3
      ? path
      : `${segments[0]}/…/${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
  const sourceHref = isWebSearch
    ? path
    : path.startsWith("docs/")
      ? `${NEXTJS_GITHUB_BLOB_BASE}/${path}`
      : null;
  const downloadHref = isWebSearch || !path.startsWith("docs/")
    ? null
    : `${API_BASE_URL}/source/download?path=${encodeURIComponent(path)}`;

  return {
    raw: citation,
    fullPath: path,
    compactPath,
    filename,
    isWebSearch,
    sourceHref,
    downloadHref,
  };
}

function formatScore(score?: number): string {
  return typeof score === "number" ? score.toFixed(4) : "—";
}

function buildErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && error.message !== "Failed to fetch") {
    return error.message;
  }
  return `Backend unreachable. Make sure the API is running at ${API_BASE_URL}.`;
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-4 last:mb-0">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="text-[19px] font-semibold text-[#0d0d0d] mb-3 mt-5 tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[17px] font-semibold text-[#0d0d0d] mb-2.5 mt-5 tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[15px] font-semibold text-[#0d0d0d] mb-2 mt-4 tracking-tight">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 space-y-1.5 pl-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 space-y-1.5 pl-0 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2.5 text-[15px]">
      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#aeaeb2] shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  code: ({ children, className, ...props }) => {
    const isBlockCode = Boolean(className);

    return (
      <code
        className={`font-mono text-[13px] ${className ?? ""}`.trim()}
        style={
          isBlockCode
            ? { color: "#1a1a1a" }
            : { backgroundColor: "#f0f0f0", color: "#c7254e", padding: "0.125rem 0.375rem", borderRadius: "0.375rem" }
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <div
      className="rounded-2xl overflow-hidden my-4"
      style={{ border: "1px solid #e5e5e7", backgroundColor: "#f8f8f8" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid #e5e5e7", backgroundColor: "#f2f2f2" }}
      >
        <span className="text-[11px] font-mono" style={{ color: "#aeaeb2" }}>code</span>
        <div className="flex gap-1.5">
          {["#f87171", "#fbbf24", "#4ade80"].map((c, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, opacity: 0.65 }} />
          ))}
        </div>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6" style={{ color: "#1a1a1a" }}>
        {children}
      </pre>
    </div>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#111113]">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="my-4 px-4 py-3 rounded-xl text-[14px] italic"
      style={{ backgroundColor: "#f4f4f5", borderLeft: "3px solid #d1d1d6", color: "#6e6e80" }}
    >
      {children}
    </blockquote>
  ),
};

export default function ChatPanel() {
  const { activeMessages, activeSessionId, addMessage } = useChatContext();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const messages  = activeMessages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    addMessage(userMsg);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg.content }),
      });

      const data = await res.json().catch(() => ({})) as Partial<AskResponse> & { detail?: string };

      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "Request failed.";
        throw new Error(detail);
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "No answer generated. Please try again.",
        citations: data.citations || [],
        evidenceScore: data.evidence_score,
        bestEvidenceScore: data.best_evidence_score,
        currentEvidenceScore: data.current_evidence_score,
        fromCache: data.from_cache ?? false,
      });
    } catch (error) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: buildErrorMessage(error),
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="relative w-full flex flex-col items-center bg-[#f7f7f8] min-h-screen pb-40">

      {/* ── Chat Feed ─────────────────────────────────────── */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-10 pb-6">
        <AnimatePresence mode="popLayout">

          {/* ── Empty State ─────────────────────────────────── */}
          {messages.length === 0 && !isLoading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center pt-12"
            >
              {/* Three.js Orb */}
              <div className="mb-6">
                <OrbCanvas size={148} isThinking={isLoading} />
              </div>

              <h2 className="text-[26px] font-semibold text-[#111113] tracking-tight mb-1.5">
                How can I help?
              </h2>
              <p className="text-[14px] text-[#a0a0ab] mb-10 text-center">
                Ask anything about the Next.js Agentic RAG system.
              </p>

              {/* Suggestion cards */}
              <div className="grid grid-cols-3 gap-2.5 w-full">
                {[
                  { title: "Rendering modes",  sub: "Static vs Dynamic" },
                  { title: "Caching strategy", sub: "Next.js 15" },
                  { title: "Streaming & Suspense", sub: "React patterns" },
                ].map(({ title, sub }, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(
                      i === 0 ? "What is the difference between static and dynamic rendering in App Router?" :
                      i === 1 ? "How does the cache mechanism work in Next.js 15?" :
                                "How do I implement streaming and Suspense boundaries?"
                    )}
                    className="text-left bg-white hover:bg-[#fafafa] rounded-2xl px-4 py-4 transition-all duration-200 cursor-pointer"
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
                    }}
                  >
                    <p className="text-[13px] font-medium text-[#1c1c1e] leading-snug">{title}</p>
                    <p className="text-[12px] text-[#a0a0ab] mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Message Thread ──────────────────────────────── */}
          {(messages.length > 0 || isLoading) && (
            <div className="space-y-8">
              {messages.filter(m => m.content).map(msg => {
                const isAssistantError = msg.role === "assistant" && msg.isError;
                const hasResponseMeta =
                  !isAssistantError &&
                  (
                    typeof msg.evidenceScore === "number" ||
                    typeof msg.bestEvidenceScore === "number" ||
                    typeof msg.currentEvidenceScore === "number" ||
                    typeof msg.fromCache === "boolean"
                  );
                const parsedCitations = (msg.citations ?? []).map(parseCitation);

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "user" ? (
                      /* ── User Bubble ─── */
                      <div className="max-w-[75%] text-[#1c1c1e] text-[15px] leading-[1.65] px-5 py-3.5 rounded-[22px] rounded-tr-[6px]"
                        style={{
                          backgroundColor: "#f0f0f3",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      /* ── Assistant Response ─── */
                      <div className="w-full">
                        <div className="flex items-start gap-3.5">
                          {/* mini orb */}
                          <div className="shrink-0 mt-1">
                            <OrbCanvas size={28} isThinking={false} />
                          </div>
                          {/* Markdown output */}
                          <div
                            className={`flex-1 text-[15px] text-[#1a1a1a] leading-[1.75] ${isAssistantError ? "rounded-[24px] px-5 py-4" : ""}`}
                            style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                              ...(isAssistantError ? {
                                backgroundColor: "#fff7f7",
                                border: "1px solid #f3d6d8",
                              } : {}),
                            }}
                          >
                            {isAssistantError && (
                              <div
                                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-3 text-[11px] font-medium"
                                style={{
                                  backgroundColor: "#fff1f2",
                                  border: "1px solid #f5c2c7",
                                  color: "#b42318",
                                }}
                              >
                                <AlertCircle size={12} />
                                Request failed
                              </div>
                            )}

                            <ReactMarkdown components={markdownComponents}>
                              {msg.content}
                            </ReactMarkdown>

                            {hasResponseMeta && (
                              <div className="flex flex-wrap gap-2 mt-4">
                                <div
                                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium"
                                  style={{
                                    backgroundColor: msg.fromCache ? "#effaf4" : "#f4f6fb",
                                    border: `1px solid ${msg.fromCache ? "#cdebd8" : "#dce3f0"}`,
                                    color: msg.fromCache ? "#1f7a45" : "#52607a",
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: msg.fromCache ? "#1f7a45" : "#73839e" }}
                                  />
                                  {msg.fromCache ? "Warm cache" : "Fresh retrieval"}
                                </div>

                                {[
                                  { label: "Evidence", value: msg.evidenceScore },
                                  { label: "Best", value: msg.bestEvidenceScore },
                                  { label: "Current", value: msg.currentEvidenceScore },
                                ].map(({ label, value }) => (
                                  <div
                                    key={label}
                                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                                    style={{
                                      backgroundColor: "#fbfbfc",
                                      border: "1px solid #ececef",
                                    }}
                                  >
                                    <span className="text-[10px] uppercase tracking-[0.12em] text-[#8e8e93]">{label}</span>
                                    <span className="text-[12px] font-semibold text-[#111113] tabular-nums">{formatScore(value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Citations */}
                            {parsedCitations.length > 0 && (
                              <div className="grid gap-2.5 mt-4 pt-3 sm:grid-cols-2" style={{ borderTop: "1px solid #f0f0f0" }}>
                                {parsedCitations.map((citation, i) => (
                                  <div
                                    key={`${citation.raw}-${i}`}
                                    className={`min-w-0 rounded-2xl px-3.5 py-3 transition-colors ${citation.sourceHref ? "cursor-pointer" : ""}`}
                                    style={{
                                      backgroundColor: "#fafafa",
                                      border: "1px solid #ececef",
                                    }}
                                    title={citation.fullPath}
                                    role={citation.sourceHref ? "link" : undefined}
                                    tabIndex={citation.sourceHref ? 0 : undefined}
                                    onClick={() => {
                                      if (citation.sourceHref) {
                                        window.open(citation.sourceHref, "_blank", "noopener,noreferrer");
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (!citation.sourceHref) return;
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        window.open(citation.sourceHref, "_blank", "noopener,noreferrer");
                                      }
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="truncate text-[12px] font-semibold text-[#1c1c1e]">
                                            {citation.filename}
                                          </span>
                                          {citation.isWebSearch && (
                                            <span
                                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                                              style={{
                                                backgroundColor: "#fff4e8",
                                                border: "1px solid #f2d2a6",
                                                color: "#9a5d12",
                                              }}
                                            >
                                              Web
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-1 truncate font-mono text-[11px] text-[#8e8e93]">
                                          {citation.compactPath}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {citation.sourceHref && (
                                          <a
                                            href={citation.sourceHref}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(event) => event.stopPropagation()}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl transition-colors"
                                            style={{
                                              backgroundColor: "#ffffff",
                                              border: "1px solid #e5e5e7",
                                              color: "#6e6e80",
                                            }}
                                            title={citation.isWebSearch ? "Open link" : "Open source on GitHub"}
                                          >
                                            <ExternalLink size={14} />
                                          </a>
                                        )}
                                        {citation.downloadHref && (
                                          <a
                                            href={citation.downloadHref}
                                            onClick={(event) => event.stopPropagation()}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl transition-colors"
                                            style={{
                                              backgroundColor: "#ffffff",
                                              border: "1px solid #e5e5e7",
                                              color: "#6e6e80",
                                            }}
                                            title="Download source file"
                                          >
                                            <Download size={14} />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Thinking indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3.5"
                >
                  <div className="shrink-0">
                    <OrbCanvas size={28} isThinking={true} />
                  </div>
                  <div className="flex gap-1 items-center">
                    {[0,1,2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: "#c7c7cc",
                          animation: `orbPulse 1.1s ease-in-out ${i * 0.18}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* ── Fixed Input Bar ─────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 flex flex-col items-center px-4 pb-5 pt-6 bg-gradient-to-t from-[#f7f7f8] via-[#f7f7f8]/90 to-transparent z-50">
        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-2xl bg-white rounded-[20px] transition-all"
          style={{
            border: "1px solid rgba(0,0,0,0.09)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 8px 28px rgba(0,0,0,0.04)",
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask the Agentic RAG engine..."
            className="w-full bg-transparent text-[15px] text-[#1c1c1e] placeholder-[#a0a0ab] px-5 py-[17px] pr-16 focus:outline-none rounded-[20px]"
            disabled={isLoading}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer disabled:cursor-not-allowed"
            style={{ backgroundColor: !input.trim() || isLoading ? "#d1d1d6" : "#0d0d0d" }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </form>

        {/* AI Disclaimer */}
        <p className="mt-2.5 text-[11px] text-[#c7c7cc] text-center">
          A-RAG can make mistakes. Consider verifying important information.
        </p>
      </div>
    </section>
  );
}
