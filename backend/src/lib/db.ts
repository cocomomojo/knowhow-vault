import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { calculateAnalysisScore, createPracticeSummary } from './workflow.js';

const DB_PATH = path.join(process.cwd(), 'data', 'app.sqlite');

let dbInstance: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getDb() {
  if (!dbInstance) {
    const wasmPath = path.join(process.cwd(), '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        if (file === 'sql-wasm.wasm') {
          return wasmPath;
        }
        return path.join(process.cwd(), '..', 'node_modules', 'sql.js', 'dist', file);
      },
    });

    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(new Uint8Array(data));
    } else {
      dbInstance = new SQL.Database();
      dbInstance.run(`
        CREATE TABLE themes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE knowhows (
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
        CREATE TABLE analyses (
          id TEXT PRIMARY KEY,
          knowhow_id TEXT NOT NULL,
          summary TEXT NOT NULL,
          score INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'analyzed',
          created_at TEXT NOT NULL
        );
        CREATE TABLE best_practices (
          id TEXT PRIMARY KEY,
          knowhow_id TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          content TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      persistDb();
    }
  }

  return dbInstance;
}

function persistDb() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function initDb() {
  await getDb();
}

export async function listThemes() {
  const db = await getDb();
  const rows = db.exec('SELECT id, name, description, created_at as createdAt FROM themes ORDER BY created_at ASC');
  return rows[0]?.values.map((row: unknown[]) => ({
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string | null,
    createdAt: row[3] as string,
  })) ?? [];
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
  const rows = db.exec(`SELECT k.id, k.title, k.theme_id, k.content, k.source, k.importance, k.status, k.created_at, k.updated_at, t.id, t.name, t.description
    FROM knowhows k LEFT JOIN themes t ON k.theme_id = t.id ORDER BY k.created_at DESC`);
  const values = rows[0]?.values ?? [];
  return values.map((row: unknown[]) => ({
    id: row[0] as string,
    title: row[1] as string,
    themeId: row[2] as string,
    content: row[3] as string,
    source: row[4] as string | null,
    importance: row[5] as number,
    status: row[6] as string,
    createdAt: row[7] as string,
    updatedAt: row[8] as string,
    theme: row[9] ? { id: row[9] as string, name: row[10] as string, description: row[11] as string | null } : null,
  }));
}

export async function createKnowhow(input: { title: string; themeId: string; content: string; source?: string | null; importance: number }) {
  const db = await getDb();
  const id = uuid();
  const now = nowIso();
  db.run('INSERT INTO knowhows (id, title, theme_id, content, source, importance, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, input.title, input.themeId, input.content, input.source ?? null, input.importance, 'collected', now, now]);
  persistDb();
  return { id, title: input.title, themeId: input.themeId, content: input.content, source: input.source ?? null, importance: input.importance, status: 'collected', createdAt: now, updatedAt: now, theme: null };
}

export async function analyzeKnowhow(id: string) {
  const db = await getDb();
  const row = db.prepare('SELECT content, importance FROM knowhows WHERE id = ?').get(id) as { content: string; importance: number } | undefined;
  if (!row) return null;
  const summary = createPracticeSummary(row.content);
  const score = calculateAnalysisScore(row.importance, row.content.length);
  const analysisId = uuid();
  const createdAt = nowIso();
  db.run('INSERT INTO analyses (id, knowhow_id, summary, score, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [analysisId, id, summary, score, 'analyzed', createdAt]);
  db.run('UPDATE knowhows SET status = ?, updated_at = ? WHERE id = ?', ['analyzed', nowIso(), id]);
  persistDb();
  return { analysis: { id: analysisId, knowhowId: id, summary, score, status: 'analyzed', createdAt }, itemId: id };
}

export async function organizeKnowhow(id: string) {
  const db = await getDb();
  db.run('UPDATE knowhows SET status = ?, updated_at = ? WHERE id = ?', ['organized', nowIso(), id]);
  persistDb();
  return true;
}

export async function publishKnowhow(id: string) {
  const db = await getDb();
  const row = db.prepare('SELECT title, content FROM knowhows WHERE id = ?').get(id) as { title: string; content: string } | undefined;
  if (!row) return null;
  const practiceId = uuid();
  const now = nowIso();
  db.run('INSERT INTO best_practices (id, knowhow_id, title, summary, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [practiceId, id, row.title, createPracticeSummary(row.content), row.content, 'draft', now, now]);
  db.run('UPDATE knowhows SET status = ?, updated_at = ? WHERE id = ?', ['published', nowIso(), id]);
  persistDb();
  return { id: practiceId, knowhowId: id, title: row.title, summary: row.content.slice(0, 120), content: row.content, status: 'draft', createdAt: now, updatedAt: now };
}

export async function listBestPractices() {
  const db = await getDb();
  const rows = db.exec('SELECT id, knowhow_id, title, summary, content, status, created_at, updated_at FROM best_practices ORDER BY created_at DESC');
  return rows[0]?.values.map((row: unknown[]) => ({
    id: row[0] as string,
    knowhowId: row[1] as string,
    title: row[2] as string,
    summary: row[3] as string,
    content: row[4] as string,
    status: row[5] as string,
    createdAt: row[6] as string,
    updatedAt: row[7] as string,
  })) ?? [];
}
