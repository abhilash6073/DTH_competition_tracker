"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ReportJSON } from "@/agents/types";
import { ReportView } from "@/components/report/ReportView";
import { PDFDownloadButton } from "@/components/report/PDFDownloadButton";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { generateSuggestedQuestions } from "@/agents/chatbot";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reports?id=${id}`);
        if (!res.ok) throw new Error("Report not found");
        const data = await res.json();
        setReport(data.report);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-destructive">{error || "Report not found"}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <span className="text-sm font-medium">
              Report —{" "}
              {new Date(report.generatedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <PDFDownloadButton reportId={report.reportId} className="h-8 text-xs" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <ReportView report={report} />
      </main>

      <ChatPanel
        suggestedQuestions={generateSuggestedQuestions(report)}
        reportId={report.reportId}
      />
    </div>
  );
}
