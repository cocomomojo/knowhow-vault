export function calculateAnalysisScore(importance: number | null | undefined, contentLength: number | null | undefined) {
  const safeImportance = Number(importance ?? 3);
  const safeLength = Number(contentLength ?? 0);
  const base = safeImportance * 20;
  const adjusted = base + (safeLength > 200 ? 20 : -10);
  return Math.min(100, Math.max(50, adjusted));
}

export function createPracticeSummary(content: string | null | undefined) {
  const safeContent = content ?? '';
  return safeContent.slice(0, 120);
}
