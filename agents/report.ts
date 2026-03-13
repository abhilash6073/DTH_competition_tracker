// ============================================================
// agents/report.ts — Report composition + PDF generation agent
// ============================================================
import {
  ReportJSON,
  CompetitorNewsItem,
  LaunchItem,
  PlansPack,
  EventCorrelation,
  Recommendation,
  SourceRecord,
  DataGap,
  RunConfig,
} from "@/agents/types";
import { claudeComplete, SYSTEM_PROMPT_BASE } from "@/lib/claude";
import {
  reactLog,
  uuidv4,
  getAllSources,
  getAllGaps,
  buildConfidenceLimitations,
} from "@/agents/utils";

const REPORT_SYSTEM = `${SYSTEM_PROMPT_BASE}

You are the Report Agent. Your job is to synthesize all intelligence data into:
1. An executive summary (3–5 bullets)
2. 3–5 strategic recommendations for Tata Play

Rules:
- Base all statements on the provided data. Label hypotheses.
- Recommendations must have: title, rationale, action, expected impact, priority (high/medium/low), timeframe.
- Write for a senior Product/Marketing Manager. Be concise and actionable.`;

async function generateExecutiveSummary(data: {
  news: CompetitorNewsItem[];
  launches: LaunchItem[];
  packs: PlansPack[];
  correlations: EventCorrelation[];
}): Promise<string> {
  const topNews = data.news.slice(0, 5).map((n) => `• ${n.entity}: ${n.title}`).join("\n");
  const topLaunches = data.launches
    .slice(0, 3)
    .map((l) => `• ${l.entity}: ${l.changeDescription}`)
    .join("\n");
  const topThreats = data.launches
    .filter((l) => l.pmAnalysis.threatScoreToTataPlay >= 7)
    .map((l) => `• ${l.entity} (threat: ${l.pmAnalysis.threatScoreToTataPlay}/10)`)
    .join("\n");

  const { text } = await claudeComplete(
    REPORT_SYSTEM,
    `Generate a concise executive summary (5 bullet points max) for Tata Play leadership based on:

TOP NEWS:
${topNews || "No major news this week."}

TOP LAUNCHES/CHANGES:
${topLaunches || "No significant launches detected."}

HIGH THREAT ITEMS (score ≥7/10):
${topThreats || "No high-threat items detected."}

Format as bullet points starting with •. Be specific and actionable.`,
    600
  );

  return text;
}

async function generateRecommendations(data: {
  news: CompetitorNewsItem[];
  launches: LaunchItem[];
  packs: PlansPack[];
  correlations: EventCorrelation[];
}): Promise<Recommendation[]> {
  const highThreats = data.launches
    .filter((l) => l.pmAnalysis.threatScoreToTataPlay >= 6)
    .slice(0, 5);

  const packContext =
    data.packs.length > 0
      ? data.packs
          .slice(0, 5)
          .map((p) => `${p.operator} (${p.region}): ₹${p.monthlyPrice}/mo, ${p.totalChannels} channels`)
          .join("; ")
      : "Pack data not available.";

  const { text } = await claudeComplete(
    REPORT_SYSTEM,
    `Based on this competitive intelligence, generate 5 strategic recommendations for Tata Play.

HIGH-THREAT COMPETITOR MOVES:
${highThreats.map((l) => `${l.entity}: ${l.changeDescription} (threat: ${l.pmAnalysis.threatScoreToTataPlay}/10)`).join("\n") || "None"}

PACK PRICE CONTEXT:
${packContext}

DEACTIVATION INSIGHTS:
${data.correlations
  .slice(0, 3)
  .map((c) => `${c.affectedRegion}: ${c.causalHypothesis}`)
  .join("\n") || "No significant correlations."}

Return a JSON array of recommendation objects:
[
  {
    "category": "pricing|product|retention|acquisition|content|regulatory|regional",
    "priority": "high|medium|low",
    "title": "...",
    "rationale": "...",
    "suggestedAction": "...",
    "expectedImpact": "...",
    "timeToExecute": "immediate|short_term|medium_term|long_term",
    "basis": "data_backed|hypothesis",
    "confidence": "high|medium|low"
  }
]`,
    1200
  );

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const raw = JSON.parse(match[0]) as Omit<
      Recommendation,
      "id" | "relatedNewsIds" | "relatedLaunchIds"
    >[];
    return raw.map((r) => ({ ...r, id: uuidv4() }));
  } catch {
    return [];
  }
}

