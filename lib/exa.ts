// ============================================================
// lib/exa.ts — Exa.ai client wrapper with Tavily fallback
// EXA_API_KEY and TAVILY_API_KEY are never printed/logged.
// ============================================================
import Exa from "exa-js";
import { tavily } from "@tavily/core";
import { logSource, EXA_NO_RESULTS } from "@/agents/utils";

// Lazily initialised so tests can run without the env var
let _client: Exa | null = null;

function getClient(): Exa | null {
  try {
    if (!_client) {
      const key = process.env.EXA_API_KEY;
      if (!key) return null;
      _client = new Exa(key);
    }
    return _client;
  } catch (e) {
    console.error("[Exa] Failed to initialize client:", e);
    return null;
  }
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
  provider?: "exa" | "tavily" | "google";
}


export interface ExaSearchResponse {
  results: ExaResult[];
  noResults: boolean;
  rawQuery: string;
  provider: "exa" | "tavily" | "google";
}


/**
 * Fallback search using Tavily SDK.
 */
async function tavilySearchFallback(
  query: string,
  numResults: number = 10,
  agentName: string = "unknown"
): Promise<ExaSearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[Tavily] Fallback failed: TAVILY_API_KEY not found");
    return { results: [], noResults: true, rawQuery: query, provider: "exa" };
  }

  try {
    const tvly = tavily({ apiKey });
    const response = await tvly.search(query, {
      searchDepth: "advanced",
      maxResults: numResults,
    });


    const results: ExaResult[] = (response.results || []).map((r: any) => ({
      id: r.url,
      url: r.url,
      title: r.title,
      text: r.content,
      summary: r.content,
      publishedDate: r.publishedDate, // Check if this matches Tavily SDK's property
      score: r.score,
      provider: "tavily",
    }));

    for (const r of results) {
      logSource(r.url, query, r.summary?.slice(0, 200) || "", agentName);
    }

    return {
      results,
      noResults: results.length === 0,
      rawQuery: query,
      provider: "tavily",
    };
  } catch (err) {
    console.error("[Tavily] Fallback search failed:", err);
    return { results: [], noResults: true, rawQuery: query, provider: "tavily" };
  }
}

/**
 * Fallback search using Google Custom Search API.
 */
async function googleSearchFallback(
  query: string,
  numResults: number = 10,
  agentName: string = "unknown"
): Promise<ExaSearchResponse> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    console.warn("[Google] Fallback failed: GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX not found");
    return { results: [], noResults: true, rawQuery: query, provider: "google" };
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=${numResults}`;
    const res = await fetch(url);
    const data = await res.json();

    const results: ExaResult[] = (data.items || []).map((r: any) => ({
      id: r.link,
      url: r.link,
      title: r.title,
      text: r.snippet,
      summary: r.snippet,
      provider: "google",
    }));

    for (const r of results) {
      logSource(r.url, query, r.summary || "", agentName);
    }

    return {
      results,
      noResults: results.length === 0,
      rawQuery: query,
      provider: "google",
    };
  } catch (err) {
    console.error("[Google] Fallback search failed:", err);
    return { results: [], noResults: true, rawQuery: query, provider: "google" };
  }
}


/**
 * Primary search function. Routes all open-web retrieval through Exa.
 * Falls back to Tavily if Exa fails or returns zero results.
 */
export async function exaSearch(
  query: string,
  options: ExaSearchOptions = {}
): Promise<ExaSearchResponse> {
  const {
    type = "auto",
    numResults = 10,
    useAutoprompt = true,
    agentName = "unknown",
  } = options;

  const client = getClient();

  if (client) {
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

      if (options.startPublishedDate) searchParams.startPublishedDate = options.startPublishedDate;
      if (options.endPublishedDate) searchParams.endPublishedDate = options.endPublishedDate;
      if (options.includeDomains?.length) searchParams.includeDomains = options.includeDomains;
      if (options.excludeDomains?.length) searchParams.excludeDomains = options.excludeDomains;

      const response = await client.searchAndContents(query, searchParams);
      const results: ExaResult[] = (response.results || []).map((r: any) => ({
        id: r.id || "",
        url: r.url || "",
        title: r.title || "",
        publishedDate: r.publishedDate,
        text: r.text,
        highlights: r.highlights,
        summary: r.summary,
        score: r.score,
        provider: "exa",
      }));

      if (results.length > 0) {
        for (const r of results) {
          logSource(r.url, query, r.summary || r.highlights?.[0] || r.text?.slice(0, 200) || "", agentName);
        }
        return { results, noResults: false, rawQuery: query, provider: "exa" };
      }
    } catch (err) {
      console.error("[Exa] Primary search failed, attempting fallback:", err);
    }
  }

  // Fallback chain: Tavily -> Google
  console.log(`[Search] Primary search (Exa) yielded no results for "${query}", trying Tavily...`);
  const tavilyRes = await tavilySearchFallback(query, numResults, agentName);

  if (!tavilyRes.noResults) return tavilyRes;

  console.log(`[Search] Tavily fallback yielded no results for "${query}", trying Google...`);
  return googleSearchFallback(query, numResults, agentName);
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

export { EXA_NO_RESULTS };
