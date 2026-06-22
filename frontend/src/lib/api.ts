import type {
  AnalyzeResponse,
  BestPractice,
  CollectionSource,
  CollectResponse,
  KnowhowItem,
  Theme,
} from '../types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function buildUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => requestJson<{ ok: boolean; aiConfigured: boolean }>('/api/health'),
  listThemes: () => requestJson<Theme[]>('/api/themes'),
  createTheme: (payload: { name: string; description?: string | null }) =>
    requestJson<Theme>('/api/themes', { method: 'POST', body: JSON.stringify(payload) }),
  listKnowhow: () => requestJson<KnowhowItem[]>('/api/knowhow'),
  createKnowhow: (payload: { title: string; themeId: string; content: string; source?: string; importance: number }) =>
    requestJson<KnowhowItem>('/api/knowhow', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeKnowhow: (id: string) => requestJson<AnalyzeResponse>(`/api/knowhow/${id}/analyze`, { method: 'POST' }),
  organizeKnowhow: (id: string) => requestJson<{ ok: boolean }>(`/api/knowhow/${id}/organize`, { method: 'POST' }),
  publishKnowhow: (id: string) => requestJson<BestPractice>(`/api/knowhow/${id}/publish`, { method: 'POST' }),
  listBestPractices: () => requestJson<BestPractice[]>('/api/best-practices'),
  listCollectionSources: () => requestJson<CollectionSource[]>('/api/collection-sources'),
  createCollectionSource: (payload: { name: string; url: string; themeId: string; type: string }) =>
    requestJson<CollectionSource>('/api/collection-sources', { method: 'POST', body: JSON.stringify(payload) }),
  collectSource: (id: string) => requestJson<CollectResponse>(`/api/collection-sources/${id}/collect`, { method: 'POST' }),
  collectAllSources: () => requestJson<{ results: CollectResponse[] }>('/api/collection-sources/collect', { method: 'POST' }),
};
