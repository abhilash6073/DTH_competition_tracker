// ============================================================
// lib/mapUtils.ts — India deactivation map utilities
// ============================================================
import { EventCorrelation, EventType, ConfidenceLevel } from "@/agents/types";

// ── State code constants ──────────────────────────────────────
export const GEO_NAME_TO_CODE: Record<string, string> = {
  // GeoJSON NAME_1 values → ISO 2-letter state codes
  "andaman and nicobar": "AN",
  "andhra pradesh": "AP",
  "arunachal pradesh": "AR",
  "assam": "AS",
  "bihar": "BR",
  "chandigarh": "CH",
  "chhattisgarh": "CG",
  "dadra and nagar haveli": "DN",
  "daman and diu": "DD",
  "delhi": "DL",
  "goa": "GA",
  "gujarat": "GJ",
  "haryana": "HR",
  "himachal pradesh": "HP",
  "jammu and kashmir": "JK",
  "jharkhand": "JH",
  "karnataka": "KA",
  "kerala": "KL",
  "lakshadweep": "LD",
  "madhya pradesh": "MP",
  "maharashtra": "MH",
  "manipur": "MN",
  "meghalaya": "ML",
  "mizoram": "MZ",
  "nagaland": "NL",
  "orissa": "OR",
  "odisha": "OR",
  "puducherry": "PY",
  "pondicherry": "PY",
  "punjab": "PB",
  "rajasthan": "RJ",
  "sikkim": "SK",
  "tamil nadu": "TN",
  "tripura": "TR",
  "uttar pradesh": "UP",
  "uttarakhand": "UK",
  "uttaranchal": "UK",
  "west bengal": "WB",
  "telangana": "TG",
  "ladakh": "LA",
};

// Reverse map: state code → GeoJSON NAME_1 value
export const CODE_TO_GEO_NAME: Record<string, string> = {
  AN: "Andaman and Nicobar",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CG: "Chhattisgarh",
  DN: "Dadra and Nagar Haveli",
  DD: "Daman and Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JK: "Jammu and Kashmir",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  LD: "Lakshadweep",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OR: "Orissa",
  PY: "Puducherry",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttaranchal",
  WB: "West Bengal",
  TG: "Telangana",
  LA: "Ladakh",
};

