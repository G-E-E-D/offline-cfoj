import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.CFOJ_DATA_DIR
  ? path.resolve(process.env.CFOJ_DATA_DIR)
  : path.join(ROOT_DIR, 'data');

let dbInstance = null;

export function ensureDataDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'contests'), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'tmp'), { recursive: true });
}

export function getDb() {
  if (dbInstance) return dbInstance;
  ensureDataDirs();
  const dbPath = path.join(DATA_DIR, 'cfoj.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contests (
      id INTEGER PRIMARY KEY,
      title_en TEXT NOT NULL,
      title_zh TEXT,
      type TEXT NOT NULL DEFAULT 'ICPC',
      phase TEXT NOT NULL DEFAULT 'FINISHED',
      duration_seconds INTEGER NOT NULL DEFAULT 7200,
      start_time_seconds INTEGER,
      source_url TEXT NOT NULL,
      tutorial_url TEXT,
      data_dir TEXT NOT NULL,
      editorial_en_path TEXT,
      editorial_zh_path TEXT,
      editorial_status TEXT NOT NULL DEFAULT 'pending',
      editorial_error TEXT,
      standings_json TEXT,
      imported_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      contest_id INTEGER NOT NULL,
      problem_index TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      title_en TEXT NOT NULL,
      title_zh TEXT,
      problem_type TEXT NOT NULL DEFAULT 'batch',
      missing_component TEXT,
      points REAL,
      rating INTEGER,
      tags_json TEXT NOT NULL DEFAULT '[]',
      time_limit_ms INTEGER NOT NULL DEFAULT 2000,
      memory_limit_mb INTEGER NOT NULL DEFAULT 256,
      input_file TEXT NOT NULL DEFAULT 'standard input',
      output_file TEXT NOT NULL DEFAULT 'standard output',
      source_url TEXT NOT NULL,
      statement_en_json TEXT,
      statement_zh_json TEXT,
      translation_status TEXT NOT NULL DEFAULT 'pending',
      translation_error TEXT,
      translation_provider TEXT,
      fetch_status TEXT NOT NULL DEFAULT 'pending',
      fetch_error TEXT,
      test_prep_status TEXT NOT NULL DEFAULT 'pending',
      test_prep_error TEXT,
      editorial_prep_status TEXT NOT NULL DEFAULT 'pending',
      editorial_prep_error TEXT,
      editorial_source TEXT,
      editorial_provider TEXT,
      editorial_verified INTEGER NOT NULL DEFAULT 0,
      active_package_rev INTEGER NOT NULL DEFAULT 0,
      candidate_package_rev INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_problems_contest ON problems(contest_id, sort_order);

    CREATE TABLE IF NOT EXISTS test_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      status TEXT NOT NULL,
      provider TEXT,
      checker_type TEXT NOT NULL DEFAULT 'token',
      checker_eps REAL DEFAULT 1e-6,
      sample_count INTEGER NOT NULL DEFAULT 0,
      generated_count INTEGER NOT NULL DEFAULT 0,
      categories_json TEXT NOT NULL DEFAULT '[]',
      seeds_json TEXT NOT NULL DEFAULT '[]',
      validation_json TEXT NOT NULL DEFAULT '{}',
      package_dir TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(problem_id, revision)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contest_id INTEGER NOT NULL,
      problem_id TEXT NOT NULL,
      problem_index TEXT NOT NULL,
      vp_id INTEGER,
      mode TEXT NOT NULL DEFAULT 'practice',
      language TEXT NOT NULL DEFAULT 'GNU C++23',
      toolchain TEXT NOT NULL,
      source_code TEXT NOT NULL,
      package_revision INTEGER NOT NULL,
      suite_type TEXT NOT NULL DEFAULT 'full',
      status TEXT NOT NULL DEFAULT 'queued',
      current_test INTEGER NOT NULL DEFAULT 0,
      total_tests INTEGER NOT NULL DEFAULT 0,
      verdict TEXT NOT NULL DEFAULT 'QUEUED',
      time_ms INTEGER NOT NULL DEFAULT 0,
      memory_bytes INTEGER NOT NULL DEFAULT 0,
      compiler_output TEXT NOT NULL DEFAULT '',
      first_failed_test INTEGER,
      failed_case_json TEXT,
      case_results_json TEXT NOT NULL DEFAULT '[]',
      submitted_at INTEGER NOT NULL,
      judged_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_submissions_contest ON submissions(contest_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_submissions_vp ON submissions(vp_id, id ASC);

    CREATE TABLE IF NOT EXISTS drafts (
      problem_id TEXT PRIMARY KEY,
      source_code TEXT NOT NULL,
      custom_input TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS virtual_participations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contest_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      scoring_type TEXT NOT NULL DEFAULT 'ICPC',
      status TEXT NOT NULL DEFAULT 'active',
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      pinned_revisions_json TEXT NOT NULL DEFAULT '{}',
      finalized_at INTEGER,
      final_score_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contest_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      provider TEXT,
      steps_json TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      started_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS browser_transfer_tokens (
      token TEXT PRIMARY KEY,
      contest_id INTEGER NOT NULL,
      expected_indices_json TEXT NOT NULL DEFAULT '[]',
      provider TEXT NOT NULL DEFAULT 'codex',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_browser_tokens_contest ON browser_transfer_tokens(contest_id, created_at DESC);
  `);

  const defaults = {
    ui_language: 'en',
    ai_provider: 'codex',
    codex_bin: process.env.CFOJ_CODEX_BIN || 'codex',
    agy_bin: process.env.CFOJ_AGY_BIN || 'agy',
    target_test_count: '50',
    compiler_path: process.env.CFOJ_GPP_BIN || 'C:\\YX\\mingw64\\bin\\g++.exe',
    clock_offset_ms: '0',
    offline_mode: 'false'
  };
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)'
  );
  const now = Date.now();
  for (const [k, v] of Object.entries(defaults)) {
    insertSetting.run(k, v, now);
  }

  dbInstance = db;
  return db;
}

export function getSetting(key, fallback = '') {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  const db = getDb();
  db.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, String(value), Date.now());
}

export function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function getNowMs() {
  const offset = Number(getSetting('clock_offset_ms', '0')) || 0;
  return Date.now() + offset;
}
