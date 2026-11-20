import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getDb } from '../src/db.mjs';
import {
  getContestReadinessSummary,
  importContest,
  repairProblemStage,
  translateSingleProblem
} from '../src/importer.mjs';
import { checkCaseOutput, loadProblemTestSuite } from '../src/judge.mjs';
import {
  TRANSLATION_SCHEMA,
  checkProviderStatus,
  getFixtureExecutable,
  runProviderStructuredJob
} from '../src/providers.mjs';
import { prepareProblemTestPackage } from '../src/testgen.mjs';

async function main() {
  console.log('1. Testing OpenAI Codex & Google Antigravity provider adapters (status + success + failure paths)...');
  const codexFix = getFixtureExecutable('codex');
  const agyFix = getFixtureExecutable('antigravity');

  for (const [prov, exe] of [
    ['codex', codexFix],
    ['antigravity', agyFix]
  ]) {
    // Success path
    const res = await runProviderStructuredJob({
      providerName: prov,
      taskType: 'translate',
      problemMaterials: {
        contestId: 4,
        problemIndex: 'A',
        title: 'Watermelon',
        statement: {
          title: 'Watermelon',
          descriptionHtml: '<p>$$$w$$$</p>',
          inputSpecHtml: '<p>$$$1 \\le w \\le 100$$$</p>',
          outputSpecHtml: '<p><code>YES</code> <code>NO</code></p>',
          samples: [{ input: '8\n', output: 'YES\n' }]
        }
      },
      schema: TRANSLATION_SCHEMA,
      executableOverride: exe
    });
    assert.equal(res.provider, prov);
    assert.equal(res.data.title, '西瓜');

    // Failure path 1: auth_error
    await assert.rejects(
      () =>
        runProviderStructuredJob({
          providerName: prov,
          taskType: 'translate',
          problemMaterials: { contestId: 4, problemIndex: 'A', statement: {} },
          schema: TRANSLATION_SCHEMA,
          executableOverride: exe,
          envOverride: { CFOJ_MOCK_PROVIDER_FAIL: 'auth_error' }
        }),
      (err) => err.code === 'PROVIDER_AUTH_ERROR'
    );

    // Failure path 2: version_error
    await assert.rejects(
      () =>
        runProviderStructuredJob({
          providerName: prov,
          taskType: 'translate',
          problemMaterials: { contestId: 4, problemIndex: 'A', statement: {} },
          schema: TRANSLATION_SCHEMA,
          executableOverride: exe,
          envOverride: { CFOJ_MOCK_PROVIDER_FAIL: 'version_error' }
        }),
      (err) => err.code === 'PROVIDER_VERSION_ERROR'
    );

    // Failure path 3: malformed_json
    await assert.rejects(
      () =>
        runProviderStructuredJob({
          providerName: prov,
          taskType: 'translate',
          problemMaterials: { contestId: 4, problemIndex: 'A', statement: {} },
          schema: TRANSLATION_SCHEMA,
          executableOverride: exe,
          envOverride: { CFOJ_MOCK_PROVIDER_FAIL: 'malformed_json' }
        }),
      (err) => err.code === 'PROVIDER_INVALID_JSON'
    );
  }
  console.log('   Both Codex and Antigravity adapters passed success, auth_error, version_error, and malformed_json checks!');

  console.log('2. Importing Contest 4 by numeric ID only...');
  const imp = await importContest(4, { useFixture: true, provider: 'codex' });
  if (!imp.ok) console.error('   Import steps:', JSON.stringify(imp.steps, null, 2));
  assert.equal(imp.ok, true, imp.error || JSON.stringify(imp.steps));

  const summary = getContestReadinessSummary(4);
  assert.equal(summary.offlineReady, true);
  assert.deepEqual(
    summary.problems.map((p) => p.index),
    ['A', 'B', 'C', 'D']
  );
  console.log('   Problems discovered in order:', summary.problems.map((p) => `${p.index}: ${p.titleEn} / ${p.titleZh}`));

  // Verify editorial files exist on disk with 4 sections and relative assets
  assert.equal(fs.existsSync(summary.editorialFiles.enPath), true);
  assert.equal(fs.existsSync(summary.editorialFiles.zhPath), true);
  const edEn = fs.readFileSync(summary.editorialFiles.enPath, 'utf8');
  const edZh = fs.readFileSync(summary.editorialFiles.zhPath, 'utf8');
  for (const idx of ['A', 'B', 'C', 'D']) {
    assert.ok(edEn.includes(`{#problem-${idx}}`), `editorial.en.md missing #problem-${idx}`);
    assert.ok(edZh.includes(`{#problem-${idx}}`), `editorial.zh-CN.md missing #problem-${idx}`);
  }
  assert.ok(edEn.includes('assets/4a-watermelon.svg'));
  assert.ok(edEn.includes('assets/4d-envelopes.svg'));
  assert.ok(edEn.includes('AI-Generated Editorial'));
  console.log('   Both editorial.en.md and editorial.zh-CN.md verified on disk with 4 indexed sections and relative asset paths!');

  // Verify 4B semantic checker acceptance criteria from prompt.md:
  // Input: 2 3 / 1 2 / 1 2 -> accept YES\n1 2 and YES\n2 1, reject YES\n2 2
  const db = getDb();
  const prob4B = db.prepare('SELECT * FROM problems WHERE id = ?').get('4B');
  const suite4B = loadProblemTestSuite(prob4B);
  assert.equal(suite4B.checker.type, 'custom');
  assert.ok(suite4B.cases.length >= 50, `Expected >=50 cases for 4B, got ${suite4B.cases.length}`);

  const in4B = '2 3\n1 2\n1 2\n';
  const exp4B = 'YES\n2 1\n';
  const chk12 = await checkCaseOutput(suite4B.checker, in4B, 'YES\n1 2\n', exp4B);
  const chk21 = await checkCaseOutput(suite4B.checker, in4B, 'YES\n2 1\n', exp4B);
  const chk22 = await checkCaseOutput(suite4B.checker, in4B, 'YES\n2 2\n', exp4B);
  console.log('   4B semantic checker results:', {
    '1 2': chk12,
    '2 1': chk21,
    '2 2': chk22
  });
  assert.equal(chk12.ok, true);
  assert.equal(chk21.ok, true);
  assert.equal(chk22.ok, false);

  // Verify protected-fragment translation failure & single-item regeneration
  console.log('3. Testing protected-fragment translation rejection and single-item repair...');
  const prob4A = db.prepare('SELECT * FROM problems WHERE id = ?').get('4A');
  const badTr = await translateSingleProblem(prob4A, {
    provider: 'antigravity',
    envOverride: { CFOJ_MOCK_PROVIDER_FAIL: 'corrupt_fragments' }
  });
  assert.equal(badTr.ok, false);
  assert.ok(badTr.error.includes('Protected'));
  // Repair 4A translation using Antigravity
  const repairedTr = await repairProblemStage('4A', 'translation', { provider: 'antigravity' });
  assert.equal(repairedTr.results.translation.ok, true);

  // Verify oracle disagreement detection keeps candidate package out of active use and allows repair
  console.log('4. Testing oracle disagreement detection and atomic package protection...');
  const beforeRev = db.prepare('SELECT active_package_rev FROM problems WHERE id = ?').get('4A').active_package_rev;
  const badPkg = await prepareProblemTestPackage(prob4A, {
    provider: 'antigravity',
    envOverride: { CFOJ_MOCK_PROVIDER_FAIL: 'oracle_disagreement' }
  });
  assert.equal(badPkg.ok, false);
  assert.ok(badPkg.oracleDisagreement, 'Expected oracleDisagreement details');
  assert.equal(badPkg.oracleDisagreement.input.trim(), '2');
  const afterFailProb = db.prepare('SELECT * FROM problems WHERE id = ?').get('4A');
  // Active package revision MUST remain beforeRev (candidate failed revision kept out of use!)
  assert.equal(afterFailProb.active_package_rev, beforeRev);

  // Repair 4A test package
  const repairedPkg = await repairProblemStage('4A', 'test_prep', { provider: 'antigravity' });
  assert.equal(repairedPkg.results.test_prep.ok, true);
  const afterRepairProb = db.prepare('SELECT * FROM problems WHERE id = ?').get('4A');
  assert.ok(afterRepairProb.active_package_rev > beforeRev);

  console.log('ALL MILESTONE 2 & 3 CHECKS PASSED!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
