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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Tv2, Radio } from "lucide-react";

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

  // Chart: average monthly price per operator
  const operatorAvg = Object.entries(
    packs.reduce<Record<string, number[]>>((acc, p) => {
      if (!acc[p.operator]) acc[p.operator] = [];
      if (p.monthlyPrice > 0) acc[p.operator].push(p.monthlyPrice);
      return acc;
    }, {})
  )
    .map(([op, prices]) => ({
      operator: op.replace("Digital TV", "").replace("Tata ", "T.").trim(),
      fullOperator: op,
      avgPrice:
        prices.length > 0
          ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
          : 0,
    }))
    .filter((d) => d.avgPrice > 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pack Comparison ({packs.length} packs)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bar chart — avg price per operator */}
          {operatorAvg.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operatorAvg} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="operator" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} className="fill-muted-foreground" />
                  <RechartsTooltip
                    formatter={(v) => [`₹${v}`, "Avg monthly price"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="avgPrice" radius={[4, 4, 0, 0]}>
                    {operatorAvg.map((entry) => (
                      <Cell key={entry.operator} fill={resolveColor(entry.fullOperator)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
                          <button
                            onClick={() => setSelectedPack(pack)}
                            className={`tabular-nums rounded px-1.5 py-0.5 transition-colors ${
                              hasChannelList
                                ? "text-primary font-semibold hover:bg-primary/10 cursor-pointer underline underline-offset-2 decoration-dotted"
                                : "text-foreground cursor-default"
                            }`}
                            title={hasChannelList ? "Click to see channel list" : "Channel list not available"}
                          >
                            {pack.totalChannels}
                          </button>
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
