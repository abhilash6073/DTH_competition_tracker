import { runDeactivationAgent } from "./agents/deactivation";
import { DEFAULT_RUN_CONFIG } from "./agents/types";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function debug() {
  console.log("--- Debugging Deactivations Agent (Batch) ---");
  const config = { ...DEFAULT_RUN_CONFIG, deactivation_window_days: 7 };
  
  const start = Date.now();
  // Call for a single region to see how fast it evaluates all events
  try {
    const result = await runDeactivationAgent(config, undefined, "Region-110"); // Delhi region
    console.log(`Deactivations Agent took ${Date.now() - start}ms`);
    console.log(`Correlations found: ${result.correlations.length}`);
    if (result.correlations.length > 0) {
      console.log("Sample correlation:", JSON.stringify(result.correlations[0], null, 2));
    }
    if (result.gaps.length > 0) {
      console.log("Gaps:", JSON.stringify(result.gaps, null, 2));
    }
  } catch (e) {
    console.error("Deactivations error:", e);
  }
}

debug().catch(console.error);
