"use client";

import { useEffect, useRef } from "react";
import {
  Newspaper,
  TrendingDown,
  PackageSearch,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
} from "lucide-react";

export type AgentState = "waiting" | "running" | "done" | "failed";

export interface AgentStatus {
  id: string;
  label: string;
  count?: number;
  state: AgentState;
}

export interface LiveFinding {
  id: string;
  agentLabel: string;
  text: string;
  tag?: string;
  tagColor?: string;
}

interface AgentRunPanelProps {
  agents: AgentStatus[];
  liveFeed: LiveFinding[];
  doneCount: number;
  totalCount: number;
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  news_dth:          <Newspaper className="w-4 h-4" />,
  news_ott:          <Newspaper className="w-4 h-4" />,
  news_isp:          <Newspaper className="w-4 h-4" />,
  pm_dth:            <TrendingDown className="w-4 h-4" />,
  pm_ott:            <TrendingDown className="w-4 h-4" />,
  pricing:           <PackageSearch className="w-4 h-4" />,
  deactivation:      <TrendingDown className="w-4 h-4" />,
  report_generation: <FileText className="w-4 h-4" />,
};

const STATE_STYLES: Record<AgentState, { bg: string; icon: string; label: string; dot: string }> = {
  waiting: {
    bg: "bg-slate-50 dark:bg-slate-900/30",
    icon: "text-slate-300 dark:text-slate-600",
    label: "text-slate-400",
    dot: "bg-slate-300 dark:bg-slate-600",
  },
  running: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    icon: "text-blue-500",
    label: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  done: {
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    icon: "text-emerald-500",
    label: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  failed: {
    bg: "bg-red-50 dark:bg-red-950/20",
    icon: "text-red-400",
    label: "text-red-500",
    dot: "bg-red-400",
  },
};

function AgentCard({ agent }: { agent: AgentStatus }) {
  const icon = AGENT_ICONS[agent.id] ?? <Wifi className="w-4 h-4" />;
  const s = STATE_STYLES[agent.state];

  return (
    <div className={`relative flex flex-col items-center gap-1.5 p-3 transition-colors ${s.bg}`}>
      {/* State indicator dot */}
      <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${s.dot} ${agent.state === "running" ? "animate-pulse" : ""}`} />

      {/* Icon */}
      <div className={`transition-colors ${s.icon}`}>
        {agent.state === "running" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : agent.state === "done" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : agent.state === "failed" ? (
          <XCircle className="w-4 h-4" />
        ) : (
          icon
        )}
      </div>

      {/* Label */}
      <p className="text-[10px] font-semibold text-center leading-tight text-foreground/70 truncate w-full text-center">
        {agent.label}
      </p>

      {/* Count / status line */}
      <p className={`text-[10px] font-medium ${s.label}`}>
        {agent.state === "done" && agent.count !== undefined
          ? `${agent.count} found`
          : agent.state === "done"
          ? "done"
          : agent.state === "running"
          ? "scanning…"
          : agent.state === "failed"
          ? "failed"
          : "queued"}
      </p>
    </div>
  );
}

export function AgentRunPanel({ agents, liveFeed, doneCount, totalCount }: AgentRunPanelProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [liveFeed.length]);

  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-xl overflow-hidden shadow-md border border-white/[0.06] bg-[#07101f]">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="text-white text-sm font-semibold tracking-tight">Intelligence agents running</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-white/40 text-xs tabular-nums">{doneCount}/{totalCount} complete</span>
          <div className="relative w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-white/60 text-xs font-medium tabular-nums w-8 text-right">{pct}%</span>
        </div>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-white/[0.04] border-b border-white/[0.06]">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Live findings feed */}
      <div className="bg-[#050c18]">
        <div className="px-3 py-1.5 border-b border-white/[0.05] flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
            Live findings
          </span>
        </div>
        <div
          ref={feedRef}
          className="h-36 overflow-y-auto p-3 space-y-1.5 font-mono scrollbar-thin"
        >
          {liveFeed.length === 0 ? (
            <p className="text-xs text-white/20 italic">
              Waiting for first results…
            </p>
          ) : (
            liveFeed.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-2 text-xs animate-in fade-in slide-in-from-bottom-1 duration-300"
              >
                <span className="text-emerald-500 shrink-0 mt-px select-none">›</span>
                <span className="text-white/30 shrink-0 font-medium">[{f.agentLabel}]</span>
                <span className="flex-1 min-w-0 truncate text-white/70">{f.text}</span>
                {f.tag && (
                  <span className={`shrink-0 text-[10px] font-medium ${f.tagColor ?? "text-amber-400"}`}>
                    {f.tag}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
