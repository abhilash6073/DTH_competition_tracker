// ============================================================
// app/api/chat/route.ts — Chatbot Q&A SSE stream
// POST { message: string, sessionId?: string, reportId?: string }
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { chatbotStream, createChatSession } from "@/agents/chatbot";
import { getChatSession, saveChatSession } from "@/lib/kv";
import { ChatMessage, ChatSession } from "@/agents/types";
import { uuidv4 } from "@/agents/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const { message, sessionId, reportId = "latest" } = body as {
    message: string;
    sessionId?: string;
    reportId?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Load or create session
  let session: ChatSession;
  if (sessionId) {
    session = (await getChatSession(sessionId)) || createChatSession(reportId);
  } else {
    session = createChatSession(reportId);
  }

  // Add user message to session
  const userMsg: ChatMessage = {
    id: uuidv4(),
    role: "user",
    content: message,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMsg);

  let fullResponse = "";
  let finalBasis: string = "report";
  let finalSources: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      try {
        for await (const chunk of chatbotStream(message, session, reportId)) {
          if (chunk.token !== undefined) {
            fullResponse += chunk.token;
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({ type: "token", token: chunk.token })}\n\n`
              )
            );
          }
          if (chunk.basis) finalBasis = chunk.basis;
          if (chunk.done) {
            finalSources = chunk.sources || [];
            // Save assistant message to session
            const assistantMsg: ChatMessage = {
              id: uuidv4(),
              role: "assistant",
              content: fullResponse,
              basis: finalBasis as ChatMessage["basis"],
              sources: finalSources,
              timestamp: new Date().toISOString(),
            };
            session.messages.push(assistantMsg);
            session.updatedAt = new Date().toISOString();
            await saveChatSession(session);

            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  sessionId: session.sessionId,
                  basis: finalBasis,
                  sources: finalSources,
                })}\n\n`
              )
            );
          }
        }
      } catch (err) {
        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`
          )
        );
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
