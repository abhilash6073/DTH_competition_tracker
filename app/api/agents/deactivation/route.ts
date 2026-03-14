import { NextRequest, NextResponse } from "next/server";
import { runDeactivationAgent } from "@/agents/deactivation";
import { RunConfig } from "@/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: RunConfig = body.config;
    const region: string | undefined = body.region;

    const result = await runDeactivationAgent(config, undefined, region);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/agents/deactivation]", err);
    return NextResponse.json(
      { error: String(err), correlations: [], gaps: [] },
      { status: 500 }
    );
  }
}
