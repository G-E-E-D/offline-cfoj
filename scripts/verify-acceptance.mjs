import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ROOT_DIR, getDb, setSetting } from '../src/db.mjs';
import { checkCaseOutput, judgeEvents, loadProblemTestSuite } from '../src/judge.mjs';
import { startServer } from '../src/server.mjs';

const EDGE_PATH = fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiJson(baseUrl, endpoint, options = {}) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function waitForSubmissionFinal(baseUrl, submissionId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    async function poll() {
      try {
        const { ok, data } = await apiJson(baseUrl, `/api/submissions/${submissionId}`);
        if (ok && data.submission?.status === 'final') {
          resolve(data.submission);
          return;
        }
      } catch {}
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for submission #${submissionId}`));
        return;
      }
      setTimeout(poll, 200);
    }
    poll();
  });
}

// Minimal Chrome DevTools Protocol client using Node 24 built-in global WebSocket
async function launchFreshHeadlessBrowser(cdpPort = 9345) {
  const profileDir = path.join(DATA_DIR, 'tmp', `browser-profile-${Date.now()}-${cdpPort}`);
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const proc = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-extensions',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${cdpPort}`,
      'about:blank'
    ],
    { windowsHide: true }
  );

  let targetWsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((x) => x.type === 'page');
        if (page?.webSocketDebuggerUrl) {
          targetWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {}
    await sleep(200);
  }
  assert.ok(targetWsUrl, 'Failed to connect to headless Edge CDP target');

  const ws = new WebSocket(targetWsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 1;
  const pending = new Map();
  const networkRequests = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === 'Network.requestWillBeSent') {
      const reqUrl = msg.params?.request?.url || '';
      if (!reqUrl.startsWith('data:')) {
        networkRequests.push(reqUrl);
      }
    }
  };

  function sendCdp(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCdp('Page.enable');
  await sendCdp('Runtime.enable');
  await sendCdp('Network.enable');

  async function navigate(url) {
    await sendCdp('Page.navigate', { url });
    await sleep(600);
  }

  async function evaluate(expression) {
    const res = await sendCdp('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(
        `Browser JS exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`
      );
    }
    return res.result?.value;
  }

  async function waitForSelector(selector, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (found) return true;
      await sleep(150);
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  async function close() {
    try {
      ws.close();
    } catch {}
    try {
      proc.kill();
    } catch {}
    await sleep(300);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }

  return { navigate, evaluate, waitForSelector, networkRequests, close };
}

