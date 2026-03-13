"use client";

import { DataBasis } from "@/agents/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BASIS_STYLES: Record<DataBasis, { label: string; className: string; description: string }> = {
  report: {
    label: "Report data",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    description: "This answer is based on data from the latest intelligence report.",
  },
  exa: {
    label: "Fresh web data",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    description: "This answer includes fresh data retrieved via Exa web search.",
  },
  hypothesis: {
    label: "Hypothesis",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    description: "This is an inference or hypothesis. Manual validation recommended.",
  },
};

interface Props {
  basis: DataBasis;
}

export function SourceBadge({ basis }: Props) {
  const style = BASIS_STYLES[basis];
  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-help ${style.className}`}
        >
          {style.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-xs">
        {style.description}
      </TooltipContent>
    </Tooltip>
  );
}
