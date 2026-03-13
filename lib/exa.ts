// ============================================================
// lib/exa.ts — Exa.ai client wrapper
// EXA_API_KEY is never printed/logged.
// ============================================================
import Exa from "exa-js";
import { logSource, EXA_NO_RESULTS } from "@/agents/utils";

// Lazily initialised so tests can run without the env var
let _client: Exa | null = null;

function getClient(): Exa {
  if (!_client) {
    const key = process.env.EXA_API_KEY;
    if (!key) throw new Error("EXA_API_KEY is not set");
    _client = new Exa(key);
  }
  return _client;
}

export interface ExaSearchOptions {
  type?: "auto" | "neural" | "keyword";
  numResults?: number;
  startPublishedDate?: string; // YYYY-MM-DD
  endPublishedDate?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  useAutoprompt?: boolean;
  agentName?: string; // for source logging
}

export interface ExaResult {
  id: string;
  url: string;
  title: string;
  publishedDate?: string;
  text?: string;
  highlights?: string[];
  summary?: string;
  score?: number;
}

export interface ExaSearchResponse {
  results: ExaResult[];
  noResults: boolean;
  rawQuery: string;
}

/**
 * Primary search function. Routes all open-web retrieval through Exa.
 * Logs every call to the source audit trail.
 */
export async function exaSearch(
  query: string,
  options: ExaSearchOptions = {}
): Promise<ExaSearchResponse> {
  const {
    type = "auto",
    numResults = 10,
    startPublishedDate,
    endPublishedDate,
    includeDomains,
    excludeDomains,
    useAutoprompt = true,
    agentName = "unknown",
  } = options;

  const client = getClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams: any = {
      type,
      numResults,
      useAutoprompt,
      contents: {
        text: { maxCharacters: 2000 },
        highlights: { numSentences: 3, highlightsPerUrl: 2 },
        summary: { query },
      },
    };

    if (startPublishedDate) searchParams.startPublishedDate = startPublishedDate;
    if (endPublishedDate) searchParams.endPublishedDate = endPublishedDate;
    if (includeDomains?.length) searchParams.includeDomains = includeDomains;
    if (excludeDomains?.length) searchParams.excludeDomains = excludeDomains;

    const response = await client.searchAndContents(query, searchParams);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: ExaResult[] = (response.results || []).map((r: any) => ({
      id: r.id || "",
      url: r.url || "",
      title: r.title || "",
      publishedDate: r.publishedDate,
      text: r.text,
      highlights: r.highlights,
      summary: r.summary,
      score: r.score,
    }));

    // Log each result to source audit
    for (const r of results) {
      logSource(
        r.url,
        query,
        r.summary || r.highlights?.[0] || r.text?.slice(0, 200) || "",
        agentName
      );
    }

    return {
      results,
      noResults: results.length === 0,
      rawQuery: query,
    };
  } catch (err) {
    console.error("[Exa] Search failed for query:", query.slice(0, 80), err);
    return { results: [], noResults: true, rawQuery: query };
  }
}

/**
 * News-specific search (uses Exa's neural search with recency bias).
 */
export async function exaNewsSearch(
  query: string,
  windowDays: number,
  agentName = "news_agent"
): Promise<ExaSearchResponse> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - windowDays * 86400000)
    .toISOString()
    .split("T")[0];

  return exaSearch(query, {
    type: "neural",
    numResults: 15,
    startPublishedDate: startDate,
    endPublishedDate: endDate,
    agentName,
  });
}

/**
 * Returns the EXA_NO_RESULTS sentinel string for consistent gap reporting.
 */
export { EXA_NO_RESULTS };
