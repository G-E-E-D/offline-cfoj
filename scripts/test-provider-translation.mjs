import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { validateTranslatedStatement } from '../src/statement.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfoj translation '));
process.env.CFOJ_DATA_DIR = temp;
const { getDb, setSetting, ROOT_DIR } = await import('../src/db.mjs');
const { getFixtureExecutable, runProviderStructuredJob, TRANSLATION_SCHEMA, validateModelSettings } =
  await import('../src/providers.mjs');
after(() => {
  getDb().close();
  fs.rmSync(temp, { recursive: true, force: true });
});

const en = { title: 'Count', descriptionHtml: '<p>Count the integers in the list.</p>',
  inputSpecHtml: '<p>The array has $$$n$$$ elements.</p>',
  outputSpecHtml: '<p>Print <code>YES</code> for a match.</p>',
  noteHtml: '<p>The first sample has one match.</p>', samples: [{ input: '1\n', output: 'YES\n' }] };
const zh = { ...en, title: '计数', descriptionHtml: '<p>统计列表中整数的个数。</p>',
  inputSpecHtml: '<p>数组含有 $$$n$$$ 个元素。</p>',
  outputSpecHtml: '<p>若匹配，输出 <code>YES</code>。</p>', noteHtml: '<p>第一个样例有一项匹配。</p>' };

test('validates prose in every section while preserving formulas, literals and samples', () => {
  assert.ok(validateTranslatedStatement(en, zh).valid);
  for (const field of ['descriptionHtml', 'inputSpecHtml', 'outputSpecHtml', 'noteHtml']) {
    const copied = { ...zh, [field]: '<p>【中文题面】</p>' + en[field] };
    assert.ok(!validateTranslatedStatement(en, copied).valid, field);
  }
  const partial = { ...zh, descriptionHtml: zh.descriptionHtml + en.descriptionHtml };
  assert.ok(!validateTranslatedStatement(en, partial).valid);
  const tokenOnly = { ...en, outputSpecHtml: '<p><code>YES</code> / <code>NO</code></p>' };
  assert.ok(validateTranslatedStatement(tokenOnly, { ...zh, outputSpecHtml: tokenOnly.outputSpecHtml }).valid);
  const board = '<table><tr><td>o</td><td>f </td><td>f </td><td>f</td><td>o</td></tr></table>';
  assert.ok(validateTranslatedStatement({ ...en, noteHtml: en.noteHtml + board }, { ...zh, noteHtml: zh.noteHtml + board }).valid);
  assert.ok(!validateTranslatedStatement(en, { ...zh, samples: [] }).valid);
});

test('reopens old ready records and invalidates only the untranslated copy', () => {
  const db = getDb();
  const insert = db.prepare(`INSERT INTO problems
    (id,contest_id,problem_index,title_en,source_url,updated_at,translation_status,statement_en_json,statement_zh_json)
    VALUES (?,100,?,'Count','',0,'ready',?,?)`);
  insert.run('100A', 'A', JSON.stringify(en), JSON.stringify(zh));
  insert.run('100B', 'B', JSON.stringify(en), JSON.stringify({ ...en, title: '中文题面' }));
  db.exec('PRAGMA user_version=0');
  execFileSync(process.execPath, ['--input-type=module', '-e', "import { getDb } from './src/db.mjs'; getDb();"], { cwd: ROOT_DIR });
  assert.equal(db.prepare("SELECT translation_status FROM problems WHERE id='100A'").get().translation_status, 'ready');
  const bad = db.prepare("SELECT * FROM problems WHERE id='100B'").get();
  assert.equal(bad.translation_status, 'failed');
  assert.equal(bad.statement_zh_json, null);
  assert.equal(bad.statement_en_json, JSON.stringify(en));
});

test('model and effort settings reach each CLI independently and defaults omit overrides', async () => {
  fs.copyFileSync(path.join(ROOT_DIR, 'fixtures/providers/mock-provider.mjs'), path.join(temp, 'mock-provider.mjs'));
  for (const [provider, prefix] of [['codex', 'codex'], ['antigravity', 'agy']]) {
    const argvFile = path.join(temp, prefix + '-argv.json');
    const exe = path.join(temp, path.basename(getFixtureExecutable(provider)));
    fs.copyFileSync(getFixtureExecutable(provider), exe);
    const request = { providerName: provider, taskType: 'translate',
      problemMaterials: { contestId: 4, problemIndex: 'A', statement: en },
      schema: TRANSLATION_SCHEMA, executableOverride: exe,
      envOverride: { CFOJ_TEST_ARGV_FILE: argvFile } };
    await runProviderStructuredJob(request);
    const defaults = JSON.parse(fs.readFileSync(argvFile, 'utf8'));
    assert.ok(!defaults.includes('--model') && !defaults.includes('--effort') && !defaults.includes('-c'));
    setSetting(prefix + '_model', prefix + '-test-model');
    setSetting(prefix + '_effort', 'high');
    await runProviderStructuredJob(request);
    const args = JSON.parse(fs.readFileSync(argvFile, 'utf8'));
    assert.equal(args[args.indexOf('--model') + 1], prefix + '-test-model');
    if (provider === 'codex') assert.equal(args[args.indexOf('-c') + 1], 'model_reasoning_effort=high');
    else assert.equal(args[args.indexOf('--effort') + 1], 'high');
  }
  assert.throws(() => validateModelSettings({ agy_effort: 'bogus' }));
  assert.throws(() => validateModelSettings({ codex_model: '--invalid' }));
});

test('a missing CLI cannot silently translate a real contest with a demo', async () => {
  setSetting('allow_fixture_fallback', 'true');
  await assert.rejects(runProviderStructuredJob({
    providerName: 'codex', taskType: 'translate', schema: TRANSLATION_SCHEMA,
    problemMaterials: { contestId: 2272, statement: en },
    executableOverride: path.join(temp, 'missing.exe')
  }), err => err.code === 'PROVIDER_NOT_INSTALLED');
});
