/**
 * lib/searchProvider.ts
 * Unified search interface. Entry point for all search requests.
 * Currently wraps exaSearch which handles its own Tavily fallback.
 */

import { exaSearch, ExaSearchOptions, ExaSearchResponse, ExaResult } from "./exa";

export interface UnifiedSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
  provider: "exa" | "tavily";
}

export interface UnifiedSearchResponse {
  results: UnifiedSearchResult[];
  provider: "exa" | "tavily";
  query: string;
}

/**
 * Conducts a search using the primary search provider (Exa) with automatic 
 * fallback to Tavily.
 */
export async function conductSearch(
  query: string,
  options: ExaSearchOptions = {}
): Promise<UnifiedSearchResponse> {
  const response = await exaSearch(query, options);
  
  return {
    results: response.results.map(r => ({
      title: r.title,
      url: r.url,
      content: r.summary || r.text || "",
      score: r.score,
      publishedDate: r.publishedDate,
      provider: r.provider || "exa",
    })),
    provider: response.provider,
    query,
  };
}
