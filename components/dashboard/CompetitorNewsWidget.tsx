"use client";

import { CompetitorNewsItem } from "@/agents/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  neutral: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  negative: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  pricing_change: "Pricing",
  content_rights: "Content",
  new_feature: "Feature",
  partnership: "Partnership",
  merger_acquisition: "M&A",
  regulatory: "Regulatory",
  outage: "Outage",
  pr_campaign: "PR",
  other: "Other",
};

interface Props {
  items: CompetitorNewsItem[];
  maxItems?: number;
}

export function CompetitorNewsWidget({ items, maxItems = 8 }: Props) {
  const visible = items.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competitor News</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No news found in the time window. Run the intelligence report to
            populate this section.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Competitor News ({items.length} items)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {visible.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-3 space-y-1.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 items-center">
                <Badge variant="outline" className="text-xs">
                  {item.entity}
                </Badge>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    SENTIMENT_COLORS[item.sentiment]
                  }`}
                >
                  {item.sentiment}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {CATEGORY_LABELS[item.category] || item.category}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {item.date}
              </span>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline flex items-center gap-1 text-primary"
            >
              {item.title}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
            <p className="text-xs text-muted-foreground">{item.summary}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              ↳ {item.whyItMatterForTataPlay}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Relevance:</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      i < item.relevanceScore
                        ? "bg-blue-500"
                        : "bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              <span>{item.relevanceScore}/10</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
