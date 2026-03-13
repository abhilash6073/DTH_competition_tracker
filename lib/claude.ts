// ============================================================
// lib/claude.ts — Google Gemini client wrapper w/ Anthropic fallback
// All exports unchanged for zero-change compatibility with agents.
// ============================================================
import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

// ── Gemini client ─────────────────────────────────────────────
let _geminiClient: GoogleGenAI | null = null;

export function getClaudeClient(): GoogleGenAI {
  if (!_geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    _geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return _geminiClient;
}

// ── Anthropic fallback client ─────────────────────────────────
let _anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    _anthropicClient = new Anthropic({ apiKey: key });
  }
  return _anthropicClient;
}

export const CLAUDE_MODEL = "gemini-2.0-flash";        // Gemini fallback model
const ANTHROPIC_PRIMARY_MODEL = "claude-sonnet-4-6";   // Anthropic primary model

export const SYSTEM_PROMPT_BASE = `You are an expert competitive intelligence analyst for Tata Play, India's leading DTH operator.
You follow the ReAct framework: Reason step-by-step before acting, and update your plan after each observation.
You MUST NOT hallucinate. Never invent prices, channel counts, dates, or feature details.
When data is unavailable, explicitly say so and mark gaps.
All hypotheses must be labeled as such with a confidence level (high/medium/low).
Your outputs must be actionable for Tata Play's product and marketing teams.
Always write in clear, concise business English suitable for a senior PM or marketing lead.
Today's date in IST: ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`;

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeToolCall {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
}

export interface LLMTool {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input_schema: { type: string; properties: Record<string, any>; required?: string[] };
}

function toGeminiContents(
  messages: LLMMessage[]
): { role: string; parts: { text: string }[] }[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// ── Anthropic primary: claudeComplete ────────────────────────
async function anthropicComplete(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<{ text: string; toolCalls: ClaudeToolCall[] }> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: ANTHROPIC_PRIMARY_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const text =
    response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("") || "";
  return { text, toolCalls: [] };
}

// ── claudeComplete — Anthropic primary, Gemini fallback ───────
export async function claudeComplete(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2048,
  _tools?: LLMTool[]
): Promise<{ text: string; toolCalls: ClaudeToolCall[] }> {
  // Try Anthropic first
  try {
    return await anthropicComplete(systemPrompt, userMessage, maxTokens);
  } catch (anthropicErr) {
    console.warn("[claude.ts] Anthropic failed, falling back to Gemini:", (anthropicErr as Error).message);
  }

  // Gemini fallback
  try {
    const ai = getClaudeClient();
    const response = await ai.models.generateContent({
      model: CLAUDE_MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: { systemInstruction: systemPrompt, maxOutputTokens: maxTokens },
    });
    const text = response.text || "";
    const toolCalls: ClaudeToolCall[] = [];
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name || "",
          input: (part.functionCall.args as Record<string, unknown>) || {},
        });
      }
    }
    return { text, toolCalls };
  } catch (geminiErr) {
    console.error("[claude.ts] Gemini fallback also failed:", (geminiErr as Error).message);
    throw geminiErr;
  }
}

// ── claudeWithTools — Anthropic primary, Gemini fallback ──────
export async function claudeWithTools(
  systemPrompt: string,
  messages: LLMMessage[],
  tools: LLMTool[],
  toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>,
  maxTokens = 3000,
  maxIterations = 5
): Promise<string> {
  // Try Anthropic first
  try {
    return await anthropicWithTools(systemPrompt, messages, tools, toolHandler, maxTokens, maxIterations);
  } catch (anthropicErr) {
    console.warn("[claude.ts] Anthropic (tools) failed, falling back to Gemini:", (anthropicErr as Error).message);
    try {
      return await geminiWithTools(systemPrompt, messages, tools, toolHandler, maxTokens, maxIterations);
    } catch (geminiErr) {
      console.error("[claude.ts] Gemini fallback (tools) also failed:", (geminiErr as Error).message);
      throw geminiErr;
    }
  }
}

async function geminiWithTools(
  systemPrompt: string,
  messages: LLMMessage[],
  tools: LLMTool[],
  toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>,
  maxTokens: number,
  maxIterations: number
): Promise<string> {
  const ai = getClaudeClient();
  const conversation = toGeminiContents(messages);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolConfig: any = tools.length
    ? {
        tools: [
          {
            functionDeclarations: tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: {
                type: Type.OBJECT,
                properties: Object.fromEntries(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  Object.entries(t.input_schema.properties).map(([k, v]: [string, any]) => [
                    k,
                    { type: Type.STRING, description: v.description || k },
                  ])
                ),
              },
            })),
          },
        ],
      }
    : {};

  for (let i = 0; i < maxIterations; i++) {
    const response = await ai.models.generateContent({
      model: CLAUDE_MODEL,
      contents: conversation,
      config: { systemInstruction: systemPrompt, maxOutputTokens: maxTokens, ...toolConfig },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const fnParts = parts.filter((p) => p.functionCall);

    if (fnParts.length === 0) return response.text || "Analysis completed.";

    conversation.push({ role: "model", parts: parts.map((p) => ({ text: p.text || "" })) });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    for (const part of fnParts) {
      const fc = part.functionCall!;
      const result = await toolHandler(fc.name || "", (fc.args as Record<string, unknown>) || {});
      results.push({ functionResponse: { name: fc.name || "", response: { result } } });
    }
    conversation.push({ role: "user", parts: results });
  }

  return "Analysis completed (max iterations reached).";
}

async function anthropicWithTools(
  systemPrompt: string,
  messages: LLMMessage[],
  tools: LLMTool[],
  toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>,
  maxTokens: number,
  maxIterations: number
): Promise<string> {
  const client = getAnthropicClient();

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));

  const conversation: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: ANTHROPIC_PRIMARY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: conversation,
      tools: anthropicTools,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];

    if (toolUseBlocks.length === 0) {
      const textBlocks = response.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
      return textBlocks.map((b) => b.text).join("") || "Analysis completed.";
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const result = await toolHandler(block.name, block.input as Record<string, unknown>);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }
    conversation.push({ role: "user", content: toolResults });
  }

  return "Analysis completed (max iterations reached).";
}

// ── claudeStream — Anthropic primary, Gemini fallback ─────────
export async function* claudeStream(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: LLMMessage[] = [],
  maxTokens = 1500
): AsyncGenerator<string> {
  // Try Anthropic streaming first
  try {
    const client = getAnthropicClient();
    const anthMessages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content } as Anthropic.MessageParam)),
      { role: "user", content: userMessage },
    ];

    const stream = client.messages.stream({
      model: ANTHROPIC_PRIMARY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
    return;
  } catch (anthropicErr) {
    console.warn("[claude.ts] Anthropic stream failed, falling back to Gemini:", (anthropicErr as Error).message);
  }

  // Gemini fallback stream
  try {
    yield* geminiStream(systemPrompt, userMessage, conversationHistory, maxTokens);
  } catch (geminiErr) {
    console.error("[claude.ts] Gemini stream fallback also failed:", (geminiErr as Error).message);
    throw geminiErr;
  }
}

async function* geminiStream(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: LLMMessage[],
  maxTokens: number
): AsyncGenerator<string> {
  const ai = getClaudeClient();

  const contents = [
    ...toGeminiContents(conversationHistory),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const stream = await ai.models.generateContentStream({
    model: CLAUDE_MODEL,
    contents,
    config: { systemInstruction: systemPrompt, maxOutputTokens: maxTokens },
  });

  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
