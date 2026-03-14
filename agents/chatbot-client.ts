import { ReportJSON, ChatSession } from "@/agents/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Build a new chat session object.
 */
export function createChatSession(reportId: string): ChatSession {
  return {
    sessionId: uuidv4(),
    reportId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate suggested questions based on the latest report.
 */
export function generateSuggestedQuestions(report: ReportJSON | null): string[] {
  if (!report) {
    return [
      "What are the biggest competitor threats to Tata Play this week?",
      "Which DTH operator offers the best value pack in Mumbai?",
      "Why did deactivations change recently?",
    ];
  }

  const topThreat = report.launches[0];
  const topRegion = report.events_correlation[0]?.affectedRegion;
  const topRec = report.recommendations[0];

  return [
    topThreat
      ? `Why is ${topThreat.entity}'s latest move a threat? What should Tata Play do?`
      : "Which OTT platform is the biggest threat for sports viewers?",
    topRegion
      ? `Why did deactivations change in ${topRegion} recently?`
      : "Which region has the highest deactivation risk this week?",
    topRec
      ? `Tell me more about: ${topRec.title}`
      : "What packs should Tata Play consider launching to counter competitors?",
  ];
}
