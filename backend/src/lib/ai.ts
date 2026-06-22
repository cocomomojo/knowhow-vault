import { env } from './env.js';
import {
  createFallbackAnalysis,
  createFallbackBestPractice,
  type AnalysisDraft,
  type BestPracticeDraft,
} from './workflow.js';

type AIMessage = {
  role: 'system' | 'user';
  content: string;
};

type AnalysisInput = {
  title: string;
  content: string;
  importance: number;
  source?: string | null;
  themeName?: string | null;
};

type BestPracticeInput = AnalysisInput & {
  analysisSummary?: string | null;
  analysisHighlights?: string[];
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const AI_ENDPOINT = 'https://models.github.ai/inference/chat/completions';

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFenceMatch?.[1]) {
    return codeFenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error('AI response did not contain a JSON object.');
}

async function requestCopilotJson<T>(messages: AIMessage[], maxTokens: number) {
  if (!env.githubModelsToken) {
    return null;
  }

  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.githubModelsToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({
      model: env.githubModelsModel,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub Models request failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('GitHub Models response was empty.');
  }

  return JSON.parse(extractJsonObject(content)) as T;
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function generateAnalysisWithCopilot(input: AnalysisInput): Promise<AnalysisDraft> {
  const fallback = createFallbackAnalysis(input);

  try {
    const result = await requestCopilotJson<Partial<AnalysisDraft>>(
      [
        {
          role: 'system',
          content:
            'あなたは GitHub Copilot です。日本語で、実務で再利用しやすい分析結果を JSON だけで返してください。summary は120文字以内、score は 50〜100、keyPoints と recommendedActions は各3件以内にしてください。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'ノウハウ分析',
            input,
            outputSchema: {
              summary: 'string',
              score: 'number',
              keyPoints: ['string'],
              recommendedActions: ['string'],
            },
          }),
        },
      ],
      700,
    );

    if (!result) {
      return fallback;
    }

    return {
      summary: String(result.summary ?? fallback.summary).trim() || fallback.summary,
      score: Math.min(100, Math.max(50, Number(result.score ?? fallback.score))),
      keyPoints: sanitizeStringArray(result.keyPoints).slice(0, 3),
      recommendedActions: sanitizeStringArray(result.recommendedActions).slice(0, 3),
      provider: 'copilot',
    };
  } catch (error) {
    console.warn('Falling back to local analysis:', error);
    return fallback;
  }
}

export async function generateBestPracticeWithCopilot(input: BestPracticeInput): Promise<BestPracticeDraft> {
  const fallback = createFallbackBestPractice(input);

  try {
    const result = await requestCopilotJson<Partial<BestPracticeDraft>>(
      [
        {
          role: 'system',
          content:
            'あなたは GitHub Copilot です。入力内容をもとに、再利用しやすいベストプラクティス草案を日本語の JSON だけで返してください。title は簡潔に、summary は120文字以内、content は「背景」「実践ポイント」「次に試すこと」の3見出しを含めてください。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'ベストプラクティス草案作成',
            input,
            outputSchema: {
              title: 'string',
              summary: 'string',
              content: 'string',
            },
          }),
        },
      ],
      900,
    );

    if (!result) {
      return fallback;
    }

    return {
      title: String(result.title ?? fallback.title).trim() || fallback.title,
      summary: String(result.summary ?? fallback.summary).trim() || fallback.summary,
      content: String(result.content ?? fallback.content).trim() || fallback.content,
      provider: 'copilot',
    };
  } catch (error) {
    console.warn('Falling back to local best practice generation:', error);
    return fallback;
  }
}
