// ============================================================
// agents/orchestrator.ts — Planner / Supervisor agent
//
// Execution plan (maximally parallel):
//
//  Phase 1 — ALL in parallel:
//    ├── DTH News & Sentiment
//    ├── OTT News & Sentiment
//    ├── ISP News & Sentiment
//    ├── DTH PM Analysis
//    ├── OTT PM Analysis
//    ├── Pricing Agent
//    └── Deactivation Agent
//
//  Phase 2:
//    └── Report Agent (needs all Phase 1 outputs)
// ============================================================
import {
  RunConfig,
  DEFAULT_RUN_CONFIG,
  ReportJSON,
  SSEEvent,
} from "@/agents/types";
import { runNewsSentimentAgent } from "@/agents/news-sentiment";
import { runPMAnalystAgent } from "@/agents/pm-analyst";
import { runPricingAgent } from "@/agents/pricing";
import { runDeactivationAgent } from "@/agents/deactivation";
import { runReportAgent } from "@/agents/report";
import { clearSources, clearGaps, reactLog } from "@/agents/utils";
import { cacheReport } from "@/lib/kv";
import { saveReport } from "@/lib/supabase";

export type SSEEmitter = (event: SSEEvent) => void;

export async function runOrchestrator(
  config: Partial<RunConfig> = {},
  emit: SSEEmitter
): Promise<ReportJSON> {
  const runConfig: RunConfig = { ...DEFAULT_RUN_CONFIG, ...config };

  clearSources();
  clearGaps();

  reactLog({
    thought: `Orchestrator started. Config: ${JSON.stringify(runConfig)}`,
    action: "Run all 7 specialist agents in Phase 1 fully in parallel.",
    observation: "DTH/OTT/ISP split enables true concurrent processing.",
  });

  emit({ type: "run_started", data: { config: runConfig } });

  // ── Phase 1: All agents in parallel ─────────────────────────
  const phase1Tasks = [
    { taskId: "news_dth",    agentName: "NewsSentimentAgent[DTH]" },
    { taskId: "news_ott",    agentName: "NewsSentimentAgent[OTT]" },
    { taskId: "news_isp",    agentName: "NewsSentimentAgent[ISP]" },
    { taskId: "pm_dth",      agentName: "PMAnalystAgent[DTH]" },
    { taskId: "pm_ott",      agentName: "PMAnalystAgent[OTT]" },
    { taskId: "pricing",     agentName: "PricingAgent" },
    { taskId: "deactivation",agentName: "DeactivationAgent" },
  ];

  phase1Tasks.forEach(({ taskId, agentName }) =>
    emit({ type: "task_started", taskId, agentName })
  );

  const [
    newsDTH,
    newsOTT,
    newsISP,
    pmDTH,
    pmOTT,
    pricingResult,
    deactivationResult,
  ] = await Promise.all([
    runNewsSentimentAgent(runConfig, "dth").catch((e) => {
      emit({ type: "task_failed", taskId: "news_dth", error: String(e) });
      return { items: [], gaps: [] };
    }),
    runNewsSentimentAgent(runConfig, "ott").catch((e) => {
      emit({ type: "task_failed", taskId: "news_ott", error: String(e) });
      return { items: [], gaps: [] };
    }),
    runNewsSentimentAgent(runConfig, "isp").catch((e) => {
      emit({ type: "task_failed", taskId: "news_isp", error: String(e) });
      return { items: [], gaps: [] };
    }),
    runPMAnalystAgent(runConfig, "dth").catch((e) => {
      emit({ type: "task_failed", taskId: "pm_dth", error: String(e) });
      return { items: [], gaps: [] };
    }),
    runPMAnalystAgent(runConfig, "ott").catch((e) => {
      emit({ type: "task_failed", taskId: "pm_ott", error: String(e) });
      return { items: [], gaps: [] };
    }),
    runPricingAgent(runConfig).catch((e) => {
      emit({ type: "task_failed", taskId: "pricing", error: String(e) });
      return { packs: [], gaps: [] };
    }),
    runDeactivationAgent(runConfig).catch((e) => {
      emit({ type: "task_failed", taskId: "deactivation", error: String(e) });
      return { correlations: [], gaps: [] };
    }),
  ]);

  // Merge news and PM results
  const newsResult = {
    items: [...newsDTH.items, ...newsOTT.items, ...newsISP.items].sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    ),
  };
  const pmResult = {
    items: [...pmDTH.items, ...pmOTT.items].sort(
      (a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay
    ),
  };

  phase1Tasks.forEach(({ taskId, agentName }) =>
    emit({
      type: "task_completed",
      taskId,
      agentName,
      data: taskId.startsWith("news")
        ? { count: taskId === "news_dth" ? newsDTH.items.length : taskId === "news_ott" ? newsOTT.items.length : newsISP.items.length }
        : taskId.startsWith("pm")
        ? { count: taskId === "pm_dth" ? pmDTH.items.length : pmOTT.items.length }
        : taskId === "pricing"
        ? { count: pricingResult.packs.length }
        : { count: deactivationResult.correlations.length },
    })
  );

  // ── Phase 2: Report generation ────────────────────────────────
  emit({ type: "task_started", taskId: "report_generation", agentName: "ReportAgent" });

  const report = await runReportAgent(
    runConfig,
    newsResult.items,
    pmResult.items,
    pricingResult.packs,
    deactivationResult.correlations
  );

  emit({
    type: "task_completed",
    taskId: "report_generation",
    agentName: "ReportAgent",
    data: { reportId: report.reportId, qualityScore: report.qualityScore },
  });

  // ── Persist (non-blocking) ────────────────────────────────────
  await Promise.allSettled([
    cacheReport(report),
    saveReport(report).catch((e) =>
      console.error("[Orchestrator] Supabase save failed:", e)
    ),
  ]);

  reactLog({
    thought: "All agents completed.",
    action: "Emit run_complete.",
    observation: `Report ID: ${report.reportId}, quality: ${report.qualityScore}/10`,
  });

  emit({
    type: "run_complete",
    data: {
      reportId: report.reportId,
      qualityScore: report.qualityScore,
      newsCount: newsResult.items.length,
      launchCount: pmResult.items.length,
      packCount: pricingResult.packs.length,
      correlationCount: deactivationResult.correlations.length,
      recommendationCount: report.recommendations.length,
      gapCount: report.dataGaps.length,
    },
  });

  return report;
}
