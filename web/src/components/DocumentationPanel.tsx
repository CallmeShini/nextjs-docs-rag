"use client";

import { Brain, ChevronRight, FileText, GitBranch, Search, ShieldCheck } from "lucide-react";

export default function DocumentationPanel() {
  return (
    <section
      className="h-full flex flex-col relative z-10"
      style={{
        backgroundColor: "#ffffff",
        borderRight: "1px solid rgba(0,0,0,0.07)",
      }}
    >
      <div className="p-6">
        <h2 className="text-[15px] font-semibold text-[#111113] tracking-tight mb-5">
          Project Context
        </h2>

        <div
          className="rounded-2xl p-5 transition-all duration-200"
          style={{
            background: "linear-gradient(145deg, #fafafa 0%, #f5f5f7 100%)",
            border: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
          }}
        >
          <div className="flex items-start gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(124,58,237,0.1) 100%)",
                border: "1px solid rgba(37,99,235,0.15)",
              }}
            >
              <Brain size={18} style={{ color: "#2563eb" }} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1c1c1e] mb-1">A-RAG Next.js</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "#6b6b7a" }}>
                Agentic RAG over the official Next.js documentation with explicit evidence memory,
                hybrid retrieval, and source traceability.
              </p>
            </div>
          </div>

          <div
            className="mt-4 pt-4 text-[11px]"
            style={{ borderTop: "1px solid rgba(0,0,0,0.06)", color: "#a0a0ab" }}
          >
            Created by Gabriel R. · CallmeShini
          </div>
        </div>
      </div>

      <div className="px-6 pt-0 pb-4">
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#a0a0ab" }}>
          <span className="hover:text-[#1c1c1e] cursor-pointer transition-colors">System</span>
          <ChevronRight size={12} />
          <span className="font-medium" style={{ color: "#1c1c1e" }}>Current Decisions</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
        <DocRecord
          icon={<GitBranch size={15} style={{ color: "#2563eb" }} />}
          iconBg="rgba(37,99,235,0.08)"
          name="Explicit Graph"
          status="LangGraph"
          statusColor="#2563eb"
          statusBg="rgba(37,99,235,0.08)"
          desc="Planner, router, retrieval loop, evidence memory, synthesizer"
          active
        />
        <DocRecord
          icon={<Search size={15} style={{ color: "#7c3aed" }} />}
          iconBg="rgba(124,58,237,0.08)"
          name="Hybrid Retrieval"
          status="BM25 + Vector"
          statusColor="#7c3aed"
          statusBg="rgba(124,58,237,0.08)"
          desc="Exact-match retrieval plus semantic retrieval on the same corpus"
        />
        <DocRecord
          icon={<ShieldCheck size={15} style={{ color: "#059669" }} />}
          iconBg="rgba(5,150,105,0.08)"
          name="Traceability"
          status="Citations"
          statusColor="#059669"
          statusBg="rgba(5,150,105,0.08)"
          desc="Answers expose scores, citations, GitHub links, and source download"
        />
        <DocRecord
          icon={<FileText size={15} style={{ color: "#d97706" }} />}
          iconBg="rgba(217,119,6,0.08)"
          name="Documentation"
          status="/docs"
          statusColor="#d97706"
          statusBg="rgba(217,119,6,0.08)"
          desc="Architecture, decisions, limitations, benchmarking, and authorship"
        />
      </div>
    </section>
  );
}

function DocRecord({
  icon,
  iconBg,
  name,
  status,
  statusColor,
  statusBg,
  desc,
  active = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  status: string;
  statusColor: string;
  statusBg: string;
  desc: string;
  active?: boolean;
}) {
  return (
    <div
      className="flex items-center p-3 rounded-xl transition-all duration-150 cursor-default"
      style={
        active
          ? {
              backgroundColor: "#f5f5f7",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }
          : {
              border: "1px solid transparent",
            }
      }
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "#f9f9fb";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.06)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLElement).style.borderColor = "transparent";
        }
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mr-3.5 shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[13px] font-medium truncate" style={{ color: "#1c1c1e" }}>
          {name}
        </h4>
        <div className="text-[11px] truncate mt-0.5" style={{ color: "#a0a0ab" }}>
          {desc}
        </div>
      </div>
      <div className="shrink-0 ml-3">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
          style={{ color: statusColor, backgroundColor: statusBg }}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
