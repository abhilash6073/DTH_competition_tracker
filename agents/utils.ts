// ============================================================
// agents/utils.ts — ReAct helpers, source logging, anti-hallucination
// ============================================================
import { DataGap, SourceRecord } from "./types";
import { v4 as uuidv4 } from "uuid";

// ── ReAct loop logger (internal only, never exposed to user) ─
export interface ReActStep {
  thought: string;
  action: string;
  observation: string;
}

export function reactLog(step: ReActStep): void {
  // Only logged server-side; never sent to frontend
  if (process.env.NODE_ENV === "development") {
    console.log("[ReAct] Thought:", step.thought);
    console.log("[ReAct] Action:", step.action);
    console.log("[ReAct] Observation:", step.observation);
  }
}

// ── Source audit trail ───────────────────────────────────────
const _sources: Map<string, SourceRecord> = new Map();

export function logSource(
  url: string,
  query: string,
  snippet: string,
  agent: string
): SourceRecord {
  const record: SourceRecord = {
    id: uuidv4(),
    url,
    query,
    timestamp: new Date().toISOString(),
    snippet: snippet.slice(0, 500), // cap at 500 chars
    agent,
  };
  _sources.set(record.id, record);

  // NEVER log the raw API key or full URL with credentials
  if (process.env.NODE_ENV === "development") {
    const safeUrl = url.replace(/api[_-]?key=[^&]*/gi, "api_key=***");
    console.log(`[Source] ${agent}: ${safeUrl.slice(0, 120)}`);
  }
  return record;
}

export function getAllSources(): SourceRecord[] {
  return Array.from(_sources.values());
}

export function clearSources(): void {
  _sources.clear();
}

// ── Data gap reporter ────────────────────────────────────────
const _gaps: DataGap[] = [];

export function markDataGap(
  field: string,
  reason: string,
  suggestedSource: string
): DataGap {
  const gap: DataGap = { field, reason, suggestedSource };
  _gaps.push(gap);
  return gap;
}

export function getAllGaps(): DataGap[] {
  return [..._gaps];
}

export function clearGaps(): void {
  _gaps.length = 0;
}

// ── Exa "no results" sentinel ────────────────────────────────
export const EXA_NO_RESULTS =
  "No reliable web data found via Exa for this query in the specified time window.";

export function isNoResults(text: string): boolean {
  return text.trim() === EXA_NO_RESULTS || text.trim() === "";
}

// ── Anti-hallucination guard ─────────────────────────────────
/**
 * Call this before emitting any number, price, date, or channel count
 * that came from LLM inference rather than a retrieved source.
 * Throws if `sourceId` is not in the logged sources map.
 */
export function assertSourced(value: unknown, sourceId: string): void {
  if (!_sources.has(sourceId)) {
    throw new Error(
      `[Anti-hallucination] Value "${JSON.stringify(value)}" has no logged source with id "${sourceId}". ` +
        `Only use data retrieved from Exa or internal APIs.`
    );
  }
}

// ── IST date helpers ─────────────────────────────────────────
export function nowIST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

export function daysAgo(n: number): Date {
  const d = nowIST();
  d.setDate(d.getDate() - n);
  return d;
}

export function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function exaDateFilter(windowDays: number): {
  startPublishedDate: string;
  endPublishedDate: string;
} {
  return {
    startPublishedDate: toISODate(daysAgo(windowDays)),
    endPublishedDate: toISODate(nowIST()),
  };
}

// ── Pincode → region mapping ─────────────────────────────────
const PINCODE_MAP: Record<string, { state: string; region: string; metro: boolean }> = {
  "110": { state: "Delhi", region: "North", metro: true },
  "400": { state: "Maharashtra", region: "West", metro: true },
  "500": { state: "Telangana", region: "South", metro: true },
  "560": { state: "Karnataka", region: "South", metro: true },
  "600": { state: "Tamil Nadu", region: "South", metro: true },
  "700": { state: "West Bengal", region: "East", metro: true },
  "380": { state: "Gujarat", region: "West", metro: true },
  "302": { state: "Rajasthan", region: "North", metro: false },
  "226": { state: "Uttar Pradesh", region: "North", metro: false },
  "800": { state: "Bihar", region: "East", metro: false },
  "682": { state: "Kerala", region: "South", metro: false },
  "160": { state: "Punjab", region: "North", metro: false },
  "440": { state: "Maharashtra (Nagpur)", region: "West", metro: false },
  "452": { state: "Madhya Pradesh", region: "Central", metro: false },
  "492": { state: "Chhattisgarh", region: "Central", metro: false },
};

export function pincodeToRegion(pincode: string): {
  state: string;
  region: string;
  metro: boolean;
} {
  const prefix3 = pincode.slice(0, 3);
  const prefix2 = pincode.slice(0, 2);
  return (
    PINCODE_MAP[prefix3] ||
    PINCODE_MAP[prefix2] || {
      state: "Unknown",
      region: "Unknown",
      metro: false,
    }
  );
}

// ── UUID helper (re-exported for agent use) ──────────────────
export { uuidv4 };

// ── Truncate text ────────────────────────────────────────────
export function truncate(text: string, maxLen = 300): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

// ── Confidence and Limitations builder ──────────────────────
export function buildConfidenceLimitations(
  gaps: DataGap[],
  strongAreas: string[],
  weakAreas: string[]
): string {
  const gapLines = gaps
    .map((g) => `- **${g.field}**: ${g.reason} → Suggested: ${g.suggestedSource}`)
    .join("\n");

  return `
## Confidence and Limitations

### Strong Data Areas
${strongAreas.map((a) => `- ${a}`).join("\n")}

### Weak Data Areas / Manual Validation Required
${weakAreas.map((a) => `- ${a}`).join("\n")}

### Known Data Gaps
${gapLines || "None identified in this run."}

> This report was generated by an AI system. All numeric values, prices, and channel counts are sourced from retrieved web data or internal APIs. Hypotheses are explicitly labeled. Do not use this report as the sole basis for pricing or product decisions without manual validation.
`.trim();
}
