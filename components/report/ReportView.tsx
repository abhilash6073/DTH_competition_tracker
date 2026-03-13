"use client";

import { ReportJSON } from "@/agents/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompetitorNewsWidget } from "@/components/dashboard/CompetitorNewsWidget";
import { PricingTable } from "@/components/dashboard/PricingTable";
import { DeactivationChart } from "@/components/dashboard/DeactivationChart";
import { RecommendationsList } from "@/components/dashboard/RecommendationsList";
import { Badge } from "@/components/ui/badge";

interface Props {
  report: ReportJSON;
}

export function ReportView({ report }: Props) {
  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/30">
        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Executive Summary
        </h2>
        <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
          {report.competitor_news.length === 0 &&
          report.launches.length === 0 ? (
            <p className="text-muted-foreground">
              No data available. Run the intelligence report first.
            </p>
          ) : (
            report.markdownReport
              .split("## Executive Summary")[1]
              ?.split("##")[0]
              ?.trim() || "See sections below for full analysis."
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">
            {report.competitor_news.length} news items
          </Badge>
          <Badge variant="secondary">{report.launches.length} launches</Badge>
          <Badge variant="secondary">{report.plans_and_packs.length} packs</Badge>
          <Badge variant="secondary">
            {report.events_correlation.length} correlations
          </Badge>
          {report.qualityScore && (
            <Badge variant="outline">
              Quality: {report.qualityScore}/10
            </Badge>
          )}
        </div>
      </div>

      {/* Tabbed sections */}
      <Tabs defaultValue="news">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="news">News & Sentiment</TabsTrigger>
          <TabsTrigger value="packs">Plans & Packs</TabsTrigger>
          <TabsTrigger value="deactivations">Deactivations</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="mt-3">
          <CompetitorNewsWidget items={report.competitor_news} />
        </TabsContent>

        <TabsContent value="packs" className="mt-3">
          <PricingTable packs={report.plans_and_packs} />
        </TabsContent>

        <TabsContent value="deactivations" className="mt-3">
          <DeactivationChart correlations={report.events_correlation} />
        </TabsContent>

        <TabsContent value="recommendations" className="mt-3">
          <RecommendationsList recommendations={report.recommendations} />
        </TabsContent>
      </Tabs>

      {/* Data gaps */}
      {report.dataGaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
            ⚠️ Data Gaps ({report.dataGaps.length}) — Manual Validation Needed
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
            {report.dataGaps.slice(0, 5).map((g, i) => (
              <li key={i}>
                <strong>{g.field}:</strong> {g.reason} → {g.suggestedSource}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
