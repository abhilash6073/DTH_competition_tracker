// ============================================================
// app/api/run/route.ts — Trigger a full agent run (SSE stream)
// POST { config?: Partial<RunConfig> }
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/agents/orchestrator";
import { RunConfig, SSEEvent } from "@/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min Vercel Pro timeout

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let config: Partial<RunConfig> = {};

  try {
    const body = await request.json();
    config = body.config || {};
  } catch {
    // Empty body — use defaults
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SSEEvent): void => {
        try {
          controller.enqueue(new TextEncoder().encode(encodeSSE(event)));
        } catch {
          // Client disconnected
        }
      };

      try {
        const report = await runOrchestrator(config, emit);
        // Emit the full report JSON at the end
        emit({ type: "run_complete", data: { report } });
      } catch (err) {
        emit({
          type: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok", agent: "orchestrator" });
}
