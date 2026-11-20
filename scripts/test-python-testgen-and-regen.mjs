import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfoj-pygen-'));
process.env.CFOJ_DATA_DIR = tempDir;

const { getDb, setSetting, ROOT_DIR } = await import('../src/db.mjs');
const { createCfojHttpServer } = await import('../src/server.mjs');
const { prepareProblemTestPackage } = await import('../src/testgen.mjs');
const { getFixtureExecutable } = await import('../src/providers.mjs');

after(() => {
  try {
    getDb().close();
  } catch {}
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
});

function createCustom2283AMockProvider(dir) {
  const mjsPath = path.join(dir, 'mock-2283a.mjs');
  const payloadPath = path.join(dir, 'mock-2283a-payload.json');
  const cmdPath = path.join(dir, 'mock-2283a.cmd');
  const seeds = [];
  for (let i = 1; i <= 25; i++) {
    const cats = ['minimum', 'boundary', 'ties', 'special_structure', 'anti_greedy_plausible_wrong', 'maximum', 'stress_max_complexity'];
    seeds.push({ seed: i, category: cats[(i - 1) % cats.length] });
  }
  const payload = {
    planSummary: 'Multi-test Python random generator for 2283A (Numbers on the Board) with t test cases of (l, r) in [-100, 100].',
    checkerType: 'token',
    checkerEps: 1e-6,
    checkerCpp: '',
    checkerSelfTests: [],
    generatorPy: `import sys, random

def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    category = sys.argv[2] if len(sys.argv) > 2 else "random"
    rng = random.Random(seed * 1000003 + sum(ord(c) for c in category))
    if category == "minimum":
        t = rng.randint(1, 3)
        cases = []
        for _ in range(t):
            v = rng.randint(-5, 5)
            cases.append((v, v))
    elif category in ("maximum", "stress_max_complexity"):
        t = rng.randint(200, 500)
        cases = []
        for _ in range(t):
            a = rng.randint(-100, 100)
            b = rng.randint(-100, 100)
            if a > b:
                a, b = b, a
            cases.append((a, b))
    elif category == "boundary":
        t = rng.randint(4, 10)
        cases = [(-100, 100), (0, 0), (-100, -100), (100, 100)]
        while len(cases) < t:
            a = rng.randint(-10, 10)
            b = rng.randint(a, 10)
            cases.append((a, b))
    else:
        t = rng.randint(3, 12)
        cases = []
        for _ in range(t):
            a = rng.randint(-12, 12)
            b = rng.randint(a, min(12, a + rng.randint(0, 10)))
            cases.append((a, b))
    out = [str(len(cases))] + [f"{l} {r}" for l, r in cases]
    sys.stdout.write("\\n".join(out) + "\\n")

if __name__ == "__main__":
    main()
`,
    validatorCpp: `#include <bits/stdc++.h>
int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int t;
    if (!(std::cin >> t)) return 1;
    if (t < 1 || t > 10000) return 2;
    for (int i = 0; i < t; ++i) {
        int l, r;
        if (!(std::cin >> l >> r)) return 3;
        if (l < -100 || r > 100 || l > r) return 4;
    }
    std::string extra;
    if (std::cin >> extra) return 5;
    return 0;
}`,
    referenceCpp: `#include <bits/stdc++.h>
using namespace std;
int solve_one(int l, int r) {
    int n = r - l + 1;
    if (r < 0 || l > 0) return n - 1;
    const int NEG = -1e9;
    int posMax = r * (r + 1) / 2;
    int negMax = (-l) * (-l + 1) / 2;
    int lim = min(posMax, negMax);
    vector<int> dpP(posMax + 1, NEG), dpN(negMax + 1, NEG);
    dpP[0] = 0;
    for (int v = 1; v <= r; ++v)
        for (int s = posMax; s >= v; --s)
            if (dpP[s - v] != NEG) dpP[s] = max(dpP[s], dpP[s - v] + 1);
    dpN[0] = 0;
    for (int v = 1; v <= -l; ++v)
        for (int s = negMax; s >= v; --s)
            if (dpN[s - v] != NEG) dpN[s] = max(dpN[s], dpN[s - v] + 1);
    int bestKeep = 1;
    for (int s = 0; s <= lim; ++s) {
        if (dpP[s] != NEG && dpN[s] != NEG) {
            int m_nz = dpP[s] + dpN[s];
            int totalKeep = (m_nz < n - 1) ? (m_nz + 2) : n;
            bestKeep = max(bestKeep, totalKeep);
        }
    }
    return n - bestKeep;
}
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t;
    if (!(cin >> t)) return 0;
    while (t--) {
        int l, r;
        cin >> l >> r;
        cout << solve_one(l, r) << '\\n';
    }
    return 0;
}`,
    oracleCpp: `#include <bits/stdc++.h>
using namespace std;
int solve_oracle(int l, int r) {
    int n = r - l + 1;
    if (r < 0 || l > 0) return n - 1;
    int offset = 5050;
    vector<int> dp(2 * offset + 1, -1e9);
    dp[offset] = 0;
    for (int v = l; v <= r; ++v) {
        if (v == 0) continue;
        if (v > 0) {
            for (int s = 2 * offset; s >= v; --s)
                if (dp[s - v] >= 0) dp[s] = max(dp[s], dp[s - v] + 1);
        } else {
            for (int s = 0; s <= 2 * offset + v; ++s)
                if (dp[s - v] >= 0) dp[s] = max(dp[s], dp[s - v] + 1);
        }
    }
    int maxZeroNz = dp[offset];
    int bestKeep = (maxZeroNz < n - 1) ? (maxZeroNz + 2) : n;
    return n - bestKeep;
}
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t;
    if (!(cin >> t)) return 0;
    while (t--) {
        int l, r;
        cin >> l >> r;
        cout << solve_oracle(l, r) << '\\n';
    }
    return 0;
}`,
    wrongSolutions: [
      {
        name: 'always_outputs_zero',
        sourceCpp: `#include <bits/stdc++.h>
int main() {
    int t;
    if (!(std::cin >> t)) return 0;
    while (t--) {
        int l, r;
        std::cin >> l >> r;
        std::cout << 0 << '\\n';
    }
}`
      }
    ],
    seeds
  };
  fs.writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');
  const script = `import fs from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('--version')) {
  process.stdout.write('codex-cli 0.114.0 (2283A test adapter)\\n');
  process.exit(0);
}
let outPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output-last-message' && args[i + 1]) {
    outPath = args[i + 1];
    i++;
  }
}
const raw = fs.readFileSync(${JSON.stringify(payloadPath)}, 'utf8');
if (outPath) fs.writeFileSync(outPath, raw, 'utf8');
else process.stdout.write(raw);
`;
  fs.writeFileSync(mjsPath, script, 'utf8');
  fs.writeFileSync(cmdPath, `@echo off\r\nnode "${mjsPath}" %*\r\n`, 'utf8');
  return cmdPath;
}

