import type { TestDefinition } from './tests.data.js';
export function score(test: TestDefinition, answers: unknown) {
  if (!Array.isArray(answers) || answers.length !== test.questions.length ||
      Array.from(answers).some(v => !Number.isInteger(v) || v < 1 || v > 5)) {
    throw new Error('Дайте відповідь на всі запитання значеннями від 1 до 5.');
  }
  const raw = answers.reduce((sum: number, value: number, i: number) =>
    sum + (test.questions[i][1] ? 6 - value : value), 0);
  return { raw, percent: Math.round((raw - test.questions.length) / (test.questions.length * 4) * 100) };
}