// ── Pincode prefix → state code ───────────────────────────────
// Maps the first 3 digits of a 6-digit pincode to a state code
const PINCODE_PREFIX_TO_STATE: Record<string, string> = {
  "110": "DL", "111": "DL",
  "121": "HR", "122": "HR", "123": "HR", "124": "HR", "125": "HR",
  "126": "HR", "127": "HR", "128": "HR", "129": "HR", "130": "HR",
  "131": "HR", "132": "HR", "133": "HR", "134": "HR", "135": "HR",
  "140": "PB", "141": "PB", "142": "PB", "143": "PB", "144": "PB",
  "145": "PB", "146": "PB", "147": "PB", "148": "PB", "149": "PB",
  "151": "PB", "152": "PB", "153": "PB", "154": "PB", "155": "PB",
  "156": "PB", "157": "PB", "158": "PB",
  "160": "CH",
  "170": "HP", "171": "HP", "172": "HP", "173": "HP", "174": "HP",
  "175": "HP", "176": "HP", "177": "HP",
  "180": "JK", "181": "JK", "182": "JK", "183": "JK", "184": "JK",
  "185": "JK", "186": "JK", "190": "JK", "191": "JK", "192": "JK",
  "193": "JK", "194": "JK",
  "200": "UP", "201": "UP", "202": "UP", "203": "UP", "204": "UP",
  "205": "UP", "206": "UP", "207": "UP", "208": "UP", "209": "UP",
  "210": "UP", "211": "UP", "212": "UP", "213": "UP", "214": "UP",
  "215": "UP", "221": "UP", "222": "UP", "223": "UP", "224": "UP",
  "225": "UP", "226": "UP", "227": "UP", "228": "UP", "229": "UP",
  "231": "UP", "232": "UP", "233": "UP", "241": "UP", "242": "UP",
  "243": "UP", "244": "UK", "245": "UK", "246": "UK", "247": "UK",
  "248": "UK", "249": "UK", "250": "UP", "251": "UP", "261": "UP",
  "262": "UK", "263": "UK", "271": "UP", "272": "UP", "273": "UP",
  "274": "UP", "275": "UP", "276": "UP", "277": "UP", "281": "UP",
  "282": "UP", "283": "UP", "284": "UP", "285": "UP",
  "300": "RJ", "301": "RJ", "302": "RJ", "303": "RJ", "304": "RJ",
  "305": "RJ", "306": "RJ", "307": "RJ", "311": "RJ", "312": "RJ",
  "313": "RJ", "314": "RJ", "321": "RJ", "322": "RJ", "323": "RJ",
  "324": "RJ", "325": "RJ", "326": "RJ", "327": "RJ", "328": "RJ",
  "329": "RJ", "331": "RJ", "332": "RJ", "333": "RJ", "334": "RJ",
  "335": "RJ", "341": "RJ", "342": "RJ", "343": "RJ", "344": "RJ",
  "345": "RJ",
  "360": "GJ", "361": "GJ", "362": "GJ", "363": "GJ", "364": "GJ",
  "365": "GJ", "370": "GJ", "380": "GJ", "382": "GJ", "383": "GJ",
  "384": "GJ", "385": "GJ", "388": "GJ", "390": "GJ", "391": "GJ",
  "392": "GJ", "394": "GJ", "395": "GJ", "396": "GJ",
  "400": "MH", "401": "MH", "402": "MH", "404": "MH",
  "410": "MH", "411": "MH", "412": "MH", "413": "MH", "414": "MH",
  "415": "MH", "416": "MH", "417": "MH", "418": "MH", "419": "MH",
  "421": "MH", "422": "MH", "423": "MH", "424": "MH", "425": "MH",
  "431": "MH", "432": "MH", "440": "MH", "441": "MH", "442": "MH",
  "443": "MH", "444": "MH", "445": "MH",
  "403": "GA",
  "450": "MP", "451": "MP", "452": "MP", "453": "MP", "454": "MP",
  "455": "MP", "456": "MP", "457": "MP", "458": "MP", "460": "MP",
  "461": "MP", "462": "MP", "463": "MP", "464": "MP", "465": "MP",
  "466": "MP", "470": "MP", "471": "MP", "472": "MP", "473": "MP",
  "474": "MP", "475": "MP", "476": "MP", "477": "MP", "478": "MP",
  "480": "MP", "481": "MP", "482": "MP", "483": "MP", "484": "MP",
  "485": "MP", "486": "MP", "487": "MP", "488": "MP",
  "490": "CG", "491": "CG", "492": "CG", "493": "CG", "494": "CG",
  "495": "CG", "496": "CG",
  "500": "TG", "501": "TG", "502": "TG", "503": "TG", "504": "TG",
  "505": "TG", "506": "TG", "507": "TG", "508": "TG", "509": "TG",
  "515": "AP", "516": "AP", "517": "AP", "518": "AP", "519": "AP",
  "520": "AP", "521": "AP", "522": "AP", "523": "AP", "524": "AP",
  "525": "AP", "530": "AP", "531": "AP", "532": "AP", "533": "AP",
  "534": "AP", "535": "AP",
  "560": "KA", "561": "KA", "562": "KA", "563": "KA", "564": "KA",
  "570": "KA", "571": "KA", "572": "KA", "573": "KA", "574": "KA",
  "575": "KA", "576": "KA", "577": "KA", "580": "KA", "581": "KA",
  "582": "KA", "583": "KA", "584": "KA", "585": "KA", "586": "KA",
  "587": "KA", "590": "KA", "591": "KA", "592": "KA", "593": "KA",
  "600": "TN", "601": "TN", "602": "TN", "603": "TN", "604": "TN",
  "605": "PY", "606": "TN", "607": "TN", "608": "TN", "609": "TN",
  "610": "TN", "611": "TN", "612": "TN", "613": "TN", "614": "TN",
  "615": "TN", "620": "TN", "621": "TN", "622": "TN", "623": "TN",
  "624": "TN", "625": "TN", "626": "TN", "627": "TN", "628": "TN",
  "629": "TN", "630": "TN", "631": "TN", "632": "TN", "633": "TN",
  "634": "TN", "635": "TN", "636": "TN", "637": "TN", "638": "TN",
  "639": "TN", "641": "TN", "642": "TN", "643": "TN",
  "670": "KL", "671": "KL", "672": "KL", "673": "KL", "676": "KL",
  "677": "KL", "678": "KL", "679": "KL", "680": "KL", "681": "KL",
  "682": "KL", "683": "KL", "685": "KL", "686": "KL", "688": "KL",
  "689": "KL", "690": "KL", "691": "KL", "692": "KL", "695": "KL",
  "700": "WB", "711": "WB", "712": "WB", "713": "WB", "721": "WB",
  "722": "WB", "723": "WB", "731": "WB", "732": "WB", "733": "WB",
  "734": "WB", "735": "WB", "741": "WB", "742": "WB", "743": "WB",
  "737": "SK",
  "744": "AN",
  "751": "OR", "752": "OR", "753": "OR", "754": "OR", "755": "OR",
  "756": "OR", "757": "OR", "758": "OR", "759": "OR", "760": "OR",
  "761": "OR", "762": "OR", "763": "OR", "764": "OR", "765": "OR",
  "766": "OR", "767": "OR", "768": "OR", "769": "OR", "770": "OR",
  "781": "AS", "782": "AS", "783": "AS", "784": "AS", "785": "AS",
  "786": "AS", "787": "AS",
  "790": "AR", "791": "AR", "792": "AR",
  "793": "ML", "794": "ML",
  "795": "MN",
  "796": "MZ",
  "797": "NL",
  "799": "TR",
  "800": "BR", "801": "BR", "802": "BR", "803": "BR", "804": "BR",
  "805": "BR", "811": "BR", "812": "BR", "813": "BR", "821": "BR",
  "822": "BR", "823": "BR", "824": "BR", "841": "BR", "842": "BR",
  "843": "BR", "844": "BR", "845": "BR", "846": "BR", "847": "BR",
  "848": "BR", "851": "BR", "852": "BR", "853": "BR", "854": "BR",
  "855": "BR",
  "814": "JH", "815": "JH", "816": "JH", "817": "JH", "818": "JH",
  "819": "JH", "825": "JH", "826": "JH", "827": "JH", "828": "JH",
  "829": "JH", "832": "JH", "833": "JH", "834": "JH", "835": "JH",
};

