import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { generateAnalysisWithCopilot, generateBestPracticeWithCopilot } from './ai.js';
import { collectFeedItems } from './collector.js';
import { env } from './env.js';
import { sqlWasmPath } from './paths.js';

type Theme = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

type AnalysisDetails = {
  keyPoints: string[];
  recommendedActions: string[];
  provider: 'copilot' | 'fallback';
};

type KnowhowRecord = {
  id: string;
  title: string;
  themeId: string;
  content: string;
  source: string | null;
  importance: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  collectionSourceId: string | null;
  externalRef: string | null;
  theme: Theme | null;
  analysisSummary: string | null;
  analysisDetails: AnalysisDetails | null;
};

type BestPracticeRecord = {
  id: string;
  knowhowId: string;
  title: string;
  summary: string;
  content: string;
  status: string;
  provider: 'copilot' | 'fallback';
  createdAt: string;
  updatedAt: string;
};

type CollectionSourceRecord = {
  id: string;
  name: string;
  url: string;
  type: string;
  themeId: string;
  lastCollectedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  theme: Theme | null;
};

type CreateKnowhowInput = {
  title: string;
  themeId: string;
  content: string;
  source?: string | null;
  importance: number;
  collectionSourceId?: string | null;
  externalRef?: string | null;
};

type CreateCollectionSourceInput = {
  name: string;
  url: string;
  type: string;
  themeId: string;
};

type SqlJsModule = Awaited<ReturnType<typeof initSqlJs>>;
type Database = InstanceType<SqlJsModule['Database']>;

let dbInstance: Database | null = null;
const dbFilePath = path.join(env.dataDir, 'app.sqlite');

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function persistDb() {
  if (!dbInstance) return;
  fs.mkdirSync(env.dataDir, { recursive: true });
  fs.writeFileSync(dbFilePath, Buffer.from(dbInstance.export()));
}

function execValues(db: Database, query: string, params: unknown[] = []) {
  const statement = db.prepare(query);
  statement.bind(params);
  const rows: unknown[][] = [];
  while (statement.step()) {
    rows.push(statement.get());
  }
  statement.free();
  return rows;
}

function getFirstRow<T extends Record<string, unknown>>(db: Database, query: string, params: unknown[] = []) {
  const statement = db.prepare(query);
  statement.bind(params);
  const row = statement.step() ? (statement.getAsObject() as T) : undefined;
  statement.free();
  return row;
}

function hasColumn(db: Database, tableName: string, columnName: string) {
  const columns = execValues(db, `PRAGMA table_info(${tableName})`);
  return columns.some((column) => column[1] === columnName);
}

function ensureColumn(db: Database, tableName: string, columnName: string, definition: string) {
  if (!hasColumn(db, tableName, columnName)) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function parseAnalysisDetails(value: unknown): AnalysisDetails | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AnalysisDetails>;
    return {
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map((item) => String(item)) : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions.map((item) => String(item))
        : [],
      provider: parsed.provider === 'copilot' ? 'copilot' : 'fallback',
    };
  } catch {
    return null;
  }
}

function mapKnowhowRow(row: unknown[]): KnowhowRecord {
  return {
    id: String(row[0]),
    title: String(row[1]),
    themeId: String(row[2]),
    content: String(row[3] ?? ''),
    source: row[4] ? String(row[4]) : null,
    importance: Number(row[5] ?? 3),
    status: String(row[6]),
    createdAt: String(row[7]),
    updatedAt: String(row[8]),
    collectionSourceId: row[9] ? String(row[9]) : null,
    externalRef: row[10] ? String(row[10]) : null,
    theme: row[11]
      ? {
          id: String(row[11]),
          name: String(row[12]),
          description: row[13] ? String(row[13]) : null,
          createdAt: row[14] ? String(row[14]) : '',
        }
      : null,
    analysisSummary: row[15] ? String(row[15]) : null,
    analysisDetails: parseAnalysisDetails(row[16]),
  };
}

function ensureSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowhows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      importance INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'collected',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      knowhow_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      score INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'analyzed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS best_practices (
      id TEXT PRIMARY KEY,
      knowhow_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collection_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'rss',
      theme_id TEXT NOT NULL,
      last_collected_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, 'knowhows', 'collection_source_id', 'TEXT');
  ensureColumn(db, 'knowhows', 'external_ref', 'TEXT');
  ensureColumn(db, 'analyses', 'details', `TEXT NOT NULL DEFAULT '{}'`);
  ensureColumn(db, 'best_practices', 'provider', `TEXT NOT NULL DEFAULT 'fallback'`);

  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_knowhows_external_ref ON knowhows (external_ref) WHERE external_ref IS NOT NULL');
  db.run('CREATE INDEX IF NOT EXISTS idx_knowhows_theme_id ON knowhows (theme_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_collection_sources_theme_id ON collection_sources (theme_id)');
}

async function getDb() {
  if (!dbInstance) {
    const SQL = await initSqlJs({ locateFile: () => sqlWasmPath });
    fs.mkdirSync(env.dataDir, { recursive: true });

    if (fs.existsSync(dbFilePath)) {
      dbInstance = new SQL.Database(new Uint8Array(fs.readFileSync(dbFilePath)));
    } else {
      dbInstance = new SQL.Database();
    }

    ensureSchema(dbInstance);
    persistDb();
  }

  return dbInstance;
}

function insertKnowhow(db: Database, input: CreateKnowhowInput) {
  const id = uuid();
  const timestamp = nowIso();
  db.run(
    'INSERT INTO knowhows (id, title, theme_id, content, source, importance, status, created_at, updated_at, collection_source_id, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      input.title,
      input.themeId,
      input.content,
      input.source ?? null,
      input.importance,
      'collected',
      timestamp,
      timestamp,
      input.collectionSourceId ?? null,
      input.externalRef ?? null,
    ],
  );

  return {
    id,
    title: input.title,
    themeId: input.themeId,
    content: input.content,
    source: input.source ?? null,
    importance: input.importance,
    status: 'collected',
    createdAt: timestamp,
    updatedAt: timestamp,
    collectionSourceId: input.collectionSourceId ?? null,
    externalRef: input.externalRef ?? null,
    theme: null,
    analysisSummary: null,
    analysisDetails: null,
  } satisfies KnowhowRecord;
}

async function getKnowhowById(id: string) {
  const db = await getDb();
  const rows = execValues(
    db,
    `SELECT k.id, k.title, k.theme_id, k.content, k.source, k.importance, k.status, k.created_at, k.updated_at,
            k.collection_source_id, k.external_ref,
            t.id, t.name, t.description, t.created_at,
            (SELECT summary FROM analyses a WHERE a.knowhow_id = k.id ORDER BY a.created_at DESC LIMIT 1) AS analysis_summary,
            (SELECT details FROM analyses a WHERE a.knowhow_id = k.id ORDER BY a.created_at DESC LIMIT 1) AS analysis_details
       FROM knowhows k
       LEFT JOIN themes t ON k.theme_id = t.id
      WHERE k.id = ?`,
    [id],
  );

  return rows[0] ? mapKnowhowRow(rows[0]) : null;
}

async function getLatestAnalysis(db: Database, knowhowId: string) {
  return getFirstRow<{ summary?: string; details?: string }>(
    db,
    'SELECT summary, details FROM analyses WHERE knowhow_id = ? ORDER BY created_at DESC LIMIT 1',
    [knowhowId],
  );
}

export async function initDb() {
  await getDb();
}

export async function listThemes() {
  const db = await getDb();
  const rows = execValues(db, 'SELECT id, name, description, created_at FROM themes ORDER BY created_at ASC');
  return rows.map((row) => ({
    id: String(row[0]),
    name: String(row[1]),
    description: row[2] ? String(row[2]) : null,
    createdAt: String(row[3]),
  }));
}

export async function createTheme(name: string, description: string | null) {
  const db = await getDb();
  const id = uuid();
  const createdAt = nowIso();
  db.run('INSERT INTO themes (id, name, description, created_at) VALUES (?, ?, ?, ?)', [id, name, description, createdAt]);
  persistDb();
  return { id, name, description, createdAt };
}

