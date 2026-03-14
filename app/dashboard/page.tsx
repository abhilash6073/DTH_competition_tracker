"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  ReportJSON,
  SSEEvent,
  RunConfig,
  CompetitorNewsItem,
  LaunchItem,
  PlansPack,
  EventCorrelation,
} from "@/agents/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CompetitorNewsWidget } from "@/components/dashboard/CompetitorNewsWidget";
import { PricingTable } from "@/components/dashboard/PricingTable";
import { DeactivationChart } from "@/components/dashboard/DeactivationChart";
import { RecommendationsList } from "@/components/dashboard/RecommendationsList";
import {
  AgentRunPanel,
  AgentStatus,
  AgentState,
  LiveFinding,
} from "@/components/dashboard/AgentRunPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PDFDownloadButton } from "@/components/report/PDFDownloadButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Newspaper,
  TrendingDown,
  PackageSearch,
  Lightbulb,
  Activity,
  AlertTriangle,
  Shield,
  Star,
  Loader2,
} from "lucide-react";
import { generateSuggestedQuestions } from "@/agents/chatbot";

const IndiaDeactivationMap = dynamic(
  () =>
    import("@/components/dashboard/IndiaDeactivationMap").then(
      (m) => m.IndiaDeactivationMap
    ),
  { ssr: false, loading: () => <Skeleton className="w-full h-[500px] rounded-xl" /> }
);

type RunStatus = "idle" | "running" | "done" | "error";

