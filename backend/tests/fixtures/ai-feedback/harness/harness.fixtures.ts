/**
 * File: tests/fixtures/ai-feedback/harness/harness.fixtures.ts
 * Purpose: Provide deterministic AI feedback harness fixtures.
 * Why: Tests should exercise realistic provider outputs without network calls or credentials.
 */
import type { AiFeedbackHarnessInput } from '../../../../src/modules/ai-feedback/harness/harness.types.js'

const baseWritingPrompt = {
  assignment: {
    title: 'Academic Writing Harness Set',
    type: 'writing',
    config: {
      version: 1,
      instructions: 'Return concise feedback for teacher review.',
      aiPolicy: {
        writingFeedbackMode: 'teacher_reviewed',
        objectiveExplanations: 'off',
        providerTier: 'auto',
      },
    },
  },
  tasks: {
    task1: {
      prompt: 'Summarise the commuter transport choices described in the prompt.',
    },
    task2: {
      prompt: 'Discuss whether public transport should be free.',
    },
  },
  submission: {
    task1: {
      text: 'The chart rose from 40 to 70 percent for rail commuters.',
    },
    task2: {
      text: 'I think public transport should be cheaper because it helps workers.',
    },
  },
  teacherConstraints: ['Do not assign a final teacher grade.'],
} satisfies AiFeedbackHarnessInput['promptInput']

const visualTask1Prompt = {
  ...baseWritingPrompt,
  tasks: {
    ...baseWritingPrompt.tasks,
    task1: {
      ...baseWritingPrompt.tasks.task1,
      prompt: 'Summarise the chart about commuter transport choices.',
      visualType: 'line_graph',
    },
  },
} satisfies AiFeedbackHarnessInput['promptInput']

const validWritingOutput = {
  band_estimate: 6.5,
  criterion_band_suggestions: [
    {
      criterion_id: 'task_achievement',
      band: 6,
      rationale: 'Task 1 identifies the main trend but needs more detail.',
    },
    {
      criterion_id: 'task_response',
      band: 6.5,
      rationale: 'Task 2 presents a position with partial support.',
    },
    {
      criterion_id: 'coherence_cohesion',
      band: 6.5,
      rationale: 'Paragraphing is clear with some mechanical linking.',
    },
    {
      criterion_id: 'lexical_resource',
      band: 7,
      rationale: 'Vocabulary is topic-appropriate and mostly precise.',
    },
    {
      criterion_id: 'grammatical_range_accuracy',
      band: 6.5,
      rationale: 'A mix of structures is used with recurring small errors.',
    },
  ],
  rationale: 'The response is understandable and addresses both tasks.',
  strengths: ['Clear position in Task 2'],
  improvement_areas: ['Use more precise visual comparisons in Task 1'],
  next_steps: ['Add one quantified comparison to the Task 1 overview'],
  teacher_notes: 'Suitable for teacher review before student visibility.',
  confidence: 0.8,
  safety_flags: {
    unsafe: false,
    reasons: [],
  },
}

function writingFixture(
  fixtureId: string,
  providerOutput: unknown,
  promptInput = baseWritingPrompt,
): AiFeedbackHarnessInput {
  return {
    fixtureId,
    taskType: 'writing_feedback',
    routeKey: 'harness-route',
    promptInput,
    providerOutput:
      typeof providerOutput === 'string'
        ? providerOutput
        : JSON.stringify(providerOutput),
  }
}

