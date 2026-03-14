import { NextRequest, NextResponse } from "next/server";
import { runPMAnalystAgent } from "@/agents/pm-analyst";
import { EntityCategory } from "@/agents/news-sentiment";
import { RunConfig } from "@/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: RunConfig = body.config;
    const category: EntityCategory | undefined = body.category;

    const result = await runPMAnalystAgent(config, category);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/agents/pm]", err);
    return NextResponse.json(
      { error: String(err), items: [], gaps: [] },
      { status: 500 }
    );
  }
}
