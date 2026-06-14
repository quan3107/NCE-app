/**
 * File: tests/fixtures/ai-feedback/harness/harness.fixtures.ts
 * Purpose: Provide deterministic AI feedback harness fixtures.
 * Why: Tests should exercise realistic provider outputs without network calls or credentials.
 */
import type {
  AiFeedbackHarnessInput,
  AiFeedbackHarnessReport,
} from '../../../../src/modules/ai-feedback/harness/harness.types.js'

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

const teacherReviewedPolicy = {
  writingFeedbackMode: 'teacher_reviewed',
  objectiveExplanations: 'off',
  providerTier: 'auto',
} as const

const instantVisiblePolicy = {
  writingFeedbackMode: 'instant_student_visible',
  objectiveExplanations: 'off',
  providerTier: 'premium',
} as const

function writingPromptWith(input: {
  title: string
  submission: typeof baseWritingPrompt.submission
  aiPolicy?: typeof teacherReviewedPolicy | typeof instantVisiblePolicy
  task1?: typeof visualTask1Prompt.tasks.task1
  teacherConstraints?: string[]
}) {
  return {
    ...baseWritingPrompt,
    assignment: {
      ...baseWritingPrompt.assignment,
      title: input.title,
      config: {
        ...baseWritingPrompt.assignment.config,
        aiPolicy: input.aiPolicy ?? teacherReviewedPolicy,
      },
    },
    tasks: {
      ...baseWritingPrompt.tasks,
      ...(input.task1 ? { task1: input.task1 } : {}),
    },
    submission: input.submission,
    teacherConstraints: input.teacherConstraints ?? baseWritingPrompt.teacherConstraints,
  } satisfies AiFeedbackHarnessInput['promptInput']
}

function writingOutputWith(
  overrides: Partial<typeof validWritingOutput>,
): typeof validWritingOutput {
  return {
    ...validWritingOutput,
    ...overrides,
    safety_flags: {
      ...validWritingOutput.safety_flags,
      ...overrides.safety_flags,
    },
  }
}

const weakWritingPrompt = writingPromptWith({
  title: 'Weak Teacher Reviewed Writing',
  submission: {
    task1: {
      text: 'The chart go up and down. Cars are more. Buses less.',
    },
    task2: {
      text: 'Transport free is good because people no money. I agree.',
    },
  },
})

const averageWritingPrompt = writingPromptWith({
  title: 'Average Teacher Reviewed Writing',
  submission: {
    task1: {
      text: 'Rail use increased steadily, while bus use fell after the first year.',
    },
    task2: {
      text: 'Free public transport can help workers, although cities still need a stable budget.',
    },
  },
})

const strongInstantVisiblePrompt = writingPromptWith({
  title: 'Strong Instant Visible Writing',
  aiPolicy: instantVisiblePolicy,
  submission: {
    task1: {
      text: 'Rail rose from 40% to 70%, overtaking buses by the end of the period.',
    },
    task2: {
      text: 'While free transport increases access, targeted subsidies are more sustainable than universal free fares.',
    },
  },
})

const shortWritingPrompt = writingPromptWith({
  title: 'Short Teacher Reviewed Writing',
  submission: {
    task1: { text: 'Rail went up.' },
    task2: { text: 'I agree.' },
  },
})

const copiedSamplePrompt = writingPromptWith({
  title: 'Copied Sample Teacher Reviewed Writing',
  submission: {
    task1: {
      text: 'I copied this from the sample answer: the graph illustrates transport choices.',
    },
    task2: {
      text: 'I copied this from the sample answer and changed only a few words.',
    },
  },
})

const textOnlyTask1Prompt = writingPromptWith({
  title: 'Text Only Task 1 Writing',
  submission: {
    task1: {
      text: 'The process begins with ticket purchase and ends when passengers exit the station.',
    },
    task2: {
      text: 'Governments should improve reliability before reducing fares.',
    },
  },
})

function visualCorpusPrompt(
  title: string,
  imageContext: NonNullable<typeof visualTask1Prompt.tasks.task1.imageContext>,
) {
  return writingPromptWith({
    title,
    submission: averageWritingPrompt.submission,
    task1: {
      ...visualTask1Prompt.tasks.task1,
      imageContext,
    },
  })
}

