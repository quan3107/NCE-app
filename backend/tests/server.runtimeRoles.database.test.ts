/**
 * File: tests/server.runtimeRoles.database.test.ts
 * Purpose: Boot the compiled production server with the deployed role layout.
 * Why: Startup readiness and pg-boss must both work before HTTP traffic opens.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it } from "vitest";

const databaseDescribe =
  process.env.CI === "true" || process.env.RUN_DATABASE_TESTS === "true"
    ? describe
    : describe.skip;

async function reservePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const listener = createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      if (!address || typeof address === "string") {
        listener.close();
        reject(new Error("Unable to reserve a test server port."));
        return;
      }
      listener.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolveExit) => child.once("exit", () => resolveExit())),
    delay(5_000).then(() => undefined),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

databaseDescribe("production server runtime roles", () => {
  it("starts readiness, pg-boss, and the health endpoint", async () => {
    const serverEntry = resolve(process.cwd(), "dist/server.js");
    expect(existsSync(serverEntry)).toBe(true);
    expect(process.env.DATABASE_URL).toContain("nce_runtime");
    expect(process.env.JOB_DATABASE_URL).toContain("nce_job_runner");

    const port = await reservePort();
    // Production never generates fallback JWT keys, so give the child valid
    // in-memory key material without creating test secrets on disk.
    const jwtKeys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const childEnv = {
      ...process.env,
      CORS_ALLOWED_ORIGINS: "https://app.example.test",
      JWT_PRIVATE_KEY: jwtKeys.privateKey,
      JWT_PUBLIC_KEY: jwtKeys.publicKey,
      LOG_LEVEL: "silent",
      LOG_PRETTY: "false",
      NCE_ASSET_ROOT: "tests/fixtures/nce-assets",
      NODE_ENV: "production",
      PORT: String(port),
    };
    delete childEnv.DIRECT_URL;

    const child = spawn(process.execPath, [serverEntry], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });

    try {
      const deadline = Date.now() + 20_000;
      let healthResponse: Response | null = null;

      while (Date.now() < deadline && child.exitCode === null) {
        try {
          healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
          if (healthResponse.ok) {
            break;
          }
        } catch {
          // The socket is expected to refuse connections until bootstrap finishes.
        }
        await delay(100);
      }

      expect(child.exitCode, output).toBeNull();
      expect(healthResponse?.status, output).toBe(200);
      await expect(healthResponse?.json()).resolves.toMatchObject({ ok: true });
    } finally {
      await stopChild(child);
    }
  }, 30_000);
});
