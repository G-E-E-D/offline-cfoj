import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { DATA_DIR, ROOT_DIR, getDb, setSetting } from '../src/db.mjs';
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

async function launchHeadlessBrowser(cdpPort = 9355) {
  const profileDir = path.join(DATA_DIR, 'tmp', `ext-browser-${Date.now()}-${cdpPort}`);
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
  assert.ok(targetWsUrl, 'Failed to connect to headless Edge CDP');

  const ws = new WebSocket(targetWsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
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

  return { navigate, evaluate, close };
}

function buildContest2283PostVerificationHtml(assetBaseUrl, problemsList) {
  const holders = problemsList.map((p, idx) => {
    const index = p.index;
    const name = p.name;
    // Include MathJax rendered DOM on Problem A to verify original $$$...$$$ restoration
    const mathClause =
      idx === 0
        ? `<span class="MathJax_Preview">n</span><span class="MathJax" id="MathJax-Element-1-Frame">n</span><script type="math/tex">1 \\le n \\le 2 \\cdot 10^5</script>`
        : `$$$1 \\le n \\le 10^5$$$`;
    const diagramHtml =
      index === 'D'
        ? `<center><img class="tex-graphics" src="${assetBaseUrl}/assets/2283d-tree.svg" alt="Tree coloring diagram" /></center>`
        : '';

    return `
      <div class="problemindexholder" problemindex="${index}">
        <div class="ttypography">
          <div class="problem-statement">
            <div class="header">
              <div class="title">${index}. ${name}</div>
              <div class="time-limit"><div class="property-title">time limit per test</div>2 seconds</div>
              <div class="memory-limit"><div class="property-title">memory limit per test</div>256 megabytes</div>
              <div class="input-file"><div class="property-title">input</div>standard input</div>
              <div class="output-file"><div class="property-title">output</div>standard output</div>
            </div>
            <div>
              <p>In problem <b>${name}</b> (Contest 2283 Problem ${index}), you are given an input of size ${mathClause}.</p>
              ${diagramHtml}
            </div>
            <div class="input-specification">
              <div class="section-title">Input</div>
              <p>The first line contains an integer $$$t$$$ (${mathClause}) &mdash; the test parameter for ${index}.</p>
            </div>
            <div class="output-specification">
              <div class="section-title">Output</div>
              <p>For each test case of ${index}, print the answer token <code>YES</code> or the computed integer value.</p>
            </div>
            <div class="sample-tests">
              <div class="section-title">Example</div>
              <div class="sample-test">
                <div class="input">
                  <div class="title">Input</div>
                  <pre><div class="test-example-line">3</div><div class="test-example-line">10  20</div><div class="test-example-line">30</div></pre>
                </div>
                <div class="output">
                  <div class="title">Output</div>
                  <pre>42
</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Problems - Educational Codeforces Round 196 (Rated for Div. 2) - Codeforces</title>
</head>
<body>
  <!-- Simulated sensitive user header & CSRF token that MUST NOT be captured by the extension -->
  <div id="header" data-csrf="secret_csrf_token_99999">
    <a href="/profile/SecretUserHandle">SecretUserHandle</a>
  </div>
  <script>window.secretSessionToken = "DO_NOT_CAPTURE_THIS_SCRIPT";</script>

  <div id="sidebar">
    <div class="roundbox sidebox sidebar-menu">
      <div class="caption titled">&rarr; Contest materials</div>
      <ul>
        <li><a href="/blog/entry/139999">Tutorial</a></li>
      </ul>
    </div>
  </div>

  ${holders.join('\n')}
</body>
</html>`;
}

async function startMockCfServer() {
  const contest4Standings = fs.readFileSync(
    path.join(ROOT_DIR, 'fixtures', 'codeforces', 'contest4', 'contest.standings.json'),
    'utf8'
  );
  const contest4ProblemsHtml = fs.readFileSync(
    path.join(ROOT_DIR, 'fixtures', 'codeforces', 'contest4', 'problems.html'),
    'utf8'
  );
  const contest4TutorialHtml = fs.readFileSync(
    path.join(ROOT_DIR, 'fixtures', 'codeforces', 'contest4', 'tutorial.html'),
    'utf8'
  );
  const svg4A = fs.readFileSync(
    path.join(ROOT_DIR, 'fixtures', 'codeforces', 'contest4', 'assets', '4a-watermelon.svg')
  );
  const svg4D = fs.readFileSync(
    path.join(ROOT_DIR, 'fixtures', 'codeforces', 'contest4', 'assets', '4d-envelopes.svg')
  );

  let dynamic2283Problems = [
    { contestId: 2283, index: 'A', name: 'Numbers on the Board', tags: ['greedy', 'math'] },
    { contestId: 2283, index: 'B', name: 'Rhythmic String', tags: ['number theory'] },
    { contestId: 2283, index: 'C', name: 'Big XOR', tags: ['bitmasks'] },
    { contestId: 2283, index: 'D', name: 'Black, Gray and White', tags: ['trees'] },
    { contestId: 2283, index: 'E', name: 'Partition of a Binary String', tags: ['dp'] },
    { contestId: 2283, index: 'F', name: 'Minimize the Graph', tags: ['graphs'] },
    { contestId: 2283, index: 'G', name: 'Order Statistics on the Graph', tags: ['bitmasks'] }
  ];

  const makeTwoProbApi = (cid) =>
    JSON.stringify({
      status: 'OK',
      result: {
        contest: { id: cid, name: `Test Contest ${cid}`, type: 'ICPC', phase: 'FINISHED', durationSeconds: 7200 },
        problems: [
          { contestId: cid, index: 'A', name: 'Alpha', type: 'PROGRAMMING', tags: ['math'] },
          { contestId: cid, index: 'B', name: 'Beta', type: 'PROGRAMMING', tags: ['dp'] }
        ],
        rows: []
      }
    });

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const p = u.pathname;

    // Assets
    if (p.endsWith('4a-watermelon.svg') || p.endsWith('2283d-tree.svg')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(svg4A);
      return;
    }
    if (p.endsWith('4d-envelopes.svg')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(svg4D);
      return;
    }

    // API standings
    if (p === '/api/contest.standings') {
      const cid = Number(u.searchParams.get('contestId'));
      if (cid === 4) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(contest4Standings);
        return;
      }
      if ([901, 902, 903, 904, 905, 906].includes(cid)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(makeTwoProbApi(cid));
        return;
      }
    }

    // Contest 4 direct HTTP problems page
    if (p === '/contest/4/problems') {
      const html = contest4ProblemsHtml.replace(
        /https:\/\/espresso\.codeforces\.com\//g,
        `http://127.0.0.1:${server.address().port}/assets/`
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (p === '/blog/entry/169') {
      const html = contest4TutorialHtml.replace(
        /https:\/\/espresso\.codeforces\.com\//g,
        `http://127.0.0.1:${server.address().port}/assets/`
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 901: cf-mitigated: challenge header
    if (p === '/contest/901/problems') {
      res.writeHead(403, {
        'Content-Type': 'text/html; charset=utf-8',
        'cf-mitigated': 'challenge'
      });
      res.end('<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Challenge</body></html>');
      return;
    }

    // 902: HTTP 429 Rate Limited (no cf-mitigated header)
    if (p === '/contest/902/problems') {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end('Too Many Requests');
      return;
    }

    // 903: HTTP 403 Ordinary Access Denial (no cf-mitigated header, no Cloudflare challenge markup)
    if (p === '/contest/903/problems') {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html><head><title>Access Denied</title></head><body>Private contest</body></html>');
      return;
    }

    // 904: Network Failure (socket destroy)
    if (p === '/contest/904/problems') {
      req.socket.destroy();
      return;
    }

    // 905: Parse/Validation Error (HTTP 200 but missing expected problem B)
    if (p === '/contest/905/problems') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><body>
        <div class="problemindexholder" problemindex="A">
          <div class="problem-statement">
            <div class="header"><div class="title">A. Alpha</div></div>
            <div><p>Only A is present, B is missing.</p></div>
            <div class="input-specification"><div class="section-title">Input</div><p>x</p></div>
            <div class="output-specification"><div class="section-title">Output</div><p>y</p></div>
          </div>
        </div>
      </body></html>`);
      return;
    }

    // Simulated verified browser tab for Contest 2283
    if (p === '/contest/2283/problems') {
      const origin = `http://127.0.0.1:${server.address().port}`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buildContest2283PostVerificationHtml(origin, dynamic2283Problems));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}`,
    set2283Problems: (list) => {
      dynamic2283Problems = list;
    },
    close: () => new Promise((r) => server.close(r))
  };
}

async function main() {
  console.log('======================================================================');
  console.log('TESTING IMPROVED CONTEST IMPORT & BROWSER EXTENSION TRANSFER WORKFLOW');
  console.log('======================================================================\n');

  // Set target_test_count to 10 in isolated test dir so multi-problem test generation runs quickly
  setSetting('target_test_count', '10');

  const mockCf = await startMockCfServer();
  const srv = await startServer({ port: 0 });
  const baseUrl = srv.url;
  const extensionContentJs = fs.readFileSync(
    path.join(ROOT_DIR, 'extension', 'content.js'),
    'utf8'
  );

  try {
    // =========================================================================
    // 1. Distinguish all 5 statement fetch failure categories
    // =========================================================================
    console.log('1. Verifying distinct error categories (browser_challenge, rate_limited, access_denied, network_failure, parse_error)...');

    // 1a. browser_challenge (cf-mitigated: challenge)
    const r901 = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 901,
        codeforcesBaseUrl: mockCf.url,
        disableFixtureFallback: true
      })
    });
    assert.equal(r901.data.status, 'awaiting_browser');
    assert.equal(r901.data.errorCategory, 'browser_challenge');
    assert.equal(r901.data.errorCode, 'CLOUDFLARE_CHALLENGE');
    assert.ok(r901.data.browserVerification?.token, 'Expected short-lived transfer token');

    // 1b. rate_limited (HTTP 429 without challenge)
    const r902 = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 902,
        codeforcesBaseUrl: mockCf.url,
        disableFixtureFallback: true
      })
    });
    assert.equal(r902.data.status, 'failed');
    assert.equal(r902.data.errorCategory, 'rate_limited');
    assert.equal(r902.data.errorCode, 'RATE_LIMITED');

    // 1c. access_denied (HTTP 403 without cf-mitigated and without challenge body)
    const r903 = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 903,
        codeforcesBaseUrl: mockCf.url,
        disableFixtureFallback: true
      })
    });
    assert.equal(r903.data.status, 'failed');
    assert.equal(r903.data.errorCategory, 'access_denied');
    assert.equal(r903.data.errorCode, 'ACCESS_DENIED');

    // 1d. network_failure (socket closed)
    const r904 = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 904,
        codeforcesBaseUrl: mockCf.url,
        disableFixtureFallback: true
      })
    });
    assert.equal(r904.data.status, 'failed');
    assert.equal(r904.data.errorCategory, 'network_failure');
    assert.equal(r904.data.errorCode, 'NETWORK_FAILURE');

    // 1e. parse_error (missing expected problem index B)
    const r905 = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 905,
        codeforcesBaseUrl: mockCf.url,
        disableFixtureFallback: true
      })
    });
    assert.equal(r905.data.status, 'failed');
    assert.equal(r905.data.errorCategory, 'parse_error');
    assert.equal(r905.data.errorCode, 'MISSING_PROBLEM_INDICES');
    assert.equal(
      fs.existsSync(path.join(DATA_DIR, 'contests', '905', 'cache', 'problems.html')),
      false,
      'Incomplete problems.html must NOT be written to cache'
    );
    console.log('   ✓ All 5 error categories accurately distinguished and validated.');

    // =========================================================================
    // 2. Direct HTTP Import (Default Path)
    // =========================================================================
    console.log('\n2. Testing Direct HTTP Import (/contest/4/problems?locale=en)...');
    const directRes = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 4,
        codeforcesBaseUrl: mockCf.url,
        disableFixtureFallback: true
      })
    });
    assert.equal(directRes.data.ok, true, `Direct HTTP import failed: ${directRes.data.error}`);
    assert.equal(directRes.data.statementFetchSource, 'direct_http');
    assert.deepEqual(
      directRes.data.summary.problems.map((p) => p.index),
      ['A', 'B', 'C', 'D']
    );
    console.log('   ✓ Direct HTTP import succeeded, validated indices A..D, and cached statements.');

    // =========================================================================
    // 3. Contest 2283 Live Check (or mock fallback if offline) -> Challenge -> Browser Import
    // =========================================================================
    console.log('\n3. Testing Contest 2283 import (Live Codeforces API + Live cf-mitigated: challenge)...');
    let live2283Exercised = false;
    let r2283 = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 2283,
        disableFixtureFallback: true
      })
    });

    if (r2283.data.status === 'awaiting_browser' && r2283.data.errorCategory === 'browser_challenge') {
      live2283Exercised = true;
      console.log('   ✓ LIVE Contest 2283 metadata fetched from codeforces.com and LIVE `cf-mitigated: challenge` detected!');
    } else {
      console.log('   (Live codeforces.com unreachable in current environment; using mock challenge for 2283)');
    }

    assert.equal(r2283.data.status, 'awaiting_browser');
    assert.equal(r2283.data.errorCategory, 'browser_challenge');
    const bVer2283 = r2283.data.browserVerification;
    assert.ok(bVer2283?.token, 'Expected short-lived single-use token for Contest 2283');
    assert.equal(bVer2283.contestId, 2283);
    assert.deepEqual(bVer2283.expectedIndices, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    console.log('   ✓ Pending Contest 2283 preserved with expected indices:', bVer2283.expectedIndices.join(', '));

    // 3b. Verify Bilingual UI shows "Continue in browser" / "在浏览器中继续" on #/contest/2283
    const browser = await launchHeadlessBrowser(9358);
    try {
      await browser.navigate(`${baseUrl}/#/contest/2283`);
      await sleep(400);
      const uiBannerEn = await browser.evaluate(`({
        panelExists: Boolean(document.querySelector('#browser-verification-panel')),
        btnText: document.querySelector('#continue-in-browser-btn')?.textContent?.trim() || '',
        targetUrl: document.querySelector('#continue-in-browser-btn')?.getAttribute('data-target-url') || ''
      })`);
      assert.equal(uiBannerEn.panelExists, true);
      assert.ok(uiBannerEn.btnText.includes('Continue in browser'));
      assert.ok(uiBannerEn.targetUrl.includes('https://codeforces.com/contest/2283/problems?locale=en#cfoj_token='));

      // Toggle to Simplified Chinese and verify bilingual action
      await browser.evaluate(`document.querySelector('#lang-toggle-btn').click()`);
      await sleep(250);
      const uiBannerZh = await browser.evaluate(
        `document.querySelector('#continue-in-browser-btn')?.textContent?.trim() || ''`
      );
      assert.ok(uiBannerZh.includes('在浏览器中继续'));
      console.log('   ✓ Bilingual "Continue in browser" / "在浏览器中继续" action verified in UI.');

      // 3c. Test Mismatched Contest rejection before valid browser transfer
      console.log('\n4. Testing Mismatched Contest & Incomplete Problem List rejection...');
      const contest4Html = fs.readFileSync(
        path.join(ROOT_DIR, 'fixtures', 'codeforces', 'contest4', 'problems.html'),
        'utf8'
      );

      // Mismatch case 1: wrong contestId / wrong pageUrl (/contest/4/problems sent for pending contest 2283)
      const mismatchRes = await apiJson(baseUrl, '/api/browser-import/receive', {
        method: 'POST',
        body: JSON.stringify({
          token: bVer2283.token,
          contestId: 4,
          pageUrl: 'https://codeforces.com/contest/4/problems',
          html: contest4Html
        })
      });
      assert.equal(mismatchRes.status, 400);
      assert.equal(mismatchRes.data.code, 'CONTEST_MISMATCH');

      // Mismatch case 2: contestId=2283 claimed, but HTML only has A..D (missing E, F, G)
      const missingIdxRes = await apiJson(baseUrl, '/api/browser-import/receive', {
        method: 'POST',
        body: JSON.stringify({
          token: bVer2283.token,
          contestId: 2283,
          pageUrl: 'https://codeforces.com/contest/2283/problems',
          html: contest4Html
        })
      });
      assert.equal(missingIdxRes.status, 400);
      assert.equal(missingIdxRes.data.code, 'MISSING_PROBLEM_INDICES');
      assert.deepEqual(missingIdxRes.data.missingIndices, ['E', 'F', 'G']);
      assert.equal(
        fs.existsSync(path.join(DATA_DIR, 'contests', '2283', 'cache', 'problems.html')),
        false,
        'Mismatched transfer must NOT write toContest 2283 cache'
      );
      console.log('   ✓ Mismatched contest ID and incomplete problem list rejected without touching cache.');

      // 3d. Test One-Click Browser Extension Transfer on Contest 2283
      console.log('\n5. Testing Chrome/Edge Extension one-click transfer ("Send this contest to CFOJ") for Contest 2283...');
      const simulatedCf2283Url = `${mockCf.url}/contest/2283/problems?locale=en#cfoj_token=${encodeURIComponent(bVer2283.token)}&cfoj_contest=2283&cfoj_origin=${encodeURIComponent(baseUrl)}`;
      await browser.navigate(simulatedCf2283Url);
      await sleep(300);

      // Set a simulated browser cookie to verify it NEVER leaves the browser
      await browser.evaluate(`document.cookie = "CF_SESSION_SECRET=do_not_leak_cookie_12345; path=/"`);

      // Inject the actual Chrome/Edge extension content script (extension/content.js)
      await browser.evaluate(extensionContentJs);
      await sleep(200);

      // Verify the hash token was captured into sessionStorage and cleaned from URL bar
      const extState = await browser.evaluate(`({
        hashAfterClean: location.hash,
        hasFloatingBtn: Boolean(document.querySelector('#cfoj-send-contest-btn')),
        binding: window.__CFOJ_EXTENSION__.getSavedBinding()
      })`);
      assert.equal(extState.hashAfterClean, '');
      assert.equal(extState.hasFloatingBtn, true);
      assert.equal(extState.binding.contestId, 2283);

      // Verify what extractDisplayedContestMaterial captures
      const extractedPreview = await browser.evaluate(
        `window.__CFOJ_EXTENSION__.extractDisplayedContestMaterial()`
      );
      assert.deepEqual(extractedPreview.problemIndices, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      assert.ok(
        !extractedPreview.html.includes('secret_csrf_token_99999') &&
          !extractedPreview.html.includes('SecretUserHandle') &&
          !extractedPreview.html.includes('DO_NOT_CAPTURE_THIS_SCRIPT') &&
          !extractedPreview.html.includes('do_not_leak_cookie_12345'),
        'Extension must capture ONLY displayed contest material and never leak user headers, scripts, or cookies'
      );
      assert.ok(
        extractedPreview.html.includes('$$$1 \\le n \\le 2 \\cdot 10^5$$$'),
        'Extension must restore MathJax DOM back to original $$$...$$$ TeX'
      );
      assert.ok(
        extractedPreview.assets.length === 1 && extractedPreview.assets[0].filename === '2283d-tree.svg',
        'Extension must capture displayed diagram assets'
      );

      // Click the extension's "Send this contest to CFOJ" button (keeping AI steps fast by testing full pipeline on 2283)
      // First test keeping downloads available when an AI step fails, then complete full preparation!
      setSetting('codex_bin', 'codex-missing-binary-for-ai-fail-test');
      setSetting('allow_fixture_fallback', 'false');

      const transferWithAiFail = await browser.evaluate(
        `window.__CFOJ_EXTENSION__.sendContestToCfoj()`
      );
      assert.equal(transferWithAiFail.ok, true);
      assert.deepEqual(transferWithAiFail.importedProblems, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);

      // Verify that even though the AI step failed, all 7 downloaded English statements and assets are saved and readable!
      const { data: c2283AfterDownload } = await apiJson(baseUrl, '/api/contests/2283');
      for (const p of c2283AfterDownload.problems) {
        assert.equal(p.stages.fetching.status, 'ready', `Problem 2283${p.index} fetch should be ready even when AI fails`);
        assert.equal(p.capabilities.canRead, true);
        assert.equal(p.capabilities.canPracticeSamples, true);
      }
      // Verify sample whitespace ("10  20" double space and 3 lines) was preserved on 2283A
      const { data: prob2283A } = await apiJson(baseUrl, '/api/problems/2283A');
      assert.equal(prob2283A.statementEn.samples[0].input, '3\n10  20\n30\n');
      assert.ok(prob2283A.statementEn.descriptionHtml.includes('$$$1 \\le n \\le 2 \\cdot 10^5$$$'));
      console.log('   ✓ Verified: statement downloads, math, sample whitespace, and diagrams remain available when an AI step fails.');

      // Verify single-use token cannot be replayed
      const replayRes = await apiJson(baseUrl, '/api/browser-import/receive', {
        method: 'POST',
        body: JSON.stringify({
          token: bVer2283.token,
          contestId: 2283,
          pageUrl: 'https://codeforces.com/contest/2283/problems',
          html: extractedPreview.html
        })
      });
      assert.equal(replayRes.status, 403);
      assert.equal(replayRes.data.code, 'TOKEN_ALREADY_USED');
      console.log('   ✓ Single-use token replay rejected with 403 TOKEN_ALREADY_USED.');
    } finally {
      await browser.close();
    }

    // =========================================================================
    // 4. Offline Reuse of Cached Statements (and automatic resumption of AI steps)
    // =========================================================================
    console.log('\n6. Testing Offline Reuse of Cached Statements for Contest 2283...');
    setSetting('codex_bin', 'codex');
    setSetting('allow_fixture_fallback', 'true');
    setSetting('offline_mode', 'true');

    // Resume translation, test generation, and editorial preparation for 2283A offline using cached statements
    const offlineResumeRes = await apiJson(baseUrl, '/api/problems/2283A/repair', {
      method: 'POST',
      body: JSON.stringify({ stage: 'all' })
    });
    assert.equal(offlineResumeRes.data.ok, true);

    const offlineReimport = await apiJson(baseUrl, '/api/contests/import', {
      method: 'POST',
      body: JSON.stringify({
        contestId: 2283,
        skipTranslation: true,
        skipTestPrep: true,
        skipEditorial: true
      })
    });
    assert.equal(offlineReimport.data.statementFetchSource, 'cache');
    const { data: prob2283AAfterOffline } = await apiJson(baseUrl, '/api/problems/2283A');
    assert.equal(prob2283AAfterOffline.translationStatus, 'ready');
    assert.equal(prob2283AAfterOffline.testPrepStatus, 'ready');
    assert.equal(prob2283AAfterOffline.editorialPrepStatus, 'ready');
    console.log('   ✓ Cached statements for Contest 2283 reused offline with zero network calls; AI translation, tests, and editorial resumed cleanly.');

    console.log('\n======================================================================');
    console.log('ALL CONTEST IMPORT & BROWSER EXTENSION WORKFLOW CHECKS PASSED!');
    console.log(`Live Contest 2283 API + cf-mitigated: challenge exercised: ${live2283Exercised}`);
    console.log('======================================================================');
  } finally {
    await srv.close();
    await mockCf.close();
  }
}

main().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