const gptNanoConciseOutput = writingOutputWith({
  rationale: 'Concise feedback: clear ideas, limited visual detail.',
  strengths: ['Clear central opinion'],
  improvement_areas: ['Add one more quantified comparison'],
  next_steps: ['Revise the overview sentence'],
  teacher_notes: 'Concise low-cost route output shape.',
  confidence: 0.72,
})

const gptMiniPremiumOutput = writingOutputWith({
  band_estimate: 7.5,
  rationale:
    'Premium route output gives fuller reasoning while preserving the expected JSON schema.',
  strengths: ['Detailed comparison of transport changes', 'Balanced Task 2 position'],
  improvement_areas: ['Tighten one long supporting sentence'],
  next_steps: ['Add a concession sentence before the conclusion'],
  teacher_notes: 'Premium route output shape remains teacher-reviewable.',
  confidence: 0.88,
})

const hallucinatedCriteriaOutput = {
  ...validWritingOutput,
  criterion_band_suggestions: [
    ...validWritingOutput.criterion_band_suggestions,
    {
      criterion_id: 'creativity_and_voice',
      band: 9,
      rationale: 'Invented criterion that is not part of IELTS writing.',
    },
  ],
}

const writingRegressionFixtures: AiFeedbackHarnessInput[] = [
  writingFixture(
    'weak_teacher_reviewed_writing',
    writingOutputWith({
      band_estimate: 5,
      rationale: 'The response is understandable but underdeveloped.',
      confidence: 0.45,
    }),
    weakWritingPrompt,
  ),
  writingFixture('average_teacher_reviewed_writing', validWritingOutput, averageWritingPrompt),
  {
    ...writingFixture(
      'strong_instant_visible_writing',
      gptMiniPremiumOutput,
      strongInstantVisiblePrompt,
    ),
    routeKey: 'premium',
  },
  writingFixture(
    'short_teacher_reviewed_writing',
    writingOutputWith({
      band_estimate: 4,
      rationale: 'The response is too short for reliable automated feedback.',
      confidence: 0.38,
    }),
    shortWritingPrompt,
  ),
  writingFixture(
    'copied_sample_teacher_reviewed_writing',
    writingOutputWith({
      safety_flags: {
        unsafe: true,
        reasons: ['Submission appears copied from a sample response.'],
      },
    }),
    copiedSamplePrompt,
  ),
  writingFixture('text_only_task1_prompt', validWritingOutput, textOnlyTask1Prompt),
  writingFixture(
    'visual_task1_inaccessible_image',
    validWritingOutput,
    visualCorpusPrompt('Visual Task 1 Inaccessible Image', {
      status: 'image_unavailable',
      reason: 'The attached image URL could not be read by the provider.',
    }),
  ),
  writingFixture(
    'visual_task1_oversized_image',
    validWritingOutput,
    visualCorpusPrompt('Visual Task 1 Oversized Image', {
      status: 'image_unavailable',
      reason: 'The image exceeded the configured AI image byte limit.',
    }),
  ),
  writingFixture(
    'visual_task1_unsupported_image',
    validWritingOutput,
    visualCorpusPrompt('Visual Task 1 Unsupported Image', {
      status: 'image_unavailable',
      reason: 'The image MIME type is not supported for AI feedback.',
    }),
  ),
  {
    ...writingFixture(
      'visual_task1_teacher_approved_fallback_corpus',
      validWritingOutput,
      visualCorpusPrompt('Visual Task 1 Teacher Approved Fallback', {
        status: 'teacher_summary_supplemental',
        teacherSummary: 'Rail increased sharply while bus usage declined.',
      }),
    ),
    allowVisualImageFallback: true,
  },
  {
    ...writingFixture(
      'gpt_5_4_nano_concise_writing',
      gptNanoConciseOutput,
      averageWritingPrompt,
    ),
    routeKey: 'low_cost',
  },
  {
    ...writingFixture(
      'gpt_5_4_mini_premium_writing',
      gptMiniPremiumOutput,
      strongInstantVisiblePrompt,
    ),
    routeKey: 'premium',
  },
  writingFixture('provider_empty_feedback', '', averageWritingPrompt),
  writingFixture('provider_hallucinated_criteria', hallucinatedCriteriaOutput, averageWritingPrompt),
  writingFixture('provider_off_task_response', {
    feedback_type: 'study_plan',
    content: 'This plan does not evaluate IELTS writing.',
  }),
]

