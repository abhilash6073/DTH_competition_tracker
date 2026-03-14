"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  tooltip?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  accentColor?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  badge,
  badgeVariant = "default",
  tooltip,
  icon,
  trend,
  accentColor = "bg-primary",
}: MetricCardProps) {
  const isNeg = trend === "down";
  const isPos = trend === "up";
  const trendClass = isNeg
    ? "text-red-600 dark:text-red-400"
    : isPos
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-foreground";

  return (
    <div className="relative bg-card rounded-xl border border-border/70 shadow-sm overflow-hidden flex flex-col">
      {/* Colored top accent */}
      <div className={`h-[3px] w-full ${accentColor} shrink-0`} />

      <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-2">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </span>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger className="cursor-help shrink-0">
                  <Info className="w-3 h-3 text-muted-foreground/40" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {badge && <Badge variant={badgeVariant} className="text-[10px] shrink-0">{badge}</Badge>}
        </div>

        {/* Value */}
        <div className={`text-[2rem] font-bold leading-none tabular-nums ${trendClass}`}>
          {value}
        </div>

        {/* Subtitle + trend icon */}
        <div className="flex items-center gap-2">
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          {trend && trend !== "neutral" && (
            <span className={`flex items-center gap-0.5 ml-auto ${trendClass}`}>
              {isNeg ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
