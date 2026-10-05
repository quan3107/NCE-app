// File: docs/performance/x07/setup.mjs
// Purpose: Build and start the isolated X-07 production rehearsal.
// Why: Performance testing must use disposable data and local credentials.
import { mkdirSync, writeFileSync, openSync, readFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { resolve } from "node:path";
const repo = resolve(import.meta.dirname, "../../..");
export const dir = "/tmp/nce-x07-performance-20260926";
const container = "nce-x07-performance-20260926";
const owner = "postgres://postgres:x07-local-owner@127.0.0.1:55448/nce_x07";
const runtime = "postgres://nce_runtime:x07-local-runtime@127.0.0.1:55448/nce_x07";
const jobs = "postgres://nce_job_runner:x07-local-jobs@127.0.0.1:55448/nce_x07";
// Never inherit a hosted storage/AI credential into a disposable rehearsal.
const localEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("R2_") && key !== "AI_API_KEY"),
);
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: repo, ...options });
async function startServers(env) {
  const pids = [];
  for (const [name, cwd, args] of [
    ["backend", `${repo}/backend`, ["dist/server.js"]],
    [
      "frontend",
      `${repo}/frontend`,
      ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "3018", "--strictPort"],
    ],
  ]) {
    const fd = openSync(`${dir}/${name}.log`, "a");
    const child = spawn("node", args, {
      cwd,
      env: { ...localEnvironment, ...env },
      detached: true,
      stdio: ["ignore", fd, fd],
    });
    child.unref();
    pids.push(child.pid);
  }
  writeFileSync(`${dir}/pids.json`, JSON.stringify(pids));
  // Process creation is asynchronous; don't race the first login against API startup.
  for (const url of ['http://127.0.0.1:4008/health', 'http://127.0.0.1:3018']) {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error(`Local service did not become ready: ${url}`);
  }
}
if (process.argv[2] === "stop") {
  for (const pid of JSON.parse(readFileSync(`${dir}/pids.json`))) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
  run("sudo", ["-n", "docker", "stop", container]);
  console.log("Stopped only X-07 services and disposable container; evidence/database preserved.");
} else if (process.argv[2] === "start") {
  const env = Object.fromEntries(
    readFileSync(`${dir}/runtime.env`, "utf8")
      .trim()
      .split("\n")
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  await startServers(env);
} else {
  mkdirSync(dir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  writeFileSync(`${dir}/private.pem`, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  writeFileSync(`${dir}/public.pem`, publicKey.export({ type: "spki", format: "pem" }));
  const env = {
    NODE_ENV: "production",
    PORT: "4008",
    DATABASE_URL: runtime,
    JOB_DATABASE_URL: jobs,
    DIRECT_URL: owner,
    JWT_PRIVATE_KEY_PATH: `${dir}/private.pem`,
    JWT_PUBLIC_KEY_PATH: `${dir}/public.pem`,
    GOOGLE_CLIENT_ID: "local-disabled",
    GOOGLE_CLIENT_SECRET: "local-disabled",
    BREVO_API_KEY: "local-disabled",
    BREVO_SENDER_NAME: "X07 Local",
    BREVO_SENDER_EMAIL: "local@x07.example.test",
    CORS_ALLOWED_ORIGINS: "http://127.0.0.1:3018",
    AI_FEEDBACK_ENABLED: "false",
    LOG_LEVEL: "warn",
    NCE_ASSET_ROOT: `${dir}/assets`,
  };
  mkdirSync(env.NCE_ASSET_ROOT, { recursive: true });
  writeFileSync(
    `${dir}/runtime.env`,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    { mode: 0o600 },
  );
  writeFileSync(`${dir}/credentials.json`, JSON.stringify({ password: `X07-${randomBytes(12).toString("hex")}!` }), {
    mode: 0o600,
  });
  run("sudo", [
    "-n",
    "docker",
    "run",
    "-d",
    "--name",
    container,
    "--cpus",
    "2",
    "--memory",
    "2g",
    "-p",
    "127.0.0.1:55448:5432",
    "-e",
    "POSTGRES_PASSWORD=x07-local-owner",
    "-e",
    "POSTGRES_DB=nce_x07",
    "postgres:17",
  ]);
  for (let i = 0; i < 60; i++) {
    try {
      run(
        "sudo",
        [
          "-n",
          "docker",
          "exec",
          container,
          "psql",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
          "-d",
          "nce_x07",
          "-c",
          "SELECT 1",
        ],
        { stdio: "ignore" },
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const sql = `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
CREATE ROLE nce_runtime LOGIN PASSWORD 'x07-local-runtime' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE nce_job_runner LOGIN PASSWORD 'x07-local-jobs' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT service_role TO nce_runtime WITH ADMIN FALSE, SET TRUE, INHERIT FALSE;
GRANT CONNECT ON DATABASE nce_x07 TO nce_runtime,nce_job_runner;`;
  run(
    "sudo",
    ["-n", "docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", "nce_x07", "-v", "ON_ERROR_STOP=1"],
    { input: sql },
  );
  for (const script of ["pgboss:install", "prisma:migrate:deploy", "seed:reference", "build"]) {
    const log = openSync(`${dir}/${script.replaceAll(":", "-")}.log`, "w");
    run("npm", ["--prefix", "backend", "run", script], {
      env: { ...localEnvironment, ...env },
      stdio: ["ignore", log, log],
    });
    console.log(`${script} completed; log saved.`);
  }
  const log = openSync(`${dir}/frontend-build.log`, "w");
  run("npm", ["--prefix", "frontend", "run", "build"], {
    env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:4008/api/v1" },
    stdio: ["ignore", log, log],
  });
  run("node", [`${repo}/docs/performance/x07/fixture.mjs`], { env: { ...localEnvironment, ...env }, stdio: "inherit" });
  await startServers(env);
  console.log("Local production frontend/API started on 3018/4008; PostgreSQL on 55448.");
}
