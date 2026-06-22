import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import {
  analyzeKnowhow,
  collectFromAllSources,
  collectFromSource,
  createCollectionSource,
  createKnowhow,
  createTheme,
  initDb,
  listBestPractices,
  listCollectionSources,
  listKnowhows,
  listThemes,
  organizeKnowhow,
  publishKnowhow,
} from './lib/db.js';
import { env } from './lib/env.js';
import { frontendDistDir } from './lib/paths.js';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function serveFrontendAsset(requestPath: string) {
  const sanitizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const resolvedPath = path.resolve(frontendDistDir, `.${sanitizedPath}`);

  if (!resolvedPath.startsWith(frontendDistDir)) {
    return null;
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (stat.isFile()) {
      return {
        body: await fs.readFile(resolvedPath),
        path: resolvedPath,
      };
    }
  } catch {
    // ignore and fall back to index.html below
  }

  const indexPath = path.join(frontendDistDir, 'index.html');

  try {
    return {
      body: await fs.readFile(indexPath),
      path: indexPath,
    };
  } catch {
    return null;
  }
}

const app = new Hono();
app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ ok: true, aiConfigured: Boolean(env.githubModelsToken) }));

app.get('/api/themes', async (c) => {
  const themes = await listThemes();
  return c.json(themes);
});

app.post('/api/themes', async (c) => {
  const body = await c.req.json();
  const theme = await createTheme(String(body.name ?? '').trim(), String(body.description ?? '').trim() || null);
  return c.json(theme, 201);
});

app.get('/api/collection-sources', async (c) => {
  const sources = await listCollectionSources();
  return c.json(sources);
});

app.post('/api/collection-sources', async (c) => {
  const body = await c.req.json();
  const source = await createCollectionSource({
    name: String(body.name ?? '').trim(),
    url: String(body.url ?? '').trim(),
    type: String(body.type ?? 'rss').trim() || 'rss',
    themeId: String(body.themeId ?? '').trim(),
  });
  return c.json(source, 201);
});

app.post('/api/collection-sources/:id/collect', async (c) => {
  const id = c.req.param('id');
  const result = await collectFromSource(id);
  if (!result) return c.json({ error: 'not found' }, 404);
  return c.json(result);
});

app.post('/api/collection-sources/collect', async (c) => {
  const results = await collectFromAllSources();
  return c.json({ results });
});

app.get('/api/knowhow', async (c) => {
  const items = await listKnowhows();
  return c.json(items);
});

app.post('/api/knowhow', async (c) => {
  const body = await c.req.json();
  const item = await createKnowhow({
    title: String(body.title ?? '').trim(),
    themeId: String(body.themeId ?? '').trim(),
    content: String(body.content ?? '').trim(),
    source: String(body.source ?? '').trim() || null,
    importance: Number(body.importance ?? 3),
  });
  return c.json(item, 201);
});

app.post('/api/knowhow/:id/analyze', async (c) => {
  const id = c.req.param('id');
  const result = await analyzeKnowhow(id);
  if (!result) return c.json({ error: 'not found' }, 404);
  return c.json(result);
});

app.post('/api/knowhow/:id/organize', async (c) => {
  const id = c.req.param('id');
  const ok = await organizeKnowhow(id);
  return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

app.post('/api/knowhow/:id/publish', async (c) => {
  const id = c.req.param('id');
  const practice = await publishKnowhow(id);
  if (!practice) return c.json({ error: 'not found' }, 404);
  return c.json(practice, 201);
});

app.get('/api/best-practices', async (c) => {
  const practices = await listBestPractices();
  return c.json(practices);
});

app.get('*', async (c) => {
  const asset = await serveFrontendAsset(c.req.path);
  if (!asset) {
    return c.text('Frontend build not found. Run npm run build first.', 404);
  }

  const extension = path.extname(asset.path);
  const contentType = contentTypes[extension] ?? 'application/octet-stream';
  return new Response(asset.body, {
    headers: {
      'Content-Type': contentType,
    },
  });
});

await initDb();

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`Backend running on http://localhost:${info.port}`);
});