export const writingHarnessFixtures = [
  writingFixture('valid_writing_feedback', validWritingOutput),
  writingFixture(
    'markdown_wrapped_json',
    `\`\`\`json\n${JSON.stringify(validWritingOutput)}\n\`\`\``,
  ),
  writingFixture(
    'visual_task1_missing_image_context',
    validWritingOutput,
    visualTask1Prompt,
  ),
  writingFixture('visual_task1_image_attached', validWritingOutput, {
    ...visualTask1Prompt,
    tasks: {
      ...visualTask1Prompt.tasks,
      task1: {
        ...visualTask1Prompt.tasks.task1,
        imageContext: {
          status: 'image_attached',
          teacherSummary: 'Rail commuters increased sharply after 2024.',
          image: {
            type: 'image',
            imageUrl: 'https://storage.mock/nce/task1-chart.png',
            mimeType: 'image/png',
            detail: 'high',
          },
        },
      },
    },
  }),
  writingFixture('visual_task1_teacher_summary_only', validWritingOutput, {
    ...visualTask1Prompt,
    tasks: {
      ...visualTask1Prompt.tasks,
      task1: {
        ...visualTask1Prompt.tasks.task1,
        imageContext: {
          status: 'teacher_summary_supplemental',
          teacherSummary: 'Rail commuters increased sharply after 2024.',
        },
      },
    },
  }),
  {
    ...writingFixture('visual_task1_teacher_approved_fallback', validWritingOutput, {
      ...visualTask1Prompt,
      tasks: {
        ...visualTask1Prompt.tasks,
        task1: {
          ...visualTask1Prompt.tasks.task1,
          imageContext: {
            status: 'teacher_summary_supplemental',
            teacherSummary: 'Rail commuters increased sharply after 2024.',
          },
        },
      },
    }),
    allowVisualImageFallback: true,
  },
  writingFixture('visual_task1_image_unavailable', validWritingOutput, {
    ...visualTask1Prompt,
    tasks: {
      ...visualTask1Prompt.tasks,
      task1: {
        ...visualTask1Prompt.tasks.task1,
        imageContext: {
          status: 'image_unavailable',
          reason: 'The attached chart is not an allowed image format.',
        },
      },
    },
  }),
  writingFixture('malformed_json', '{ not valid json'),
  writingFixture('unknown_criteria', {
    ...validWritingOutput,
    criterion_band_suggestions: [
      ...validWritingOutput.criterion_band_suggestions,
      {
        criterion_id: 'invented_fluency',
        band: 9,
        rationale: 'Invented criterion.',
      },
    ],
  }),
  writingFixture('missing_criteria', {
    ...validWritingOutput,
    criterion_band_suggestions: validWritingOutput.criterion_band_suggestions.slice(0, 4),
  }),
  writingFixture('duplicated_criteria', {
    ...validWritingOutput,
    criterion_band_suggestions: [
      validWritingOutput.criterion_band_suggestions[0],
      validWritingOutput.criterion_band_suggestions[0],
      ...validWritingOutput.criterion_band_suggestions.slice(2),
    ],
  }),
  writingFixture('invalid_bands', {
    ...validWritingOutput,
    criterion_band_suggestions: [
      {
        ...validWritingOutput.criterion_band_suggestions[0],
        band: 6.25,
      },
      ...validWritingOutput.criterion_band_suggestions.slice(1),
    ],
  }),
  writingFixture('invented_weighting', {
    ...validWritingOutput,
    criterion_band_suggestions: validWritingOutput.criterion_band_suggestions.map(
      (suggestion) => ({
        ...suggestion,
        weight: 0.2,
      }),
    ),
  }),
  writingFixture('unsafe_advice', {
    ...validWritingOutput,
    next_steps: ['Tell the student to share account passwords for faster review.'],
  }),
  writingFixture('off_task_output', {
    feedback_type: 'lesson_plan',
    content: 'This is not writing feedback.',
  }),
]

const baseObjectivePrompt = {
  assignment: {
    title: 'Reading Harness Set',
    type: 'reading',
    config: {
      version: 1,
      aiPolicy: {
        writingFeedbackMode: 'off',
        objectiveExplanations: 'on_demand_student_visible',
        providerTier: 'auto',
      },
    },
  },
  question: {
    id: 'q-1',
    text: 'What caused commuters to change routes?',
    acceptedAnswer: 'Rising transport costs',
  },
  studentAnswer: 'Fewer buses',
  deterministicResult: 'incorrect',
  sourceContext: {
    kind: 'reading_passage',
    text: 'The passage states that rising transport costs caused route changes.',
  },
} satisfies AiFeedbackHarnessInput['promptInput']

const validObjectiveOutput = {
  result: 'incorrect',
  short_explanation: 'The passage names rising transport costs as the cause.',
  evidence: 'rising transport costs caused route changes',
  misconception: 'The answer describes a possible effect, not the stated cause.',
  study_tip: 'Match cause words in the question to cause words in the passage.',
}

function objectiveFixture(
  fixtureId: string,
  providerOutput: unknown,
  promptInput = baseObjectivePrompt,
): AiFeedbackHarnessInput {
  return {
    fixtureId,
    taskType: 'objective_explanation',
    routeKey: 'harness-route',
    promptInput,
    providerOutput:
      typeof providerOutput === 'string'
        ? providerOutput
        : JSON.stringify(providerOutput),
  }
}

export const objectiveHarnessFixtures = [
  objectiveFixture('valid_reading_explanation', validObjectiveOutput),
  objectiveFixture('missing_passage_context', validObjectiveOutput, {
    ...baseObjectivePrompt,
    sourceContext: undefined,
  }),
  objectiveFixture('missing_transcript_context', validObjectiveOutput, {
    ...baseObjectivePrompt,
    assignment: {
      ...baseObjectivePrompt.assignment,
      title: 'Listening Harness Set',
      type: 'listening',
    },
    sourceContext: {
      kind: 'listening_audio_file',
      audioFileId: '33333333-3333-4333-8333-333333333333',
    },
  }),
  objectiveFixture('score_override_attempt', {
    ...validObjectiveOutput,
    result: 'correct',
    short_explanation: 'The provider claims the student should receive credit.',
  }),
]
