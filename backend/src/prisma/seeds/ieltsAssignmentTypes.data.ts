/**
 * File: src/prisma/seeds/ieltsAssignmentTypes.data.ts
 * Purpose: Define canonical IELTS assignment type presentation defaults.
 * Why: Keeps the production-safe IELTS seed focused and below the file-size limit.
 */
export const ieltsAssignmentTypeRows: Array<
  [string, string, string, string, number, string, string, string]
> = [
  [
    'reading',
    'Reading',
    'Create a reading test with passages and questions',
    'book-open',
    1,
    '#EFF6FF',
    '#DBEAFE',
    '#BFDBFE',
  ],
  [
    'listening',
    'Listening',
    'Build a listening test with audio sections',
    'headphones',
    2,
    '#FAF5FF',
    '#F3E8FF',
    '#E9D5FF',
  ],
  [
    'writing',
    'Writing',
    'Design Task 1 and Task 2 writing prompts',
    'pen-tool',
    3,
    '#F0FDF4',
    '#DCFCE7',
    '#BBF7D0',
  ],
  [
    'speaking',
    'Speaking',
    'Set up speaking test with all three parts',
    'mic',
    4,
    '#FFF7ED',
    '#FFEDD5',
    '#FED7AA',
  ],
]