const correctReadingPrompt = {
  ...baseObjectivePrompt,
  studentAnswer: 'Rising transport costs',
  deterministicResult: 'correct',
} satisfies AiFeedbackHarnessInput['promptInput']

const correctObjectiveOutput = {
  ...validObjectiveOutput,
  result: 'correct',
  short_explanation: 'The answer matches the stated cause in the passage.',
  misconception: 'No misconception detected for this item.',
}

const listeningTranscriptPrompt = {
  ...baseObjectivePrompt,
  assignment: {
    ...baseObjectivePrompt.assignment,
    title: 'Listening Harness Set',
    type: 'listening',
  },
  question: {
    id: 'q-listening-1',
    text: 'What caused the platform change?',
    acceptedAnswer: 'Track repairs',
  },
  studentAnswer: 'Bad weather',
  deterministicResult: 'incorrect',
  sourceContext: {
    kind: 'listening_transcript',
    text: 'The transcript says platform changes happened because of track repairs.',
  },
} satisfies AiFeedbackHarnessInput['promptInput']

const listeningTranscriptOutput = {
  result: 'incorrect',
  short_explanation: 'The transcript names track repairs, not weather.',
  evidence: 'platform changes happened because of track repairs',
  misconception: 'The answer confuses an outside possibility with the stated reason.',
  study_tip: 'Listen for cause phrases such as because of and due to.',
}

const teacherAuthoredExplanationPrompt = {
  ...baseObjectivePrompt,
  sourceContext: {
    kind: 'reading_passage',
    text: 'Teacher-authored note: paragraph 2 says fares rose before commuters changed routes.',
  },
} satisfies AiFeedbackHarnessInput['promptInput']

const teacherAuthoredExplanationOutput = {
  ...validObjectiveOutput,
  evidence: 'fares rose before commuters changed routes',
}

const hallucinatedEvidenceOutput = {
  ...validObjectiveOutput,
  evidence: 'a mayor announced a new cycling tax',
}

const objectiveRegressionFixtures: AiFeedbackHarnessInput[] = [
  objectiveFixture('valid_reading_correct_explanation', correctObjectiveOutput, correctReadingPrompt),
  objectiveFixture(
    'listening_transcript_explanation',
    listeningTranscriptOutput,
    listeningTranscriptPrompt,
  ),
  objectiveFixture(
    'teacher_authored_explanation_context',
    teacherAuthoredExplanationOutput,
    teacherAuthoredExplanationPrompt,
  ),
  objectiveFixture(
    'objective_markdown_wrapped_json',
    `\`\`\`json\n${JSON.stringify(validObjectiveOutput)}\n\`\`\``,
  ),
  objectiveFixture('objective_missing_source_context', validObjectiveOutput, {
    ...baseObjectivePrompt,
    sourceContext: undefined,
  }),
  objectiveFixture('objective_explanation_unsafe_advice', {
    ...validObjectiveOutput,
    study_tip: 'Ask the teacher for their login password to view more answers.',
  }),
  objectiveFixture(
    'objective_hallucinated_evidence',
    hallucinatedEvidenceOutput,
    baseObjectivePrompt,
  ),
  objectiveFixture('objective_partial_json', {
    result: 'incorrect',
    short_explanation: 'Missing required fields.',
  }),
  objectiveFixture('objective_empty_feedback', ''),
]

export const aiHarnessRegressionCorpus = {
  coverageCategories: [
    'teacher_reviewed_writing',
    'instant_visible_writing',
    'visual_task1',
    'objective_explanation',
    'provider_output_shape',
    'safety_policy',
    'provider_route_shape',
  ],
  fixtures: [...writingRegressionFixtures, ...objectiveRegressionFixtures],
  expectedSummary: {
    accepted: 10,
    review_required: 6,
    rejected: 5,
    failed: 3,
  },
} satisfies {
  coverageCategories: string[]
  fixtures: AiFeedbackHarnessInput[]
  expectedSummary: AiFeedbackHarnessReport['summary']
}
