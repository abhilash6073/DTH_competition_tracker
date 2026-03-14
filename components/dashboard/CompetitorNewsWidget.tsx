"use client";

import { CompetitorNewsItem } from "@/agents/types";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

const SENTIMENT_STYLES: Record<string, { bar: string; badge: string }> = {
  positive: {
    bar: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  neutral: {
    bar: "bg-slate-300 dark:bg-slate-600",
    badge: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  },
  negative: {
    bar: "bg-red-400",
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  },
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
      <div className="rounded-xl border border-border/70 bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No news found in the time window.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Competitor News</h2>
        <span className="text-xs text-muted-foreground">{items.length} items</span>
      </div>

      <div className="divide-y divide-border/50 max-h-[560px] overflow-y-auto">
        {visible.map((item) => {
          const styles = SENTIMENT_STYLES[item.sentiment] ?? SENTIMENT_STYLES.neutral;
          return (
            <div key={item.id} className="flex hover:bg-muted/30 transition-colors group">
              <div className={`w-[3px] shrink-0 ${styles.bar}`} />
              <div className="flex-1 px-4 py-3.5 min-w-0">
                {/* Entity · date · badges */}
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-xs font-semibold">{item.entity}</span>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <span className="text-[11px] text-muted-foreground">{item.date}</span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${styles.badge}`}>
                      {item.sentiment}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Badge>
                  </div>
                </div>

                {/* Title */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1 text-sm font-medium hover:text-primary group-hover:text-primary transition-colors"
                >
                  <span className="line-clamp-2 leading-snug">{item.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-40" />
                </a>

                {/* Summary */}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>

                {/* Why it matters */}
                {item.whyItMatterForTataPlay && (
                  <div className="mt-2 pl-2.5 py-1.5 border-l-2 border-primary/40 bg-primary/5 dark:bg-primary/10 rounded-r text-xs text-primary/90 leading-relaxed">
                    {item.whyItMatterForTataPlay}
                  </div>
                )}

                {/* Relevance */}
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex gap-[3px]">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-[5px] h-[5px] rounded-full ${i < item.relevanceScore ? "bg-primary" : "bg-border"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{item.relevanceScore}/10 relevance</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
