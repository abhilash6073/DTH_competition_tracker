// ============================================================
// agents/pricing.ts — Pricing & Pack Comparison agent
// ============================================================
import { PlansPack, DataGap, RunConfig, DTH_OPERATORS } from "@/agents/types";
import { fetchOperatorPacks, resultToSnippet } from "@/agents/scraping";
import { claudeComplete, SYSTEM_PROMPT_BASE } from "@/lib/claude";
import {
  reactLog,
  uuidv4,
  pincodeToRegion,
  markDataGap,
  getAllGaps,
} from "@/agents/utils";

const PRICING_SYSTEM = `${SYSTEM_PROMPT_BASE}

You are the Pricing & Pack Comparison Agent for Tata Play.
Extract DTH subscription pack details from the provided web content.

Rules:
- Only extract numbers and details explicitly stated in the content.
- If price is not stated, omit it — do not guess.
- If channel count is not stated, omit it — do not guess.
- Normalize: if annual price given, divide by 12 for monthlyPrice.
- Return a JSON array of pack objects. If no packs found, return [].`;

interface PackRaw {
  packName: string;
  monthlyPrice?: number;
  billingCycle?: string;
  totalChannels?: number;
  hdChannels?: number;
  hasOTTBundled?: boolean;
  ottBundles?: string[];
  keyGenres?: string[];
  regionalLanguages?: string[];
}

async function extractPacks(
  operator: string,
  snippet: string,
  url: string
): Promise<PackRaw[]> {
  if (!snippet || snippet.length < 50) return [];

  try {
    const { text } = await claudeComplete(
      PRICING_SYSTEM,
      `Operator: ${operator}
Source URL: ${url}
Content: ${snippet.slice(0, 3000)}

Extract all subscription packs. Return JSON array only:
[
  {
    "packName": "...",
    "monthlyPrice": 299,
    "billingCycle": "monthly",
    "totalChannels": 500,
    "hdChannels": 100,
    "hasOTTBundled": false,
    "ottBundles": [],
    "keyGenres": ["sports", "news", "movies"],
    "regionalLanguages": ["Hindi", "Tamil"]
  }
]`,
      600
    );

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as PackRaw[];
  } catch {
    return [];
  }
}

export async function runPricingAgent(
  config: RunConfig
): Promise<{ packs: PlansPack[]; gaps: DataGap[] }> {
  reactLog({
    thought: `Starting Pricing Agent for regions: ${config.regions_or_pincodes.join(", ")}`,
    action: "Fetch pack data for all DTH operators per region.",
    observation: "Will normalize and compare packs.",
  });

  // Build operator×region pairs, then process all in parallel
  const pairs: { operator: string; pincode: string; region: string }[] = [];
  for (const pincode of config.regions_or_pincodes) {
    const regionInfo = pincodeToRegion(pincode);
    for (const operator of DTH_OPERATORS) {
      if (
        config.focus_entities?.length &&
        !config.focus_entities.some((f) =>
          operator.toLowerCase().includes(f.toLowerCase())
        )
      ) continue;
      pairs.push({ operator, pincode, region: regionInfo.state });
    }
  }

  async function fetchPair(pair: typeof pairs[0]): Promise<PlansPack[]> {
    const raw = await fetchOperatorPacks(pair.operator, pair.region);
    if (raw.noResults || raw.results.length === 0) {
      markDataGap(
        `${pair.operator} packs (${pair.region})`,
        "No pack data retrieved from Exa",
        `Visit ${pair.operator}'s official website or TRAI pack listing`
      );
      return [];
    }

    const packs: PlansPack[] = [];
    // Classify top 2 results per operator concurrently
    const extracted = await Promise.all(
      raw.results.slice(0, 2).map((result) =>
        extractPacks(pair.operator, resultToSnippet(result), result.url).then(
          (rawPacks) => ({ result, rawPacks })
        )
      )
    );

    for (const { result, rawPacks } of extracted) {
      for (const p of rawPacks) {
        if (!p.packName) continue;
        packs.push({
          id: uuidv4(),
          operator: pair.operator,
          packName: p.packName,
          region: pair.region,
          pincode: pair.pincode,
          monthlyPrice: p.monthlyPrice || 0,
          billingCycle: (p.billingCycle as PlansPack["billingCycle"]) || "monthly",
          totalChannels: p.totalChannels || 0,
          hdChannels: p.hdChannels || 0,
          sdChannels: (p.totalChannels || 0) - (p.hdChannels || 0),
          hasOTTBundled: p.hasOTTBundled || false,
          ottBundles: p.ottBundles || [],
          keyGenres: p.keyGenres || [],
          regionalLanguages: p.regionalLanguages || [],
          hasSports: p.keyGenres?.includes("sports") || false,
          hasMovies: p.keyGenres?.includes("movies") || false,
          hasNews: p.keyGenres?.includes("news") || false,
          dataFreshness: new Date().toISOString(),
          dataGaps: p.monthlyPrice === undefined
            ? [{ field: "monthlyPrice", reason: "Not found in retrieved content", suggestedSource: "Operator website" }]
            : [],
          sources: [result.id],
        });
      }
    }
    return packs;
  }

  const pairResults = await Promise.allSettled(pairs.map(fetchPair));
  const allPacks: PlansPack[] = [];
  pairResults.forEach((r) => { if (r.status === "fulfilled") allPacks.push(...r.value); });

  if (allPacks.length === 0) {
    markDataGap(
      "All operator packs",
      "No pack data could be extracted from Exa results",
      "Integrate TRAI pack listing API or scrape operator websites directly"
    );
  }

  reactLog({
    thought: "Pricing Agent complete.",
    action: "Return extracted packs.",
    observation: `Extracted ${allPacks.length} packs across ${DTH_OPERATORS.length} operators.`,
  });

  return { packs: allPacks, gaps: getAllGaps() };
}
