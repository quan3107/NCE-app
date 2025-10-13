/**
 * File: src/config/logger.ts
 * Purpose: Provide a centralized Pino logger configured from environment settings.
 * Why: Ensures consistent structured logging and prevents ad-hoc console usage across the service.
 */
import { stdout } from "node:process";

import pino from "pino";

import { config } from "./env.js";

const LEVEL_LABELS: Record<string, string> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  fatal: "FATAL",
};

const IGNORED_FIELDS = new Set([
  "time",
  "level",
  "levelValue",
  "hostname",
  "pid",
  "msg",
  "err",
]);

const formatValue = (value: unknown): string => {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `    ${line}`))
    .join("\n");
};

const formatErrorDetails = (err: unknown): string[] => {
  if (!err) {
    return [];
  }

  if (typeof err !== "object") {
    return [`  error: ${String(err)}`];
  }

  const errorObject = err as Record<string, unknown>;
  const lines: string[] = [];

  if (typeof errorObject.message === "string") {
    lines.push(`  error: ${errorObject.message}`);
  }

  if (typeof errorObject.stack === "string") {
    lines.push("  stack:");
    for (const stackLine of errorObject.stack.split("\n")) {
      lines.push(`    ${stackLine}`);
    }
  }

  const remainingDetails = { ...errorObject };
  delete remainingDetails.message;
  delete remainingDetails.stack;

  const detailEntries = Object.entries(remainingDetails);
  if (detailEntries.length > 0) {
    lines.push("  errorDetails:");
    for (const [key, value] of detailEntries) {
      lines.push(`    ${key}: ${formatValue(value)}`);
    }
  }

  return lines;
};

const formatStructuredLine = (line: string): string => {
  if (!line.trim()) {
    return "";
  }

  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const timestamp =
      typeof parsed.time === "string"
        ? parsed.time
        : new Date(Number(parsed.time ?? Date.now())).toISOString();
    const levelKey = typeof parsed.level === "string" ? parsed.level : "";
    const level = LEVEL_LABELS[levelKey] ?? levelKey.toUpperCase();
    const message =
      typeof parsed.msg === "string" && parsed.msg.length > 0
        ? parsed.msg
        : "";

    const header = [timestamp, level].filter(Boolean).join(" ");
    const lines = [`${header}${message ? ` ${message}` : ""}`];

    lines.push(...formatErrorDetails(parsed.err));

    for (const [key, value] of Object.entries(parsed)) {
      if (IGNORED_FIELDS.has(key) || value === undefined) {
        continue;
      }
      lines.push(`  ${key}: ${formatValue(value)}`);
    }

    return `${lines.join("\n")}\n`;
  } catch {
    return `${line}\n`;
  }
};

const prettyDestination =
  config.logPretty && stdout.isTTY
    ? {
        write(chunk: string | Buffer) {
          const payload = chunk.toString();
          const formatted = payload
            .split(/\r?\n/)
            .map((line) => formatStructuredLine(line))
            .join("");
          if (formatted.length > 0) {
            stdout.write(formatted);
          }
        },
      }
    : undefined;

const baseLogger = {
  level: config.logLevel,
  formatters: {
    level(label: string, number: number) {
      return { level: label, levelValue: number };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

export const logger = prettyDestination
  ? pino(baseLogger, prettyDestination)
  : pino(baseLogger);
