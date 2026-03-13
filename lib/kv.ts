// ============================================================
// lib/kv.ts — Vercel KV (Upstash Redis) helpers for agent state & chat sessions
// ============================================================
import { kv } from "@vercel/kv";
import { ChatSession, ReportJSON } from "@/agents/types";

const SESSION_TTL = 60 * 60 * 2; // 2 hours in seconds
const REPORT_TTL = 60 * 60 * 24; // 24 hours

// ── Agent run state ──────────────────────────────────────────
export interface RunState {
  runId: string;
  status: "running" | "completed" | "failed";
  completedTasks: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export async function setRunState(state: RunState): Promise<void> {
  try {
    await kv.set(`run:${state.runId}`, JSON.stringify(state), { ex: 86400 });
  } catch {
    // KV not configured — silently degrade (in-memory only run)
  }
}

export async function getRunState(runId: string): Promise<RunState | null> {
  try {
    const raw = await kv.get(`run:${runId}`);
    if (!raw) return null;
    return JSON.parse(raw as string) as RunState;
  } catch {
    return null;
  }
}

// ── Report caching (short-lived) ─────────────────────────────
export async function cacheReport(report: ReportJSON): Promise<void> {
  try {
    await kv.set(`report:${report.reportId}`, JSON.stringify(report), {
      ex: REPORT_TTL,
    });
    // Also cache as "latest" for chatbot lookups
    await kv.set("report:latest", JSON.stringify(report), { ex: REPORT_TTL });
  } catch {
    // Degrade gracefully
  }
}

export async function getCachedReport(
  reportId: string
): Promise<ReportJSON | null> {
  try {
    const raw = await kv.get(
      reportId === "latest" ? "report:latest" : `report:${reportId}`
    );
    if (!raw) return null;
    return JSON.parse(raw as string) as ReportJSON;
  } catch {
    return null;
  }
}

// ── Chat session management ──────────────────────────────────
export async function saveChatSession(session: ChatSession): Promise<void> {
  try {
    await kv.set(`chat:${session.sessionId}`, JSON.stringify(session), {
      ex: SESSION_TTL,
    });
  } catch {
    // Degrade gracefully
  }
}

export async function getChatSession(
  sessionId: string
): Promise<ChatSession | null> {
  try {
    const raw = await kv.get(`chat:${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw as string) as ChatSession;
  } catch {
    return null;
  }
}

// ── In-memory fallback (for local dev without KV) ────────────
const _memStore: Map<string, string> = new Map();

export const memKV = {
  set(key: string, value: string): void {
    _memStore.set(key, value);
  },
  get(key: string): string | null {
    return _memStore.get(key) ?? null;
  },
};