export async function listKnowhows() {
  const db = await getDb();
  const rows = execValues(
    db,
    `SELECT k.id, k.title, k.theme_id, k.content, k.source, k.importance, k.status, k.created_at, k.updated_at,
            k.collection_source_id, k.external_ref,
            t.id, t.name, t.description, t.created_at,
            (SELECT summary FROM analyses a WHERE a.knowhow_id = k.id ORDER BY a.created_at DESC LIMIT 1) AS analysis_summary,
            (SELECT details FROM analyses a WHERE a.knowhow_id = k.id ORDER BY a.created_at DESC LIMIT 1) AS analysis_details
       FROM knowhows k
       LEFT JOIN themes t ON k.theme_id = t.id
      ORDER BY k.created_at DESC`,
  );

  return rows.map(mapKnowhowRow);
}

export async function createKnowhow(input: CreateKnowhowInput) {
  const db = await getDb();
  const created = insertKnowhow(db, input);
  persistDb();
  return created;
}

export async function analyzeKnowhow(id: string) {
  const db = await getDb();
  const item = await getKnowhowById(id);
  if (!item) {
    return null;
  }

  const analysis = await generateAnalysisWithCopilot({
    title: item.title,
    content: item.content,
    importance: item.importance,
    source: item.source,
    themeName: item.theme?.name,
  });

  const analysisId = uuid();
  const createdAt = nowIso();

  db.run(
    'INSERT INTO analyses (id, knowhow_id, summary, score, status, created_at, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [analysisId, id, analysis.summary, analysis.score, 'analyzed', createdAt, JSON.stringify(analysis)],
  );
  db.run('UPDATE knowhows SET status = ?, updated_at = ? WHERE id = ?', ['analyzed', nowIso(), id]);
  persistDb();

  return {
    analysis: {
      id: analysisId,
      knowhowId: id,
      summary: analysis.summary,
      score: analysis.score,
      status: 'analyzed',
      createdAt,
      details: {
        keyPoints: analysis.keyPoints,
        recommendedActions: analysis.recommendedActions,
        provider: analysis.provider,
      },
    },
    itemId: id,
  };
}

export async function organizeKnowhow(id: string) {
  const db = await getDb();
  const existing = getFirstRow<{ id?: string }>(db, 'SELECT id FROM knowhows WHERE id = ?', [id]);
  if (!existing?.id) {
    return false;
  }

  db.run('UPDATE knowhows SET status = ?, updated_at = ? WHERE id = ?', ['organized', nowIso(), id]);
  persistDb();
  return true;
}

export async function publishKnowhow(id: string) {
  const db = await getDb();
  const item = await getKnowhowById(id);
  if (!item) {
    return null;
  }

  const latestAnalysis = await getLatestAnalysis(db, id);
  const parsedDetails = parseAnalysisDetails(latestAnalysis?.details);
  const draft = await generateBestPracticeWithCopilot({
    title: item.title,
    content: item.content,
    importance: item.importance,
    source: item.source,
    themeName: item.theme?.name,
    analysisSummary: latestAnalysis?.summary ? String(latestAnalysis.summary) : null,
    analysisHighlights: parsedDetails?.keyPoints ?? [],
  });

  const now = nowIso();
  const existing = getFirstRow<{ id?: string }>(db, 'SELECT id FROM best_practices WHERE knowhow_id = ?', [id]);
  const practiceId = existing?.id ? String(existing.id) : uuid();

  if (existing?.id) {
    db.run(
      'UPDATE best_practices SET title = ?, summary = ?, content = ?, status = ?, provider = ?, updated_at = ? WHERE knowhow_id = ?',
      [draft.title, draft.summary, draft.content, 'draft', draft.provider, now, id],
    );
  } else {
    db.run(
      'INSERT INTO best_practices (id, knowhow_id, title, summary, content, status, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [practiceId, id, draft.title, draft.summary, draft.content, 'draft', draft.provider, now, now],
    );
  }

  db.run('UPDATE knowhows SET status = ?, updated_at = ? WHERE id = ?', ['published', nowIso(), id]);
  persistDb();

  return {
    id: practiceId,
    knowhowId: id,
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    status: 'draft',
    provider: draft.provider,
    createdAt: now,
    updatedAt: now,
  } satisfies BestPracticeRecord;
}

