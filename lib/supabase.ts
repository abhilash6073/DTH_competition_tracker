// ============================================================
// lib/supabase.ts — Supabase client + typed report queries
// ============================================================
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ReportJSON } from "@/agents/types";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    }
    _client = createClient(url, key);
  }
  return _client;
}

export interface ReportRow {
  id: string;
  title: string;
  generated_at: string;
  config: ReportJSON["config"];
  summary: string;
  report_json: ReportJSON;
  markdown: string;
  quality_score?: number;
}

export async function saveReport(report: ReportJSON): Promise<string> {
  const sb = getSupabaseClient();
  const title = `Daily Intelligence Report — ${new Date(report.generatedAt).toLocaleDateString("en-IN")}`;
  const row: Omit<ReportRow, "id"> = {
    title,
    generated_at: report.generatedAt,
    config: report.config,
    summary: report.markdownReport.slice(0, 500),
    report_json: report,
    markdown: report.markdownReport,
    quality_score: report.qualityScore,
  };

  const { data, error } = await sb
    .from("reports")
    .insert([row])
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase] saveReport error:", error.message);
    // Gracefully degrade — return a local ID
    return report.reportId;
  }
  return data.id;
}

export async function getReport(id: string): Promise<ReportJSON | null> {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from("reports")
      .select("report_json")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data.report_json as ReportJSON;
  } catch {
    return null;
  }
}

export async function listReports(limit = 20): Promise<ReportRow[]> {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from("reports")
      .select("id, title, generated_at, quality_score, summary")
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as ReportRow[];
  } catch {
    return [];
  }
}

// Schema SQL (run once in Supabase SQL editor):
/*
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  config JSONB,
  summary TEXT,
  report_json JSONB NOT NULL,
  markdown TEXT,
  quality_score NUMERIC(4,2)
);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports (generated_at DESC);
*/
