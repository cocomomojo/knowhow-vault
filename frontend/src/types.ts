export type Theme = {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string;
};

export type AnalysisDetails = {
  keyPoints: string[];
  recommendedActions: string[];
  provider: 'copilot' | 'fallback';
};

export type KnowhowItem = {
  id: string;
  title: string;
  content: string;
  source?: string | null;
  importance: number;
  status: string;
  themeId: string;
  theme?: Theme | null;
  collectionSourceId?: string | null;
  analysisSummary?: string | null;
  analysisDetails?: AnalysisDetails | null;
  createdAt?: string;
  updatedAt?: string;
};

export type BestPractice = {
  id: string;
  title: string;
  summary: string;
  content: string;
  status: string;
  knowhowId: string;
  provider?: 'copilot' | 'fallback';
  createdAt?: string;
  updatedAt?: string;
};

export type CollectionSource = {
  id: string;
  name: string;
  url: string;
  type: string;
  themeId: string;
  theme?: Theme | null;
  lastCollectedAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AnalyzeResponse = {
  analysis: {
    id: string;
    knowhowId: string;
    summary: string;
    score: number;
    status: string;
    createdAt: string;
    details: AnalysisDetails;
  };
  itemId: string;
};

export type CollectResponse = {
  sourceId: string;
  createdCount: number;
  skippedCount: number;
};
