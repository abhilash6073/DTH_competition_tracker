// ============================================================
// scripts/test-run.ts — Direct agent test runner (1-day window)
// Run with: npx tsx --env-file=.env.local scripts/test-run.ts
// ============================================================
import { clearSources, clearGaps, getAllSources, getAllGaps } from "@/agents/utils";
import { runNewsSentimentAgent } from "@/agents/news-sentiment";
import { runPMAnalystAgent } from "@/agents/pm-analyst";
import { runPricingAgent } from "@/agents/pricing";
import { runDeactivationAgent } from "@/agents/deactivation";
import { runReportAgent } from "@/agents/report";
import { RunConfig } from "@/agents/types";

const SEP = "═".repeat(70);
const sep = "─".repeat(70);

function banner(title: string) {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

function section(title: string) {
  console.log(`\n${sep}`);
  console.log(`  ${title}`);
  console.log(sep);
}

const config: RunConfig = {
  regions_or_pincodes: ["400001"],            // Mumbai
  plans_time_window_days: 1,
  news_time_window_days: 1,
  deactivation_window_days: 1,
  max_items_per_section: 5,
  focus_entities: ["Airtel DTH", "Dish TV", "Sun Direct", "JioCinema", "Zee5"],
};

async function main() {
  clearSources();
  clearGaps();

  banner("TATA PLAY COMPETITOR INTELLIGENCE — TEST RUN (1-day window, Parallel)");
  console.log(`  Date:   ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);
  console.log(`  Focus:  ${config.focus_entities?.join(", ")}`);
  console.log(`  Region: Mumbai (400001)`);
  console.log(`  LLM:    Anthropic claude-sonnet-4-6 (Gemini as fallback)`);

  // ── Phase 1: All 7 agents in parallel ────────────────────────
  banner("PHASE 1 — 7 Agents Running in Parallel");
  console.log("  DTH News | OTT News | ISP News | DTH PM | OTT PM | Pricing | Deactivation");
  const t1 = Date.now();

  const [newsDTH, newsOTT, newsISP, pmDTH, pmOTT, pricingResult, deactivationResult] =
    await Promise.all([
      runNewsSentimentAgent(config, "dth").catch((e) => { console.error("  [DTH News FAILED]", e.message); return { items: [], gaps: [] }; }),
      runNewsSentimentAgent(config, "ott").catch((e) => { console.error("  [OTT News FAILED]", e.message); return { items: [], gaps: [] }; }),
      runNewsSentimentAgent(config, "isp").catch((e) => { console.error("  [ISP News FAILED]", e.message); return { items: [], gaps: [] }; }),
      runPMAnalystAgent(config, "dth").catch((e) => { console.error("  [DTH PM FAILED]", e.message); return { items: [], gaps: [] }; }),
      runPMAnalystAgent(config, "ott").catch((e) => { console.error("  [OTT PM FAILED]", e.message); return { items: [], gaps: [] }; }),
      runPricingAgent(config).catch((e) => { console.error("  [Pricing FAILED]", e.message); return { packs: [], gaps: [] }; }),
      runDeactivationAgent(config).catch((e) => { console.error("  [Deactivation FAILED]", e.message); return { correlations: [], gaps: [] }; }),
    ]);

  const phase1Time = ((Date.now() - t1) / 1000).toFixed(1);

  const allNewsItems = [...newsDTH.items, ...newsOTT.items, ...newsISP.items]
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const allPMItems = [...pmDTH.items, ...pmOTT.items]
    .sort((a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay);

  console.log(`\n  Phase 1 completed in ${phase1Time}s`);
  console.log(`  DTH News: ${newsDTH.items.length} | OTT News: ${newsOTT.items.length} | ISP News: ${newsISP.items.length}`);
  console.log(`  DTH PM:   ${pmDTH.items.length} | OTT PM: ${pmOTT.items.length} | Packs: ${pricingResult.packs.length} | Correlations: ${deactivationResult.correlations.length}`);

  // ── News & Sentiment Results ──────────────────────────────────
  banner(`NEWS & SENTIMENT AGENT — ${allNewsItems.length} items`);
  if (allNewsItems.length === 0) {
    console.log("  No news items found in last 1 day window.");
  }
  for (const item of allNewsItems) {
    section(`[${item.entityType.toUpperCase()}] ${item.entity} — ${item.title}`);
    console.log(`  URL:        ${item.url}`);
    console.log(`  Date:       ${item.date}`);
    console.log(`  Category:   ${item.category}`);
    console.log(`  Sentiment:  ${item.sentiment}`);
    console.log(`  Relevance:  ${item.relevanceScore}/10`);
    console.log(`  Summary:    ${item.summary}`);
    console.log(`  Impact:     ${item.whyItMatterForTataPlay}`);
  }

  // ── PM Analyst Results ────────────────────────────────────────
  banner(`PM ANALYST AGENT — ${allPMItems.length} launches/changes`);
  if (allPMItems.length === 0) {
    console.log("  No product launches detected in last 1 day window.");
  }
  for (const item of allPMItems) {
    section(`[${item.entityType.toUpperCase()}] ${item.entity} — ${item.title}`);
    console.log(`  Date:         ${item.detectedDate}`);
    console.log(`  Description:  ${item.changeDescription}`);
    if (item.newValue) console.log(`  New Value:    ${item.newValue}`);
    console.log(`  Threat Score: ${item.pmAnalysis.threatScoreToTataPlay}/10  (${item.pmAnalysis.threatJustification})`);
    console.log(`  Churn Risk:   ${item.pmAnalysis.churnRiskFromTataPlay}  — ${item.pmAnalysis.churnRiskExplanation}`);
    console.log(`  Job-to-done:  ${item.pmAnalysis.jobToBeDone}`);
    if (item.pmAnalysis.basis === "hypothesis") {
      console.log(`  ⚠ HYPOTHESIS (${item.pmAnalysis.confidence} confidence)`);
    }
  }

  // ── Pricing Results ───────────────────────────────────────────
  banner(`PRICING AGENT — ${pricingResult.packs.length} packs`);
  const byOperator: Record<string, import("@/agents/types").PlansPack[]> = {};
  for (const p of pricingResult.packs) {
    if (!byOperator[p.operator]) byOperator[p.operator] = [];
    byOperator[p.operator].push(p);
  }
  if (Object.keys(byOperator).length === 0) {
    console.log("  No pack data found.");
  }
  for (const [operator, packs] of Object.entries(byOperator)) {
    section(`Operator: ${operator}`);
    for (const pack of packs) {
      console.log(`\n  Pack:            ${pack.packName}`);
      console.log(`    Monthly Price: ₹${pack.monthlyPrice || "N/A"}`);
      console.log(`    HD Channels:   ${pack.hdChannels || "N/A"}`);
      console.log(`    Total Channels:${pack.totalChannels || "N/A"}`);
      console.log(`    OTT Bundled:   ${pack.hasOTTBundled ? pack.ottBundles.join(", ") : "No"}`);
      if (pack.dataGaps.length) console.log(`    ⚠ Data gaps:  ${pack.dataGaps.map(g => g.field).join(", ")}`);
    }
  }

  // ── Deactivation Results ──────────────────────────────────────
  banner(`DEACTIVATION AGENT — ${deactivationResult.correlations.length} correlations`);
  if (deactivationResult.correlations.length === 0) {
    console.log("  No significant deactivation events found in last 1 day.");
  }
  for (const corr of deactivationResult.correlations) {
    section(`Event: ${corr.event.name} (${corr.event.type})`);
    console.log(`  Date:          ${corr.event.date}`);
    console.log(`  Region:        ${corr.affectedRegion}`);
    console.log(`  Deact. Delta:  ${corr.deactivationDelta > 0 ? "+" : ""}${corr.deactivationDelta}%`);
    console.log(`  Confidence:    ${corr.confidence}`);
    console.log(`  Explanation:   ${corr.causalHypothesis}`);
    if (corr.recommendedAction) console.log(`  Action:        ${corr.recommendedAction}`);
  }

  // ── Phase 2: Report generation ────────────────────────────────
  banner("PHASE 2 — Report Agent");
  const t2 = Date.now();

  const report = await runReportAgent(
    config,
    allNewsItems,
    allPMItems,
    pricingResult.packs,
    deactivationResult.correlations
  );

  console.log(`\n  Report generated in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
  console.log(`  Report ID:     ${report.reportId}`);
  console.log(`  Quality Score: ${report.qualityScore}/10`);
  console.log(`  Recommendations: ${report.recommendations.length}`);

  // ── Final Report ──────────────────────────────────────────────
  banner("FINAL MARKDOWN REPORT");
  console.log(report.markdownReport);

  // ── Source Audit ──────────────────────────────────────────────
  const sources = getAllSources();
  banner(`SOURCE AUDIT — ${sources.length} sources logged`);
  for (const s of sources.slice(0, 15)) {
    console.log(`  [${s.timestamp.slice(11, 19)}] ${s.query}`);
    console.log(`    → ${s.url}`);
  }
  if (sources.length > 15) console.log(`  ... and ${sources.length - 15} more sources`);

  // ── Data Gaps ─────────────────────────────────────────────────
  const allGaps = getAllGaps();
  if (allGaps.length) {
    banner(`DATA GAPS — ${allGaps.length} total`);
    for (const g of allGaps) {
      console.log(`  ${g.field}: ${g.reason} — ${g.suggestedSource}`);
    }
  }

  const totalTime = ((Date.now() - t1) / 1000).toFixed(1);
  banner(`RUN COMPLETE — Phase 1: ${phase1Time}s | Total: ${totalTime}s`);
}

main().catch((e) => {
  console.error("\n[FATAL]", e);
  process.exit(1);
});