export async function listBestPractices() {
  const db = await getDb();
  const rows = execValues(
    db,
    'SELECT id, knowhow_id, title, summary, content, status, provider, created_at, updated_at FROM best_practices ORDER BY created_at DESC',
  );

  return rows.map((row) => ({
    id: String(row[0]),
    knowhowId: String(row[1]),
    title: String(row[2]),
    summary: String(row[3] ?? ''),
    content: String(row[4] ?? ''),
    status: String(row[5]),
    provider: row[6] === 'copilot' ? 'copilot' : 'fallback',
    createdAt: String(row[7]),
    updatedAt: String(row[8]),
  })) satisfies BestPracticeRecord[];
}

export async function listCollectionSources() {
  const db = await getDb();
  const rows = execValues(
    db,
    `SELECT s.id, s.name, s.url, s.type, s.theme_id, s.last_collected_at, s.last_error, s.created_at, s.updated_at,
            t.id, t.name, t.description, t.created_at
       FROM collection_sources s
       LEFT JOIN themes t ON s.theme_id = t.id
      ORDER BY s.created_at DESC`,
  );

  return rows.map((row) => ({
    id: String(row[0]),
    name: String(row[1]),
    url: String(row[2]),
    type: String(row[3]),
    themeId: String(row[4]),
    lastCollectedAt: row[5] ? String(row[5]) : null,
    lastError: row[6] ? String(row[6]) : null,
    createdAt: String(row[7]),
    updatedAt: String(row[8]),
    theme: row[9]
      ? {
          id: String(row[9]),
          name: String(row[10]),
          description: row[11] ? String(row[11]) : null,
          createdAt: row[12] ? String(row[12]) : '',
        }
      : null,
  })) satisfies CollectionSourceRecord[];
}

export async function createCollectionSource(input: CreateCollectionSourceInput) {
  const db = await getDb();
  const id = uuid();
  const timestamp = nowIso();
  db.run(
    'INSERT INTO collection_sources (id, name, url, type, theme_id, last_collected_at, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, input.name, input.url, input.type, input.themeId, null, null, timestamp, timestamp],
  );
  persistDb();

  return {
    id,
    name: input.name,
    url: input.url,
    type: input.type,
    themeId: input.themeId,
    lastCollectedAt: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    theme: null,
  } satisfies CollectionSourceRecord;
}

export async function collectFromSource(id: string) {
  const db = await getDb();
  const source = getFirstRow<{
    id?: string;
    name?: string;
    url?: string;
    type?: string;
    theme_id?: string;
  }>(db, 'SELECT id, name, url, type, theme_id FROM collection_sources WHERE id = ?', [id]);

  if (!source?.id || !source.url || !source.theme_id) {
    return null;
  }

  try {
    const result = await collectFeedItems(String(source.url), env.autoCollectLimit);
    let createdCount = 0;
    let skippedCount = 0;

    for (const item of result.items) {
      const existing = getFirstRow<{ id?: string }>(db, 'SELECT id FROM knowhows WHERE external_ref = ?', [item.externalRef]);
      if (existing?.id) {
        skippedCount += 1;
        continue;
      }

      insertKnowhow(db, {
        title: item.title,
        themeId: String(source.theme_id),
        content: item.content,
        source: item.source,
        importance: 3,
        collectionSourceId: id,
        externalRef: item.externalRef,
      });
      createdCount += 1;
    }

    db.run('UPDATE collection_sources SET last_collected_at = ?, last_error = ?, updated_at = ? WHERE id = ?', [nowIso(), null, nowIso(), id]);
    persistDb();

    return { sourceId: id, sourceName: result.title, createdCount, skippedCount };
  } catch (error) {
    db.run('UPDATE collection_sources SET last_error = ?, updated_at = ? WHERE id = ?', [String(error), nowIso(), id]);
    persistDb();
    throw error;
  }
}

export async function collectFromAllSources() {
  const sources = await listCollectionSources();
  const results = [] as Array<{ sourceId: string; sourceName: string; createdCount: number; skippedCount: number }>;

  for (const source of sources) {
    const collected = await collectFromSource(source.id);
    if (collected) {
      results.push(collected);
    }
  }

  return results;
}