const WINDOW_OPTIONS = [
  { label: "1 day",   value: 1 },
  { label: "3 days",  value: 3 },
  { label: "7 days",  value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

const AGENT_DEFS: { id: string; label: string }[] = [
  { id: "news_dth",          label: "DTH News" },
  { id: "news_ott",          label: "OTT News" },
  { id: "news_isp",          label: "ISP News" },
  { id: "pm_dth",            label: "DTH PM" },
  { id: "pm_ott",            label: "OTT PM" },
  { id: "pricing",           label: "Pricing" },
  { id: "deactivation",      label: "Deactivation" },
  { id: "report_generation", label: "Report" },
];

function EmptyTabState({ onRun }: { onRun: () => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed p-10 text-center space-y-3">
      <Activity className="w-10 h-10 mx-auto text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Run a report to populate this view.</p>
      <Button onClick={onRun} size="sm" variant="outline">
        <Play className="w-3.5 h-3.5 mr-1.5" />
        Run Report
      </Button>
    </div>
  );
}

function TabLoadingSkeleton() {
  return (
    <div className="space-y-3 mt-1">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="w-full h-16 rounded-lg" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [report, setReport]           = useState<ReportJSON | null>(null);
  const [status, setStatus]           = useState<RunStatus>("idle");
  const [errorMsg, setErrorMsg]       = useState<string>("");
  const [windowDays, setWindowDays]   = useState(7);

  // Streamed partial data — populated as each agent finishes
  const [streamedNews, setStreamedNews]               = useState<CompetitorNewsItem[]>([]);
  const [streamedLaunches, setStreamedLaunches]       = useState<LaunchItem[]>([]);
  const [streamedPacks, setStreamedPacks]             = useState<PlansPack[]>([]);
  const [streamedCorrelations, setStreamedCorrelations] = useState<EventCorrelation[]>([]);

  // Agent status grid
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});

  // Live findings feed
  const [liveFeed, setLiveFeed]       = useState<LiveFinding[]>([]);
  const feedIdRef                     = useRef(0);

  function addToFeed(finding: Omit<LiveFinding, "id">) {
    setLiveFeed((prev) =>
      [...prev, { ...finding, id: String(feedIdRef.current++) }].slice(-30)
    );
  }

  const resetStreams = () => {
    setStreamedNews([]);
    setStreamedLaunches([]);
    setStreamedPacks([]);
    setStreamedCorrelations([]);
    setAgentStates({});
    setAgentCounts({});
    setLiveFeed([]);
    setReport(null);
  };

  const runReport = useCallback(async () => {
    setStatus("running");
    setErrorMsg("");
    resetStreams();

    const config: Partial<RunConfig> = {
      regions_or_pincodes: ["400001", "560001", "110001", "600001", "700001"],
      news_time_window_days: windowDays,
      plans_time_window_days: windowDays,
      deactivation_window_days: windowDays,
      max_items_per_section: 10,
    };

    // Mark all agents as waiting
    setAgentStates(
      Object.fromEntries(AGENT_DEFS.map((a) => [a.id, "waiting" as AgentState]))
    );

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream from server");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;
            handleSSEEvent(event);
          } catch { /* skip malformed */ }
        }
      }

      setStatus("done");
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

  function handleSSEEvent(event: SSEEvent) {
    const taskId = event.taskId ?? "";

    if (event.type === "task_started") {
      setAgentStates((prev) => ({ ...prev, [taskId]: "running" }));
    }

    if (event.type === "task_failed") {
      setAgentStates((prev) => ({ ...prev, [taskId]: "failed" }));
    }

    if (event.type === "task_completed") {
      const d = event.data as Record<string, unknown>;
      const count = (d.count as number) ?? 0;

      setAgentStates((prev) => ({ ...prev, [taskId]: "done" }));
      setAgentCounts((prev) => ({ ...prev, [taskId]: count }));

      // Accumulate partial data & push to live feed
      if ((taskId === "news_dth" || taskId === "news_ott" || taskId === "news_isp") && d.items) {
        const items = d.items as CompetitorNewsItem[];
        setStreamedNews((prev) => {
          const merged = [...prev, ...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
          return merged;
        });
        items.slice(0, 2).forEach((item) =>
          addToFeed({
            agentLabel: taskId === "news_dth" ? "DTH" : taskId === "news_ott" ? "OTT" : "ISP",
            text: `${item.entity}: ${item.title}`,
            tag: item.sentiment === "negative" ? "⚠ negative" : undefined,
            tagColor: "text-red-500",
          })
        );
      }

      if ((taskId === "pm_dth" || taskId === "pm_ott") && d.items) {
        const items = d.items as LaunchItem[];
        setStreamedLaunches((prev) => {
          const merged = [...prev, ...items].sort(
            (a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay
          );
          return merged;
        });
        items.slice(0, 2).forEach((item) =>
          addToFeed({
            agentLabel: taskId === "pm_dth" ? "DTH PM" : "OTT PM",
            text: `${item.entity}: ${item.title}`,
            tag: `⚠ Threat ${item.pmAnalysis.threatScoreToTataPlay}/10`,
            tagColor: item.pmAnalysis.threatScoreToTataPlay >= 7 ? "text-red-500" : "text-amber-500",
          })
        );
      }

      if (taskId === "pricing" && d.packs) {
        const packs = d.packs as PlansPack[];
        setStreamedPacks(packs);
        packs.slice(0, 2).forEach((p) =>
          addToFeed({
            agentLabel: "Pricing",
            text: `${p.operator} — ${p.packName} ₹${p.monthlyPrice}/mo`,
          })
        );
      }

      if (taskId === "deactivation" && d.correlations) {
        const corrs = d.correlations as EventCorrelation[];
        setStreamedCorrelations(corrs);
        corrs.slice(0, 2).forEach((c) =>
          addToFeed({
            agentLabel: "Deactivation",
            text: `${c.event.name} → ${c.deactivationDelta > 0 ? "+" : ""}${c.deactivationDelta}% in ${c.affectedRegion}`,
            tag: c.confidence === "high" ? "high confidence" : undefined,
            tagColor: "text-blue-500",
          })
        );
      }

      if (taskId === "report_generation") {
        addToFeed({ agentLabel: "Report", text: "Final report synthesised ✓" });
      }
    }

    if (event.type === "run_complete" && event.data) {
      const d = event.data as { report?: ReportJSON };
      if (d.report) setReport(d.report);
    }

    if (event.type === "error") {
      setErrorMsg(event.error || "Unknown error");
      setStatus("error");
    }
  }

  // Data to render: prefer final report, fall back to streamed partial data
  const displayNews          = report?.competitor_news     ?? streamedNews;
  const displayLaunches      = report?.launches            ?? streamedLaunches;
  const displayPacks         = report?.plans_and_packs     ?? streamedPacks;
  const displayCorrelations  = report?.events_correlation  ?? streamedCorrelations;

  const topThreat = displayLaunches
    .slice()
    .sort((a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay)[0];

  const suggestedQuestions = generateSuggestedQuestions(report);

  const agentStatusList: AgentStatus[] = AGENT_DEFS.map((a) => ({
    id: a.id,
    label: a.label,
    state: agentStates[a.id] ?? "waiting",
    count: agentCounts[a.id],
  }));

  const doneCount = agentStatusList.filter((a) => a.state === "done" || a.state === "failed").length;

  // Which tabs have at least some data
  const newsLoading          = status === "running" && displayNews.length === 0;
  const packsLoading         = status === "running" && displayPacks.length === 0;
  const deactivationLoading  = status === "running" && displayCorrelations.length === 0;
  const recoLoading          = status === "running" && !report;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Tata Play Intelligence</h1>
              <p className="text-xs text-muted-foreground">D2H + OTT Competitor Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Time window selector */}
            <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setWindowDays(opt.value)}
                  disabled={status === "running"}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    windowDays === opt.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {report && (
              <PDFDownloadButton reportId={report.reportId} className="h-8 text-xs" />
            )}
            <Button
              onClick={runReport}
              disabled={status === "running"}
              size="sm"
              className="h-8"
            >
              {status === "running" ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5" />
              )}
              {status === "running" ? "Running…" : "Run Report"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Live agent panel — only during run */}
        {status === "running" && (
          <AgentRunPanel
            agents={agentStatusList}
            liveFeed={liveFeed}
            doneCount={doneCount}
            totalCount={AGENT_DEFS.length}
          />
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="rounded-lg border border-red-200 p-4 bg-red-50 dark:bg-red-950/20">
            <p className="text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="inline w-4 h-4 mr-1" />
              Error: {errorMsg}
            </p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            title="News Items"
            value={displayNews.length || (status === "idle" ? "—" : 0)}
            subtitle={`Last ${report?.config?.news_time_window_days ?? windowDays} days`}
            icon={<Newspaper className="w-3.5 h-3.5" />}
            badge={status === "done" ? "Live" : status === "running" ? "Streaming" : undefined}
            badgeVariant="secondary"
            tooltip="Competitor news items tracked across DTH, OTT, and ISP operators."
          />
          <MetricCard
            title="Top Threat"
            value={topThreat ? `${topThreat.pmAnalysis.threatScoreToTataPlay}/10` : "—"}
            subtitle={topThreat?.entity ?? "No threats detected"}
            icon={<Shield className="w-3.5 h-3.5" />}
            trend={(topThreat?.pmAnalysis.threatScoreToTataPlay ?? 0) >= 7 ? "down" : "neutral"}
            tooltip="Highest threat score from competitor product launches."
          />
          <MetricCard
            title="Packs Analyzed"
            value={displayPacks.length || (status === "idle" ? "—" : 0)}
            subtitle="Across all regions"
            icon={<PackageSearch className="w-3.5 h-3.5" />}
            tooltip="Subscription packs retrieved and compared across DTH operators."
          />
          <MetricCard
            title="Deactivation Signals"
            value={displayCorrelations.length || (status === "idle" ? "—" : 0)}
            subtitle="Event correlations"
            icon={<TrendingDown className="w-3.5 h-3.5" />}
            tooltip="External events correlated with deactivation patterns."
          />
          <MetricCard
            title="Quality Score"
            value={report?.qualityScore ? `${report.qualityScore}/10` : "—"}
            subtitle="Report completeness"
            icon={<Star className="w-3.5 h-3.5" />}
            tooltip="Internal quality score based on data coverage and completeness."
          />
        </div>

        {/* Tabs — always visible */}
        <Tabs defaultValue="deactivations">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="news">
                <Newspaper className="w-3.5 h-3.5 mr-1.5" />
                News
                {displayNews.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full px-1.5 py-0.5 font-medium">
                    {displayNews.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="packs">
                <PackageSearch className="w-3.5 h-3.5 mr-1.5" />
                Packs
                {displayPacks.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full px-1.5 py-0.5 font-medium">
                    {displayPacks.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="deactivations">
                <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                Deactivations
              </TabsTrigger>
              <TabsTrigger value="recommendations">
                <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                Recommendations
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              {report?.dataGaps && report.dataGaps.length > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {report.dataGaps.length} data gaps
                </Badge>
              )}
              {report && (
                <span className="text-xs text-muted-foreground">
                  Generated{" "}
                  {new Date(report.generatedAt).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </span>
              )}
            </div>
          </div>

          <TabsContent value="news" className="mt-4">
            {newsLoading ? <TabLoadingSkeleton /> :
             displayNews.length > 0 ? <CompetitorNewsWidget items={displayNews} maxItems={15} /> :
             <EmptyTabState onRun={runReport} />}
          </TabsContent>

          <TabsContent value="packs" className="mt-4">
            {packsLoading ? <TabLoadingSkeleton /> :
             displayPacks.length > 0 ? <PricingTable packs={displayPacks} /> :
             <EmptyTabState onRun={runReport} />}
          </TabsContent>

          <TabsContent value="deactivations" className="mt-4 space-y-6">
            <IndiaDeactivationMap correlations={displayCorrelations} />
            {deactivationLoading && <TabLoadingSkeleton />}
            {displayCorrelations.length > 0 && (
              <DeactivationChart correlations={displayCorrelations} />
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            {recoLoading ? <TabLoadingSkeleton /> :
             report ? <RecommendationsList recommendations={report.recommendations} /> :
             <EmptyTabState onRun={runReport} />}
          </TabsContent>
        </Tabs>

        {/* Data gaps footer */}
        {report && report.dataGaps.length > 0 && (
          <>
            <Separator />
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 p-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
                ⚠️ Confidence & Limitations — Manual Validation Required
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                {report.dataGaps.slice(0, 6).map((g, i) => (
                  <li key={i}>
                    <strong>{g.field}:</strong> {g.reason}
                    {" → "}
                    <span className="italic">{g.suggestedSource}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>

      <ChatPanel
        suggestedQuestions={suggestedQuestions}
        reportId={report?.reportId || "latest"}
      />
    </div>
  );
}