// ── Region string → state code ────────────────────────────────
export function parseRegionToStateCode(affectedRegion: string): string | null {
  if (!affectedRegion) return null;
  const r = affectedRegion.trim();

  // 1. Pure 6-digit pincode: "400001"
  if (/^\d{6}$/.test(r)) {
    return PINCODE_PREFIX_TO_STATE[r.slice(0, 3)] ?? null;
  }

  // 2. "Region-NNN" format: "Region-400"
  const regionMatch = r.match(/region[-_]?(\d{3})/i);
  if (regionMatch) {
    return PINCODE_PREFIX_TO_STATE[regionMatch[1]] ?? null;
  }

  // 3. ISO 2-letter code: "MH", "KA"
  if (/^[A-Z]{2}$/.test(r) && CODE_TO_GEO_NAME[r]) {
    return r;
  }

  // 4. State name string (case-insensitive)
  const lower = r.toLowerCase();
  return GEO_NAME_TO_CODE[lower] ?? null;
}

// ── State map data interface ───────────────────────────────────
export interface StateMapData {
  stateCode: string;
  stateName: string;
  netImpactScore: number;    // Σ(deactivationDelta × weight); +ve=bad, -ve=good
  normalizedScore: number;   // 0–1; 0.5=neutral, 1=full red, 0=full green
  correlations: EventCorrelation[];
  eventTypeCounts: Partial<Record<EventType, number>>;
  dominantConfidence: ConfidenceLevel;
  latestEventDate: string;
}

