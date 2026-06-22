import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const backendRoot = path.resolve(currentDir, '..', '..');
export const repoRoot = path.resolve(backendRoot, '..');
export const backendDataDir = path.join(backendRoot, 'data');
export const dbFilePath = path.join(backendDataDir, 'app.sqlite');
export const frontendDistDir = path.join(repoRoot, 'frontend', 'dist');

const sqlWasmCandidates = [
  path.join(repoRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  path.join(backendRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
];

export const sqlWasmPath = sqlWasmCandidates.find((candidate) => fs.existsSync(candidate)) ?? sqlWasmCandidates[0];
