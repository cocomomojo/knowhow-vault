import path from 'node:path';
import dotenv from 'dotenv';
import { backendRoot, repoRoot } from './paths.js';

dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env'), override: false });

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toConfiguredToken = (value: string | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (normalized === 'your_github_token_with_models_read') return '';
  if (normalized.startsWith('<') && normalized.endsWith('>')) return '';
  return normalized;
};

export const env = {
  port: toNumber(process.env.PORT, 8787),
  githubModelsToken: toConfiguredToken(process.env.COPILOT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN),
  githubModelsModel: process.env.GITHUB_MODELS_MODEL ?? 'openai/gpt-4.1-mini',
  autoCollectLimit: toNumber(process.env.AUTO_COLLECT_LIMIT, 5),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? '*',
};
