// ============================================================
// agents/chatbot.ts — Interactive Q&A chatbot agent
// Grounded in latest report + Exa fallback for fresh data.
// ============================================================
import { ReportJSON, ChatMessage, ChatSession, DataBasis } from "@/agents/types";
import { claudeStream, LLMMessage } from "@/lib/claude";
import { chatbotSearch } from "@/agents/scraping";
import { getCachedReport } from "@/lib/kv";
import { reactLog, uuidv4, truncate } from "@/agents/utils";

const CHATBOT_SYSTEM_PREFIX = `You are an expert competitive intelligence assistant for Tata Play, India's leading DTH operator.
You have access to the latest Daily Intelligence Report as your primary source of truth.

RESPONSE FORMAT:
- Keep answers concise by default (3–5 sentences or bullet points).
- Label the basis of your answer:
  - "From report data" — when citing the loaded report
  - "From fresh web data via Exa" — when you performed a live search
  - "Hypothesis / inference" — when reasoning beyond available data
- Never fabricate prices, channel counts, or dates.
- If you don't have reliable data: say "I don't have enough reliable data to answer this precisely" and suggest next steps.
- Offer follow-up actions where relevant (e.g., "Add to watchlist", "Compare pack in [pincode]").

Today's date (IST): ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`;

function buildReportContext(report: ReportJSON): string {
  const topNews = report.competitor_news
    .slice(0, 10)
    .map((n) => `• [${n.entity}] ${n.title} (${n.date}): ${n.summary}`)
    .join("\n");

  const topLaunches = report.launches
    .slice(0, 5)
    .map(
      (l) =>
        `• [${l.entity}] ${l.title} — Threat: ${l.pmAnalysis.threatScoreToTataPlay}/10, Churn: ${l.pmAnalysis.churnRiskFromTataPlay}`
    )
    .join("\n");

  const topPacks = report.plans_and_packs
    .slice(0, 10)
    .map(
      (p) =>
        `• ${p.operator} (${p.region}): ${p.packName} @ ₹${p.monthlyPrice}/mo, ${p.totalChannels} ch (${p.hdChannels} HD)`
    )
    .join("\n");

  const topCorrelations = report.events_correlation
    .slice(0, 5)
    .map(
      (c) =>
        `• ${c.affectedRegion} — ${c.event.name}: ${truncate(c.causalHypothesis, 150)} [${c.confidence} confidence]`
    )
    .join("\n");

  const topRecs = report.recommendations
    .slice(0, 5)
    .map((r) => `• [${r.priority.toUpperCase()}] ${r.title}: ${r.suggestedAction}`)
    .join("\n");

  return `=== LATEST INTELLIGENCE REPORT (${new Date(report.generatedAt).toLocaleDateString("en-IN")}) ===

COMPETITOR NEWS (TOP 10):
${topNews || "None"}

PRODUCT LAUNCHES & CHANGES (TOP 5):
${topLaunches || "None"}

PACK COMPARISON (TOP 10):
${topPacks || "None"}

DEACTIVATION CORRELATIONS:
${topCorrelations || "None"}

RECOMMENDATIONS:
${topRecs || "None"}

DATA GAPS: ${report.dataGaps.map((g) => g.field).join(", ") || "None"}
REPORT ID: ${report.reportId}`;
}

/**
 * Decide whether the question needs a live Exa search.
 * Uses keyword heuristics to avoid unnecessary API calls.
 */
function needsLiveSearch(question: string): boolean {
  const liveKeywords = [
    "today",
    "yesterday",
    "latest",
    "just",
    "breaking",
    "recent",
    "this week",
    "now",
    "current",
    "just announced",
    "price change",
    "new plan",
    "search",
    "find",
    "look up",
  ];
  const lower = question.toLowerCase();
  return liveKeywords.some((kw) => lower.includes(kw));
}

/**
 * Main chatbot streaming function.
 * Yields text tokens and a final metadata marker.
 */
export async function* chatbotStream(
  userMessage: string,
  session: ChatSession,
  reportId = "latest"
): AsyncGenerator<{ token?: string; done?: boolean; basis?: DataBasis; sources?: string[] }> {
  reactLog({
    thought: `Chatbot received question: "${truncate(userMessage, 80)}"`,
    action: "Decide: report context | Exa search | clarification needed.",
    observation: "Processing...",
  });

  // Load report
  const report = await getCachedReport(reportId);
  let reportContext = "";
  if (report) {
    reportContext = buildReportContext(report);
  } else {
    reportContext = "No report loaded for this session. Operating without report context.";
  }

  let basis: DataBasis = "report";
  let exaSources: string[] = [];
  let extraContext = "";

  // Check if live Exa search is needed
  if (needsLiveSearch(userMessage)) {
    reactLog({
      thought: "Question requires fresh web data.",
      action: `chatbotSearch("${truncate(userMessage, 60)}")`,
      observation: "Awaiting Exa results.",
    });

    const searchRes = await chatbotSearch(userMessage, 7);
    if (!searchRes.noResults) {
      basis = "exa";
      exaSources = searchRes.results.map((r) => r.url);
      extraContext = `\n\n=== FRESH WEB DATA (via Exa) ===\n${searchRes.results
        .slice(0, 5)
        .map((r) => `• ${r.title}: ${truncate(r.summary || r.highlights?.[0] || "", 200)} [${r.url}]`)
        .join("\n")}`;
    }
  }

  const systemPrompt = `${CHATBOT_SYSTEM_PREFIX}\n\n${reportContext}${extraContext}`;

  // Build conversation history for Claude
  const history: LLMMessage[] = session.messages
    .slice(-10) // last 10 messages for context window management
    .map((m) => ({ role: m.role, content: m.content }));

  // Stream response
  yield { token: undefined, basis };

  for await (const token of claudeStream(systemPrompt, userMessage, history)) {
    yield { token };
  }

  yield { done: true, basis, sources: exaSources };
}

export * from "./chatbot-client";
