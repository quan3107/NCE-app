/**
 * File: src/prisma/verifyIeltsConfig.ts
 * Purpose: Verify IELTS config reference tables are ready for runtime usage.
 * Why: Deployment pipelines should fail fast if config is missing or incomplete.
 */

import { getIeltsConfigReadinessReport } from "../modules/ielts-config/ielts-config.readiness.js";
import { basePrisma } from "./client.js";

async function main(): Promise<void> {
  const report = await getIeltsConfigReadinessReport();
  const summary = {
    ready: report.ready,
    activeVersion: report.activeVersion,
    reason: report.reason,
    counts: report.counts,
    checkedAt: report.checkedAt,
  };

  if (!report.ready) {
    console.error("IELTS config verification failed.");
    console.error(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  console.info("IELTS config verification passed.");
  console.info(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("IELTS config verification crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });

