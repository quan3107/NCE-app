/**
 * File: src/modules/ai-feedback/prompts/nce.ts
 * Purpose: Define plain typed inputs for future NCE AI prompt builders.
 * Why: NCE generation hooks should not depend on database models before the NCE data layer lands.
 */
export type NceLevel = "book_1" | "book_2" | "book_3" | "book_4";

export type NcePromptBuilderInput = {
  level: NceLevel;
  unit: string;
  objectiveId: string;
  objectiveLabel: string;
  learnerAnswer: string;
  targetLanguage?: string[];
};

export type NcePromptBuilderContext = {
  source: "nce";
  level: NceLevel;
  unit: string;
  objective: {
    id: string;
    label: string;
  };
  learnerAnswer: string;
  targetLanguage: string[];
};

export function buildNcePromptBuilderContext(
  input: NcePromptBuilderInput,
): NcePromptBuilderContext {
  return {
    source: "nce",
    level: input.level,
    unit: input.unit,
    objective: {
      id: input.objectiveId,
      label: input.objectiveLabel,
    },
    learnerAnswer: input.learnerAnswer,
    targetLanguage: input.targetLanguage ?? [],
  };
}
