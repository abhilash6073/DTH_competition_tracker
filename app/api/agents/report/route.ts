import { NextRequest, NextResponse } from "next/server";
import { runReportAgent } from "@/agents/report";
import {
  RunConfig,
  CompetitorNewsItem,
  LaunchItem,
  PlansPack,
  EventCorrelation,
} from "@/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: RunConfig = body.config;
    const news: CompetitorNewsItem[] = body.news ?? [];
    const launches: LaunchItem[] = body.launches ?? [];
    const packs: PlansPack[] = body.packs ?? [];
    const correlations: EventCorrelation[] = body.correlations ?? [];

    const result = await runReportAgent(config, news, launches, packs, correlations);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/agents/report]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
