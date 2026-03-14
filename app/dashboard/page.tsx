"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  ReportJSON,
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
import { generateSuggestedQuestions } from "@/agents/chatbot-client";

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

  // Deactivation region tracking
  const deactivationRegionsRef = useRef<string[]>([]);
  const deactivationDoneRef    = useRef(0);

  const runReport = useCallback(async () => {
    setStatus("running");
    setErrorMsg("");
    resetStreams();

    const config: RunConfig = {
      regions_or_pincodes: ["400001", "560001", "110001", "600001", "700001"],
      news_time_window_days: windowDays,
      plans_time_window_days: windowDays,
      deactivation_window_days: windowDays,
      max_items_per_section: 10,
    };

    // Derive mock region keys the deactivation agent will produce
    const deactivationRegions = config.regions_or_pincodes.map(
      (p) => `Region-${p.slice(0, 3)}`
    );
    deactivationRegionsRef.current = deactivationRegions;
    deactivationDoneRef.current = 0;

    // Mark all agents as running
    setAgentStates(
      Object.fromEntries(AGENT_DEFS.map((a) => [a.id, "running" as AgentState]))
    );

    async function callAgent<T>(
      url: string,
      body: Record<string, unknown>,
      onSuccess: (data: T) => void,
      taskId: string
    ) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data: T = await res.json();
        onSuccess(data);
        setAgentStates((prev) => ({ ...prev, [taskId]: "done" }));
        return data;
      } catch (err) {
        console.error(`[${taskId}]`, err);
        setAgentStates((prev) => ({ ...prev, [taskId]: "failed" }));
        return null;
      }
    }

    try {
      // ── Phase 1: all agents in parallel ─────────────────────────────────────

      const [newsDth, newsOtt, newsIsp, pmDth, pmOtt, pricingRes, ...deactivationResults] =
        await Promise.all([
          // News agents
          callAgent<{ items: CompetitorNewsItem[] }>(
            "/api/agents/news", { config, category: "dth" }, (d) => {
              setStreamedNews((prev) => [...prev, ...d.items].sort((a, b) => b.relevanceScore - a.relevanceScore));
              setAgentCounts((prev) => ({ ...prev, news_dth: d.items.length }));
              d.items.slice(0, 2).forEach((item) =>
                addToFeed({ agentLabel: "DTH", text: `${item.entity}: ${item.title}`, tag: item.sentiment === "negative" ? "⚠ negative" : undefined, tagColor: "text-red-500" })
              );
            }, "news_dth"
          ),
          callAgent<{ items: CompetitorNewsItem[] }>(
            "/api/agents/news", { config, category: "ott" }, (d) => {
              setStreamedNews((prev) => [...prev, ...d.items].sort((a, b) => b.relevanceScore - a.relevanceScore));
              setAgentCounts((prev) => ({ ...prev, news_ott: d.items.length }));
              d.items.slice(0, 2).forEach((item) =>
                addToFeed({ agentLabel: "OTT", text: `${item.entity}: ${item.title}`, tag: item.sentiment === "negative" ? "⚠ negative" : undefined, tagColor: "text-red-500" })
              );
            }, "news_ott"
          ),
          callAgent<{ items: CompetitorNewsItem[] }>(
            "/api/agents/news", { config, category: "isp" }, (d) => {
              setStreamedNews((prev) => [...prev, ...d.items].sort((a, b) => b.relevanceScore - a.relevanceScore));
              setAgentCounts((prev) => ({ ...prev, news_isp: d.items.length }));
              d.items.slice(0, 2).forEach((item) =>
                addToFeed({ agentLabel: "ISP", text: `${item.entity}: ${item.title}`, tag: item.sentiment === "negative" ? "⚠ negative" : undefined, tagColor: "text-red-500" })
              );
            }, "news_isp"
          ),

          // PM agents
          callAgent<{ items: LaunchItem[] }>(
            "/api/agents/pm", { config, category: "dth" }, (d) => {
              setStreamedLaunches((prev) => [...prev, ...d.items].sort((a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay));
              setAgentCounts((prev) => ({ ...prev, pm_dth: d.items.length }));
              d.items.slice(0, 2).forEach((item) =>
                addToFeed({ agentLabel: "DTH PM", text: `${item.entity}: ${item.title}`, tag: `⚠ Threat ${item.pmAnalysis.threatScoreToTataPlay}/10`, tagColor: item.pmAnalysis.threatScoreToTataPlay >= 7 ? "text-red-500" : "text-amber-500" })
              );
            }, "pm_dth"
          ),
          callAgent<{ items: LaunchItem[] }>(
            "/api/agents/pm", { config, category: "ott" }, (d) => {
              setStreamedLaunches((prev) => [...prev, ...d.items].sort((a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay));
              setAgentCounts((prev) => ({ ...prev, pm_ott: d.items.length }));
              d.items.slice(0, 2).forEach((item) =>
                addToFeed({ agentLabel: "OTT PM", text: `${item.entity}: ${item.title}`, tag: `⚠ Threat ${item.pmAnalysis.threatScoreToTataPlay}/10`, tagColor: item.pmAnalysis.threatScoreToTataPlay >= 7 ? "text-red-500" : "text-amber-500" })
              );
            }, "pm_ott"
          ),

          // Pricing
          callAgent<{ packs: PlansPack[] }>(
            "/api/agents/pricing", { config }, (d) => {
              setStreamedPacks(d.packs);
              setAgentCounts((prev) => ({ ...prev, pricing: d.packs.length }));
              d.packs.slice(0, 2).forEach((p) =>
                addToFeed({ agentLabel: "Pricing", text: `${p.operator} — ${p.packName} ₹${p.monthlyPrice}/mo` })
              );
            }, "pricing"
          ),

          // Deactivation: one call per region — progressive map population
          ...deactivationRegions.map((region) =>
            callAgent<{ correlations: EventCorrelation[] }>(
              "/api/agents/deactivation", { config, region }, (d) => {
                setStreamedCorrelations((prev) => [...prev, ...d.correlations]);
                deactivationDoneRef.current += 1;
                const done = deactivationDoneRef.current;
                const total = deactivationRegionsRef.current.length;
                setAgentCounts((prev) => ({ ...prev, deactivation: (prev.deactivation ?? 0) + d.correlations.length }));
                d.correlations.slice(0, 1).forEach((c) =>
                  addToFeed({
                    agentLabel: `Deactivation (${done}/${total})`,
                    text: `${c.event.name} → ${c.deactivationDelta > 0 ? "+" : ""}${c.deactivationDelta}% in ${c.affectedRegion}`,
                    tag: c.confidence === "high" ? "high confidence" : undefined,
                    tagColor: "text-blue-500",
                  })
                );
                if (done === total) {
                  setAgentStates((prev) => ({ ...prev, deactivation: "done" }));
                }
              }, "deactivation"
            )
          ),
        ]);

      // ── Phase 2: report synthesis ────────────────────────────────────────────

      // Collect all accumulated data from state reads (use latest values via functional updates)
      const allNews: CompetitorNewsItem[] = [
        ...(newsDth?.items ?? []),
        ...(newsOtt?.items ?? []),
        ...(newsIsp?.items ?? []),
      ].sort((a, b) => b.relevanceScore - a.relevanceScore);

      const allLaunches: LaunchItem[] = [
        ...(pmDth?.items ?? []),
        ...(pmOtt?.items ?? []),
      ].sort((a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay);

      const allPacks: PlansPack[] = pricingRes?.packs ?? [];

      const allCorrelations: EventCorrelation[] = deactivationResults
        .flatMap((r) => r?.correlations ?? []);

      addToFeed({ agentLabel: "Report", text: "Synthesising final report…" });

      await callAgent<ReportJSON>(
        "/api/agents/report",
        { config, news: allNews, launches: allLaunches, packs: allPacks, correlations: allCorrelations },
        (reportData) => {
          setReport(reportData);
          addToFeed({ agentLabel: "Report", text: "Final report synthesised ✓" });
        },
        "report_generation"
      );

      setStatus("done");
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

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
      {/* Header — dark navy premium */}
      <header className="sticky top-0 z-40 bg-[#07101f] border-b border-white/[0.06] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-900/50">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Tata Play Intelligence</h1>
              <p className="text-[11px] text-white/40 leading-tight">D2H · OTT · Competitor Tracker</p>
            </div>
          </div>

          {/* Center: time window pill selector */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWindowDays(opt.value)}
                disabled={status === "running"}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  windowDays === opt.value
                    ? "bg-blue-600 text-white shadow"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {report && (
              <PDFDownloadButton reportId={report.reportId} className="h-8 text-xs border-white/20 text-white/80 bg-white/5 hover:bg-white/10" />
            )}
            <Button
              onClick={runReport}
              disabled={status === "running"}
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow shadow-blue-900/50"
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
            accentColor="bg-blue-500"
          />
          <MetricCard
            title="Top Threat"
            value={topThreat ? `${topThreat.pmAnalysis.threatScoreToTataPlay}/10` : "—"}
            subtitle={topThreat?.entity ?? "No threats detected"}
            icon={<Shield className="w-3.5 h-3.5" />}
            trend={(topThreat?.pmAnalysis.threatScoreToTataPlay ?? 0) >= 7 ? "down" : "neutral"}
            tooltip="Highest threat score from competitor product launches."
            accentColor="bg-red-500"
          />
          <MetricCard
            title="Packs Analyzed"
            value={displayPacks.length || (status === "idle" ? "—" : 0)}
            subtitle="Across all regions"
            icon={<PackageSearch className="w-3.5 h-3.5" />}
            tooltip="Subscription packs retrieved and compared across DTH operators."
            accentColor="bg-violet-500"
          />
          <MetricCard
            title="Deactivation Signals"
            value={displayCorrelations.length || (status === "idle" ? "—" : 0)}
            subtitle="Event correlations"
            icon={<TrendingDown className="w-3.5 h-3.5" />}
            tooltip="External events correlated with deactivation patterns."
            accentColor="bg-amber-500"
          />
          <MetricCard
            title="Quality Score"
            value={report?.qualityScore ? `${report.qualityScore}/10` : "—"}
            subtitle="Report completeness"
            icon={<Star className="w-3.5 h-3.5" />}
            tooltip="Internal quality score based on data coverage and completeness."
            accentColor="bg-emerald-500"
          />
        </div>

        {/* Tabs — always visible */}
        <Tabs defaultValue="deactivations">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
            <TabsList className="h-9 p-1 gap-0.5">
              <TabsTrigger value="news" className="h-7 px-3 text-xs gap-1.5">
                <Newspaper className="w-3.5 h-3.5" />
                News
                {displayNews.length > 0 && (
                  <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0 font-semibold tabular-nums">
                    {displayNews.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="packs" className="h-7 px-3 text-xs gap-1.5">
                <PackageSearch className="w-3.5 h-3.5" />
                Packs
                {displayPacks.length > 0 && (
                  <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0 font-semibold tabular-nums">
                    {displayPacks.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="deactivations" className="h-7 px-3 text-xs gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" />
                Deactivations
                {displayCorrelations.length > 0 && (
                  <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0 font-semibold tabular-nums">
                    {displayCorrelations.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="h-7 px-3 text-xs gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                Recommendations
                {report?.recommendations?.length ? (
                  <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0 font-semibold tabular-nums">
                    {report.recommendations.length}
                  </span>
                ) : null}
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
                <span className="text-[11px] text-muted-foreground">
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
             displayNews.length > 0 ? <CompetitorNewsWidget items={displayNews} /> :
             <EmptyTabState onRun={runReport} />}
          </TabsContent>

          <TabsContent value="packs" className="mt-4">
            {packsLoading ? <TabLoadingSkeleton /> :
             displayPacks.length > 0 ? <PricingTable packs={displayPacks} /> :
             <EmptyTabState onRun={runReport} />}
          </TabsContent>

          <TabsContent value="deactivations" className="mt-4 space-y-6">
            <IndiaDeactivationMap correlations={displayCorrelations} isLoading={deactivationLoading} />
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
