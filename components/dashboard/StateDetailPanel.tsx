"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StateMapData, EVENT_TYPE_LABELS, scoreToColor } from "@/lib/mapUtils";
import { EventCorrelation, ConfidenceLevel } from "@/agents/types";

interface StateDetailPanelProps {
  open: boolean;
  onClose: () => void;
  stateData: StateMapData | null;
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-700 border-gray-300",
};

function CorrelationCard({ corr }: { corr: EventCorrelation }) {
  const delta = corr.deactivationDelta;
  const isPositive = delta > 0;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      {/* Event header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug">{corr.event.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {corr.event.date}
            {corr.event.endDate && corr.event.endDate !== corr.event.date
              ? ` – ${corr.event.endDate}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${CONFIDENCE_COLORS[corr.confidence]}`}
          >
            {corr.confidence}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {EVENT_TYPE_LABELS[corr.event.type]}
          </Badge>
        </div>
      </div>

      {/* Deactivation delta */}
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-bold ${isPositive ? "text-red-600" : "text-green-600"}`}>
          {isPositive ? "↑" : "↓"} {Math.abs(delta)}%
        </span>
        <span className="text-xs text-muted-foreground">deactivation delta</span>
      </div>

      {/* Hypothesis */}
      <p className="text-xs text-foreground leading-relaxed">
        {corr.causalHypothesis}
      </p>

      {/* Correlation label */}
      {corr.correlationVsCausationLabel && (
        <p className="text-xs italic text-muted-foreground">
          {corr.correlationVsCausationLabel}
        </p>
      )}

      {/* Recommended action */}
      {corr.recommendedAction && (
        <>
          <Separator />
          <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
            <span className="font-medium">Action: </span>
            {corr.recommendedAction}
          </p>
        </>
      )}
    </div>
  );
}

export function StateDetailPanel({ open, onClose, stateData }: StateDetailPanelProps) {
  const color = stateData ? scoreToColor(stateData.normalizedScore) : "#9ca3af";
  const totalCorrelations = stateData?.correlations.length ?? 0;
  const score = stateData?.netImpactScore ?? 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <SheetTitle className="text-base">
              {stateData?.stateName ?? "State"}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {totalCorrelations} correlation{totalCorrelations !== 1 ? "s" : ""}
            {" · "}
            Net impact: {score > 0 ? "+" : ""}{score.toFixed(1)}
            {" · "}
            Dominant confidence: {stateData?.dominantConfidence ?? "—"}
          </SheetDescription>

          {/* Event type summary pills */}
          {stateData && (
            <div className="flex flex-wrap gap-1 pt-1">
              {Object.entries(stateData.eventTypeCounts).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {EVENT_TYPE_LABELS[type as keyof typeof EVENT_TYPE_LABELS]} ×{count}
                </Badge>
              ))}
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-3">
          {stateData && stateData.correlations.length > 0 ? (
            <div className="space-y-2">
              {stateData.correlations
                .slice()
                .sort((a, b) => Math.abs(b.deactivationDelta) - Math.abs(a.deactivationDelta))
                .map((corr) => (
                  <CorrelationCard key={corr.id} corr={corr} />
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No correlations for this state.
            </p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
