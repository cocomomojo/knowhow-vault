export type AnalysisDraft = {
  summary: string;
  score: number;
  keyPoints: string[];
  recommendedActions: string[];
  provider: 'copilot' | 'fallback';
};

export type BestPracticeDraft = {
  title: string;
  summary: string;
  content: string;
  provider: 'copilot' | 'fallback';
};

type DraftInput = {
  title: string;
  content: string;
  importance: number;
  themeName?: string | null;
  source?: string | null;
};

type BestPracticeInput = DraftInput & {
  analysisSummary?: string | null;
  analysisHighlights?: string[];
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function calculateAnalysisScore(importance: number | null | undefined, contentLength: number | null | undefined) {
  const safeImportance = Number(importance ?? 3);
  const safeLength = Number(contentLength ?? 0);
  const base = safeImportance * 18;
  const lengthBonus = safeLength > 500 ? 16 : safeLength > 200 ? 10 : safeLength > 80 ? 4 : -4;
  return Math.min(100, Math.max(50, base + lengthBonus));
}

export function createPracticeSummary(content: string | null | undefined) {
  return normalizeText(content).slice(0, 120);
}

export function createFallbackAnalysis(input: DraftInput): AnalysisDraft {
  const normalizedContent = normalizeText(input.content);
  const themeLabel = input.themeName ? `「${input.themeName}」` : 'このテーマ';
  const sentence = normalizedContent.split(/[。.!?]/).map((item) => item.trim()).filter(Boolean);
  const summaryBase = sentence[0] || normalizedContent || `${themeLabel}に関する知見です。`;

  return {
    summary: createPracticeSummary(summaryBase),
    score: calculateAnalysisScore(input.importance, normalizedContent.length),
    keyPoints: [
      input.title ? `要点: ${input.title}` : `${themeLabel}の実践知を記録しています。`,
      normalizedContent ? `内容: ${createPracticeSummary(normalizedContent)}` : '内容が短いため、詳細補足があるとさらに活用しやすくなります。',
      input.source ? `出典: ${input.source}` : '出典リンクを追加すると再参照しやすくなります。',
    ].filter(Boolean).slice(0, 3),
    recommendedActions: [
      `${themeLabel}で再利用できる手順を1つ追加で明文化する。`,
      '実施条件や前提を追記して、別のメンバーでも再現できるようにする。',
      '結果や効果が分かる指標を追記して優先度判断をしやすくする。',
    ],
    provider: 'fallback',
  };
}

export function createFallbackBestPractice(input: BestPracticeInput): BestPracticeDraft {
  const normalizedContent = normalizeText(input.content);
  const summary = createPracticeSummary(input.analysisSummary || normalizedContent || input.title);
  const highlights = (input.analysisHighlights ?? []).filter(Boolean);
  const content = [
    '## 背景',
    summary || '現場で得た知見を再利用しやすい形に整えたメモです。',
    '',
    '## 実践ポイント',
    ...(highlights.length > 0 ? highlights.map((item) => `- ${item}`) : [
      `- 重要度は ${input.importance}/5 と判断されています。`,
      `- テーマ: ${input.themeName ?? '未設定'}`,
      `- まずは ${createPracticeSummary(normalizedContent || input.title)} をチームの標準手順へ寄せていきます。`,
    ]),
    '',
    '## 次に試すこと',
    '- 手順をチェックリスト化して再実行しやすくする。',
    '- 成果が見える指標や失敗条件を追記する。',
    input.source ? `- 元情報: ${input.source}` : '- 必要に応じて関連資料や参考リンクを追記する。',
  ].join('\n');

  return {
    title: normalizeText(input.title) || '再利用向けベストプラクティス',
    summary,
    content,
    provider: 'fallback',
  };
}
