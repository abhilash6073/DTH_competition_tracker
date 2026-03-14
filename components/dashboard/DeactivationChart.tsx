"use client";

import { EventCorrelation } from "@/agents/types";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

const CONFIDENCE_CONFIG: Record<string, { bar: string; badge: string }> = {
  high: {
    bar: "bg-red-400",
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  },
  medium: {
    bar: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  low: {
    bar: "bg-slate-300 dark:bg-slate-600",
    badge: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  },
};

interface Props { correlations: EventCorrelation[] }

export function DeactivationChart({ correlations }: Props) {
  if (correlations.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No deactivation correlation data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Deactivation Correlations</h2>
        <span className="text-xs text-muted-foreground">{correlations.length} events</span>
      </div>

      <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
        {correlations.map((c) => {
          const cfg = CONFIDENCE_CONFIG[c.confidence] ?? CONFIDENCE_CONFIG.low;
          const delta = c.deactivationDelta;
          const isSpike = delta > 0;
          return (
            <div key={c.id} className="flex hover:bg-muted/20 transition-colors">
              <div className={`w-[3px] shrink-0 ${cfg.bar}`} />
              <div className="flex-1 px-4 py-3.5">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${cfg.badge}`}>
                    {c.confidence} confidence
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {c.event.type.replace(/_/g, " ")}
                  </Badge>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className={`text-xs font-bold tabular-nums ${isSpike ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {isSpike ? "↑" : "↓"} {Math.abs(delta)}%
                    </span>
                    <span className="text-[11px] text-muted-foreground">{c.affectedRegion}</span>
                  </div>
                </div>

                <p className="text-sm font-semibold leading-snug">{c.event.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 italic">{c.correlationVsCausationLabel}</p>
                <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">{c.causalHypothesis}</p>

                {c.recommendedAction && (
                  <div className="mt-2 flex items-start gap-1.5 pl-2.5 py-1.5 border-l-2 border-primary/40 bg-primary/5 dark:bg-primary/10 rounded-r">
                    <Lightbulb className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-primary/90 leading-relaxed">{c.recommendedAction}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