const CONFIDENCE_WEIGHTS: Record<ConfidenceLevel, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

export function buildStateMapData(
  correlations: EventCorrelation[],
  activeEventTypes: EventType[]
): StateMapData[] {
  // Filter by active event types
  const filtered = activeEventTypes.length === 0
    ? correlations
    : correlations.filter((c) => activeEventTypes.includes(c.event.type));

  // Group by state code
  const byState = new Map<string, EventCorrelation[]>();
  for (const corr of filtered) {
    const code = parseRegionToStateCode(corr.affectedRegion);
    if (!code) continue;
    if (!byState.has(code)) byState.set(code, []);
    byState.get(code)!.push(corr);
  }

  // Build per-state data
  const stateDataArr: StateMapData[] = [];
  for (const [code, corrs] of byState.entries()) {
    const netScore = corrs.reduce((sum, c) => {
      return sum + c.deactivationDelta * CONFIDENCE_WEIGHTS[c.confidence];
    }, 0);

    const eventTypeCounts: Partial<Record<EventType, number>> = {};
    for (const c of corrs) {
      eventTypeCounts[c.event.type] = (eventTypeCounts[c.event.type] ?? 0) + 1;
    }

    const confidencePriority: ConfidenceLevel[] = ["high", "medium", "low"];
    const dominantConfidence = confidencePriority.find((lvl) =>
      corrs.some((c) => c.confidence === lvl)
    ) ?? "low";

    const latestEventDate = corrs
      .map((c) => c.event.date)
      .sort()
      .reverse()[0] ?? "";

    stateDataArr.push({
      stateCode: code,
      stateName: CODE_TO_GEO_NAME[code] ?? code,
      netImpactScore: netScore,
      normalizedScore: 0, // computed below after finding max
      correlations: corrs,
      eventTypeCounts,
      dominantConfidence,
      latestEventDate,
    });
  }

  // Normalize scores to [0, 1] with 0.5 = neutral
  const maxAbs = stateDataArr.reduce((m, s) => Math.max(m, Math.abs(s.netImpactScore)), 0);
  for (const s of stateDataArr) {
    if (maxAbs === 0) {
      s.normalizedScore = 0.5;
    } else {
      s.normalizedScore = Math.min(1, Math.max(0, 0.5 + (s.netImpactScore / maxAbs) * 0.5));
    }
  }

  return stateDataArr;
}

// ── Color scale ───────────────────────────────────────────────
const COLOR_LOW  = "#15803d"; // green-700 (recharge-friendly)
const COLOR_MID  = "#9ca3af"; // gray-400 (neutral)
const COLOR_HIGH = "#b91c1c"; // red-700 (high deactivations)
export const COLOR_NO_DATA = "#e5e7eb"; // gray-200

function interpolateColor(c1: string, c2: string, t: number): string {
  const hex = (s: string) => [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = hex(c1);
  const [r2, g2, b2] = hex(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Maps a normalizedScore (0–1) to a hex color */
export function scoreToColor(score: number): string {
  if (score <= 0.5) {
    // green → gray
    return interpolateColor(COLOR_LOW, COLOR_MID, score * 2);
  } else {
    // gray → red
    return interpolateColor(COLOR_MID, COLOR_HIGH, (score - 0.5) * 2);
  }
}

export function getStateColor(
  stateCode: string,
  stateDataMap: Map<string, StateMapData>
): string {
  const data = stateDataMap.get(stateCode);
  if (!data) return COLOR_NO_DATA;
  return scoreToColor(data.normalizedScore);
}

export const ALL_EVENT_TYPES: EventType[] = [
  "exam",
  "festival",
  "fasting",
  "weather_disaster",
  "sports_event",
  "political_election",
  "geo_political",
  "other",
];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  exam: "Exam",
  festival: "Festival",
  fasting: "Fasting",
  weather_disaster: "Weather",
  sports_event: "Sports",
  political_election: "Election",
  geo_political: "Geo-Political",
  other: "Other",
};
