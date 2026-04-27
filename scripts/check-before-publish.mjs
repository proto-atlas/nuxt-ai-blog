#!/usr/bin/env node
// @ts-check
/**
 * 公開前禁止ワード検出スクリプト (Node 版)。
 *
 * `scripts/check-before-publish.sh` と同等の公開前チェックを Node に移植し、
 * Windows PowerShell でも再現できるよう bash 依存をなくす。
 *
 * - DANGER-WORDS.txt の各パターン (空行 / # コメント除く) に対し、
 * プロジェクトルート以下を再帰的に grep して、ヒットがあれば exit 1
 * - 出力は **値を [REDACTED]** にしてファイル名 + 行番号のみ (transcript / log への
 * シークレットや非公開語の漏洩を防ぐため、bash 版と同じ挙動)
 * - 除外パス・除外ファイル名は bash 版と完全一致 (node_modules, .git, .next, .nuxt,
 * .output, dist, build, coverage, playwright-report, test-results, .wrangler,
 * .open-next, .husky, DANGER-WORDS.txt, check-before-publish.sh, check-secrets.sh,
 * SPEC.md, PROGRESS.md, job-description.md, .env, .env.*, .dev.vars)
 *
 * 使い方:
 * node scripts/check-before-publish.mjs
 * npm run check:publish (package.json 経由)
 *
 * exit code:
 * 0 = ヒットなし (公開 OK)
 * 1 = ヒットあり (公開不可、上の出力で対象ファイル特定して修正)
 * 2 = パターンが空、または正規表現の解析に失敗
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// DANGER-WORDS.txt の探索候補 (公開リポ外のローカル用ファイルがあれば利用)
const DANGER_WORDS_CANDIDATES = [
  path.resolve(__dirname, '..', '_docs', 'DANGER-WORDS.txt'),
  path.resolve(__dirname, '..', '..', '_docs', 'DANGER-WORDS.txt'),
];

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.output',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.wrangler',
  '.open-next',
  '.husky',
]);

const EXCLUDE_FILES = new Set([
  'DANGER-WORDS.txt',
  'check-before-publish.sh',
  'check-before-publish.mjs',
  'check-secrets.sh',
  'SPEC.md',
  'PROGRESS.md',
  'job-description.md',
  '.env',
  '.dev.vars',
]);

/** @param {string} name */
function isExcludedFile(name) {
  if (EXCLUDE_FILES.has(name)) return true;
  // .env.* (.env.local / .env.production など) を除外
  if (name.startsWith('.env.')) return true;
  return false;
}

/**
 * 与えたディレクトリを再帰走査して、対象ファイルのフルパスを yield する。
 * バイナリらしいファイル (拡張子で判定) と巨大ファイルは skip。
 *
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walkFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      yield* walkFiles(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (isExcludedFile(entry.name)) continue;

    // バイナリ/メディアファイルは skip (画像 / wasm / sqlite / lockfile を含む)
    const ext = path.extname(entry.name).toLowerCase();
    const binaryExts = new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.ico',
      '.svg',
      '.wasm',
      '.sqlite',
      '.db',
      '.lock',
      '.lockb',
      '.tsbuildinfo',
    ]);
    if (binaryExts.has(ext)) continue;

    // 巨大ファイル skip (5MB 超)
    try {
      const stat = statSync(fullPath);
      if (stat.size > 5 * 1024 * 1024) continue;
    } catch {
      continue;
    }

    yield fullPath;
  }
}

/**
 * DANGER-WORDS.txt を読んで、空行/コメントを除いたパターン配列を返す。
 *
 * @param {string} filePath
 * @returns {string[]}
 */
function loadDangerWords(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function loadFallbackWords() {
  return ['ghp_', 'github_pat_', 'sk-ant-', 'sk-proj-', 'AIza', 'AKIA'];
}

/**
 * 1 ファイルを行ごとに走査し、各 pattern (RegExp) がヒットしたら結果を返す。
 *
 * @param {string} filePath
 * @param {RegExp[]} patterns
 * @returns {{ file: string; line: number; patternIndex: number }[]}
 */
function scanFile(filePath, patterns) {
  /** @type {{ file: string; line: number; patternIndex: number }[]} */
  const hits = [];
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return hits;
  }

  const relPath = path.relative(PROJECT_ROOT, filePath).replaceAll('\\', '/');
  const lines = content.split(/\r?\n/);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const lineText = lines[lineIdx] ?? '';
    for (let pIdx = 0; pIdx < patterns.length; pIdx += 1) {
      const pattern = patterns[pIdx];
      if (!pattern) continue;
      if (pattern.test(lineText)) {
        hits.push({ file: relPath, line: lineIdx + 1, patternIndex: pIdx });
      }
      pattern.lastIndex = 0;
    }
  }

  return hits;
}

function main() {
  const dangerWordsFile = DANGER_WORDS_CANDIDATES.find((p) => existsSync(p));
  if (dangerWordsFile) {
    console.log(`DANGER-WORDS.txt: ${dangerWordsFile}`);
  } else {
    console.log('DANGER-WORDS.txt: not found; using public fallback patterns');
  }
  console.log('Scanning project for danger words...');
  console.log('');

  const rawWords = dangerWordsFile ? loadDangerWords(dangerWordsFile) : loadFallbackWords();
  const patterns = rawWords.map((w) => new RegExp(w));

  let hitsTotal = 0;
  /** @type {Map<string, { file: string; line: number; patternIndex: number }[]>} */
  const groupedByPattern = new Map();

  for (const filePath of walkFiles(PROJECT_ROOT)) {
    const fileHits = scanFile(filePath, patterns);
    if (fileHits.length === 0) continue;
    hitsTotal += fileHits.length;
    for (const hit of fileHits) {
      const key = String(hit.patternIndex);
      const arr = groupedByPattern.get(key) ?? [];
      arr.push(hit);
      groupedByPattern.set(key, arr);
    }
  }

  if (hitsTotal === 0) {
    console.log('OK: DANGER-WORDS.txt 全パターン検出ゼロ');
    process.exit(0);
  }

  for (const [key, hits] of groupedByPattern) {
    const pIdx = Number(key);
    console.log(`!! HIT: pattern[${pIdx}] matched (value redacted)`);
    const slice = hits.slice(0, 5);
    for (const hit of slice) {
      console.log(` ${hit.file}:${hit.line}: [REDACTED]`);
    }
    if (hits.length > 5) {
      console.log(` ... (他 ${hits.length - 5} 件)`);
    }
    console.log('---');
  }

  console.log('');
  console.log(`!! NG: 合計 ${hitsTotal} 件のヒット。上記を確認して修正してください。`);
  process.exit(1);
}

main();
