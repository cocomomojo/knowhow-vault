import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAnalysisScore,
  createFallbackAnalysis,
  createFallbackBestPractice,
  createPracticeSummary,
} from '../src/lib/workflow.js';

test('calculateAnalysisScore rewards higher importance and longer content', () => {
  const first = calculateAnalysisScore(3, 250);
  const second = calculateAnalysisScore(5, 250);
  const third = calculateAnalysisScore(3, 20);

  assert.equal(first, 64);
  assert.equal(second, 100);
  assert.equal(third, 50);
});

test('createPracticeSummary truncates content to a readable preview', () => {
  const summary = createPracticeSummary('a'.repeat(130));
  assert.equal(summary.length, 120);
  assert.match(summary, /^a+$/);
});

test('createFallbackAnalysis returns reusable hints when Copilot is unavailable', () => {
  const result = createFallbackAnalysis({
    title: '障害対応のふりかえり',
    content: '切り戻し条件を先に決めておくと、判断が速くなる。',
    importance: 4,
    themeName: '運用',
    source: 'https://example.com/post',
  });

  assert.equal(result.provider, 'fallback');
  assert.ok(result.summary.length > 0);
  assert.equal(result.keyPoints.length, 3);
  assert.equal(result.recommendedActions.length, 3);
});

test('createFallbackBestPractice creates structured markdown content', () => {
  const result = createFallbackBestPractice({
    title: 'レビュー観点の標準化',
    content: 'レビュー時に見る観点を最初に共有すると、指摘の抜け漏れが減る。',
    importance: 3,
    themeName: '開発',
    analysisHighlights: ['観点を先に共有する', '抜け漏れを減らせる'],
  });

  assert.equal(result.provider, 'fallback');
  assert.match(result.content, /## 背景/);
  assert.match(result.content, /## 実践ポイント/);
  assert.match(result.content, /## 次に試すこと/);
});
