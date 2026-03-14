"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ComposableMap, Geographies, Geography, GeoFeature } from "react-simple-maps";
import { EventCorrelation, EventType } from "@/agents/types";
import {
  buildStateMapData,
  getStateColor,
  StateMapData,
  COLOR_NO_DATA,
  ALL_EVENT_TYPES,
  EVENT_TYPE_LABELS,
  GEO_NAME_TO_CODE,
} from "@/lib/mapUtils";
import { StateDetailPanel } from "@/components/dashboard/StateDetailPanel";
import { scoreToColor } from "@/lib/mapUtils";

interface TooltipState {
  x: number;
  y: number;
  stateName: string;
  data: StateMapData | null;
}

// ── FilterBar ─────────────────────────────────────────────────
function FilterBar({
  active,
  onToggle,
}: {
  active: Set<EventType>;
  onToggle: (t: EventType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_EVENT_TYPES.map((type) => {
        const isActive = active.has(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isActive
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-background text-muted-foreground border-border hover:border-blue-400"
            }`}
          >
            {EVENT_TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}

// ── MapLegend ─────────────────────────────────────────────────
function MapLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <div
          className="w-16 h-3 rounded"
          style={{
            background:
              "linear-gradient(to right, #15803d, #9ca3af, #b91c1c)",
          }}
        />
      </div>
      <span className="text-green-700 font-medium">Recharge-friendly</span>
      <span>→</span>
      <span className="text-gray-500">Neutral</span>
      <span>→</span>
      <span className="text-red-700 font-medium">High deactivations</span>
      <div className="flex items-center gap-1 ml-2">
        <div className="w-3 h-3 rounded border border-gray-300 bg-gray-200" />
        <span>No data</span>
      </div>
    </div>
  );
}

// ── MapTooltip ────────────────────────────────────────────────
function MapTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  const { x, y, stateName, data } = tooltip;

  return (
    <div
      className="fixed z-50 pointer-events-none bg-popover border rounded-lg shadow-md px-3 py-2 text-xs"
      style={{ left: x + 12, top: y - 10 }}
    >
      <p className="font-semibold">{stateName}</p>
      {data ? (
        <>
          <p className="text-muted-foreground mt-0.5">
            Net impact:{" "}
            <span className={data.netImpactScore > 0 ? "text-red-600" : "text-green-600"}>
              {data.netImpactScore > 0 ? "+" : ""}
              {data.netImpactScore.toFixed(1)}
            </span>
          </p>
          <p className="text-muted-foreground">
            {data.correlations.length} correlation{data.correlations.length !== 1 ? "s" : ""}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground mt-0.5">No data</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
interface IndiaDeactivationMapProps {
  correlations: EventCorrelation[];
}

export function IndiaDeactivationMap({ correlations }: IndiaDeactivationMapProps) {
  const [geoData, setGeoData] = useState<unknown>(null);
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(
    new Set(ALL_EVENT_TYPES)
  );
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);

  // Load GeoJSON on mount
  useEffect(() => {
    fetch("/data/india-states.json")
      .then((r) => r.json())
      .then(setGeoData)
      .catch(console.error);
  }, []);

  // Build state data from correlations + active filters
  const stateDataArr = useMemo(
    () => buildStateMapData(correlations, Array.from(activeTypes)),
    [correlations, activeTypes]
  );

  const stateDataMap = useMemo(
    () => new Map(stateDataArr.map((s) => [s.stateCode, s])),
    [stateDataArr]
  );

  const selectedStateData = selectedStateCode
    ? stateDataMap.get(selectedStateCode) ?? null
    : null;

  const toggleType = useCallback((type: EventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Prevent removing the last active type
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Resolve geo properties → state code
  function resolveGeoCode(properties: Record<string, string>): string | null {
    const name = properties.NAME_1 ?? "";
    return GEO_NAME_TO_CODE[name.toLowerCase()] ?? null;
  }

  if (!geoData) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center text-sm text-muted-foreground">
        Loading India map…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">India Deactivation Pressure Map</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hover to preview · Click state to view event timeline
          </p>
        </div>
        <MapLegend />
      </div>

      {/* Filter bar */}
      <FilterBar active={activeTypes} onToggle={toggleType} />

      {/* Empty state */}
      {correlations.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Run a report to populate the map with deactivation correlations.
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl border overflow-hidden bg-blue-50/30 dark:bg-blue-950/10">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [82.8, 22.0], scale: 1000 }}
          width={800}
          height={500}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={geoData}>
            {({ geographies }: { geographies: GeoFeature[] }) =>
              geographies.map((geo: GeoFeature) => {
                const props = geo.properties as Record<string, string>;
                const code = resolveGeoCode(props);
                const stateName = props.NAME_1 ?? "Unknown";
                const fill = code ? getStateColor(code, stateDataMap) : COLOR_NO_DATA;
                const isSelected = code === selectedStateCode;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        outline: "none",
                        opacity: 1,
                      },
                      hover: {
                        outline: "none",
                        opacity: 0.82,
                        cursor: "pointer",
                        stroke: "#1d4ed8",
                        strokeWidth: 1.5,
                      },
                      pressed: {
                        outline: "none",
                      },
                    }}
                    className={isSelected ? "ring-2 ring-blue-500" : ""}
                    onMouseEnter={(evt: React.MouseEvent) => {
                      setTooltip({
                        x: evt.clientX,
                        y: evt.clientY,
                        stateName,
                        data: code ? stateDataMap.get(code) ?? null : null,
                      });
                    }}
                    onMouseMove={(evt: React.MouseEvent) => {
                      setTooltip((prev) =>
                        prev ? { ...prev, x: evt.clientX, y: evt.clientY } : null
                      );
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => {
                      if (code) setSelectedStateCode(code);
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      <MapTooltip tooltip={tooltip} />

      {/* State detail panel */}
      <StateDetailPanel
        open={!!selectedStateCode}
        onClose={() => setSelectedStateCode(null)}
        stateData={selectedStateData}
      />
    </div>
  );
}
