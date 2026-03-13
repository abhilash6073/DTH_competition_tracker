// ============================================================
// app/api/reports/route.ts — List historical reports
// GET /api/reports?limit=20
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { listReports, getReport } from "@/lib/supabase";
import { getCachedReport } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const id = searchParams.get("id");

  // Single report fetch
  if (id) {
    const report = (await getCachedReport(id)) || (await getReport(id));
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ report });
  }

  // List reports
  const reports = await listReports(limit);
  return NextResponse.json({ reports });
}
