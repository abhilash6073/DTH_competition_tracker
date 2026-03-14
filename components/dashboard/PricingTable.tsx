"use client";

import { useState } from "react";
import { PlansPack, ChannelInfo } from "@/agents/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ComposedChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Tv2, Radio } from "lucide-react";

// ── Chart data helpers ────────────────────────────────────────────────────────

interface OperatorStats {
  operator: string;       // shortened label
  fullOperator: string;
  minPrice: number;
  maxPrice: number;
  priceRange: number;     // maxPrice - minPrice (for floating bar)
  packCount: number;
  // Value score: channels per ₹100 spent (avg across packs with both values)
  valueScore: number;
  ottPackCount: number;
}

function buildOperatorStats(packs: PlansPack[]): OperatorStats[] {
  const map: Record<string, PlansPack[]> = {};
  for (const p of packs) {
    if (!map[p.operator]) map[p.operator] = [];
    map[p.operator].push(p);
  }

  return Object.entries(map)
    .map(([op, opPacks]) => {
      const priced = opPacks.filter((p) => p.monthlyPrice > 0);
      const prices = priced.map((p) => p.monthlyPrice);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;

      // Value score: avg (channels / price * 100) across packs with both
      const valued = opPacks.filter((p) => p.monthlyPrice > 0 && p.totalChannels > 0);
      const valueScore =
        valued.length > 0
          ? Math.round(
              valued.reduce((s, p) => s + (p.totalChannels / p.monthlyPrice) * 100, 0) /
                valued.length
            )
          : 0;

      return {
        operator: op
          .replace("Digital TV", "")
          .replace("Tata ", "T.")
          .replace("d2h", "d2h")
          .trim(),
        fullOperator: op,
        minPrice,
        maxPrice,
        priceRange: maxPrice - minPrice,
        packCount: opPacks.length,
        valueScore,
        ottPackCount: opPacks.filter((p) => p.hasOTTBundled).length,
      };
    })
    .filter((s) => s.maxPrice > 0)
    .sort((a, b) => a.minPrice - b.minPrice);
}

const OPERATOR_COLORS: Record<string, string> = {
  "Tata Play": "#1a56db",
  "Airtel Digital TV": "#e53e3e",
  "Dish TV": "#dd6b20",
  "Videocon d2h": "#38a169",
  "Sun Direct": "#d69e2e",
  "DD Free Dish": "#805ad5",
};

function resolveColor(operatorKey: string): string {
  const match = Object.keys(OPERATOR_COLORS).find((k) =>
    operatorKey.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(operatorKey.toLowerCase())
  );
  return match ? OPERATOR_COLORS[match] : "#6b7280";
}

// ── Channel List Sheet ────────────────────────────────────────────────────────

interface ChannelSheetProps {
  pack: PlansPack | null;
  onClose: () => void;
}