function buildMarkdownReport(
  summary: string,
  news: CompetitorNewsItem[],
  launches: LaunchItem[],
  packs: PlansPack[],
  correlations: EventCorrelation[],
  recommendations: Recommendation[],
  sources: SourceRecord[],
  gaps: DataGap[],
  config: RunConfig
): string {
  const date = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const packTable =
    packs.length > 0
      ? `| Operator | Pack | Region | ₹/mo | Channels (HD) | OTT |
|---|---|---|---|---|---|
${packs
  .slice(0, 20)
  .map(
    (p) =>
      `| ${p.operator} | ${p.packName} | ${p.region} | ₹${p.monthlyPrice || "N/A"} | ${p.totalChannels || "N/A"} (${p.hdChannels || "N/A"} HD) | ${p.hasOTTBundled ? p.ottBundles.join(", ") : "—"} |`
  )
  .join("\n")}`
      : "*No pack data available. Manual validation required.*";

  const newsSection =
    news.length > 0
      ? news
          .slice(0, 15)
          .map(
            (n) =>
              `### ${n.entity} — ${n.title}\n**Date:** ${n.date} | **Category:** ${n.category} | **Sentiment:** ${n.sentiment} | **Relevance:** ${n.relevanceScore}/10\n\n${n.summary}\n\n**Why it matters for Tata Play:** ${n.whyItMatterForTataPlay}\n\n[Source](${n.url})\n`
          )
          .join("\n---\n\n")
      : "*No significant news found in the time window.*";

  const launchSection =
    launches.length > 0
      ? launches
          .slice(0, 10)
          .map(
            (l) =>
              `### ${l.entity} — ${l.title}\n**Threat Score:** ${l.pmAnalysis.threatScoreToTataPlay}/10 | **Churn Risk:** ${l.pmAnalysis.churnRiskFromTataPlay}\n\n**What changed:** ${l.changeDescription}\n\n**PM Analysis:**\n- Job to be done: ${l.pmAnalysis.jobToBeDone}\n- Friction removed: ${l.pmAnalysis.frictionRemoved}\n- Target segment: ${l.pmAnalysis.targetSegment}\n- Impact: ${l.pmAnalysis.impactOnUserBehavior}\n- Churn risk explanation: ${l.pmAnalysis.churnRiskExplanation}\n\n> *Basis: ${l.pmAnalysis.basis} | Confidence: ${l.pmAnalysis.confidence}*\n`
          )
          .join("\n---\n\n")
      : "*No significant product launches detected in the time window.*";

  const correlationSection =
    correlations.length > 0
      ? correlations
          .slice(0, 10)
          .map(
            (c) =>
              `### ${c.event.name} → ${c.affectedRegion}\n**Confidence:** ${c.confidence} | **Type:** ${c.correlationVsCausationLabel}\n\n${c.causalHypothesis}\n\n**Recommended Action:** ${c.recommendedAction}\n`
          )
          .join("\n---\n\n")
      : "*Insufficient deactivation data for correlation analysis.*";

  const recSection = recommendations
    .slice(0, 5)
    .map(
      (r, i) =>
        `### ${i + 1}. [${r.priority.toUpperCase()}] ${r.title}\n**Category:** ${r.category} | **Timeline:** ${r.timeToExecute}\n\n**Rationale:** ${r.rationale}\n\n**Action:** ${r.suggestedAction}\n\n**Expected Impact:** ${r.expectedImpact}\n\n> *Basis: ${r.basis} | Confidence: ${r.confidence}*`
    )
    .join("\n\n---\n\n");

  const sourceList = sources
    .slice(0, 30)
    .map((s, i) => `${i + 1}. [${s.url}](${s.url}) — ${s.agent} — ${s.timestamp}`)
    .join("\n");

  const confidenceLimitations = buildConfidenceLimitations(
    gaps,
    ["News & sentiment coverage (7 days)", "Exa-based event detection"],
    [
      "DTH pack pricing (depends on Exa retrieval quality)",
      "Internal deactivation data (simulated if not provided)",
      "Pincode-level pack granularity (state-level only)",
    ]
  );

  return `# Tata Play Competitor Intelligence Report
**Date:** ${date}
**Regions analyzed:** ${config.regions_or_pincodes.join(", ")}
**Time windows:** News ${config.news_time_window_days}d | Plans ${config.plans_time_window_days}d | Deactivations ${config.deactivation_window_days}d

---

## Executive Summary

${summary}

---

## 1. Competitor News (Last ${config.news_time_window_days} Days)

${newsSection}

---

## 2. New Plans & Features (Last ${config.plans_time_window_days} Days) — PM Analysis

${launchSection}

---

## 3. Pack Comparison by Region

${packTable}

---

## 4. Deactivations vs External Events

${correlationSection}

---

## 5. Recommendations for Tata Play

${recSection}

---

${confidenceLimitations}

---

## Sources

${sourceList || "*No sources logged in this run.*"}
`;
}

export async function runReportAgent(
  config: RunConfig,
  news: CompetitorNewsItem[],
  launches: LaunchItem[],
  packs: PlansPack[],
  correlations: EventCorrelation[]
): Promise<ReportJSON> {
  reactLog({
    thought: "Starting Report Agent — composing final report.",
    action: "Generate executive summary + recommendations, then build markdown.",
    observation: "Will return full ReportJSON.",
  });

  const [summary, recommendations] = await Promise.all([
    generateExecutiveSummary({ news, launches, packs, correlations }),
    generateRecommendations({ news, launches, packs, correlations }),
  ]);

  const sources = getAllSources();
  const gaps = getAllGaps();

  const markdownReport = buildMarkdownReport(
    summary,
    news,
    launches,
    packs,
    correlations,
    recommendations,
    sources,
    gaps,
    config
  );

  // Internal quality score
  const qualityScore = Math.min(
    10,
    (news.length > 0 ? 2 : 0) +
      (launches.length > 0 ? 2 : 0) +
      (packs.length > 0 ? 2 : 0) +
      (correlations.length > 0 ? 2 : 0) +
      (recommendations.length >= 3 ? 2 : 1)
  );

  const report: ReportJSON = {
    reportId: uuidv4(),
    generatedAt: new Date().toISOString(),
    config,
    competitor_news: news,
    launches,
    plans_and_packs: packs,
    events_correlation: correlations,
    recommendations,
    sources,
    dataGaps: gaps,
    confidenceAndLimitations: buildConfidenceLimitations(gaps, [], []),
    markdownReport,
    qualityScore,
  };

  reactLog({
    thought: "Report Agent complete.",
    action: "Return ReportJSON.",
    observation: `Report ID: ${report.reportId}, quality score: ${qualityScore}/10`,
  });

  return report;
}
