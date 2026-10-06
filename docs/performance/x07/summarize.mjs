// File: docs/performance/x07/summarize.mjs
// Purpose: Preserve numeric X-07 results in the checkout.
// Why: Reproducible evidence must exclude credentials and raw response bodies.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const prettier = createRequire(`${resolve(import.meta.dirname, "../../..")}/backend/package.json`)("prettier");
const dir = process.env.X07_EVIDENCE_DIR ?? "/tmp/nce-x07-performance-20260926";
const output = process.env.X07_SUMMARY_DIR ?? import.meta.dirname;
mkdirSync(output, { recursive: true });
const read = (name) => JSON.parse(readFileSync(`${dir}/${name}`));
const save = async (name, value) =>
  writeFileSync(`${output}/${name}`, await prettier.format(JSON.stringify(value), { parser: "json" }));
const quantile = (values, q) => values.toSorted((a, b) => a - b)[Math.max(0, Math.ceil(values.length * q) - 1)] ?? null;
const summarize = (values) => ({
  n: values.length,
  p50: quantile(values, 0.5),
  p95: quantile(values, 0.95),
  max: Math.max(0, ...values),
});
const environment = read("environment.json");
const source = {
  date: environment.date.slice(0, 10),
  revision: environment.revision,
  rawEvidence: dir,
  acceptance: "Measurements only; no approved SLO or release PASS",
  scripts: "docs/performance/x07",
};
await save("api-summary.json", { source, ...read("api-summary.json") });
const loads = read("browser-loads.json"),
  actions = read("browser-interactions.json");
const browserSummary = {
  source,
  browser: loads.browser,
  loads: loads.results.map((r) => ({
    profile: r.profile.name,
    role: r.role,
    repeat: r.repeat,
    conditions: {
      cpuSlowdown: r.profile.cpu,
      latencyMs: r.profile.latency,
      downloadBytesPerSecond: r.profile.down,
      uploadBytesPerSecond: r.profile.up,
      cache: "disabled",
      viewport: "1365x900",
    },
    readyMs: r.readyMs,
    settledMs: r.settledMs,
    lcpMs: r.observer.lcp.at(-1)?.start ?? null,
    lcpText: r.observer.lcp.at(-1)?.text ?? null,
    loadingFirstMs: r.observer.loading[0] ?? null,
    requests: r.requests.length,
    responseBodyBytes: r.requests.reduce((n, r) => n + (r.bodyBytes || 0), 0),
    submissionPages: r.requests.filter((r) => r.path.endsWith("/submissions/accessible")).length,
    longTasks: summarize(r.observer.longTasks.map((e) => e.duration)),
    idleRequests: r.idleRequests,
    idleWindowMs: r.idleWindowMs,
    errors: r.errors,
    blocked: r.blocked,
    failure: r.failure,
  })),
  actions: actions.map((r) => ({
    name: r.name,
    readyMs: r.wallMs,
    requestCount: r.requests.length,
    gradeRequests: r.requests.filter((r) => r.path.endsWith("/grade")).length,
    gradeBatchRequests: r.requests.filter((r) => r.path.endsWith('/submissions/grades')).length,
    gradeStatuses: r.requests
      .filter((r) => r.path.endsWith("/grade"))
      .reduce((o, r) => ((o[r.status] = (o[r.status] || 0) + 1), o), {}),
    maxInteractionEventMs: Math.max(0, ...r.observer.events.filter((e) => e.interactionId).map((e) => e.duration)),
    eventToTwoFramesMs: summarize(r.observer.paints.map((e) => e.ms)),
    longTasks: summarize(r.observer.longTasks.map((e) => e.duration)),
    domElements: r.domElements,
    pagination: r.pagination,
    restoredFirstPage: r.restoredFirstPage,
    failure: r.failure,
  })),
  limitations:
    "Three cold samples per route under synthetic CDP throttles; one unthrottled reference and one sample per action; event durations are not field INP.",
};
await save("browser-load-summary.json", { source, browser: loads.browser, loads: browserSummary.loads });
await save("browser-action-summary.json", { source, actions: browserSummary.actions });
await save("browser-summary.json", {
  source,
  browser: loads.browser,
  initialLoads: "browser-load-summary.json",
  actions: "browser-action-summary.json",
  limitations: browserSummary.limitations,
});
const supplement = read("supplement.json");
await save("supplement-summary.json", {
  source,
  collections: supplement.collections.map((r) => ({ ...r, pageMs: summarize(r.pageMs) })),
  uploads: supplement.uploads,
  sharedIpLoginBurst: {
    ...supplement.sharedIpLoginBurst,
    results: undefined,
    latencyMs: summarize(supplement.sharedIpLoginBurst.results.map((r) => r.ms)),
  },
  database: supplement.database,
  drafts: supplement.drafts,
  authoring: supplement.authoring,
});
console.log("Saved API, browser and supplemental numeric summaries; secrets and raw responses excluded.");
