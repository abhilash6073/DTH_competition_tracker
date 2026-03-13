"use client";

import { PlansPack } from "@/agents/types";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const OPERATOR_COLORS: Record<string, string> = {
  "Tata Play": "#1a56db",
  "Airtel Digital TV": "#e53e3e",
  "Dish TV": "#dd6b20",
  "Videocon d2h": "#38a169",
  "Sun Direct": "#d69e2e",
  "DD Free Dish": "#805ad5",
};

interface Props {
  packs: PlansPack[];
}

export function PricingTable({ packs }: Props) {
  if (packs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pack Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No pack data available. Data depends on Exa retrieval quality.
            Consider manually uploading pack data via CSV.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build chart data: avg price per operator
  const operatorAvg = Object.entries(
    packs.reduce<Record<string, number[]>>((acc, p) => {
      if (!acc[p.operator]) acc[p.operator] = [];
      if (p.monthlyPrice > 0) acc[p.operator].push(p.monthlyPrice);
      return acc;
    }, {})
  )
    .map(([op, prices]) => ({
      operator: op.replace("Digital TV", "").replace("Tata ", "T.").trim(),
      avgPrice:
        prices.length > 0
          ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
          : 0,
    }))
    .filter((d) => d.avgPrice > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Pack Comparison ({packs.length} packs)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bar chart */}
        {operatorAvg.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operatorAvg} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="operator"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₹${v}`}
                  className="fill-muted-foreground"
                />
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
                    <Cell
                      key={entry.operator}
                      fill={
                        OPERATOR_COLORS[
                          Object.keys(OPERATOR_COLORS).find((k) =>
                            k.includes(entry.operator)
                          ) || ""
                        ] || "#6b7280"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div className="max-h-64 overflow-y-auto rounded-md border">
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
              {packs.slice(0, 30).map((pack) => (
                <TableRow key={pack.id}>
                  <TableCell>
                    <span
                      className="font-medium text-xs"
                      style={{
                        color: OPERATOR_COLORS[pack.operator] || undefined,
                      }}
                    >
                      {pack.operator === "Tata Play" ? (
                        <span className="font-bold">{pack.operator}</span>
                      ) : (
                        pack.operator
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{pack.packName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {pack.region}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {pack.monthlyPrice > 0 ? `₹${pack.monthlyPrice}` : "N/A"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {pack.totalChannels || "—"}
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
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
