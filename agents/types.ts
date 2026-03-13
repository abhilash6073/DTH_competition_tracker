// ============================================================
// agents/types.ts — Shared TypeScript interfaces for all agents
// ============================================================

// ── Run configuration ────────────────────────────────────────
export interface RunConfig {
  regions_or_pincodes: string[];
  plans_time_window_days: number;   // default 1
  news_time_window_days: number;    // default 1
  deactivation_window_days: number; // default 1
  focus_entities?: string[];        // optional competitor filter
  max_items_per_section: number;    // default 5
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  regions_or_pincodes: ["400001", "560001", "110001", "600001", "700001"],
  plans_time_window_days: 1,
  news_time_window_days: 1,
  deactivation_window_days: 1,
  max_items_per_section: 5,
};

// ── Source audit trail ───────────────────────────────────────
export interface SourceRecord {
  id: string;
  url: string;
  query: string;
  timestamp: string; // ISO
  snippet: string;
  agent: string;
}

// ── Agent task orchestration ─────────────────────────────────
export type AgentTaskType =
  | "news_sentiment"
  | "pm_analysis"
  | "pricing_comparison"
  | "deactivation_correlation"
  | "report_generation";

export interface AgentTask {
  id: string;
  type: AgentTaskType;
  query: string;
  priority: "high" | "medium" | "low";
  dependsOn?: string[]; // task IDs
}

export interface AgentResult<T = unknown> {
  taskId: string;
  agentName: string;
  data: T;
  sources: SourceRecord[];
  dataGaps: DataGap[];
  completedAt: string;
}

// ── Data quality ─────────────────────────────────────────────
export type DataBasis = "report" | "exa" | "hypothesis";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface DataGap {
  field: string;
  reason: string;
  suggestedSource: string;
}

// ── Competitor news ──────────────────────────────────────────
export type NewsCategory =
  | "pricing_change"
  | "content_rights"
  | "new_feature"
  | "partnership"
  | "merger_acquisition"
  | "regulatory"
  | "outage"
  | "pr_campaign"
  | "other";

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface CompetitorNewsItem {
  id: string;
  entity: string;         // e.g. "Airtel Digital TV"
  entityType: "dth" | "ott" | "isp";
  title: string;
  date: string;           // ISO date
  url: string;
  category: NewsCategory;
  relevanceScore: number; // 0–10
  summary: string;        // 2–3 lines
  whyItMatterForTataPlay: string;
  sentiment: SentimentLabel;
  basis: DataBasis;
  sourceId: string;
}

// ── Product launches ─────────────────────────────────────────
export interface PMAnalysisBlock {
  jobToBeDone: string;
  frictionRemoved: string;
  targetSegment: string;
  impactOnUserBehavior: string;
  cannibalizeOrUpsell: string;
  threatScoreToTataPlay: number; // 0–10
  threatJustification: string;
  churnRiskFromTataPlay: "high" | "medium" | "low";
  churnRiskExplanation: string;
  basis: DataBasis;
  confidence: ConfidenceLevel;
}

export interface LaunchItem {
  id: string;
  entity: string;
  entityType: "dth" | "ott" | "isp";
  title: string;
  detectedDate: string;
  effectiveDate?: string;
  changeDescription: string;
  oldValue?: string;
  newValue?: string;
  category: NewsCategory;
  pmAnalysis: PMAnalysisBlock;
  sources: string[]; // source IDs
}

// ── DTH pack comparison ──────────────────────────────────────
export interface ChannelInfo {
  name: string;
  genre: string;
  language: string;
  isHD: boolean;
  isFTA: boolean;
}

export interface PlansPack {
  id: string;
  operator: string;
  packName: string;
  region: string;       // state or region label
  pincode?: string;
  monthlyPrice: number; // INR effective monthly
  billingCycle: "monthly" | "quarterly" | "annual" | "other";
  totalChannels: number;
  hdChannels: number;
  sdChannels: number;
  hasOTTBundled: boolean;
  ottBundles: string[];
  keyGenres: string[];  // sports, news, movies, regional, kids
  regionalLanguages: string[];
  hasSports: boolean;
  hasMovies: boolean;
  hasNews: boolean;
  channelList?: ChannelInfo[];
  dataFreshness: string; // ISO date retrieved
  dataGaps: DataGap[];
  sources: string[]; // source IDs
}

// ── Deactivation correlation ──────────────────────────────────
export type EventType =
  | "exam"
  | "festival"
  | "fasting"
  | "weather_disaster"
  | "sports_event"
  | "political_election"
  | "geo_political"
  | "other";

export interface ExternalEvent {
  id: string;
  type: EventType;
  name: string;
  date: string;       // ISO
  endDate?: string;
  affectedRegions: string[];
  description: string;
  sourceId: string;
}

export interface DeactivationDataPoint {
  date: string;       // ISO
  region: string;
  count: number;
  isAnomaly?: boolean;
}

export interface EventCorrelation {
  id: string;
  event: ExternalEvent;
  affectedRegion: string;
  deactivationDelta: number;       // +ve = spike, -ve = drop
  correlationCoefficient?: number; // if calculable
  causalHypothesis: string;
  correlationVsCausationLabel: string;
  confidence: ConfidenceLevel;
  recommendedAction: string;
  basis: DataBasis;
}

// ── Recommendations ──────────────────────────────────────────
export type RecommendationCategory =
  | "pricing"
  | "product"
  | "retention"
  | "acquisition"
  | "content"
  | "regulatory"
  | "regional";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  suggestedAction: string;
  expectedImpact: string;
  timeToExecute: "immediate" | "short_term" | "medium_term" | "long_term";
  basis: DataBasis;
  confidence: ConfidenceLevel;
  relatedNewsIds?: string[];
  relatedLaunchIds?: string[];
}

// ── Full report JSON ─────────────────────────────────────────
export interface ReportJSON {
  reportId: string;
  generatedAt: string; // ISO
  config: RunConfig;
  competitor_news: CompetitorNewsItem[];
  launches: LaunchItem[];
  plans_and_packs: PlansPack[];
  events_correlation: EventCorrelation[];
  recommendations: Recommendation[];
  sources: SourceRecord[];
  dataGaps: DataGap[];
  confidenceAndLimitations: string;
  markdownReport: string;
  qualityScore?: number; // internal 0–10
}

// ── Chat types ───────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  basis?: DataBasis;
  sources?: string[];   // URLs
  timestamp: string;
}

export interface ChatSession {
  sessionId: string;
  reportId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ── SSE event types ──────────────────────────────────────────
export type SSEEventType =
  | "run_started"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "run_complete"
  | "error"
  | "chat_token"
  | "chat_done";

export interface SSEEvent {
  type: SSEEventType;
  taskId?: string;
  agentName?: string;
  data?: unknown;
  error?: string;
  token?: string;
}

// ── DTH operators tracked ────────────────────────────────────
export const DTH_OPERATORS = [
  "Tata Play",
  "Airtel Digital TV",
  "Dish TV",
  "Videocon d2h",
  "Sun Direct",
  "DD Free Dish",
] as const;

export const OTT_PLATFORMS = [
  "Netflix",
  "Prime Video",
  "Disney+ Hotstar",
  "JioCinema",
  "SonyLIV",
  "Zee5",
  "MX Player",
  "Aha",
  "Sun NXT",
] as const;

export const ISP_BUNDLES = [
  "Jio Fiber",
  "Airtel Broadband",
  "BSNL Broadband",
  "ACT Fibernet",
] as const;
