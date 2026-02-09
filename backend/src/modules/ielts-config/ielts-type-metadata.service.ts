/**
 * File: src/modules/ielts-config/ielts-type-metadata.service.ts
 * Purpose: Resolve versioned IELTS type-card metadata from persisted assignment type rows.
 * Why: Removes hardcoded frontend card text/icons/themes while keeping explicit fallback logging.
 */

import { logger } from "../../config/logger.js";
import { prisma } from "../../prisma/client.js";
import type {
  IeltsTypeMetadataItem,
  IeltsTypeMetadataResponse,
  IeltsTypeMetadataTheme,
} from "./ielts-type-metadata.schema.js";

type FallbackReason =
  | "active_version_missing"
  | "requested_version_not_found"
  | "db_empty_for_version"
  | "invalid_rows"
  | "query_failed";

type TypeDefaults = {
  icon: string;
  description: string;
  theme: IeltsTypeMetadataTheme;
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const TYPE_DEFAULTS: Record<string, TypeDefaults> = {
  reading: {
    icon: "book-open",
    description: "Create a reading test with passages and questions",
    theme: {
      color_from: "#EFF6FF",
      color_to: "#DBEAFE",
      border_color: "#BFDBFE",
    },
  },
  listening: {
    icon: "headphones",
    description: "Build a listening test with audio sections",
    theme: {
      color_from: "#FAF5FF",
      color_to: "#F3E8FF",
      border_color: "#E9D5FF",
    },
  },
  writing: {
    icon: "pen-tool",
    description: "Design Task 1 and Task 2 writing prompts",
    theme: {
      color_from: "#F0FDF4",
      color_to: "#DCFCE7",
      border_color: "#BBF7D0",
    },
  },
  speaking: {
    icon: "mic",
    description: "Set up speaking test with all three parts",
    theme: {
      color_from: "#FFF7ED",
      color_to: "#FFEDD5",
      border_color: "#FED7AA",
    },
  },
};

const GENERIC_DEFAULTS: TypeDefaults = {
  icon: "book-open",
  description: "Create an IELTS assignment",
  theme: {
    color_from: "#F8FAFC",
    color_to: "#F1F5F9",
    border_color: "#CBD5E1",
  },
};

const FALLBACK_TYPE_METADATA: IeltsTypeMetadataItem[] = [
  {
    id: "reading",
    title: "Reading",
    description: TYPE_DEFAULTS.reading.description,
    icon: TYPE_DEFAULTS.reading.icon,
    theme: TYPE_DEFAULTS.reading.theme,
    enabled: true,
    sort_order: 1,
  },
  {
    id: "listening",
    title: "Listening",
    description: TYPE_DEFAULTS.listening.description,
    icon: TYPE_DEFAULTS.listening.icon,
    theme: TYPE_DEFAULTS.listening.theme,
    enabled: true,
    sort_order: 2,
  },
  {
    id: "writing",
    title: "Writing",
    description: TYPE_DEFAULTS.writing.description,
    icon: TYPE_DEFAULTS.writing.icon,
    theme: TYPE_DEFAULTS.writing.theme,
    enabled: true,
    sort_order: 3,
  },
  {
    id: "speaking",
    title: "Speaking",
    description: TYPE_DEFAULTS.speaking.description,
    icon: TYPE_DEFAULTS.speaking.icon,
    theme: TYPE_DEFAULTS.speaking.theme,
    enabled: true,
    sort_order: 4,
  },
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeColor(value: unknown, fallback: string): string {
  const normalized = normalizeText(value);
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : fallback;
}

function getDefaultsForType(typeId: string): TypeDefaults {
  return TYPE_DEFAULTS[typeId] ?? GENERIC_DEFAULTS;
}

function toFallbackResponse(
  reason: FallbackReason,
  details: Record<string, unknown> = {},
  version = 1,
): IeltsTypeMetadataResponse {
  logger.warn(
    {
      event: "ielts_type_metadata_fallback_used",
      reason,
      fallback_count: FALLBACK_TYPE_METADATA.length,
      ...details,
    },
    "Using fallback IELTS type metadata configuration",
  );

  return {
    version,
    types: FALLBACK_TYPE_METADATA.map((item) => ({ ...item, theme: { ...item.theme } })),
  };
}

async function resolveTargetVersion(version?: number): Promise<number | null> {
  if (typeof version === "number") {
    const requestedVersion = await prisma.ieltsConfigVersion.findUnique({
      where: { version },
      select: { version: true },
    });

    return requestedVersion?.version ?? null;
  }

  const activeVersion = await prisma.ieltsConfigVersion.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return activeVersion?.version ?? null;
}

function mapTypeMetadataRow(
  row: Awaited<ReturnType<typeof prisma.ieltsAssignmentType.findMany>>[number],
): IeltsTypeMetadataItem | null {
  const id = normalizeText(row.id);
  const title = normalizeText(row.label);

  if (!id || !title) {
    return null;
  }

  const defaults = getDefaultsForType(id);
  const icon = normalizeText(row.icon) || defaults.icon;

  return {
    id,
    title,
    description: normalizeText(row.description) || defaults.description,
    icon,
    theme: {
      color_from: normalizeColor(row.themeColorFrom, defaults.theme.color_from),
      color_to: normalizeColor(row.themeColorTo, defaults.theme.color_to),
      border_color: normalizeColor(row.themeBorderColor, defaults.theme.border_color),
    },
    enabled: row.enabled,
    sort_order: row.sortOrder,
  };
}

/**
 * Return backend-driven IELTS type metadata for the active or requested config version.
 */
export async function getIeltsTypeMetadata(
  version?: number,
): Promise<IeltsTypeMetadataResponse> {
  try {
    const targetVersion = await resolveTargetVersion(version);

    if (!targetVersion) {
      return toFallbackResponse(
        typeof version === "number" ? "requested_version_not_found" : "active_version_missing",
        typeof version === "number" ? { requested_version: version } : {},
        typeof version === "number" && version > 0 ? version : 1,
      );
    }

    const rows = await prisma.ieltsAssignmentType.findMany({
      where: {
        configVersion: targetVersion,
        enabled: true,
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    if (rows.length === 0) {
      return toFallbackResponse("db_empty_for_version", { version: targetVersion }, targetVersion);
    }

    const mapped = rows
      .map(mapTypeMetadataRow)
      .filter((item): item is IeltsTypeMetadataItem => item !== null);

    if (mapped.length !== rows.length) {
      return toFallbackResponse(
        "invalid_rows",
        {
          version: targetVersion,
          row_count: rows.length,
          invalid_count: rows.length - mapped.length,
        },
        targetVersion,
      );
    }

    return {
      version: targetVersion,
      types: mapped,
    };
  } catch (error) {
    return toFallbackResponse(
      "query_failed",
      {
        err: error,
        requested_version: version ?? null,
      },
      typeof version === "number" && version > 0 ? version : 1,
    );
  }
}
