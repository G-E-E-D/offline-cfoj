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
const {
  extractAntigravityEnvelope,
  getFixtureExecutable,
  runProviderStructuredJob,
  TEST_SUITE_SCHEMA,
  TRANSLATION_SCHEMA,
  validateModelSettings
} = await import('../src/providers.mjs');
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

test('antigravity uses stream-json stdin with inline materials (never -p -) and cleans up on timeout', async () => {
  setSetting('agy_model', '');
  setSetting('agy_effort', '');
  fs.copyFileSync(path.join(ROOT_DIR, 'fixtures/providers/mock-provider.mjs'), path.join(temp, 'mock-provider.mjs'));
  const exe = path.join(temp, path.basename(getFixtureExecutable('antigravity')));
  fs.copyFileSync(getFixtureExecutable('antigravity'), exe);
  const argvFile = path.join(temp, 'agy-stream-argv.json');
  const stdinFile = path.join(temp, 'agy-stream-stdin.txt');

  const res = await runProviderStructuredJob({
    providerName: 'antigravity',
    taskType: 'test_suite',
    problemMaterials: { contestId: 4, problemIndex: 'A', title: 'Watermelon', timeLimitMs: 1000, memoryLimitMb: 64, statement: en },
    schema: TEST_SUITE_SCHEMA,
    promptText: 'Build deterministic test suite.',
    executableOverride: exe,
    envOverride: { CFOJ_TEST_ARGV_FILE: argvFile, CFOJ_TEST_STDIN_FILE: stdinFile }
  });
  assert.ok(res.data.generatorPy);

  const argv = JSON.parse(fs.readFileSync(argvFile, 'utf8'));
  assert.equal(argv[argv.indexOf('--input-format') + 1], 'stream-json');
  assert.equal(argv[argv.indexOf('--output-format') + 1], 'stream-json');
  assert.ok(!argv.includes('-p'), 'Must not pass literal -p - to agy');

  const stdinLine = fs.readFileSync(stdinFile, 'utf8').trim();
  const ndjson = JSON.parse(stdinLine);
  assert.equal(ndjson.event, 'user');
  assert.equal(ndjson.message.role, 'user');
  assert.ok(ndjson.message.content.includes('Build deterministic test suite.'));
  assert.ok(ndjson.message.content.includes('No tools are needed'));
  assert.ok(ndjson.message.content.includes('Count the integers in the list.'));

  // extractAntigravityEnvelope supports both single JSON objects and NDJSON streams
  const singleEnv = extractAntigravityEnvelope(JSON.stringify({ status: 'SUCCESS', structured_output: { ok: 1 } }));
  assert.equal(singleEnv.structured_output.ok, 1);
  const ndjsonEnv = extractAntigravityEnvelope([
    JSON.stringify({ event: 'init', init: {} }),
    JSON.stringify({ event: 'result', result: { status: 'SUCCESS', structured_output: { ok: 2 } } })
  ].join('\n'));
  assert.equal(ndjsonEnv.structured_output.ok, 2);

  // Timeout terminates child process tree and cleans up temp jobDir
  await assert.rejects(
    runProviderStructuredJob({
      providerName: 'antigravity',
      taskType: 'test_suite',
      problemMaterials: { contestId: 4, problemIndex: 'A', statement: en },
      schema: TEST_SUITE_SCHEMA,
      executableOverride: exe,
      envOverride: { CFOJ_MOCK_PROVIDER_FAIL: 'hang' },
      timeoutMs: 600
    }),
    err => err.code === 'PROVIDER_EXEC_ERROR' && err.message.includes('timed out')
  );
  const tmpRoot = path.join(temp, 'tmp');
  const leftover = fs.existsSync(tmpRoot) ? fs.readdirSync(tmpRoot).filter(n => n.startsWith('ai-antigravity-')) : [];
  assert.deepEqual(leftover, [], 'Timed-out job directory must be cleaned up without EBUSY leaks');
});
