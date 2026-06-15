/**
 * File: src/modules/ai-feedback/prompts/index.ts
 * Purpose: Re-export AI feedback prompt builders and prompt versions.
 * Why: Gives queue workers and tests a single import point for prompt assembly.
 */
export {
  IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
  OBJECTIVE_EXPLANATION_PROMPT_VERSION,
  buildIeltsWritingSystemMessage,
  buildObjectiveExplanationSystemMessage,
} from './system.js'
export {
  buildIeltsWritingFeedbackPrompt,
  type BuiltIeltsWritingFeedbackPrompt,
  type IeltsWritingFeedbackPromptInput,
} from './ielts-writing.js'
export {
  buildObjectiveExplanationPrompt,
  type BuiltObjectiveExplanationPrompt,
  type ObjectiveExplanationPromptInput,
} from './objective-explanation.js'
export {
  buildNcePromptBuilderContext,
  type NcePromptBuilderContext,
  type NcePromptBuilderInput,
} from './nce.js'
