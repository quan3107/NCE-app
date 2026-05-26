/**
 * Location: src/lib/ielts/questions.ts
 * Purpose: Provide IELTS question collection helpers.
 * Why: Keeps ordering utilities separate from config creation and normalization.
 */

export function groupQuestionsByType<T extends { type: string }>(questions: T[]): T[] {
  const typeOrder: string[] = [];
  const typeMap = new Map<string, T[]>();

  for (const question of questions) {
    if (!typeMap.has(question.type)) {
      typeOrder.push(question.type);
      typeMap.set(question.type, []);
    }
    typeMap.get(question.type)!.push(question);
  }

  const grouped: T[] = [];
  for (const type of typeOrder) {
    grouped.push(...typeMap.get(type)!);
  }

  return grouped;
}
