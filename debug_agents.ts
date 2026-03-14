import { runNewsSentimentAgent } from "./agents/news-sentiment";
import { runPMAnalystAgent } from "./agents/pm-analyst";
import { DEFAULT_RUN_CONFIG } from "./agents/types";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".env.local" });

async function debug() {
  console.log("EXA_API_KEY present:", !!process.env.EXA_API_KEY);
  console.log("TAVILY_API_KEY present:", !!process.env.TAVILY_API_KEY);

  const config = { ...DEFAULT_RUN_CONFIG, news_time_window_days: 1, plans_time_window_days: 1 };


  console.log("--- Debugging ISP News Agent ---");
  const startISP = Date.now();
  try {
    const ispNews = await runNewsSentimentAgent(config, "isp");
    console.log(`ISP News took ${Date.now() - startISP}ms`);
    console.log(`ISP News count: ${ispNews.items.length}`);
  } catch (e) {
    console.error("ISP News error:", e);
  }

  console.log("\n--- Debugging OTT PM Agent ---");
  const startOTT = Date.now();
  try {
    const ottPM = await runPMAnalystAgent(config, "ott");
    console.log(`OTT PM took ${Date.now() - startOTT}ms`);
    console.log(`OTT PM count: ${ottPM.items.length}`);
  } catch (e) {
    console.error("OTT PM error:", e);
  }
}

debug().catch(console.error);
