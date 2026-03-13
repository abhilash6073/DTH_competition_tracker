// ============================================================
// agents/scraping.ts — Data & Exa.ai retrieval agent
// All open-web retrieval is routed through Exa.
// ============================================================
import { exaSearch, exaNewsSearch, ExaResult } from "@/lib/exa";
import { reactLog, markDataGap, uuidv4, exaDateFilter } from "@/agents/utils";
import {
  SourceRecord,
  DataGap,
  RunConfig,
} from "@/agents/types";

export interface RawSearchResult {
  query: string;
  results: ExaResult[];
  sources: SourceRecord[];
  gaps: DataGap[];
  noResults: boolean;
}

/**
 * Search for competitor news and events.
 */
export async function fetchCompetitorNews(
  entity: string,
  windowDays: number
): Promise<RawSearchResult> {
  reactLog({
    thought: `Searching for news about ${entity} in the last ${windowDays} days.`,
    action: `exaNewsSearch("${entity} India DTH OTT news ${new Date().getFullYear()}")`,
    observation: "Will process results after retrieval.",
  });

  const res = await exaNewsSearch(
    `${entity} India DTH OTT streaming news plans pricing`,
    windowDays,
    "scraping_agent"
  );

  if (res.noResults) {
    const gap = markDataGap(
      `${entity} recent news`,
      `No Exa results for "${entity}" in last ${windowDays} days`,
      "Try broader query or check operator's official newsroom"
    );
    return { query: entity, results: [], sources: [], gaps: [gap], noResults: true };
  }

  return {
    query: entity,
    results: res.results,
    sources: [],
    gaps: [],
    noResults: false,
  };
}

/**
 * Fetch subscription plan pages for a DTH operator.
 */
export async function fetchOperatorPacks(
  operator: string,
  region: string
): Promise<RawSearchResult> {
  const query = `${operator} DTH subscription packs channels price ${region} India 2025 2026`;

  reactLog({
    thought: `Fetching pack details for ${operator} in ${region}.`,
    action: `exaSearch("${query}")`,
    observation: "Awaiting results.",
  });

  const dateFilter = exaDateFilter(90); // packs may be 3 months old
  const res = await exaSearch(query, {
    type: "neural",
    numResults: 5,
    startPublishedDate: dateFilter.startPublishedDate,
    agentName: "pricing_agent",
    includeDomains: [
      "tataplay.com",
      "airtel.in",
      "dishtv.in",
      "d2h.com",
      "sundirect.in",
      "ddindia.gov.in",
      "trai.gov.in",
    ],
  });

  if (res.noResults) {
    // Fallback without domain restriction
    const fallback = await exaSearch(query, {
      type: "keyword",
      numResults: 8,
      agentName: "pricing_agent",
    });

    if (fallback.noResults) {
      const gap = markDataGap(
        `${operator} pack data (${region})`,
        "No Exa results from operator sites or general web",
        `Manually check ${operator}'s official website or TRAI pack listing`
      );
      return { query, results: [], sources: [], gaps: [gap], noResults: true };
    }
    return { query, results: fallback.results, sources: [], gaps: [], noResults: false };
  }

  return { query, results: res.results, sources: [], gaps: [], noResults: false };
}

/**
 * Fetch external event data for a region (exams, festivals, sports, weather).
 */
export async function fetchExternalEvents(
  eventType: string,
  region: string,
  windowDays: number
): Promise<RawSearchResult> {
  const dateFilter = exaDateFilter(windowDays);
  const query = `${eventType} ${region} India ${new Date().getFullYear()} schedule calendar`;

  reactLog({
    thought: `Fetching ${eventType} events for ${region} in the last ${windowDays} days.`,
    action: `exaSearch("${query}")`,
    observation: "Awaiting results.",
  });

  const res = await exaSearch(query, {
    type: "neural",
    numResults: 10,
    startPublishedDate: dateFilter.startPublishedDate,
    endPublishedDate: dateFilter.endPublishedDate,
    agentName: "deactivation_agent",
  });

  if (res.noResults) {
    const gap = markDataGap(
      `${eventType} events (${region})`,
      "No results found",
      `Check official calendars: CBSE, state boards, weather.gov.in, BCCI`
    );
    return { query, results: [], sources: [], gaps: [gap], noResults: true };
  }

  return { query, results: res.results, sources: [], gaps: [], noResults: false };
}

/**
 * Fetch OTT platform news/launches.
 */
export async function fetchOTTNews(
  platform: string,
  windowDays: number
): Promise<RawSearchResult> {
  return fetchCompetitorNews(`${platform} OTT streaming India`, windowDays);
}

/**
 * General-purpose Exa search for chatbot ad-hoc queries.
 */
export async function chatbotSearch(
  query: string,
  windowDays = 30
): Promise<RawSearchResult> {
  const dateFilter = exaDateFilter(windowDays);
  const res = await exaSearch(query, {
    type: "auto",
    numResults: 8,
    startPublishedDate: dateFilter.startPublishedDate,
    agentName: "chatbot_agent",
  });
  return {
    query,
    results: res.results,
    sources: [],
    gaps: [],
    noResults: res.noResults,
  };
}

/**
 * De-duplicate results by URL.
 */
export function deduplicateResults(results: ExaResult[]): ExaResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

/**
 * Build a source-safe snippet for a result.
 */
export function resultToSnippet(result: ExaResult): string {
  return (
    result.summary ||
    result.highlights?.[0] ||
    result.text?.slice(0, 200) ||
    "No content available."
  );
}

export { uuidv4 };