function ChannelSheet({ pack, onClose }: ChannelSheetProps) {
  const channels = pack?.channelList ?? [];
  const hdChannels = channels.filter((c) => c.isHD);
  const sdChannels = channels.filter((c) => !c.isHD);

  // Group by genre
  const byGenre = channels.reduce<Record<string, ChannelInfo[]>>((acc, ch) => {
    const g = ch.genre || "Other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(ch);
    return acc;
  }, {});
  const genres = Object.keys(byGenre).sort();

  return (
    <Sheet open={!!pack} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <SheetTitle className="text-sm font-bold leading-tight">
            {pack?.packName}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {pack?.operator} · {pack?.region} ·{" "}
            {pack?.monthlyPrice ? `₹${pack.monthlyPrice}/mo` : "Price N/A"}
          </SheetDescription>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="secondary" className="text-[11px]">
              {channels.length} total channels
            </Badge>
            {hdChannels.length > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {hdChannels.length} HD
              </Badge>
            )}
            {sdChannels.length > 0 && (
              <Badge variant="outline" className="text-[11px]">
                {sdChannels.length} SD
              </Badge>
            )}
            {pack?.hasOTTBundled && (
              <Badge className="text-[11px] bg-primary/15 text-primary border-0">
                OTT: {pack.ottBundles.join(", ")}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          {channels.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Tv2 className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                Channel list not available for this pack.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                The agent retrieved pack metadata but no channel-level data.
              </p>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-5">
              {genres.map((genre) => (
                <div key={genre}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    {genre} ({byGenre[genre].length})
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {byGenre[genre].map((ch, i) => (
                      <div key={i} className="flex items-center gap-1.5 min-w-0">
                        {ch.isHD ? (
                          <Tv2 className="w-3 h-3 shrink-0 text-blue-500" />
                        ) : (
                          <Radio className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                        )}
                        <span className="text-xs truncate leading-relaxed">{ch.name}</span>
                        {ch.isFTA && (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                            FTA
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Main PricingTable ─────────────────────────────────────────────────────────

interface Props {
  packs: PlansPack[];
}

export function PricingTable({ packs }: Props) {
  const [selectedPack, setSelectedPack] = useState<PlansPack | null>(null);

  if (packs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pack Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No pack data available. Data depends on Exa retrieval quality.
          </p>
        </CardContent>
      </Card>
    );
  }

  const stats = buildOperatorStats(packs);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pack Comparison ({packs.length} packs)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {stats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Chart 1 — Price Range per operator (floating bar: min → max) */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Price Range (₹/mo) — min to max per operator
                </p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stats} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="operator" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} width={42} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload as OperatorStats;
                          return (
                            <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                              <p className="font-semibold">{d.fullOperator}</p>
                              <p>Min: <span className="font-medium">₹{d.minPrice}</span></p>
                              <p>Max: <span className="font-medium">₹{d.maxPrice}</span></p>
                              <p className="text-muted-foreground">{d.packCount} packs</p>
                            </div>
                          );
                        }}
                      />
                      {/* Transparent floor bar (min price — invisible, just sets the base) */}
                      <Bar dataKey="minPrice" stackId="range" fill="transparent" radius={0} legendType="none" />
                      {/* Colored range bar (max - min on top of the floor) */}
                      <Bar dataKey="priceRange" stackId="range" radius={[4, 4, 0, 0]}>
                        {stats.map((s) => (
                          <Cell key={s.operator} fill={resolveColor(s.fullOperator)} />
                        ))}
                        <LabelList
                          dataKey="maxPrice"
                          position="top"
                          formatter={(v: number) => `₹${v}`}
                          style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        />
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Bar spans cheapest → most expensive pack per operator
                </p>
              </div>

              {/* Chart 2 — Value Score: channels per ₹100 */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Value Score — channels per ₹100 spent
                </p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...stats].sort((a, b) => b.valueScore - a.valueScore)}
                      margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="operator" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={30} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload as OperatorStats;
                          return (
                            <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
                              <p className="font-semibold">{d.fullOperator}</p>
                              <p>
                                Value: <span className="font-medium">{d.valueScore} ch/₹100</span>
                              </p>
                              <p className="text-muted-foreground">Higher = better value</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="valueScore" radius={[4, 4, 0, 0]}>
                        {[...stats]
                          .sort((a, b) => b.valueScore - a.valueScore)
                          .map((s) => (
                            <Cell key={s.operator} fill={resolveColor(s.fullOperator)} />
                          ))}
                        <LabelList
                          dataKey="valueScore"
                          position="top"
                          style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Avg across packs with known price + channel count
                </p>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="max-h-[480px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operator</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">₹/mo</TableHead>
                  <TableHead className="text-right">Ch.</TableHead>
                  <TableHead className="text-right">HD</TableHead>
                  <TableHead>OTT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((pack) => {
                  const hasChannelList = (pack.channelList?.length ?? 0) > 0;
                  return (
                    <TableRow key={pack.id}>
                      <TableCell>
                        <span
                          className="font-medium text-xs"
                          style={{ color: OPERATOR_COLORS[pack.operator] || undefined }}
                        >
                          {pack.operator === "Tata Play" ? (
                            <span className="font-bold">{pack.operator}</span>
                          ) : (
                            pack.operator
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{pack.packName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{pack.region}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {pack.monthlyPrice > 0 ? `₹${pack.monthlyPrice}` : "N/A"}
                      </TableCell>

                      {/* Channel count — clickable if channel list exists */}
                      <TableCell className="text-right text-xs">
                        {pack.totalChannels ? (
                          hasChannelList ? (
                            <button
                              onClick={() => setSelectedPack(pack)}
                              className="tabular-nums rounded px-1.5 py-0.5 transition-colors text-primary font-semibold hover:bg-primary/10 cursor-pointer underline underline-offset-2 decoration-dotted"
                              title="Click to see channel list"
                            >
                              {pack.totalChannels}
                            </button>
                          ) : (
                            <span
                              className="tabular-nums text-foreground cursor-default"
                              title="Channel list not available"
                            >
                              {pack.totalChannels}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-xs">
                        {pack.hdChannels || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {pack.hasOTTBundled ? (
                          <Badge variant="secondary" className="text-xs">
                            {pack.ottBundles.slice(0, 2).join(", ")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-[11px] text-muted-foreground/60">
            Click a channel count to view the full channel list for that pack.
          </p>
        </CardContent>
      </Card>

      <ChannelSheet pack={selectedPack} onClose={() => setSelectedPack(null)} />
    </>
  );
}
