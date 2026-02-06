/**
 * File: tests/prisma/ieltsSeedShapeAssertions.ts
 * Purpose: Provide invariant checks for official IELTS seed fixture structures.
 * Why: Prevents accidental drift from required official section counts and timing rules.
 */
import assert from 'node:assert/strict';

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}

function readNumber(value: unknown): number {
  assert.equal(typeof value, 'number');
  return value;
}

function readString(value: unknown): string {
  assert.equal(typeof value, 'string');
  return value;
}

export function assertOfficialReadingConfig(config: unknown): void {
  const record = asRecord(config);
  const timing = asRecord(record.timing);
  assert.equal(readNumber(timing.durationMinutes), 60);

  const sections = asArray(record.sections);
  assert.equal(sections.length, 3);

  const expectedDistribution = [13, 13, 14];
  let totalQuestions = 0;

  sections.forEach((section, index) => {
    const sectionRecord = asRecord(section);
    const passage = readString(sectionRecord.passage);
    const paragraphs = passage
      .split(/\n\s*\n/g)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    assert.ok(paragraphs.length >= 3);

    const questions = asArray(sectionRecord.questions);
    assert.equal(questions.length, expectedDistribution[index]);
    totalQuestions += questions.length;

    questions.forEach((question) => {
      const questionRecord = asRecord(question);
      assert.equal(typeof questionRecord.id, 'string');
      assert.equal(typeof questionRecord.answer, 'string');
      assert.equal(typeof questionRecord.correctAnswer, 'string');
    });
  });

  assert.equal(totalQuestions, 40);
}

export function assertOfficialListeningConfig(config: unknown): void {
  const record = asRecord(config);
  const timing = asRecord(record.timing);
  assert.equal(readNumber(timing.durationMinutes), 30);

  const instructions = readString(record.instructions).toLowerCase();
  assert.ok(instructions.includes('computer-delivered'));

  const sections = asArray(record.sections);
  assert.equal(sections.length, 4);

  let totalQuestions = 0;
  sections.forEach((section) => {
    const sectionRecord = asRecord(section);
    const playback = asRecord(sectionRecord.playback);
    assert.equal(readNumber(playback.limitPlays), 1);

    const questions = asArray(sectionRecord.questions);
    assert.equal(questions.length, 10);
    totalQuestions += questions.length;

    questions.forEach((question) => {
      const questionRecord = asRecord(question);
      assert.equal(typeof questionRecord.id, 'string');
      assert.equal(typeof questionRecord.answer, 'string');
      assert.equal(typeof questionRecord.correctAnswer, 'string');
    });
  });

  assert.equal(totalQuestions, 40);
}

export function assertOfficialWritingConfig(config: unknown): void {
  const record = asRecord(config);
  const timing = asRecord(record.timing);
  assert.equal(readNumber(timing.durationMinutes), 60);

  const instructions = readString(record.instructions);
  assert.ok(instructions.includes('150'));
  assert.ok(instructions.includes('250'));

  const task1 = asRecord(record.task1);
  const task2 = asRecord(record.task2);
  assert.ok(readString(task1.prompt).length > 0);
  assert.ok(readString(task2.prompt).length > 0);
}

export function assertOfficialSpeakingConfig(config: unknown): void {
  const record = asRecord(config);
  const timing = asRecord(record.timing);
  assert.equal(readNumber(timing.durationMinutes), 14);

  const part1 = asRecord(record.part1);
  const part2 = asRecord(record.part2);
  const part3 = asRecord(record.part3);

  const part1Questions = asArray(part1.questions);
  const part3Questions = asArray(part3.questions);
  assert.ok(part1Questions.length >= 4 && part1Questions.length <= 6);
  assert.ok(part3Questions.length >= 4 && part3Questions.length <= 6);

  assert.equal(readNumber(part2.prepSeconds), 60);
  assert.equal(readNumber(part2.talkSeconds), 120);

  const cueCard = asRecord(part2.cueCard);
  const bulletPoints = asArray(cueCard.bulletPoints);
  assert.equal(bulletPoints.length, 4);
}
