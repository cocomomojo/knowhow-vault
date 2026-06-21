export function calculateAnalysisScore(importance: number, contentLength: number) {
  const base = importance * 20;
  const adjusted = base + (contentLength > 200 ? 20 : -10);
  return Math.min(100, Math.max(50, adjusted));
}

export function createPracticeSummary(content: string) {
  return content.slice(0, 120);
}
