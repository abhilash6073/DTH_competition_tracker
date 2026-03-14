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
  news_dth:          <Newspaper className="w-3.5 h-3.5" />,
  news_ott:          <Newspaper className="w-3.5 h-3.5" />,
  news_isp:          <Newspaper className="w-3.5 h-3.5" />,
  pm_dth:            <TrendingDown className="w-3.5 h-3.5" />,
  pm_ott:            <TrendingDown className="w-3.5 h-3.5" />,
  pricing:           <PackageSearch className="w-3.5 h-3.5" />,
  deactivation:      <TrendingDown className="w-3.5 h-3.5" />,
  report_generation: <FileText className="w-3.5 h-3.5" />,
};

function AgentCard({ agent }: { agent: AgentStatus }) {
  const icon = AGENT_ICONS[agent.id] ?? <Wifi className="w-3.5 h-3.5" />;

  return (
    <div
      className={`flex flex-col gap-1 p-3 transition-colors ${
        agent.state === "done"
          ? "bg-green-50 dark:bg-green-950/20"
          : agent.state === "failed"
          ? "bg-red-50 dark:bg-red-950/20"
          : agent.state === "running"
          ? "bg-blue-50 dark:bg-blue-950/20"
          : "bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`${
          agent.state === "done" ? "text-green-600" :
          agent.state === "failed" ? "text-red-500" :
          agent.state === "running" ? "text-blue-500" :
          "text-muted-foreground"
        }`}>
          {icon}
        </span>
        {agent.state === "running" && (
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
        )}
        {agent.state === "done" && (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        )}
        {agent.state === "failed" && (
          <XCircle className="w-3 h-3 text-red-500" />
        )}
      </div>
      <p className="text-[11px] font-medium leading-tight truncate">{agent.label}</p>
      {agent.state === "done" && agent.count !== undefined && (
        <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">
          {agent.count} found
        </p>
      )}
      {agent.state === "running" && (
        <p className="text-[10px] text-blue-500">scanning…</p>
      )}
      {agent.state === "waiting" && (
        <p className="text-[10px] text-muted-foreground">waiting</p>
      )}
      {agent.state === "failed" && (
        <p className="text-[10px] text-red-500">failed</p>
      )}
    </div>
  );
}

export function AgentRunPanel({ agents, liveFeed, doneCount, totalCount }: AgentRunPanelProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll feed to bottom on new findings
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [liveFeed.length]);

  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-xl border overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
          <span className="text-white text-sm font-semibold">Intelligence agents running</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-100 text-xs">{doneCount}/{totalCount} complete</span>
          <div className="w-20 h-1.5 bg-blue-400/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-border border-b">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Live findings feed */}
      <div className="bg-muted/20">
        <div className="px-3 py-1.5 border-b flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Live findings
          </span>
        </div>
        <div
          ref={feedRef}
          className="h-36 overflow-y-auto p-3 space-y-1.5 font-mono"
        >
          {liveFeed.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Waiting for first results…
            </p>
          ) : (
            liveFeed.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-2 text-xs animate-in fade-in slide-in-from-bottom-1 duration-300"
              >
                <span className="text-green-500 shrink-0 mt-px">›</span>
                <span className="text-muted-foreground shrink-0">[{f.agentLabel}]</span>
                <span className="flex-1 min-w-0 truncate text-foreground">{f.text}</span>
                {f.tag && (
                  <span className={`shrink-0 text-[10px] font-medium ${f.tagColor ?? "text-amber-600"}`}>
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
