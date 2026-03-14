"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ReportJSON, SSEEvent, RunConfig } from "@/agents/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CompetitorNewsWidget } from "@/components/dashboard/CompetitorNewsWidget";
import { PricingTable } from "@/components/dashboard/PricingTable";
import { DeactivationChart } from "@/components/dashboard/DeactivationChart";
import { RecommendationsList } from "@/components/dashboard/RecommendationsList";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PDFDownloadButton } from "@/components/report/PDFDownloadButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const IndiaDeactivationMap = dynamic(
  () =>
    import("@/components/dashboard/IndiaDeactivationMap").then(
      (m) => m.IndiaDeactivationMap
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[500px] rounded-xl" />,
  }
);
import {
  Play,
  Loader2,
  Newspaper,
  TrendingDown,
  PackageSearch,
  Lightbulb,
  Activity,
  AlertTriangle,
  Shield,
  Star,
} from "lucide-react";
import { generateSuggestedQuestions } from "@/agents/chatbot";

type RunStatus = "idle" | "running" | "done" | "error";

interface ProgressEvent {
  taskId?: string;
  agentName?: string;
  count?: number;
}

function EmptyTabState({ onRun }: { onRun: () => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed p-10 text-center space-y-3">
      <Activity className="w-10 h-10 mx-auto text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">
        Run a report to populate this view.
      </p>
      <Button onClick={onRun} size="sm" variant="outline">
        <Play className="w-3.5 h-3.5 mr-1.5" />
        Run Daily Report
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const [report, setReport] = useState<ReportJSON | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const runReport = useCallback(async () => {
    setStatus("running");
    setProgress([]);
    setErrorMsg("");

    const config: Partial<RunConfig> = {
      regions_or_pincodes: ["400001", "560001", "110001", "600001", "700001"],
      news_time_window_days: 7,
      plans_time_window_days: 30,
      deactivation_window_days: 7,
      max_items_per_section: 10,
    };

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

            if (event.type === "task_completed") {
              setProgress((prev) => [
                ...prev,
                {
                  taskId: event.taskId,
                  agentName: event.agentName,
                  count: (event.data as { count?: number })?.count,
                },
              ]);
            }

            if (event.type === "run_complete" && event.data) {
              const data = event.data as { report?: ReportJSON };
              if (data.report) {
                setReport(data.report);
                setStatus("done");
              }
            }

            if (event.type === "error") {
              setErrorMsg(event.error || "Unknown error");
              setStatus("error");
            }
          } catch {
            // skip malformed
          }
        }
      }

      if (status === "running") setStatus("done");
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  }, [status]);

  const suggestedQuestions = generateSuggestedQuestions(report);

  const topThreat = report?.launches?.sort(
    (a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay
  )[0];

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
              <p className="text-xs text-muted-foreground">
                D2H + OTT Competitor Tracker
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <PDFDownloadButton
                reportId={report.reportId}
                className="h-8 text-xs"
              />
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
              {status === "running" ? "Generating…" : "Run Daily Report"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Progress indicator during run */}
        {status === "running" && (
          <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Running intelligence agents…
              </p>
            </div>
            <div className="space-y-1">
              {progress.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300"
                >
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span>
                    ✓ {p.agentName}{" "}
                    {p.count !== undefined ? `(${p.count} items)` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
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

        {/* KPI Cards — above the fold */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            title="News Items"
            value={report?.competitor_news?.length ?? "—"}
            subtitle={`Last ${report?.config?.news_time_window_days ?? 7} days`}
            icon={<Newspaper className="w-3.5 h-3.5" />}
            badge={status === "done" ? "Live" : undefined}
            badgeVariant="secondary"
            tooltip="Number of competitor news items tracked across DTH, OTT, and ISP operators."
          />
          <MetricCard
            title="Top Threat"
            value={
              topThreat
                ? `${topThreat.pmAnalysis.threatScoreToTataPlay}/10`
                : "—"
            }
            subtitle={topThreat?.entity ?? "No threats detected"}
            icon={<Shield className="w-3.5 h-3.5" />}
            trend={
              (topThreat?.pmAnalysis.threatScoreToTataPlay ?? 0) >= 7
                ? "down"
                : "neutral"
            }
            tooltip="Highest threat score (0–10) from competitor product launches this week."
          />
          <MetricCard
            title="Packs Analyzed"
            value={report?.plans_and_packs?.length ?? "—"}
            subtitle="Across all regions"
            icon={<PackageSearch className="w-3.5 h-3.5" />}
            tooltip="Number of subscription packs retrieved and compared across DTH operators."
          />
          <MetricCard
            title="Deactivation Signals"
            value={report?.events_correlation?.length ?? "—"}
            subtitle="Event correlations"
            icon={<TrendingDown className="w-3.5 h-3.5" />}
            tooltip="Number of external events correlated with deactivation patterns."
          />
          <MetricCard
            title="Quality Score"
            value={report?.qualityScore ? `${report.qualityScore}/10` : "—"}
            subtitle="Report completeness"
            icon={<Star className="w-3.5 h-3.5" />}
            tooltip="Internal quality score based on data coverage, source diversity, and completeness."
          />
        </div>

        {/* Main content tabs — always visible */}
        {true && (
          <Tabs defaultValue={report ? "news" : "deactivations"}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="news">
                  <Newspaper className="w-3.5 h-3.5 mr-1.5" />
                  News
                </TabsTrigger>
                <TabsTrigger value="packs">
                  <PackageSearch className="w-3.5 h-3.5 mr-1.5" />
                  Packs
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
              {report ? (
                <CompetitorNewsWidget items={report.competitor_news} maxItems={15} />
              ) : (
                <EmptyTabState onRun={runReport} />
              )}
            </TabsContent>

            <TabsContent value="packs" className="mt-4">
              {report ? (
                <PricingTable packs={report.plans_and_packs} />
              ) : (
                <EmptyTabState onRun={runReport} />
              )}
            </TabsContent>

            <TabsContent value="deactivations" className="mt-4 space-y-6">
              <IndiaDeactivationMap correlations={report?.events_correlation ?? []} />
              {report && <DeactivationChart correlations={report.events_correlation} />}
            </TabsContent>

            <TabsContent value="recommendations" className="mt-4">
              {report ? (
                <RecommendationsList recommendations={report.recommendations} />
              ) : (
                <EmptyTabState onRun={runReport} />
              )}
            </TabsContent>
          </Tabs>
        )}

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

      {/* Persistent chat panel */}
      <ChatPanel
        suggestedQuestions={suggestedQuestions}
        reportId={report?.reportId || "latest"}
      />
    </div>
  );
}
