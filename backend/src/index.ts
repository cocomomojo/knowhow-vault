import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import {
  analyzeKnowhow,
  createKnowhow,
  createTheme,
  initDb,
  listBestPractices,
  listKnowhows,
  listThemes,
  organizeKnowhow,
  publishKnowhow,
} from './lib/db.js';

const app = new Hono();
app.use('*', cors());

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/themes', async (c) => {
  const themes = await listThemes();
  return c.json(themes);
});

app.post('/api/themes', async (c) => {
  const body = await c.req.json();
  const theme = await createTheme(String(body.name ?? '').trim(), String(body.description ?? '').trim() || null);
  return c.json(theme, 201);
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

await initDb();

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`Backend running on http://localhost:${info.port}`);
});
