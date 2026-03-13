// ============================================================
// app/api/pdf/route.ts — Generate and download PDF for a report
// GET /api/pdf?reportId=<id>
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { getCachedReport } from "@/lib/kv";
import { getReport } from "@/lib/supabase";
import { generatePDF, buildReportHTML } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId") || "latest";

  // Try KV cache first, then Supabase
  let report = await getCachedReport(reportId);
  if (!report && reportId !== "latest") {
    report = await getReport(reportId);
  }

  if (!report) {
    return NextResponse.json(
      { error: "Report not found. Run /api/run first." },
      { status: 404 }
    );
  }

  const title = `Tata Play Competitor Intelligence — ${new Date(
    report.generatedAt
  ).toLocaleDateString("en-IN")}`;

  try {
    const html = buildReportHTML(report.markdownReport, title);
    const pdfBuffer = await generatePDF(html);

    const filename = `tata-play-intelligence-${report.reportId.slice(0, 8)}.pdf`;

    return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[PDF Route] Generation failed:", err);
    // Fallback: return markdown as plain text download
    return new NextResponse(report.markdownReport, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="tata-play-intelligence-${report.reportId.slice(0, 8)}.md"`,
      },
    });
  }
}
