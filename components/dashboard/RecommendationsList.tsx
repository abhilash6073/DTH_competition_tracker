"use client";

import { Recommendation } from "@/agents/types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

const PRIORITY_CONFIG: Record<string, { dot: string; bar: string; label: string; labelClass: string }> = {
  high: {
    dot: "bg-red-500 text-white",
    bar: "bg-red-400",
    label: "High",
    labelClass: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
  },
  medium: {
    dot: "bg-amber-500 text-white",
    bar: "bg-amber-400",
    label: "Medium",
    labelClass: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
  },
  low: {
    dot: "bg-primary text-white",
    bar: "bg-primary/60",
    label: "Low",
    labelClass: "text-primary bg-primary/10 border-primary/20",
  },
};

const TIMELINE_LABELS: Record<string, string> = {
  immediate: "Act now",
  short_term: "1–4 weeks",
  medium_term: "1–3 months",
  long_term: "3+ months",
};

interface Props { recommendations: Recommendation[] }

export function RecommendationsList({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No recommendations generated.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Strategic Recommendations</h2>
        <span className="text-xs text-muted-foreground">{recommendations.length} actions</span>
      </div>

      <div className="divide-y divide-border/50">
        {recommendations.map((rec, i) => {
          const cfg = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.low;
          return (
            <div key={rec.id} className="flex hover:bg-muted/20 transition-colors">
              <div className={`w-[3px] shrink-0 ${cfg.bar}`} />
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${cfg.dot}`}>
                    {i + 1}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide ${cfg.labelClass}`}>
                    {cfg.label}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">{rec.category}</Badge>
                  <span className="ml-auto text-[11px] text-muted-foreground font-medium">
                    {TIMELINE_LABELS[rec.timeToExecute] ?? rec.timeToExecute}
                  </span>
                </div>

                <p className="text-sm font-semibold leading-snug">{rec.title}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{rec.rationale}</p>

                <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Action</p>
                    <p className="text-xs leading-relaxed">{rec.suggestedAction}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Expected Impact</p>
                    <p className="text-xs leading-relaxed">{rec.expectedImpact}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  {rec.basis !== "hypothesis" ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {rec.basis === "hypothesis" ? "Hypothesis" : "Data-backed"} · {rec.confidence} confidence
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