test('db migration v2 invalidates legacy fixture test packages on real contests while preserving contest 4', () => {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT OR REPLACE INTO contests (id, title_en, data_dir, source_url, imported_at, updated_at)
     VALUES (4, 'Beta Round 4', ?, 'https://codeforces.com/contest/4', ?, ?),
            (2283, 'Edu 196', ?, 'https://codeforces.com/contest/2283', ?, ?)`
  ).run(path.join(tempDir, 'contests', '4'), now, now, path.join(tempDir, 'contests', '2283'), now, now);

  db.prepare(
    `INSERT OR REPLACE INTO problems (id, contest_id, problem_index, title_en, source_url, fetch_status, test_prep_status, active_package_rev, updated_at)
     VALUES ('4A', 4, 'A', 'Watermelon', '', 'ready', 'ready', 1, ?),
            ('2283A', 2283, 'A', 'Numbers on the Board', '', 'ready', 'ready', 1, ?)`
  ).run(now, now);

  const fixtureVal = JSON.stringify({ valid: true, isFixture: true });
  db.prepare(
    `INSERT OR REPLACE INTO test_packages (problem_id, revision, status, provider, validation_json, package_dir, created_at)
     VALUES ('4A', 1, 'published', 'codex', ?, 'dir4a', ?),
            ('2283A', 1, 'published', 'codex', ?, 'dir2283a', ?)`
  ).run(fixtureVal, now, fixtureVal, now);

  // Rewind user_version to 1 and reopen DB in a child process to trigger v2 migration
  db.exec('PRAGMA user_version = 1');
  execFileSync(
    process.execPath,
    ['--input-type=module', '-e', "import { getDb } from './src/db.mjs'; getDb();"],
    { cwd: ROOT_DIR, env: { ...process.env, CFOJ_DATA_DIR: tempDir } }
  );

  const p4A = db.prepare("SELECT test_prep_status, active_package_rev FROM problems WHERE id = '4A'").get();
  const p2283A = db.prepare("SELECT test_prep_status, active_package_rev, test_prep_error FROM problems WHERE id = '2283A'").get();
  assert.equal(p4A.test_prep_status, 'ready');
  assert.equal(p4A.active_package_rev, 1);
  assert.equal(p2283A.test_prep_status, 'failed');
  assert.equal(p2283A.active_package_rev, 0);
  assert.match(p2283A.test_prep_error, /Python/);
});

test('Python random generator builds valid multi-test cases for 2283A (t + l r pairs, never single "1")', async () => {
  const db = getDb();
  const stmt2283A = {
    problemId: '2283A',
    contestId: 2283,
    problemIndex: 'A',
    title: 'Numbers on the Board',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    descriptionHtml: '<p>All integers from $$$l$$$ to $$$r$$$ inclusive are written on the board.</p>',
    inputSpecHtml: '<p>The first line contains $$$t$$$ ($$$1 \\le t \\le 10^4$$$). Each test case contains $$$l$$$ and $$$r$$$ ($$$-100 \\le l \\le r \\le 100$$$).</p>',
    outputSpecHtml: '<p>Minimum number of erasures.</p>',
    noteHtml: '',
    samples: [
      {
        input: '8\n0 0\n2 6\n-5 -3\n-2 2\n-2 3\n-2 5\n-6 2\n0 4\n',
        output: '0\n4\n2\n0\n0\n2\n3\n3\n'
      }
    ]
  };
  db.prepare(
    `UPDATE problems SET statement_en_json = ?, time_limit_ms = 2000, memory_limit_mb = 512 WHERE id = '2283A'`
  ).run(JSON.stringify(stmt2283A));

  const mockCmd = createCustom2283AMockProvider(tempDir);
  const probRow = db.prepare("SELECT * FROM problems WHERE id = '2283A'").get();
  const res = await prepareProblemTestPackage(probRow, {
    provider: 'codex',
    executableOverride: mockCmd,
    targetTestCount: 12
  });
  assert.equal(res.ok, true, res.error || 'prepareProblemTestPackage failed');
  assert.equal(res.validation.generatorLanguage, 'python');
  assert.equal(res.validation.sampleCount, 1);
  assert.equal(res.validation.generatedCount, 12);

  const genPyPath = path.join(res.packageDir, 'src', 'generator.py');
  assert.equal(fs.existsSync(genPyPath), true, 'src/generator.py must be saved');

  const manifest = JSON.parse(fs.readFileSync(path.join(res.packageDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.generator.language, 'python');
  assert.equal(manifest.cases.length, 13);

  // Verify every single test case has multi-test format: first line t >= 1, followed by t lines of "l r"
  for (const tc of manifest.cases) {
    const content = fs.readFileSync(path.join(res.packageDir, tc.inputFile), 'utf8').trim();
    const lines = content.split('\n');
    const tVal = Number(lines[0]);
    assert.ok(Number.isInteger(tVal) && tVal >= 1 && tVal <= 10000, `Invalid t in ${tc.inputFile}: ${lines[0]}`);
    assert.equal(lines.length, tVal + 1, `Expected ${tVal + 1} lines in ${tc.inputFile}, got ${lines.length}`);
    for (let i = 1; i <= tVal; i++) {
      const parts = lines[i].trim().split(/\s+/).map(Number);
      assert.equal(parts.length, 2, `Expected 2 integers (l r) on line ${i} of ${tc.inputFile}`);
      assert.ok(parts[0] >= -100 && parts[1] <= 100 && parts[0] <= parts[1]);
    }
  }
});

test('POST /api/contests/:id/regenerate-tests regenerates all contest test packages via Python generator and preserves drafts', async () => {
  setSetting('codex_bin', getFixtureExecutable('codex'));
  setSetting('target_test_count', '10');

  const server = createCfojHttpServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Import Contest 4 using fixture provider (now backed by Python generators)
    const impRes = await fetch(`${baseUrl}/api/contests/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestId: 4, useFixture: true, provider: 'codex', forceRegenerate: true })
    });
    const impData = await impRes.json();
    assert.equal(impRes.status, 200);
    assert.equal(impData.ok, true, JSON.stringify(impData));

    // Save a draft on 4A to verify regeneration does not clobber user work
    await fetch(`${baseUrl}/api/drafts/4A`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceCode: '// keep my 4A draft', customInput: '8\n' })
    });

    const beforeDetail = await (await fetch(`${baseUrl}/api/contests/4`)).json();
    const beforeRevs = Object.fromEntries(beforeDetail.problems.map((p) => [p.id, p.stages.test_prep.activeRevision]));

    // Trigger contest-wide test data regeneration
    const regenRes = await fetch(`${baseUrl}/api/contests/4/regenerate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'codex', useFixture: true, targetTestCount: 10 })
    });
    const regenData = await regenRes.json();
    assert.equal(regenRes.status, 200);
    assert.equal(regenData.ok, true, JSON.stringify(regenData));
    assert.equal(regenData.results.length, 4);

    for (const r of regenData.results) {
      assert.equal(r.ok, true, `Problem ${r.problemId} regeneration failed: ${r.error}`);
      assert.equal(r.validation.generatorLanguage, 'python');
      assert.ok(r.revision > beforeRevs[r.problemId], `Expected revision increment for ${r.problemId}`);
      assert.equal(fs.existsSync(path.join(r.packageDir, 'src', 'generator.py')), true);
    }

    // Draft is preserved
    const draftAfter = await (await fetch(`${baseUrl}/api/drafts/4A`)).json();
    assert.equal(draftAfter.sourceCode, '// keep my 4A draft');

    // Non-existent contest returns 404
    const notFoundRes = await fetch(`${baseUrl}/api/contests/999999/regenerate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(notFoundRes.status, 404);

    // Frontend app.js exposes per-contest and per-problem regenerate buttons
    const appJs = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf8');
    assert.ok(appJs.includes('regen-contest-tests-btn'));
    assert.ok(appJs.includes('regen-prob-tests-btn'));
    assert.ok(appJs.includes('/regenerate-tests'));
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});
