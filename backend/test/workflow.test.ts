import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAnalysisScore, createPracticeSummary } from '../src/lib/workflow.js';

test('calculateAnalysisScore rewards higher importance and longer content', () => {
  const first = calculateAnalysisScore(3, 250);
  const second = calculateAnalysisScore(5, 250);
  const third = calculateAnalysisScore(3, 20);

  assert.equal(first, 80);
  assert.equal(second, 100);
  assert.equal(third, 50);
});

test('createPracticeSummary truncates content to a readable preview', () => {
  const summary = createPracticeSummary('a'.repeat(130));
  assert.equal(summary.length, 120);
  assert.match(summary, /^a+$/);
});
