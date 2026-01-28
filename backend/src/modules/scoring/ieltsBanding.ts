/**
 * File: src/modules/scoring/ieltsBanding.ts
 * Purpose: Convert IELTS raw reading/listening scores to band values.
 * Why: Centralizes conversion tables for auto-scoring consistency.
 */
import { AssignmentType } from "../../prisma/generated/client/client.js";

export type ReadingModule = "academic" | "general";

type BandRange = {
  min: number;
  max: number;
  band: number;
};

const IELTS_LISTENING_BANDS: BandRange[] = [
  { min: 39, max: 40, band: 9 },
  { min: 37, max: 38, band: 8.5 },
  { min: 35, max: 36, band: 8 },
  { min: 32, max: 34, band: 7.5 },
  { min: 30, max: 31, band: 7 },
  { min: 26, max: 29, band: 6.5 },
  { min: 23, max: 25, band: 6 },
  { min: 18, max: 22, band: 5.5 },
  { min: 16, max: 17, band: 5 },
  { min: 13, max: 15, band: 4.5 },
  { min: 11, max: 12, band: 4 },
  { min: 8, max: 10, band: 3.5 },
  { min: 6, max: 7, band: 3 },
  { min: 4, max: 5, band: 2.5 },
  { min: 0, max: 3, band: 0 },
];

const IELTS_READING_ACADEMIC_BANDS: BandRange[] = [
  { min: 39, max: 40, band: 9 },
  { min: 37, max: 38, band: 8.5 },
  { min: 35, max: 36, band: 8 },
  { min: 33, max: 34, band: 7.5 },
  { min: 30, max: 32, band: 7 },
  { min: 27, max: 29, band: 6.5 },
  { min: 23, max: 26, band: 6 },
  { min: 19, max: 22, band: 5.5 },
  { min: 15, max: 18, band: 5 },
  { min: 13, max: 14, band: 4.5 },
  { min: 10, max: 12, band: 4 },
  { min: 8, max: 9, band: 3.5 },
  { min: 6, max: 7, band: 3 },
  { min: 4, max: 5, band: 2.5 },
  { min: 0, max: 3, band: 0 },
];

const IELTS_READING_GENERAL_BANDS: BandRange[] = [
  { min: 40, max: 40, band: 9 },
  { min: 39, max: 39, band: 8.5 },
  { min: 37, max: 38, band: 8 },
  { min: 36, max: 36, band: 7.5 },
  { min: 34, max: 35, band: 7 },
  { min: 32, max: 33, band: 6.5 },
  { min: 30, max: 31, band: 6 },
  { min: 27, max: 29, band: 5.5 },
  { min: 23, max: 26, band: 5 },
  { min: 19, max: 22, band: 4.5 },
  { min: 15, max: 18, band: 4 },
  { min: 12, max: 14, band: 3.5 },
  { min: 9, max: 11, band: 3 },
  { min: 6, max: 8, band: 2.5 },
  { min: 0, max: 5, band: 0 },
];

function normalizeRawScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) {
    return 0;
  }
  const floored = Math.floor(rawScore);
  return Math.min(40, Math.max(0, floored));
}

export function getIeltsBandForRawScore(
  assignmentType: AssignmentType,
  rawScore: number,
  options?: { readingModule?: ReadingModule },
): number {
  const normalized = normalizeRawScore(rawScore);
  const readingModule = options?.readingModule ?? "academic";
  const table =
    assignmentType === AssignmentType.listening
      ? IELTS_LISTENING_BANDS
      : readingModule === "general"
        ? IELTS_READING_GENERAL_BANDS
        : IELTS_READING_ACADEMIC_BANDS;
  const range = table.find(
    (entry) => normalized >= entry.min && normalized <= entry.max,
  );
  return range?.band ?? 0;
}