async function main() {
  console.log('================================================================');
  console.log('OFFLINE CFOJ — FULL ACCEPTANCE VERIFICATION SUITE (prompt.md 1-5)');
  console.log('================================================================\n');

  let srv = await startServer({ port: 0 });
  let baseUrl = srv.url;
  console.log(`Started Offline CFOJ server #1 at ${baseUrl} (Data Dir: ${DATA_DIR})`);

  try {
    // =========================================================================
    // ACCEPTANCE CHECK 1:
    // Import public contest 4 by entering only its ID. Verify A..D in order,
    // both languages available, assets load locally, editorial files open on
    // disk with 4 sections, exercise provider adapters (success & failure paths).
    // =========================================================================
    console.log('\n--- [Acceptance 1] Provider Adapters & Contest 4 Import by ID ---');
    const { data: provStatus } = await apiJson(baseUrl, '/api/providers/status');
    console.log('Provider detection status:', {
      codexInstalledInSystemPath: provStatus.providers.codex.installed && !provStatus.providers.codex.isFixture,
      antigravityInstalledInSystemPath:
        provStatus.providers.antigravity.installed && !provStatus.providers.antigravity.isFixture
    });

    for (const prov of ['codex', 'antigravity']) {
      const okTest = await apiJson(baseUrl, '/api/providers/test', {
        method: 'POST',
        body: JSON.stringify({ provider: prov, useFixture: true })
      });
      assert.equal(okTest.data.ok, true, `${prov} fixture success test failed`);

      for (const [failMode, expectedCode] of [
        ['auth_error', 'PROVIDER_AUTH_ERROR'],
        ['version_error', 'PROVIDER_VERSION_ERROR'],
        ['malformed_json', 'PROVIDER_INVALID_JSON']
      ]) {
        const failTest = await apiJson(baseUrl, '/api/providers/test', {
          method: 'POST',
          body: JSON.stringify({ provider: prov, useFixture: true, failMode })
        });
        assert.equal(failTest.data.ok, false);
        assert.equal(failTest.data.code, expectedCode, `${prov} ${failMode} code mismatch`);
      }
    }
    console.log('✓ OpenAI Codex (`codex exec`) and Google Antigravity (`agy -p`) success & failure paths verified.');

    // Import Contest 4 by entering only its numeric ID ("4")
    const impRes = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({ contestId: '4' })
    });
    assert.equal(impRes.data.ok, true, `Contest 4 import failed: ${JSON.stringify(impRes.data)}`);

    const { data: contest4 } = await apiJson(baseUrl, '/api/contests/4');
    assert.equal(contest4.offlineReady, true);
    assert.deepEqual(
      contest4.problems.map((p) => p.index),
      ['A', 'B', 'C', 'D']
    );
    for (const p of contest4.problems) {
      assert.equal(p.capabilities.canRead, true);
      assert.equal(p.capabilities.hasChinese, true);
      assert.equal(p.capabilities.canJudgeFull, true);
      assert.equal(p.capabilities.hasEditorial, true);
    }

    // Verify local assets load with 200 OK
    for (const assetName of ['4a-watermelon.svg', '4d-envelopes.svg']) {
      const assetRes = await fetch(`${baseUrl}/api/contests/4/assets/${assetName}`);
      assert.equal(assetRes.status, 200);
      const svgText = await assetRes.text();
      assert.ok(svgText.includes('<svg'), `Asset ${assetName} is not valid SVG`);
    }

    // Verify editorial.en.md and editorial.zh-CN.md open directly on disk with 4 sections
    const enMdPath = contest4.editorialFiles.enPath;
    const zhMdPath = contest4.editorialFiles.zhPath;
    assert.ok(fs.existsSync(enMdPath), `Missing ${enMdPath}`);
    assert.ok(fs.existsSync(zhMdPath), `Missing ${zhMdPath}`);
    const enMd = fs.readFileSync(enMdPath, 'utf8');
    const zhMd = fs.readFileSync(zhMdPath, 'utf8');
    assert.ok(enMd.includes('## Contents'));
    assert.ok(zhMd.includes('## 目录'));
    for (const idx of ['A', 'B', 'C', 'D']) {
      assert.ok(enMd.includes(`{#problem-${idx}}`), `editorial.en.md missing section ${idx}`);
      assert.ok(zhMd.includes(`{#problem-${idx}}`), `editorial.zh-CN.md missing section ${idx}`);
    }
    assert.ok(enMd.includes('assets/4a-watermelon.svg'));
    assert.ok(enMd.includes('assets/4d-envelopes.svg'));
    console.log('✓ Contest 4 imported by ID only: A, B, C, D in order, bilingual, local SVG assets, and both editorial.en.md & editorial.zh-CN.md verified on disk.');

    // =========================================================================
    // ACCEPTANCE CHECK 2:
    // 4A sample 8 -> YES; parity-only passes sample and gets WA on weight 2;
    // correct C++23 gets AC.
    // 4B input "2 3 / 1 2 / 1 2": after YES, checker accepts "1 2" or "2 1"
    // and rejects "2 2".
    // =========================================================================
    console.log('\n--- [Acceptance 2] 4A Watermelon & 4B Before an Exam Verdicts ---');
    const parityOnly4A = `#include <bits/stdc++.h>
int main() {
    int w;
    if (!(std::cin >> w)) return 0;
    std::println("{}", (w % 2 == 0) ? "YES" : "NO");
}`;
    const correct4A = `#include <bits/stdc++.h>
int main() {
    int w;
    if (!(std::cin >> w)) return 0;
    std::println("{}", (w % 2 == 0 && w > 2) ? "YES" : "NO");
}`;

    const sampleRun4A = await apiJson(baseUrl, '/api/problems/4A/run', {
      method: 'POST',
      body: JSON.stringify({ mode: 'samples', sourceCode: parityOnly4A })
    });
    assert.equal(sampleRun4A.data.verdict, 'AC');
    assert.equal(sampleRun4A.data.cases[0].input.trim(), '8');
    assert.equal(sampleRun4A.data.cases[0].output.trim(), 'YES');

    const subWa4A = await apiJson(baseUrl, '/api/problems/4A/submit', {
      method: 'POST',
      body: JSON.stringify({ sourceCode: parityOnly4A })
    });
    const judgedWa4A = await waitForSubmissionFinal(baseUrl, subWa4A.data.submission.id);
    assert.equal(judgedWa4A.verdict, 'WA');
    assert.equal(judgedWa4A.failedCase.inputPreview.trim(), '2');

    const subAc4A = await apiJson(baseUrl, '/api/problems/4A/submit', {
      method: 'POST',
      body: JSON.stringify({ sourceCode: correct4A })
    });
    const judgedAc4A = await waitForSubmissionFinal(baseUrl, subAc4A.data.submission.id);
    assert.equal(judgedAc4A.verdict, 'AC');
    assert.equal(judgedAc4A.totalTests, 100);
    console.log('✓ 4A verified: sample 8 -> YES, parity-only passes sample & receives WA on weight 2, correct C++23 solution receives AC on all 100 cases.');

    // 4B checker verification on "2 3\n1 2\n1 2"
    const db = getDb();
    const prob4BRow = db.prepare('SELECT * FROM problems WHERE id = ?').get('4B');
    const suite4B = loadProblemTestSuite(prob4BRow);
    const input4B = '2 3\n1 2\n1 2\n';
    const refAns4B = 'YES\n2 1\n';
    const res12 = await checkCaseOutput(suite4B.checker, input4B, 'YES\n1 2\n', refAns4B);
    const res21 = await checkCaseOutput(suite4B.checker, input4B, 'YES\n2 1\n', refAns4B);
    const res22 = await checkCaseOutput(suite4B.checker, input4B, 'YES\n2 2\n', refAns4B);
    assert.equal(res12.ok, true, '4B checker should accept 1 2');
    assert.equal(res21.ok, true, '4B checker should accept 2 1');
    assert.equal(res22.ok, false, '4B checker should reject 2 2');

    // Also submit a full 4B solution that prints reverse greedy (yielding 1 2 on 2 3 / 1 2 / 1 2)
    const reverseGreedy4B = `#include <bits/stdc++.h>
int main() {
    int d, sumTime;
    std::cin >> d >> sumTime;
    std::vector<int> mn(d), mx(d);
    int L = 0, R = 0;
    for (int i = 0; i < d; ++i) { std::cin >> mn[i] >> mx[i]; L += mn[i]; R += mx[i]; }
    if (sumTime < L || sumTime > R) { std::println("NO"); return 0; }
    int rem = sumTime - L;
    std::vector<int> ans = mn;
    for (int i = d - 1; i >= 0; --i) {
        int add = std::min(rem, mx[i] - mn[i]);
        ans[i] += add;
        rem -= add;
    }
    std::println("YES");
    for (int i = 0; i < d; ++i) std::print("{}{}", ans[i], (i + 1 == d) ? "\\n" : " ");
}`;
    const subAc4B = await apiJson(baseUrl, '/api/problems/4B/submit', {
      method: 'POST',
      body: JSON.stringify({ sourceCode: reverseGreedy4B })
    });
    const judgedAc4B = await waitForSubmissionFinal(baseUrl, subAc4B.data.submission.id);
    assert.equal(judgedAc4B.verdict, 'AC');
    console.log('✓ 4B verified: semantic checker accepts both "1 2" and "2 1" and rejects "2 2"; full 4B submission receives AC.');

    // =========================================================================
    // ACCEPTANCE CHECK 3:
    // Block external network access while keeping loopback available. Sign out
    // both AI providers. Restart the app and judge, open a fresh browser profile,
    // switch languages while editing, run a sample, submit correct and incorrect
    // programs, view results, and open local Markdown editorial. Verify zero
    // external requests. Exercise compiler and resource-limit verdicts.
    // =========================================================================
    console.log('\n--- [Acceptance 3] Cold Restart Offline + Fresh Browser Profile + Bilingual Switch + Resource Limit Verdicts ---');
    await apiJson(baseUrl, '/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        ui_language: 'en',
        offline_mode: 'true',
        allow_fixture_fallback: 'false',
        codex_bin: 'codex-signed-out',
        agy_bin: 'agy-signed-out'
      })
    });

    // Restart the app and judge
    await srv.close();
    srv = await startServer({ port: 0 });
    baseUrl = srv.url;
    console.log(`Restarted server #2 (strict offline mode, both providers signed out) at ${baseUrl}`);

    const browser = await launchFreshHeadlessBrowser(9347);
    try {
      await browser.navigate(`${baseUrl}/#/problem/4A`);
      await browser.waitForSelector('#code-editor-textarea');
      await browser.waitForSelector('#problem-statement-title');

      const titleEnInDom = await browser.evaluate(
        `document.querySelector('#problem-statement-title').textContent.trim()`
      );
      assert.equal(titleEnInDom, 'A. Watermelon');

      // Verify KaTeX rendered locally inside statement
      const katexCount = await browser.evaluate(
        `document.querySelectorAll('#statement-pane .katex').length`
      );
      assert.ok(katexCount >= 3, `Expected local KaTeX elements in statement, got ${katexCount}`);

      // Type draft code into editor, then click language toggle while editing
      const draftMarker = '// Draft preserved across language switch\n' + correct4A;
      await browser.evaluate(`
        const ta = document.querySelector('#code-editor-textarea');
        ta.value = ${JSON.stringify(draftMarker)};
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        window.scrollTo(0, 120);
      `);

      await browser.evaluate(`document.querySelector('#lang-toggle-btn').click()`);
      await sleep(250);

      const afterSwitch = await browser.evaluate(`({
        lang: document.documentElement.lang,
        title: document.querySelector('#problem-statement-title').textContent.trim(),
        inputHeading: document.querySelector('#sec-input-heading').textContent.trim(),
        navText: document.querySelector('#nav-contests').textContent.trim(),
        draftValue: document.querySelector('#code-editor-textarea').value,
        route: location.hash
      })`);
      assert.equal(afterSwitch.lang, 'zh-CN');
      assert.equal(afterSwitch.title, 'A. 西瓜');
      assert.equal(afterSwitch.inputHeading, '输入格式');
      assert.equal(afterSwitch.navText, '比赛题库');
      assert.equal(afterSwitch.draftValue, draftMarker);
      assert.equal(afterSwitch.route, '#/problem/4A');
      console.log('✓ Language switched to Simplified Chinese in browser while preserving route and active editor draft.');

      // Run sample in browser
      await browser.evaluate(`document.querySelector('#run-samples-btn').click()`);
      await browser.waitForSelector('#sample-run-verdict');
      const sampleVerdictText = await browser.evaluate(
        `document.querySelector('#sample-run-verdict').textContent.trim()`
      );
      assert.ok(sampleVerdictText.includes('AC'), `Unexpected sample verdict: ${sampleVerdictText}`);

      // Submit correct solution in browser
      await browser.evaluate(`document.querySelector('#submit-solution-btn').click()`);
      await sleep(500);
      const startWait = Date.now();
      let finalBannerVerdict = '';
      while (Date.now() - startWait < 30000) {
        finalBannerVerdict = await browser.evaluate(
          `document.querySelector('#submission-result-banner')?.getAttribute('data-verdict') || ''`
        );
        if (finalBannerVerdict === 'AC') break;
        await sleep(250);
      }
      assert.equal(finalBannerVerdict, 'AC');

      // Open local Markdown editorial in browser
      await browser.navigate(`${baseUrl}/#/editorial/4?problem=A`);
      await browser.waitForSelector('#editorial-rendered-body');
      const edTextZh = await browser.evaluate(
        `document.querySelector('#editorial-rendered-body').textContent`
      );
      assert.ok(edTextZh.includes('西瓜') && edTextZh.includes('神秘礼物'));

      // Verify 100% of browser requests went ONLY to 127.0.0.1 loopback
      const externalReqs = browser.networkRequests.filter(
        (u) => !u.startsWith(baseUrl) && !u.startsWith('http://127.0.0.1')
      );
      assert.deepEqual(
        externalReqs,
        [],
        `External network requests detected: ${externalReqs.join(', ')}`
      );
      console.log(
        `✓ Browser verified (${browser.networkRequests.length} localhost requests, 0 external requests).`
      );
    } finally {
      await browser.close();
    }

    // Exercise compiler and resource-limit verdicts (CE, RE, TLE, MLE, OLE)
    const limitTests = [
      ['CE', '#include <bits/stdc++.h>\nint main(){ invalid_identifier_xyz; }'],
      ['RE', '#include <bits/stdc++.h>\nint main(){ std::abort(); }'],
      ['TLE', '#include <bits/stdc++.h>\nint main(){ volatile unsigned long long c=0; while(true) c++; }'],
      [
        'MLE',
        '#include <bits/stdc++.h>\nint main(){ constexpr size_t N=100ULL*1024*1024; volatile char* p=(volatile char*)std::malloc(N); if(!p) return 99; for(size_t i=0;i<N;i+=4096) p[i]=1; std::println("{}", (int)p[0]); }'
      ],
      [
        'OLE',
        '#include <bits/stdc++.h>\nint main(){ std::string s(1024, \'X\'); for(int i=0;i<20000;i++) std::cout << s; }'
      ]
    ];
    for (const [expectedVerdict, code] of limitTests) {
      const sub = await apiJson(baseUrl, '/api/problems/4A/submit', {
        method: 'POST',
        body: JSON.stringify({ sourceCode: code })
      });
      const finalSub = await waitForSubmissionFinal(baseUrl, sub.data.submission.id);
      assert.equal(
        finalSub.verdict,
        expectedVerdict,
        `Expected ${expectedVerdict}, got ${finalSub.verdict}`
      );
    }
    console.log('✓ Deterministic compiler and resource-limit verdicts verified: CE, RE, TLE, MLE, OLE.');

    // =========================================================================
    // ACCEPTANCE CHECK 4:
    // Start a short VP, verify scheduled future problem hiding, verify active
    // spoiler handling (editorials locked, tags/ratings hidden), submit just
    // before expiry, refresh and restart server, finish judging after expiry,
    // verify original deadline, correct score, and post-contest editorial access.
    // Submit an upsolve and confirm the recorded VP result stays intact.
    // =========================================================================
    console.log('\n--- [Acceptance 4] Virtual Participation, Spoiler Integrity, Expiry Boundary Restart, and Upsolve ---');
    // 1. Test future scheduled VP (starts in 2 seconds, lasts 4 seconds)
    const schedVpRes = await apiJson(baseUrl, '/api/vp/start', {
      method: 'POST',
      body: JSON.stringify({ contestId: 4, startInSeconds: 2, durationSeconds: 5 })
    });
    const vpId = schedVpRes.data.vp.id;
    const originalEndsAt = schedVpRes.data.vp.endsAt;
    assert.equal(schedVpRes.data.vp.phase, 'scheduled');

    // Future problems must be hidden before start
    const beforeStartProb = await apiJson(baseUrl, '/api/problems/4C');
    assert.equal(beforeStartProb.status, 403);
    assert.equal(beforeStartProb.data.locked, true);

    // Wait for VP to transition from 'scheduled' to 'active'
    await sleep(2300);

    // Verify spoiler handling during active VP
    const activeProb4C = await apiJson(baseUrl, '/api/problems/4C');
    assert.equal(activeProb4C.status, 200);
    assert.equal(activeProb4C.data.spoilersHidden, true);
    assert.deepEqual(activeProb4C.data.tags, []);
    assert.equal(activeProb4C.data.rating, null);

    const lockedEd = await apiJson(baseUrl, '/api/contests/4/editorial');
    assert.equal(lockedEd.status, 403);
    assert.equal(lockedEd.data.locked, true);

    // Hold judge queue so submission made just before expiry finishes judging AFTER restart & expiry
    await apiJson(baseUrl, '/api/judge/queue-control', {
      method: 'POST',
      body: JSON.stringify({ paused: true })
    });

    const correct4C = `#include <bits/stdc++.h>
int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int n;
    if (!(std::cin >> n)) return 0;
    std::unordered_map<std::string, int> cnt;
    for (int i = 0; i < n; ++i) {
        std::string s; std::cin >> s;
        int k = cnt[s]++;
        if (k == 0) std::println("OK");
        else std::println("{}{}", s, k);
    }
}`;
    const vpSubRes = await apiJson(baseUrl, '/api/problems/4C/submit', {
      method: 'POST',
      body: JSON.stringify({ sourceCode: correct4C })
    });
    const vpSubId = vpSubRes.data.submission.id;
    assert.equal(vpSubRes.data.submission.mode, 'vp');
    assert.equal(vpSubRes.data.submission.vpId, vpId);
    assert.equal(vpSubRes.data.submission.status, 'queued');

    // Restart the server and wait for the VP deadline to pass before judging finishes
    await srv.close();
    await sleep(3200);
    srv = await startServer({ port: 0 });
    baseUrl = srv.url;
    console.log(`Restarted server #3 after VP expiry at ${baseUrl}; recovering in-flight VP submission #${vpSubId}...`);

    const judgedVpSub = await waitForSubmissionFinal(baseUrl, vpSubId);
    assert.equal(judgedVpSub.verdict, 'AC');
    assert.equal(judgedVpSub.mode, 'vp');
    assert.ok(
      judgedVpSub.submittedAt <= originalEndsAt && judgedVpSub.judgedAt > originalEndsAt,
      `Expected submittedAt (${judgedVpSub.submittedAt}) <= endsAt (${originalEndsAt}) < judgedAt (${judgedVpSub.judgedAt})`
    );

    const { data: afterExpiryVpData } = await apiJson(baseUrl, `/api/vp/${vpId}`);
    const finalizedVp = afterExpiryVpData.vp;
    assert.equal(finalizedVp.endsAt, originalEndsAt, 'Original VP deadline must be preserved');
    assert.equal(finalizedVp.phase, 'finished');
    assert.equal(finalizedVp.standings.localUserRow.points, 1);

    // Post-contest editorial access must now be unlocked!
    const unlockedEd = await apiJson(baseUrl, '/api/contests/4/editorial');
    assert.equal(unlockedEd.status, 200);
    assert.ok(unlockedEd.data.enMarkdown.includes('#problem-C'));

    // Submit an upsolve for 4D after VP expiry and verify recorded VP score stays 1
    const correct4D = `#include <bits/stdc++.h>
struct Env { long long w, h; int id; };
int main() {
    int n; long long w, h;
    if (!(std::cin >> n >> w >> h)) return 0;
    std::vector<Env> a;
    for (int i = 1; i <= n; ++i) {
        long long wi, hi; std::cin >> wi >> hi;
        if (wi > w && hi > h) a.push_back({wi, hi, i});
    }
    if (a.empty()) { std::println("0"); return 0; }
    std::sort(a.begin(), a.end(), [](const Env& x, const Env& y){ return std::tie(x.w, x.h) < std::tie(y.w, y.h); });
    int m = (int)a.size(), best = 0;
    std::vector<int> dp(m, 1), par(m, -1);
    for (int i = 0; i < m; ++i) {
        for (int j = 0; j < i; ++j)
            if (a[j].w < a[i].w && a[j].h < a[i].h && dp[j] + 1 > dp[i]) { dp[i] = dp[j] + 1; par[i] = j; }
        if (dp[i] > dp[best]) best = i;
    }
    std::vector<int> path;
    for (int c = best; c != -1; c = par[c]) path.push_back(a[c].id);
    std::reverse(path.begin(), path.end());
    std::println("{}", path.size());
    for (size_t i = 0; i < path.size(); ++i) std::print("{}{}", path[i], (i + 1 == path.size()) ? "\\n" : " ");
}`;
    const upsolveRes = await apiJson(baseUrl, '/api/problems/4D/submit', {
      method: 'POST',
      body: JSON.stringify({ sourceCode: correct4D })
    });
    assert.equal(upsolveRes.data.submission.mode, 'practice');
    assert.equal(upsolveRes.data.submission.vpId, null);
    const judgedUpsolve = await waitForSubmissionFinal(baseUrl, upsolveRes.data.submission.id);
    assert.equal(judgedUpsolve.verdict, 'AC');

    const { data: vpAfterUpsolve } = await apiJson(baseUrl, `/api/vp/${vpId}`);
    assert.equal(
      vpAfterUpsolve.vp.standings.localUserRow.points,
      1,
      'Recorded VP score must stay intact after post-contest upsolve'
    );
    console.log('✓ VP lifecycle verified: scheduled lock, active spoiler lock, pre-expiry submission judged after restart & expiry, editorial unlock, and post-VP upsolve isolation.');

    // =========================================================================
    // ACCEPTANCE CHECK 5:
    // Interrupt an import, resume it, and reimport the same contest. Verify
    // deduplication and that drafts, submissions, and an earlier VP are still
    // readable.
    // =========================================================================
    console.log('\n--- [Acceptance 5] Interrupted Import, Resume, Reimport & State Preservation ---');
    // Save a draft on 4A
    await apiJson(baseUrl, '/api/drafts/4A', {
      method: 'PUT',
      body: JSON.stringify({
        sourceCode: '// Persistent draft on 4A\n' + correct4A,
        customInput: '8\n'
      })
    });
    // Restore default settings for reimport test
    await apiJson(baseUrl, '/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        offline_mode: 'false',
        allow_fixture_fallback: 'true',
        codex_bin: 'codex',
        agy_bin: 'agy',
        ui_language: 'en'
      })
    });

    const subsBefore = (await apiJson(baseUrl, '/api/submissions')).data.submissions.length;

    // 1. Interrupt import after problem B
    const interruptedImp = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({ contestId: 4, interruptAfterProblemIndex: 'B' })
    });
    assert.equal(interruptedImp.data.interrupted, true);

    // 2. Resume import
    const resumedImp = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({ contestId: 4 })
    });
    assert.equal(resumedImp.data.ok, true);

    // 3. Reimport the same contest
    const reimp = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({ contestId: 4 })
    });
    assert.equal(reimp.data.ok, true);

    // Verify deduplication and preservation of drafts, submissions, and earlier VP
    const { data: contestAfterReimport } = await apiJson(baseUrl, '/api/contests/4');
    assert.equal(contestAfterReimport.problems.length, 4);
    assert.equal(contestAfterReimport.problems[0].activePackage.generatedCount, 99);

    const { data: draftAfter } = await apiJson(baseUrl, '/api/drafts/4A');
    assert.ok(draftAfter.sourceCode.includes('// Persistent draft on 4A'));

    const subsAfter = (await apiJson(baseUrl, '/api/submissions')).data.submissions.length;
    assert.equal(subsAfter, subsBefore);

    const { data: vpStillReadable } = await apiJson(baseUrl, `/api/vp/${vpId}`);
    assert.equal(vpStillReadable.vp.id, vpId);
    assert.equal(vpStillReadable.vp.standings.localUserRow.points, 1);
    console.log('✓ Interrupted import, resume, and reimport verified: deduplicated problems & tests, preserved drafts, submissions, and earlier VP record.');

    console.log('\n================================================================');
    console.log('ALL 5 ACCEPTANCE CHECKS IN prompt.md PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    await srv.close();
  }
}

main().catch((err) => {
  console.error('\nACCEPTANCE VERIFICATION FAILED:', err);
  process.exit(1);
});
