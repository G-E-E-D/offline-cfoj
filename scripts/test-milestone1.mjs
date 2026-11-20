import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, getDb, getNowMs } from '../src/db.mjs';
import {
  checkJudgeEnvironment,
  enqueueSubmission,
  judgeEvents,
  recoverInterruptedSubmissions,
  runSampleOrCustomTest
} from '../src/judge.mjs';

function waitForSubmission(submissionId, timeoutMs = 45000) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
  if (current && current.status === 'final') return Promise.resolve(current);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      judgeEvents.off('submissionUpdate', onUpdate);
      reject(new Error(`Timeout waiting for submission ${submissionId}`));
    }, timeoutMs);

    function onUpdate(sub) {
      if (sub.id === submissionId && sub.status === 'final') {
        clearTimeout(timer);
        judgeEvents.off('submissionUpdate', onUpdate);
        resolve(sub);
      }
    }
    judgeEvents.on('submissionUpdate', onUpdate);
  });
}

async function main() {
  console.log('1. Checking judge environment (MinGW C++23 + Windows AppContainer sandbox)...');
  const env = checkJudgeEnvironment();
  console.log('   Environment:', env);
  assert.equal(env.ok, true, env.error || 'Judge environment check failed');

  const db = getDb();
  const now = getNowMs();
  const pkgDir = path.join(DATA_DIR, 'contests', '4', 'problems', 'A', 'packages', 'rev-1');
  fs.mkdirSync(path.join(pkgDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'tests', '01.in'), '8\n', 'utf8');
  fs.writeFileSync(path.join(pkgDir, 'tests', '01.ans'), 'YES\n', 'utf8');
  fs.writeFileSync(path.join(pkgDir, 'tests', '02.in'), '2\n', 'utf8');
  fs.writeFileSync(path.join(pkgDir, 'tests', '02.ans'), 'NO\n', 'utf8');
  fs.writeFileSync(
    path.join(pkgDir, 'manifest.json'),
    JSON.stringify(
      {
        problemId: '4A',
        revision: 1,
        checker: { type: 'token' },
        cases: [
          { name: 'sample-1', category: 'sample', isSample: true, inputFile: 'tests/01.in', answerFile: 'tests/01.ans' },
          { name: 'edge-min-even', category: 'boundary', isSample: false, inputFile: 'tests/02.in', answerFile: 'tests/02.ans' }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  db.prepare(
    `INSERT OR REPLACE INTO contests (id, title_en, type, phase, duration_seconds, source_url, data_dir, imported_at, updated_at)
     VALUES (4, 'Codeforces Beta Round 4 (Div. 2 Only)', 'ICPC', 'FINISHED', 7200, 'https://codeforces.com/contest/4', ?, ?, ?)`
  ).run(path.join(DATA_DIR, 'contests', '4'), now, now);

  db.prepare(
    `INSERT OR REPLACE INTO problems (
      id, contest_id, problem_index, sort_order, title_en, problem_type,
      time_limit_ms, memory_limit_mb, source_url, statement_en_json,
      fetch_status, test_prep_status, active_package_rev, updated_at
    ) VALUES (?, 4, 'A', 0, 'Watermelon', 'batch', 1000, 64, 'https://codeforces.com/contest/4/problem/A', ?, 'ready', 'ready', 1, ?)`
  ).run(
    '4A',
    JSON.stringify({
      title: 'A. Watermelon',
      samples: [{ input: '8\n', output: 'YES\n' }]
    }),
    now
  );

  db.prepare(
    `INSERT OR REPLACE INTO test_packages (
      problem_id, revision, status, provider, checker_type, sample_count, generated_count,
      categories_json, seeds_json, validation_json, package_dir, created_at
    ) VALUES ('4A', 1, 'published', 'fixture', 'token', 1, 1, '["sample","boundary"]', '[1]', '{"valid":true}', ?, ?)`
  ).run(pkgDir, now);

  const problemRow = db.prepare('SELECT * FROM problems WHERE id = ?').get('4A');

  const evenOnlyCpp = `#include <bits/stdc++.h>
int main() {
    int w;
    if (!(std::cin >> w)) return 0;
    std::println("{}", (w % 2 == 0) ? "YES" : "NO");
}`;

  console.log('2. Testing sample-only run on parity-only solution (must pass sample 8 -> YES)...');
  const sampleRes = await runSampleOrCustomTest(problemRow, evenOnlyCpp, 'samples');
  console.log('   Sample run verdict:', sampleRes.verdict, 'mode:', sampleRes.mode);
  assert.equal(sampleRes.verdict, 'AC');

  function createSubmission(code) {
    const info = db
      .prepare(
        `INSERT INTO submissions (
          contest_id, problem_id, problem_index, mode, language, toolchain,
          source_code, package_revision, suite_type, status, verdict, submitted_at
        ) VALUES (4, '4A', 'A', 'practice', 'GNU C++23', ?, ?, 1, 'full', 'queued', 'QUEUED', ?)`
      )
      .run(env.toolchain, code, getNowMs());
    const id = Number(info.lastInsertRowid);
    enqueueSubmission(id);
    return id;
  }

  console.log('3. Submitting parity-only solution against full suite (must receive WA on test 2, weight=2)...');
  const waId = createSubmission(evenOnlyCpp);
  const waSub = await waitForSubmission(waId);
  console.log('   WA submission result:', {
    id: waSub.id,
    verdict: waSub.verdict,
    firstFailedTest: waSub.first_failed_test,
    timeMs: waSub.time_ms,
    memoryBytes: waSub.memory_bytes
  });
  assert.equal(waSub.verdict, 'WA');
  assert.equal(waSub.first_failed_test, 2);

  const acCpp = `#include <bits/stdc++.h>
int main() {
    int w;
    if (!(std::cin >> w)) return 0;
    std::println("{}", (w % 2 == 0 && w > 2) ? "YES" : "NO");
}`;

  console.log('4. Submitting correct GNU C++23 solution (must receive AC)...');
  const acId = createSubmission(acCpp);
  const acSub = await waitForSubmission(acId);
  console.log('   AC submission result:', {
    id: acSub.id,
    verdict: acSub.verdict,
    timeMs: acSub.time_ms,
    memoryBytes: acSub.memory_bytes
  });
  assert.equal(acSub.verdict, 'AC');
  assert.ok(acSub.memory_bytes > 0);

  console.log('5. Exercising CE, RE, TLE, MLE, OLE, and interrupted job recovery...');
  const ceId = createSubmission('#include <bits/stdc++.h>\nint main(){ syntax_error_here }');
  const ceSub = await waitForSubmission(ceId);
  assert.equal(ceSub.verdict, 'CE');
  assert.ok(ceSub.compiler_output.includes('syntax_error_here'));

  const reId = createSubmission('#include <bits/stdc++.h>\nint main(){ std::abort(); }');
  const reSub = await waitForSubmission(reId);
  assert.equal(reSub.verdict, 'RE');

  const tleId = createSubmission('#include <bits/stdc++.h>\nint main(){ volatile unsigned long long x=0; while(true){ x++; } }');
  const tleSub = await waitForSubmission(tleId);
  assert.equal(tleSub.verdict, 'TLE');

  const mleId = createSubmission('#include <bits/stdc++.h>\nint main(){ constexpr size_t N = 100ULL * 1024 * 1024; volatile char* p = (volatile char*)std::malloc(N); if(!p) return 99; for(size_t i=0;i<N;i+=4096) p[i]=1; std::println("{}", (int)p[0]); }');
  const mleSub = await waitForSubmission(mleId);
  assert.equal(mleSub.verdict, 'MLE');

  const oleId = createSubmission('#include <bits/stdc++.h>\nint main(){ std::string s(1024, \'A\'); for(int i=0;i<20000;i++) std::cout << s; }');
  const oleSub = await waitForSubmission(oleId);
  assert.equal(oleSub.verdict, 'OLE');

  // Interrupted job recovery test
  const interruptedInfo = db
    .prepare(
      `INSERT INTO submissions (
        contest_id, problem_id, problem_index, mode, language, toolchain,
        source_code, package_revision, suite_type, status, verdict, submitted_at
      ) VALUES (4, '4A', 'A', 'practice', 'GNU C++23', ?, ?, 1, 'full', 'running', 'RUNNING', ?)`
    )
    .run(env.toolchain, acCpp, getNowMs());
  const recId = Number(interruptedInfo.lastInsertRowid);
  const count = recoverInterruptedSubmissions();
  assert.ok(count >= 1);
  const recSub = await waitForSubmission(recId);
  assert.equal(recSub.id, recId);
  assert.equal(recSub.verdict, 'AC');

  console.log('ALL MILESTONE 1 VERDICT & ISOLATION CHECKS PASSED!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
