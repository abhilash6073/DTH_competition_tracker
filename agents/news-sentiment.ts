// ============================================================
// agents/news-sentiment.ts — News & Sentiment agent
// Supports filtering by entityCategory for parallel DTH/OTT/ISP runs.
// All per-entity fetches and classifications run concurrently.
// ============================================================
import {
  CompetitorNewsItem,
  NewsCategory,
  SentimentLabel,
  RunConfig,
  DTH_OPERATORS,
  OTT_PLATFORMS,
  ISP_BUNDLES,
  DataGap,
} from "@/agents/types";
import { fetchCompetitorNews, deduplicateResults, resultToSnippet } from "@/agents/scraping";
import { claudeComplete, SYSTEM_PROMPT_BASE } from "@/lib/claude";
import { reactLog, uuidv4, getAllGaps } from "@/agents/utils";
import { ExaResult } from "@/lib/exa";

export type EntityCategory = "dth" | "ott" | "isp";

const SENTIMENT_SYSTEM = `${SYSTEM_PROMPT_BASE}

You are the News & Sentiment Agent. For each news article, classify it into:
- category: one of pricing_change | content_rights | new_feature | partnership | merger_acquisition | regulatory | outage | pr_campaign | other
- sentiment: positive | neutral | negative (towards the entity mentioned)
- relevanceScore: 0–10 (how relevant is this to Tata Play's competitive position)
- whyItMatterForTataPlay: 1–2 sentences explaining the competitive implication

Return a JSON object with these fields. Never fabricate details not present in the article.`;

interface NewsAnalysis {
  category: NewsCategory;
  sentiment: SentimentLabel;
  relevanceScore: number;
  summary: string;
  whyItMatterForTataPlay: string;
}

async function classifyNewsItem(
  result: ExaResult,
  entity: string
): Promise<NewsAnalysis | null> {
  const snippet = resultToSnippet(result);
  if (!snippet || snippet === "No content available.") return null;

  try {
    const { text } = await claudeComplete(
      SENTIMENT_SYSTEM,
      `Entity: ${entity}
Article URL: ${result.url}
Title: ${result.title || "No title"}
Published: ${result.publishedDate || "Unknown"}
Content: ${snippet}

Classify this article and return valid JSON only (no markdown):
{
  "category": "...",
  "sentiment": "...",
  "relevanceScore": 0,
  "summary": "...",
  "whyItMatterForTataPlay": "..."
}`,
      512
    );

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as NewsAnalysis;
  } catch {
    return null;
  }
}

async function processEntity(
  entity: { name: string; type: EntityCategory },
  config: RunConfig
): Promise<CompetitorNewsItem[]> {
  const raw = await fetchCompetitorNews(entity.name, config.news_time_window_days);
  if (raw.noResults) return [];

  const deduped = deduplicateResults(raw.results);
  const limited = deduped.slice(0, config.max_items_per_section);

  // Classify all results for this entity concurrently
  const analyses = await Promise.all(
    limited.map((result) => classifyNewsItem(result, entity.name))
  );

  const items: CompetitorNewsItem[] = [];
  limited.forEach((result, i) => {
    const analysis = analyses[i];
    if (!analysis) return;
    items.push({
      id: uuidv4(),
      entity: entity.name,
      entityType: entity.type,
      title: result.title || "Untitled",
      date: result.publishedDate || new Date().toISOString().split("T")[0],
      url: result.url,
      category: analysis.category,
      relevanceScore: Math.min(10, Math.max(0, analysis.relevanceScore)),
      summary: analysis.summary,
      whyItMatterForTataPlay: analysis.whyItMatterForTataPlay,
      sentiment: analysis.sentiment,
      basis: "exa",
      sourceId: result.id,
    });
  });
  return items;
}

export async function runNewsSentimentAgent(
  config: RunConfig,
  entityCategory?: EntityCategory   // if omitted, runs all categories
): Promise<{ items: CompetitorNewsItem[]; gaps: DataGap[] }> {
  const categoryLabel = entityCategory?.toUpperCase() ?? "ALL";
  reactLog({
    thought: `Starting News & Sentiment Agent [${categoryLabel}] for last ${config.news_time_window_days} day(s).`,
    action: `Fetch news for ${categoryLabel} entities concurrently.`,
    observation: "Will classify each item using Claude.",
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

  // Apply focus filter if specified
  if (config.focus_entities?.length) {
    entities = entities.filter((e) =>
      config.focus_entities!.some((f) =>
        e.name.toLowerCase().includes(f.toLowerCase())
      )
    );
  }

  // Fetch + classify ALL entities concurrently
  const entityResults = await Promise.allSettled(
    entities.map((entity) => processEntity(entity, config))
  );

  const allItems: CompetitorNewsItem[] = [];
  entityResults.forEach((r) => {
    if (r.status === "fulfilled") allItems.push(...r.value);
  });

  allItems.sort((a, b) => b.relevanceScore - a.relevanceScore);

  reactLog({
    thought: `News & Sentiment Agent [${categoryLabel}] complete.`,
    action: "Return results.",
    observation: `Found ${allItems.length} items across ${entities.length} entities.`,
  });

  return {
    items: allItems.slice(0, config.max_items_per_section * 3),
    gaps: getAllGaps(),
  };
}
