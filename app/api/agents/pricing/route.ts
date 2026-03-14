import { NextRequest, NextResponse } from "next/server";
import { runPricingAgent } from "@/agents/pricing";
import { RunConfig } from "@/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: RunConfig = body.config;

    const result = await runPricingAgent(config);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/agents/pricing]", err);
    return NextResponse.json(
      { error: String(err), packs: [], gaps: [] },
      { status: 500 }
    );
  }
}
