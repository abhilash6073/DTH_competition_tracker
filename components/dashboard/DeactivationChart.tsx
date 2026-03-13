"use client";

import { EventCorrelation } from "@/agents/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

interface Props {
  correlations: EventCorrelation[];
}

export function DeactivationChart({ correlations }: Props) {
  if (correlations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deactivation Correlations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No deactivation data available. Provide internal data via the run
            API or connect your internal analytics API.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Deactivation Correlations ({correlations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {correlations.slice(0, 10).map((c) => (
          <div
            key={c.id}
            className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    CONFIDENCE_COLORS[c.confidence] as
                      | "default"
                      | "secondary"
                      | "destructive"
                      | "outline"
                  }
                  className="text-xs capitalize"
                >
                  {c.confidence} confidence
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {c.event.type.replace("_", " ")}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {c.affectedRegion}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium">{c.event.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.correlationVsCausationLabel}
              </p>
            </div>
            <p className="text-xs">{c.causalHypothesis}</p>
            <div className="pt-1 border-t">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                💡 {c.recommendedAction}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
