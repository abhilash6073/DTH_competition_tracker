"use client";

import { Recommendation } from "@/agents/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
};

const TIMELINE_LABELS: Record<string, string> = {
  immediate: "Now",
  short_term: "1–4 weeks",
  medium_term: "1–3 months",
  long_term: "3+ months",
};

interface Props {
  recommendations: Recommendation[];
}

export function RecommendationsList({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recommendations generated. Run the intelligence report first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Recommendations ({recommendations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.slice(0, 5).map((rec, i) => (
          <div
            key={rec.id}
            className={`rounded-lg border p-3 space-y-1.5 ${PRIORITY_STYLES[rec.priority]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold">{i + 1}.</span>
                <Badge
                  variant="outline"
                  className="text-xs capitalize border-current"
                >
                  {rec.category}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs capitalize border-current"
                >
                  {TIMELINE_LABELS[rec.timeToExecute] || rec.timeToExecute}
                </Badge>
              </div>
              <span className="text-xs font-medium capitalize">
                {rec.priority} priority
              </span>
            </div>
            <p className="text-sm font-semibold">{rec.title}</p>
            <p className="text-xs opacity-90">{rec.rationale}</p>
            <div className="pt-1.5 border-t border-current/20">
              <p className="text-xs font-medium">Action: {rec.suggestedAction}</p>
              <p className="text-xs opacity-75 mt-0.5">
                Impact: {rec.expectedImpact}
              </p>
            </div>
            <p className="text-xs opacity-60">
              {rec.basis === "hypothesis" ? "⚠️ Hypothesis" : "✓ Data-backed"} ·{" "}
              {rec.confidence} confidence
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
