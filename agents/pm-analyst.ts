// ============================================================
// agents/pm-analyst.ts — Product Intelligence / PM Analyst agent
// Supports filtering by entityCategory for parallel DTH/OTT/ISP runs.
// All per-entity fetches and LLM classifications run concurrently.
// ============================================================
import {
  LaunchItem,
  PMAnalysisBlock,
  DataGap,
  NewsCategory,
  RunConfig,
  DTH_OPERATORS,
  OTT_PLATFORMS,
  ISP_BUNDLES,
} from "@/agents/types";
import { fetchCompetitorNews, deduplicateResults, resultToSnippet } from "@/agents/scraping";
import { claudeComplete, SYSTEM_PROMPT_BASE } from "@/lib/claude";
import { reactLog, uuidv4, markDataGap, getAllGaps } from "@/agents/utils";
import { ExaResult } from "@/lib/exa";
import { EntityCategory } from "@/agents/news-sentiment";

const PM_SYSTEM = `${SYSTEM_PROMPT_BASE}

You are the Product Intelligence / PM Analyst Agent for Tata Play.
When presented with a competitor product launch or change, produce a structured PM analysis.

Rules:
- Only analyze what the article actually describes. Do not invent details.
- Label data_backed sections with basis="data_backed" and hypotheses with basis="hypothesis".
- Threat score (0–10): 0 = no threat, 10 = existential threat to Tata Play.
- Churn risk: high/medium/low based on how likely this makes Tata Play subscribers switch.
- Be specific about target segment and market impact.

Return valid JSON only.`;

interface PMAnalysisRaw {
  isLaunch: boolean;
  title: string;
  changeDescription: string;
  oldValue?: string;
  newValue?: string;
  category: NewsCategory;
  pmAnalysis: PMAnalysisBlock;
}

async function analyzeLaunch(
  result: ExaResult,
  entity: string,
  entityType: EntityCategory
): Promise<PMAnalysisRaw | null> {
  const snippet = resultToSnippet(result);
  if (!snippet || snippet === "No content available.") return null;

  try {
    const { text } = await claudeComplete(
      PM_SYSTEM,
      `Entity: ${entity} (${entityType})
Article URL: ${result.url}
Title: ${result.title || ""}
Content: ${snippet}

First determine if this article describes a new product launch, pricing change, or significant feature update (isLaunch).
If yes, produce a full PM analysis. If no, return {"isLaunch": false}.

Return valid JSON only:
{
  "isLaunch": true,
  "title": "Brief title of the launch/change",
  "changeDescription": "What changed",
  "oldValue": "Previous state (if known, else omit)",
  "newValue": "New state",
  "category": "pricing_change|new_feature|content_rights|partnership|other",
  "pmAnalysis": {
    "jobToBeDone": "...",
    "frictionRemoved": "...",
    "targetSegment": "...",
    "impactOnUserBehavior": "...",
    "cannibalizeOrUpsell": "...",
    "threatScoreToTataPlay": 5,
    "threatJustification": "...",
    "churnRiskFromTataPlay": "medium",
    "churnRiskExplanation": "...",
    "basis": "data_backed",
    "confidence": "medium"
  }
}`,
      800
    );

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as PMAnalysisRaw;
    if (!parsed.isLaunch) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function processEntity(
  entity: { name: string; type: EntityCategory },
  config: RunConfig
): Promise<LaunchItem[]> {
  const raw = await fetchCompetitorNews(
    `${entity.name} new plan feature launch announcement`,
    config.plans_time_window_days
  );
  if (raw.noResults) return [];

  const deduped = deduplicateResults(raw.results);
  const limited = deduped.slice(0, 5);

  // Analyze all results for this entity concurrently
  const analyses = await Promise.all(
    limited.map((result) => analyzeLaunch(result, entity.name, entity.type))
  );

  const items: LaunchItem[] = [];
  limited.forEach((result, i) => {
    const analysis = analyses[i];
    if (!analysis) return;
    items.push({
      id: uuidv4(),
      entity: entity.name,
      entityType: entity.type,
      title: analysis.title,
      detectedDate: new Date().toISOString().split("T")[0],
      effectiveDate: result.publishedDate,
      changeDescription: analysis.changeDescription,
      oldValue: analysis.oldValue,
      newValue: analysis.newValue,
      category: analysis.category,
      pmAnalysis: analysis.pmAnalysis,
      sources: [result.id],
    });
  });
  return items;
}

export async function runPMAnalystAgent(
  config: RunConfig,
  entityCategory?: EntityCategory   // if omitted, runs all categories
): Promise<{ items: LaunchItem[]; gaps: DataGap[] }> {
  const categoryLabel = entityCategory?.toUpperCase() ?? "ALL";
  reactLog({
    thought: `Starting PM Analyst Agent [${categoryLabel}] for last ${config.plans_time_window_days} day(s).`,
    action: "Fetch + analyse launches across entities concurrently.",
    observation: "Will classify and analyze each product change.",
  });

  // Build entity list filtered by category
  const allEntities = [
    ...DTH_OPERATORS.map((e) => ({ name: e, type: "dth" as const })),
    ...OTT_PLATFORMS.map((e) => ({ name: e, type: "ott" as const })),
    ...ISP_BUNDLES.map((e) => ({ name: e, type: "isp" as const })),
  ];

  let entities = entityCategory
    ? allEntities.filter((e) => e.type === entityCategory)
    : allEntities;

  if (config.focus_entities?.length) {
    entities = entities.filter((e) =>
      config.focus_entities!.some((f) =>
        e.name.toLowerCase().includes(f.toLowerCase())
      )
    );
  }

  // Process ALL entities concurrently
  const entityResults = await Promise.allSettled(
    entities.map((entity) => processEntity(entity, config))
  );

  const allItems: LaunchItem[] = [];
  entityResults.forEach((r) => {
    if (r.status === "fulfilled") allItems.push(...r.value);
  });

  if (allItems.length === 0) {
    markDataGap(
      `product launches (${categoryLabel}, ${config.plans_time_window_days}d)`,
      "No confirmed launches detected via Exa in the configured time window",
      "Check operator press release pages and TRAI announcements manually"
    );
  }

  allItems.sort(
    (a, b) => b.pmAnalysis.threatScoreToTataPlay - a.pmAnalysis.threatScoreToTataPlay
  );

  reactLog({
    thought: `PM Analyst Agent [${categoryLabel}] complete.`,
    action: "Return launch items.",
    observation: `Found ${allItems.length} significant launches/changes.`,
  });

  return {
    items: allItems.slice(0, config.max_items_per_section),
    gaps: getAllGaps(),
  };
}
