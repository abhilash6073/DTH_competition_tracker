// ============================================================
// agents/deactivation.ts — Deactivation Correlation agent
// Correlates internal deactivation data with external events.
// ============================================================
import {
  EventCorrelation,
  ExternalEvent,
  DeactivationDataPoint,
  EventType,
  DataGap,
  RunConfig,
  ConfidenceLevel,
} from "@/agents/types";
import { fetchExternalEvents, resultToSnippet } from "@/agents/scraping";
import { claudeComplete, SYSTEM_PROMPT_BASE } from "@/lib/claude";
import { reactLog, uuidv4, markDataGap, getAllGaps, toISODate, daysAgo } from "@/agents/utils";

const DEACTIVATION_SYSTEM = `${SYSTEM_PROMPT_BASE}

You are the Deactivation Correlation Agent for Tata Play.
Given external event data and internal deactivation patterns, identify correlations and causal hypotheses.

Rules:
- Always label: "correlation" vs "causal hypothesis".
- Confidence levels: high (strong temporal and regional overlap + known mechanism), medium (temporal overlap, plausible mechanism), low (tenuous link).
- Never fabricate deactivation numbers. If internal data is not provided, use placeholder analysis.
- Provide a concrete recommended action for Tata Play.

Return valid JSON.`;

const EVENT_TYPES: { type: EventType; query: string }[] = [
  { type: "exam", query: "board exams JEE NEET CBSE state board schedule India" },
  { type: "festival", query: "religious festival fasting calendar India 2025 2026" },
  { type: "sports_event", query: "IPL cricket India match schedule 2025 2026" },
  { type: "weather_disaster", query: "cyclone flood heavy rainfall India weather alert" },
  { type: "political_election", query: "India election political news state elections" },
];

async function buildExternalEvents(
  region: string,
  windowDays: number
): Promise<ExternalEvent[]> {
  const results = await Promise.all(
    EVENT_TYPES.map((et) => fetchExternalEvents(et.query, region, windowDays).then((raw) => ({ et, raw })))
  );

  const events: ExternalEvent[] = [];
  for (const { et, raw } of results) {
    if (raw.noResults) continue;

    for (const result of raw.results.slice(0, 3)) {
      const snippet = resultToSnippet(result);
      if (!snippet || snippet.length < 20) continue;

      events.push({
        id: uuidv4(),
        type: et.type,
        name: result.title || et.type,
        date: result.publishedDate || toISODate(new Date()),
        affectedRegions: [region],
        description: snippet.slice(0, 300),
        sourceId: result.id,
      });
    }
  }

  return events;
}

async function correlateEvent(
  event: ExternalEvent,
  deactivationData: DeactivationDataPoint[],
  region: string
): Promise<EventCorrelation | null> {
  const regionData = deactivationData.filter((d) => d.region === region);
  const avgDeactivations =
    regionData.length > 0
      ? regionData.reduce((s, d) => s + d.count, 0) / regionData.length
      : 0;

  try {
    const { text } = await claudeComplete(
      DEACTIVATION_SYSTEM,
      `External Event:
- Name: ${event.name}
- Type: ${event.type}
- Date: ${event.date}
- Region: ${region}
- Description: ${event.description}

Internal Deactivation Context:
- Region: ${region}
- Average daily deactivations: ${avgDeactivations.toFixed(0)} (based on ${regionData.length} data points)
- Data points available: ${regionData.length > 0 ? "Yes" : "No (simulated)"}

Analyze whether this event correlates with or causes changes in Tata Play deactivations in this region.

Return valid JSON only:
{
  "correlationLabel": "correlation|causal hypothesis|no link",
  "deactivationDelta": 0,
  "causalHypothesis": "...",
  "correlationVsCausationLabel": "...",
  "confidence": "high|medium|low",
  "recommendedAction": "..."
}`,
      400
    );

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);

    return {
      id: uuidv4(),
      event,
      affectedRegion: region,
      deactivationDelta: parsed.deactivationDelta || 0,
      causalHypothesis: parsed.causalHypothesis || "",
      correlationVsCausationLabel: parsed.correlationVsCausationLabel || "",
      confidence: (parsed.confidence as ConfidenceLevel) || "low",
      recommendedAction: parsed.recommendedAction || "",
      basis: "hypothesis",
    };
  } catch {
    return null;
  }
}

/**
 * Generate mock deactivation data when internal API is not configured.
 * Clearly labeled as simulated.
 */
function generateMockDeactivationData(
  regions: string[],
  windowDays: number
): DeactivationDataPoint[] {
  const data: DeactivationDataPoint[] = [];
  for (const region of regions) {
    for (let i = 0; i < windowDays; i++) {
      const date = toISODate(daysAgo(i));
      // Simulated baseline with some variation
      const base = 100 + Math.floor(Math.random() * 50);
      data.push({ date, region, count: base, isAnomaly: base > 130 });
    }
  }
  return data;
}

export async function runDeactivationAgent(
  config: RunConfig,
  internalData?: DeactivationDataPoint[],
  targetRegion?: string
): Promise<{ correlations: EventCorrelation[]; gaps: DataGap[] }> {
  reactLog({
    thought: `Starting Deactivation Correlation Agent for ${config.deactivation_window_days} days.`,
    action: "Fetch external events and correlate with deactivation patterns.",
    observation: "Will produce correlation hypotheses with confidence levels.",
  });

  // Use provided internal data or generate mock data
  let deactivationData = internalData;
  if (!deactivationData || deactivationData.length === 0) {
    const regions = config.regions_or_pincodes.map(
      (p) => `Region-${p.slice(0, 3)}`
    );
    deactivationData = generateMockDeactivationData(
      regions,
      config.deactivation_window_days
    );
    markDataGap(
      "Internal deactivation data",
      "No internal deactivation data provided — using simulated data for demonstration",
      "Connect Tata Play internal API or upload CSV via /api/run payload"
    );
  }

  const correlations: EventCorrelation[] = [];
  const allRegions = [...new Set(deactivationData.map((d) => d.region))];
  const uniqueRegions = targetRegion
    ? allRegions.filter((r) => r === targetRegion)
    : allRegions.slice(0, 5);

  for (const region of uniqueRegions) {
    reactLog({
      thought: `Building external events for region: ${region}`,
      action: `fetchExternalEvents for ${region}`,
      observation: "Awaiting results.",
    });

    const events = await buildExternalEvents(region, config.deactivation_window_days);

    for (const event of events) {
      const correlation = await correlateEvent(event, deactivationData, region);
      if (correlation) correlations.push(correlation);
    }
  }

  // Sort by confidence and delta
  correlations.sort((a, b) => {
    const confOrder = { high: 3, medium: 2, low: 1 };
    return confOrder[b.confidence] - confOrder[a.confidence];
  });

  reactLog({
    thought: "Deactivation Correlation Agent complete.",
    action: "Return correlations.",
    observation: `Found ${correlations.length} event correlations.`,
  });

  return {
    correlations: correlations.slice(0, config.max_items_per_section),
    gaps: getAllGaps(),
  };
}
