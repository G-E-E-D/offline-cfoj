import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_DIR,
  ROOT_DIR,
  getAllSettings,
  getDb,
  getNowMs,
  getSetting,
  setSetting
} from './db.mjs';
import {
  ensureBrowserTransferTokenForPendingContest,
  getActiveBrowserTransferToken,
  getContestReadinessSummary,
  importContest,
  isContestTestRegenRunning,
  issueBrowserTransferToken,
  parseContestIdInput,
  receiveBrowserContestTransfer,
  regenerateContestTestData,
  repairProblemStage
} from './importer.mjs';
import {
  checkJudgeEnvironment,
  enqueueSubmission,
  judgeEvents,
  recoverInterruptedSubmissions,
  runSampleOrCustomTest,
  setQueuePaused
} from './judge.mjs';
import {
  TRANSLATION_SCHEMA,
  checkProviderStatus,
  getFixtureExecutable,
  getModelOptions,
  runProviderStructuredJob,
  validateModelSettings
} from './providers.mjs';
import {
  getActiveContestVp,
  getLatestContestVp,
  getVpById,
  listVirtualParticipations,
  startVirtualParticipation
} from './vp.mjs';

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=utf-8'
};

function isLoopbackRemoteAddress(addr) {
  if (!addr) return false;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function getBrowserImportCorsHeaders(req) {
  const origin = req.headers.origin || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-CFOJ-Token',
    'Access-Control-Allow-Private-Network': 'true'
  };
}

function readJsonBody(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeSubmissionForClient(subRow, hidePrivateDiagnostics = false) {
  let failedCase = null;
  if (subRow.failed_case_json) {
    try {
      failedCase = JSON.parse(subRow.failed_case_json);
    } catch {
      failedCase = null;
    }
  }
  let caseResults = [];
  if (subRow.case_results_json) {
    try {
      caseResults = JSON.parse(subRow.case_results_json);
    } catch {
      caseResults = [];
    }
  }

  if (hidePrivateDiagnostics) {
    if (failedCase && !failedCase.isSample) {
      failedCase = {
        index: failedCase.index,
        name: `Test #${failedCase.index}`,
        isSample: false,
        verdict: failedCase.verdict,
        timeMs: failedCase.timeMs,
        memoryBytes: failedCase.memoryBytes,
        checkerComment: '[Hidden during active Virtual Participation]',
        inputPreview: '[Hidden during active Virtual Participation]',
        userOutputPreview: '[Hidden during active Virtual Participation]',
        expectedOutputPreview: '[Hidden during active Virtual Participation]'
      };
    }
    caseResults = caseResults.map((cr) => ({
      index: cr.index,
      name: cr.isSample ? cr.name : `Test #${cr.index}`,
      category: cr.isSample ? 'sample' : 'private',
      isSample: cr.isSample,
      verdict: cr.verdict,
      timeMs: cr.timeMs,
      memoryBytes: cr.memoryBytes,
      comment: cr.isSample ? cr.comment : ''
    }));
  }

  return {
    id: subRow.id,
    contestId: subRow.contest_id,
    problemId: subRow.problem_id,
    problemIndex: subRow.problem_index,
    vpId: subRow.vp_id,
    mode: subRow.mode,
    language: subRow.language,
    toolchain: subRow.toolchain,
    sourceCode: subRow.source_code,
    packageRevision: subRow.package_revision,
    suiteType: subRow.suite_type,
    status: subRow.status,
    currentTest: subRow.current_test,
    totalTests: subRow.total_tests,
    verdict: subRow.verdict,
    timeMs: subRow.time_ms,
    memoryBytes: subRow.memory_bytes,
    compilerOutput: subRow.compiler_output,
    firstFailedTest: subRow.first_failed_test,
    failedCase,
    caseResults,
    submittedAt: subRow.submitted_at,
    judgedAt: subRow.judged_at,
    diagnosticsHidden: hidePrivateDiagnostics
  };
}

export function createCfojHttpServer() {
  const sseClients = new Set();

  const onSubUpdate = (sub) => {
    const activeVp = getActiveContestVp(sub.contest_id);
    const hideDiag = Boolean(activeVp?.integrity?.hidePrivateDiagnostics);
    const payload = JSON.stringify({
      type: 'submissionUpdate',
      submission: sanitizeSubmissionForClient(sub, hideDiag)
    });
    for (const client of sseClients) {
      client.write(`data: ${payload}\n\n`);
    }
  };

  const onImportProgress = (prog) => {
    const payload = JSON.stringify({ type: 'importProgress', progress: prog });
    for (const client of sseClients) {
      client.write(`data: ${payload}\n\n`);
    }
  };

  const onVpFinalized = (ev) => {
    const payload = JSON.stringify({ type: 'vpFinalized', ...ev });
    for (const client of sseClients) {
      client.write(`data: ${payload}\n\n`);
    }
  };

  const onBrowserTransfer = (ev) => {
    const payload = JSON.stringify({ type: 'browserTransferReceived', ...ev });
    for (const client of sseClients) {
      client.write(`data: ${payload}\n\n`);
    }
  };

  judgeEvents.on('submissionUpdate', onSubUpdate);
  judgeEvents.on('importProgress', onImportProgress);
  judgeEvents.on('vpFinalized', onVpFinalized);
  judgeEvents.on('browserTransferReceived', onBrowserTransfer);

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(parsedUrl.pathname);

      // Loopback-only Browser Extension Transfer endpoints + CORS preflight
      if (pathname.startsWith('/api/browser-import/')) {
        const corsHeaders = getBrowserImportCorsHeaders(req);
        if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
          sendJson(
            res,
            403,
            {
              ok: false,
              code: 'LOOPBACK_ONLY',
              error: 'Browser transfer receiver accepts loopback (127.0.0.1) connections only.'
            },
            corsHeaders
          );
          return;
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(204, corsHeaders);
          res.end();
          return;
        }

        if (req.method === 'POST' && pathname === '/api/browser-import/token') {
          const body = await readJsonBody(req);
          const contestId = parseContestIdInput(body.contestId);
          const db = getDb();
          const probs = db
            .prepare('SELECT problem_index FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
            .all(contestId);
          const expectedIndices = Array.isArray(body.expectedIndices) && body.expectedIndices.length
            ? body.expectedIndices
            : probs.map((p) => p.problem_index.toUpperCase());
          const tokenInfo = issueBrowserTransferToken(
            contestId,
            expectedIndices,
            body.provider || null,
            body.ttlMs || undefined
          );
          sendJson(res, 200, { ok: true, ...tokenInfo }, corsHeaders);
          return;
        }

        if (req.method === 'GET' && pathname === '/api/browser-import/pending') {
          const db = getDb();
          const qContestId = parsedUrl.searchParams.get('contestId');
          if (qContestId) {
            const cid = parseInt(qContestId, 10);
            const activeTok = getActiveBrowserTransferToken(cid);
            const awaitingRow = db
              .prepare(
                "SELECT 1 FROM problems WHERE contest_id = ? AND fetch_status = 'awaiting_browser' LIMIT 1"
              )
              .get(cid);
            if (!activeTok && !awaitingRow) {
              sendJson(
                res,
                404,
                {
                  ok: false,
                  code: 'NO_PENDING_IMPORT',
                  error: `No pending browser import for contest #${cid}. Start the import in CFOJ first.`
                },
                corsHeaders
              );
              return;
            }
            const tokInfo = activeTok || ensureBrowserTransferTokenForPendingContest(cid);
            sendJson(res, 200, { ok: true, pending: tokInfo }, corsHeaders);
            return;
          }

          // Return most recent active token if no contestId specified
          const row = db
            .prepare(
              'SELECT contest_id FROM browser_transfer_tokens WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1'
            )
            .get(getNowMs());
          if (!row) {
            sendJson(res, 404, { ok: false, code: 'NO_PENDING_IMPORT', error: 'No pending browser import.' }, corsHeaders);
            return;
          }
          const tokInfo = getActiveBrowserTransferToken(row.contest_id);
          sendJson(res, 200, { ok: true, pending: tokInfo }, corsHeaders);
          return;
        }

        if (req.method === 'POST' && pathname === '/api/browser-import/receive') {
          const body = await readJsonBody(req, 16 * 1024 * 1024);
          const token = req.headers['x-cfoj-token'] || body.token || '';
          const result = await receiveBrowserContestTransfer({
            token: String(token),
            contestId: body.contestId ?? null,
            pageUrl: body.pageUrl || '',
            html: body.html || '',
            assets: Array.isArray(body.assets) ? body.assets : [],
            awaitPreparation: body.awaitPreparation !== false,
            importOptions: body.importOptions || {}
          });
          sendJson(res, result.status || (result.ok ? 200 : 400), result, corsHeaders);
          return;
        }
      }

      // Server-Sent Events stream
      if (req.method === 'GET' && pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        });
        res.write(`data: ${JSON.stringify({ type: 'connected', nowMs: getNowMs() })}\n\n`);
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // System & Judge Status
      if (req.method === 'GET' && pathname === '/api/status') {
        const db = getDb();
        const judgeEnv = checkJudgeEnvironment();
        const settings = getAllSettings();
        const contestsCount = db.prepare('SELECT COUNT(*) AS cnt FROM contests').get()?.cnt || 0;
        const problemsCount = db.prepare('SELECT COUNT(*) AS cnt FROM problems').get()?.cnt || 0;
        const submissionsCount =
          db.prepare('SELECT COUNT(*) AS cnt FROM submissions').get()?.cnt || 0;

        const allVps = listVirtualParticipations().filter(
          (v) => v.phase === 'scheduled' || v.phase === 'active' || v.phase === 'judging_pending'
        );

        sendJson(res, 200, {
          ok: true,
          nowMs: getNowMs(),
          dataDir: DATA_DIR,
          judgeEnvironment: judgeEnv,
          settings,
          counts: {
            contests: contestsCount,
            problems: problemsCount,
            submissions: submissionsCount
          },
          activeVps: allVps
        });
        return;
      }

      // Providers status
      if (req.method === 'GET' && pathname === '/api/providers/status') {
        const [codex, antigravity] = await Promise.all([
          checkProviderStatus('codex'),
          checkProviderStatus('antigravity')
        ]);
        sendJson(res, 200, {
          selectedProvider: getSetting('ai_provider', 'codex'),
          allowFixtureFallback: getSetting('allow_fixture_fallback', 'true') === 'true',
          providers: { codex, antigravity },
          fixtures: {
            codex: getFixtureExecutable('codex'),
            antigravity: getFixtureExecutable('antigravity')
          }
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/providers/models') {
        const [codex, antigravity] = await Promise.all([getModelOptions('codex'), getModelOptions('antigravity')]);
        sendJson(res, 200, { codex, antigravity });
        return;
      }

      // Provider self-test endpoint
      if (req.method === 'POST' && pathname === '/api/providers/test') {
        const body = await readJsonBody(req);
        const provider = body.provider || getSetting('ai_provider', 'codex');
        const useFixture = Boolean(body.useFixture);
        const failMode = body.failMode || '';

        try {
          const result = await runProviderStructuredJob({
            providerName: provider,
            taskType: 'translate',
            problemMaterials: {
              contestId: 4,
              problemIndex: 'A',
              title: 'Watermelon',
              statement: {
                title: 'Watermelon',
                descriptionHtml: '<p>$$$w$$$ kilos.</p>',
                inputSpecHtml: '<p>$$$1 \\le w \\le 100$$$</p>',
                outputSpecHtml: '<p><code>YES</code> or <code>NO</code></p>',
                samples: [{ input: '8\n', output: 'YES\n' }]
              }
            },
            schema: TRANSLATION_SCHEMA,
            executableOverride: useFixture ? getFixtureExecutable(provider) : null,
            envOverride: failMode ? { CFOJ_MOCK_PROVIDER_FAIL: failMode } : null
          });
          sendJson(res, 200, { ok: true, result });
        } catch (err) {
          sendJson(res, 200, { ok: false, error: err.message, code: err.code || 'ERROR' });
        }
        return;
      }

      // Update Settings
      if (req.method === 'POST' && pathname === '/api/settings') {
        const body = await readJsonBody(req);
        try {
          validateModelSettings(body);
        } catch (err) {
          sendJson(res, 400, { error: err.message });
          return;
        }
        const allowedKeys = [
          'ui_language',
          'ai_provider',
          'codex_model',
          'codex_effort',
          'agy_model',
          'agy_effort',
          'codex_bin',
          'agy_bin',
          'target_test_count',
          'compiler_path',
          'python_path',
          'clock_offset_ms',
          'offline_mode',
          'allow_fixture_fallback'
        ];
        for (const k of allowedKeys) {
          if (body[k] !== undefined) {
            setSetting(k, String(body[k]));
          }
        }
        sendJson(res, 200, { ok: true, settings: getAllSettings(), nowMs: getNowMs() });
        return;
      }

      // Judge queue control (for deterministic expiry-boundary testing)
      if (req.method === 'POST' && pathname === '/api/judge/queue-control') {
        const body = await readJsonBody(req);
        const paused = setQueuePaused(Boolean(body.paused));
        sendJson(res, 200, { ok: true, paused });
        return;
      }

      // Contests list
      if (req.method === 'GET' && pathname === '/api/contests') {
        const db = getDb();
        const contests = db
          .prepare('SELECT * FROM contests ORDER BY id ASC')
          .all();

        const items = contests.map((c) => {
          const summary = getContestReadinessSummary(c.id);
          const activeVp = getActiveContestVp(c.id);
          const latestVp = getLatestContestVp(c.id);
          const solvedCount =
            db
              .prepare(
                "SELECT COUNT(DISTINCT problem_id) AS cnt FROM submissions WHERE contest_id = ? AND verdict = 'AC'"
              )
              .get(c.id)?.cnt || 0;
          return {
            id: c.id,
            titleEn: c.title_en,
            titleZh: c.title_zh || c.title_en,
            type: c.type,
            durationSeconds: c.duration_seconds,
            sourceUrl: c.source_url,
            dataDir: c.data_dir,
            offlineReady: summary?.offlineReady || false,
            problemCount: summary?.problems?.length || 0,
            solvedCount,
            editorialStatus: c.editorial_status,
            regeneratingTests: isContestTestRegenRunning(c.id),
            activeVp: activeVp
              ? {
                  id: activeVp.id,
                  phase: activeVp.phase,
                  remainingMs: activeVp.remainingMs,
                  untilStartMs: activeVp.untilStartMs
                }
              : null,
            latestVp: latestVp
              ? {
                  id: latestVp.id,
                  phase: latestVp.phase,
                  points: latestVp.standings?.localUserRow?.points || 0,
                  penalty: latestVp.standings?.localUserRow?.penalty || 0
                }
              : null
          };
        });
        sendJson(res, 200, { contests: items, nowMs: getNowMs() });
        return;
      }

      // Import a contest by numeric ID
      if (req.method === 'POST' && pathname === '/api/contests/import') {
        const body = await readJsonBody(req, 16 * 1024 * 1024);
        const contestId = parseContestIdInput(body.contestId);
        const awaitCompletion = body.awaitCompletion !== false;
        const importOpts = {
          provider: body.provider,
          useFixture: Boolean(body.useFixture),
          forceRegenerate: Boolean(body.forceRegenerate),
          forceFetch: Boolean(body.forceFetch),
          disableFixtureFallback: Boolean(body.disableFixtureFallback),
          codeforcesBaseUrl: body.codeforcesBaseUrl || undefined,
          uploadedProblemsHtml: body.uploadedProblemsHtml || null,
          uploadedSourceUrl: body.uploadedSourceUrl || '',
          interruptAfterProblemIndex: body.interruptAfterProblemIndex || null,
          strictNetworkOnly: Boolean(body.strictNetworkOnly),
          skipTranslation: Boolean(body.skipTranslation),
          skipTestPrep: Boolean(body.skipTestPrep),
          skipEditorial: Boolean(body.skipEditorial)
        };

        if (!awaitCompletion) {
          importContest(contestId, importOpts).catch(() => {});
          sendJson(res, 202, { ok: true, started: true, contestId });
          return;
        }

        const result = await importContest(contestId, importOpts);
        sendJson(res, 200, result);
        return;
      }

      // Regenerate test data for all problems in a contest using AI Python generator
      const regenTestsMatch = pathname.match(/^\/api\/contests\/(\d+)\/regenerate-tests$/);
      if (req.method === 'POST' && regenTestsMatch) {
        const contestId = parseInt(regenTestsMatch[1], 10);
        const db = getDb();
        const contestExists = db.prepare('SELECT id FROM contests WHERE id = ?').get(contestId);
        if (!contestExists) {
          sendJson(res, 404, { ok: false, error: `Contest ${contestId} not found` });
          return;
        }
        if (isContestTestRegenRunning(contestId)) {
          sendJson(res, 409, {
            ok: false,
            code: 'ALREADY_RUNNING',
            error: `Test data regeneration is already running for contest #${contestId}.`
          });
          return;
        }

        const body = await readJsonBody(req);
        const awaitCompletion = body.awaitCompletion !== false;
        const regenOpts = {
          provider: body.provider || getSetting('ai_provider', 'codex'),
          targetTestCount: body.targetTestCount ? Number(body.targetTestCount) : undefined,
          executableOverride: body.useFixture
            ? getFixtureExecutable(body.provider || getSetting('ai_provider', 'codex'))
            : null
        };

        if (!awaitCompletion) {
          regenerateContestTestData(contestId, regenOpts).catch(() => {});
          sendJson(res, 202, {
            ok: true,
            started: true,
            contestId,
            provider: regenOpts.provider
          });
          return;
        }

        const result = await regenerateContestTestData(contestId, regenOpts);
        sendJson(res, 200, result);
        return;
      }

      // Contest detail
      const contestMatch = pathname.match(/^\/api\/contests\/(\d+)$/);
      if (req.method === 'GET' && contestMatch) {
        const contestId = parseInt(contestMatch[1], 10);
        const summary = getContestReadinessSummary(contestId);
        if (!summary) {
          sendJson(res, 404, { error: `Contest ${contestId} not found` });
          return;
        }
        const db = getDb();
        const activeVp = getActiveContestVp(contestId);
        const latestVp = getLatestContestVp(contestId);
        const lastJob = db
          .prepare('SELECT * FROM import_jobs WHERE contest_id = ? ORDER BY id DESC LIMIT 1')
          .get(contestId);

        // Enforce Contest Integrity during scheduled or active VP
        const hideProblems = Boolean(activeVp?.integrity?.hideProblems);
        const hideSpoilers = Boolean(activeVp?.integrity?.hideTagsAndRatings);

        const problemsList = hideProblems
          ? []
          : summary.problems.map((p) => {
              const solved = Boolean(
                db
                  .prepare(
                    "SELECT 1 FROM submissions WHERE problem_id = ? AND verdict = 'AC' LIMIT 1"
                  )
                  .get(p.id)
              );
              const attempted =
                !solved &&
                Boolean(
                  db
                    .prepare('SELECT 1 FROM submissions WHERE problem_id = ? LIMIT 1')
                    .get(p.id)
                );
              return {
                ...p,
                rating: hideSpoilers ? null : p.rating,
                tags: hideSpoilers ? [] : p.tags,
                spoilersHidden: hideSpoilers,
                solveStatus: solved ? 'solved' : attempted ? 'attempted' : 'unsolved'
              };
            });

        sendJson(res, 200, {
          ...summary,
          problems: problemsList,
          problemsHiddenUntilStart: hideProblems,
          spoilersHidden: hideSpoilers,
          regeneratingTests: isContestTestRegenRunning(contestId),
          activeVp,
          latestVp,
          lastImportJob: lastJob
            ? {
                id: lastJob.id,
                status: lastJob.status,
                provider: lastJob.provider,
                steps: JSON.parse(lastJob.steps_json || '{}'),
                error: lastJob.error,
                updatedAt: lastJob.updated_at
              }
            : null,
          nowMs: getNowMs()
        });
        return;
      }

      // Contest editorial reader (from local UTF-8 Markdown files on disk)
      const editorialMatch = pathname.match(/^\/api\/contests\/(\d+)\/editorial$/);
      if (req.method === 'GET' && editorialMatch) {
        const contestId = parseInt(editorialMatch[1], 10);
        const db = getDb();
        const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
        if (!contest) {
          sendJson(res, 404, { error: `Contest ${contestId} not found` });
          return;
        }

        const activeVp = getActiveContestVp(contestId);
        if (activeVp && activeVp.integrity.hideEditorials) {
          sendJson(res, 403, {
            locked: true,
            vpId: activeVp.id,
            phase: activeVp.phase,
            remainingMs: activeVp.remainingMs,
            error:
              'Editorial is locked while Virtual Participation is in progress. It will unlock automatically once the contest timer expires.',
            errorZh: '虚拟参赛进行期间题解已锁定，比赛倒计时结束后将自动解锁。'
          });
          return;
        }

        const enPath =
          contest.editorial_en_path || path.join(DATA_DIR, 'contests', String(contestId), 'editorial.en.md');
        const zhPath =
          contest.editorial_zh_path || path.join(DATA_DIR, 'contests', String(contestId), 'editorial.zh-CN.md');

        const enMarkdown = fs.existsSync(enPath) ? fs.readFileSync(enPath, 'utf8') : '';
        const zhMarkdown = fs.existsSync(zhPath) ? fs.readFileSync(zhPath, 'utf8') : '';

        const problems = db
          .prepare('SELECT id, problem_index, title_en, title_zh, editorial_prep_status, editorial_prep_error, editorial_source, editorial_verified FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
          .all(contestId);

        sendJson(res, 200, {
          contestId,
          titleEn: contest.title_en,
          titleZh: contest.title_zh || contest.title_en,
          enPath,
          zhPath,
          enMarkdown,
          zhMarkdown,
          status: contest.editorial_status,
          problems: problems.map((p) => ({
            id: p.id,
            index: p.problem_index,
            titleEn: p.title_en,
            titleZh: p.title_zh || p.title_en,
            status: p.editorial_prep_status,
            error: p.editorial_prep_error,
            source: p.editorial_source,
            verified: Boolean(p.editorial_verified)
          }))
        });
        return;
      }

      // Contest localized asset serving
      const assetMatch = pathname.match(/^\/api\/contests\/(\d+)\/assets\/([a-zA-Z0-9._-]+)$/);
      if (req.method === 'GET' && assetMatch) {
        const contestId = parseInt(assetMatch[1], 10);
        const filename = path.basename(assetMatch[2]);
        const filePath = path.join(DATA_DIR, 'contests', String(contestId), 'assets', filename);
        if (!fs.existsSync(filePath)) {
          res.writeHead(404);
          res.end('Asset not found');
          return;
        }
        const ext = path.extname(filename).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // Daily practice problemset listing with filters
      if (req.method === 'GET' && pathname === '/api/problems') {
        const db = getDb();
        const qContest = parsedUrl.searchParams.get('contestId') || '';
        const qIndex = (parsedUrl.searchParams.get('index') || '').trim().toUpperCase();
        const qMinRating = parsedUrl.searchParams.get('minRating');
        const qMaxRating = parsedUrl.searchParams.get('maxRating');
        const qTag = (parsedUrl.searchParams.get('tag') || '').trim().toLowerCase();
        const qStatus = (parsedUrl.searchParams.get('status') || '').trim().toLowerCase();
        const qSearch = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();

        const rows = db
          .prepare(
            `SELECT p.*, c.title_en AS contest_title_en, c.title_zh AS contest_title_zh
             FROM problems p
             JOIN contests c ON c.id = p.contest_id
             ORDER BY p.contest_id ASC, p.sort_order ASC`
          )
          .all();

        const allTagsSet = new Set();
        const items = [];

        for (const p of rows) {
          const activeVp = getActiveContestVp(p.contest_id);
          // Hide future problems during a scheduled VP
          if (activeVp?.integrity?.hideProblems) {
            continue;
          }
          const hideSpoilers = Boolean(activeVp?.integrity?.hideTagsAndRatings);

          const rawTags = JSON.parse(p.tags_json || '[]');
          if (!hideSpoilers) {
            for (const t of rawTags) allTagsSet.add(t);
          }

          const acCount =
            db
              .prepare(
                "SELECT COUNT(*) AS cnt FROM submissions WHERE problem_id = ? AND verdict = 'AC'"
              )
              .get(p.id)?.cnt || 0;
          const totalAttempts =
            db
              .prepare('SELECT COUNT(*) AS cnt FROM submissions WHERE problem_id = ?')
              .get(p.id)?.cnt || 0;

          const solveStatus =
            acCount > 0 ? 'solved' : totalAttempts > 0 ? 'attempted' : 'unsolved';

          if (qContest && String(p.contest_id) !== String(qContest)) continue;
          if (qIndex && p.problem_index.toUpperCase() !== qIndex) continue;
          if (qStatus && solveStatus !== qStatus) continue;

          if (!hideSpoilers) {
            if (qMinRating && (p.rating === null || p.rating < Number(qMinRating))) continue;
            if (qMaxRating && (p.rating === null || p.rating > Number(qMaxRating))) continue;
            if (qTag && !rawTags.some((t) => t.toLowerCase().includes(qTag))) continue;
          } else if (qMinRating || qMaxRating || qTag) {
            // If filtering by rating or tag while spoilers are hidden for this contest, exclude to prevent tag/rating leakage
            continue;
          }

          if (qSearch) {
            const hay = `${p.id} ${p.problem_index} ${p.title_en} ${p.title_zh || ''} ${p.contest_title_en}`.toLowerCase();
            if (!hay.includes(qSearch)) continue;
          }

          items.push({
            id: p.id,
            contestId: p.contest_id,
            contestTitleEn: p.contest_title_en,
            contestTitleZh: p.contest_title_zh || p.contest_title_en,
            index: p.problem_index,
            titleEn: p.title_en,
            titleZh: p.title_zh || p.title_en,
            problemType: p.problem_type,
            missingComponent: p.missing_component,
            timeLimitMs: p.time_limit_ms,
            memoryLimitMb: p.memory_limit_mb,
            rating: hideSpoilers ? null : p.rating,
            tags: hideSpoilers ? [] : rawTags,
            spoilersHidden: hideSpoilers,
            solveStatus,
            attempts: totalAttempts,
            hasChinese: p.translation_status === 'ready' && Boolean(p.statement_zh_json),
            canJudgeFull: p.active_package_rev > 0 && p.test_prep_status === 'ready',
            activePackageRev: p.active_package_rev
          });
        }

        sendJson(res, 200, {
          problems: items,
          availableTags: [...allTagsSet].sort()
        });
        return;
      }

      // Single problem detail
      const probMatch = pathname.match(/^\/api\/problems\/([0-9]+[A-Za-z0-9]+)$/);
      if (req.method === 'GET' && probMatch) {
        const problemId = probMatch[1].toUpperCase();
        const db = getDb();
        const p = db.prepare('SELECT * FROM problems WHERE UPPER(id) = ?').get(problemId);
        if (!p) {
          sendJson(res, 404, { error: `Problem ${problemId} not found` });
          return;
        }

        const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(p.contest_id);
        const activeVp = getActiveContestVp(p.contest_id);
        const latestVp = getLatestContestVp(p.contest_id);

        if (activeVp?.integrity?.hideProblems) {
          sendJson(res, 403, {
            locked: true,
            untilStartMs: activeVp.untilStartMs,
            startsAt: activeVp.startsAt,
            error:
              'Future contest problems are hidden until the scheduled Virtual Participation begins.',
            errorZh: '在预约的虚拟参赛开始前，比赛题目处于隐藏状态。',
            activeVp
          });
          return;
        }

        const hideSpoilers = Boolean(activeVp?.integrity?.hideTagsAndRatings);
        const hideDiag = Boolean(activeVp?.integrity?.hidePrivateDiagnostics);

        const contestProblems = db
          .prepare(
            'SELECT id, problem_index, title_en, title_zh FROM problems WHERE contest_id = ? ORDER BY sort_order ASC'
          )
          .all(p.contest_id);

        const draft = db
          .prepare('SELECT * FROM drafts WHERE problem_id = ?')
          .get(p.id);

        const submissions = db
          .prepare('SELECT * FROM submissions WHERE problem_id = ? ORDER BY id DESC LIMIT 50')
          .all(p.id)
          .map((s) => sanitizeSubmissionForClient(s, hideDiag));

        const summary = getContestReadinessSummary(p.contest_id);
        const probSummary = summary?.problems?.find((x) => x.id === p.id) || null;

        sendJson(res, 200, {
          id: p.id,
          contestId: p.contest_id,
          contestTitleEn: contest?.title_en || `Contest ${p.contest_id}`,
          contestTitleZh: contest?.title_zh || contest?.title_en || `比赛 ${p.contest_id}`,
          index: p.problem_index,
          titleEn: p.title_en,
          titleZh: p.title_zh,
          problemType: p.problem_type,
          missingComponent: p.missing_component,
          timeLimitMs: p.time_limit_ms,
          memoryLimitMb: p.memory_limit_mb,
          inputFile: p.input_file,
          outputFile: p.output_file,
          sourceUrl: p.source_url,
          rating: hideSpoilers ? null : p.rating,
          tags: hideSpoilers ? [] : JSON.parse(p.tags_json || '[]'),
          spoilersHidden: hideSpoilers,
          editorialLocked: Boolean(activeVp?.integrity?.hideEditorials),
          statementEn: p.statement_en_json ? JSON.parse(p.statement_en_json) : null,
          statementZh: p.statement_zh_json ? JSON.parse(p.statement_zh_json) : null,
          translationStatus: p.translation_status,
          translationError: p.translation_error,
          translationProvider: p.translation_provider,
          testPrepStatus: p.test_prep_status,
          testPrepError: p.test_prep_error,
          editorialPrepStatus: p.editorial_prep_status,
          editorialPrepError: p.editorial_prep_error,
          activePackageRev: p.active_package_rev,
          readiness: probSummary,
          contestProblems: contestProblems.map((cp) => ({
            id: cp.id,
            index: cp.problem_index,
            titleEn: cp.title_en,
            titleZh: cp.title_zh || cp.title_en
          })),
          draft: draft
            ? {
                sourceCode: draft.source_code,
                customInput: draft.custom_input,
                updatedAt: draft.updated_at
              }
            : null,
          submissions,
          activeVp,
          latestVp,
          nowMs: getNowMs()
        });
        return;
      }

      // Repair a single problem stage
      const repairMatch = pathname.match(/^\/api\/problems\/([0-9]+[A-Za-z0-9]+)\/repair$/);
      if (req.method === 'POST' && repairMatch) {
        const problemId = repairMatch[1].toUpperCase();
        const body = await readJsonBody(req);
        const result = await repairProblemStage(problemId, body.stage || 'all', {
          provider: body.provider || getSetting('ai_provider', 'codex'),
          useFixture: Boolean(body.useFixture)
        });
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      // Drafts GET & PUT
      const draftMatch = pathname.match(/^\/api\/drafts\/([0-9]+[A-Za-z0-9]+)$/);
      if (draftMatch && (req.method === 'GET' || req.method === 'PUT')) {
        const problemId = draftMatch[1].toUpperCase();
        const db = getDb();
        if (req.method === 'GET') {
          const row = db.prepare('SELECT * FROM drafts WHERE problem_id = ?').get(problemId);
          sendJson(res, 200, {
            problemId,
            sourceCode: row?.source_code ?? '',
            customInput: row?.custom_input ?? '',
            updatedAt: row?.updated_at ?? null
          });
          return;
        }
        const body = await readJsonBody(req);
        const now = getNowMs();
        db.prepare(
          `INSERT INTO drafts (problem_id, source_code, custom_input, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(problem_id) DO UPDATE SET
             source_code = excluded.source_code,
             custom_input = excluded.custom_input,
             updated_at = excluded.updated_at`
        ).run(problemId, String(body.sourceCode ?? ''), String(body.customInput ?? ''), now);
        sendJson(res, 200, { ok: true, problemId, updatedAt: now });
        return;
      }

      // Run sample or custom input (unscored, kept out of submission history)
      const runMatch = pathname.match(/^\/api\/problems\/([0-9]+[A-Za-z0-9]+)\/run$/);
      if (req.method === 'POST' && runMatch) {
        const problemId = runMatch[1].toUpperCase();
        const db = getDb();
        const problem = db.prepare('SELECT * FROM problems WHERE UPPER(id) = ?').get(problemId);
        if (!problem) {
          sendJson(res, 404, { error: `Problem ${problemId} not found` });
          return;
        }
        const body = await readJsonBody(req);
        const sourceCode = String(body.sourceCode ?? '');
        const mode = body.mode === 'custom' ? 'custom' : 'samples';
        const customInput = String(body.customInput ?? '');

        const result = await runSampleOrCustomTest(problem, sourceCode, mode, customInput);
        sendJson(res, 200, result);
        return;
      }

      // Submit solution against local suite
      const submitMatch = pathname.match(/^\/api\/problems\/([0-9]+[A-Za-z0-9]+)\/submit$/);
      if (req.method === 'POST' && submitMatch) {
        const problemId = submitMatch[1].toUpperCase();
        const db = getDb();
        const problem = db.prepare('SELECT * FROM problems WHERE UPPER(id) = ?').get(problemId);
        if (!problem) {
          sendJson(res, 404, { error: `Problem ${problemId} not found` });
          return;
        }

        const body = await readJsonBody(req);
        const sourceCode = String(body.sourceCode ?? '');
        if (!sourceCode.trim()) {
          sendJson(res, 400, { error: 'Source code cannot be empty' });
          return;
        }

        const submittedAt = getNowMs();
        const activeVp = getActiveContestVp(problem.contest_id);

        if (activeVp && submittedAt < activeVp.startsAt) {
          sendJson(res, 403, {
            error: 'Scheduled Virtual Participation has not started yet.'
          });
          return;
        }

        // Classify submission by backend receipt timestamp!
        const isInActiveVp =
          activeVp &&
          activeVp.phase === 'active' &&
          submittedAt >= activeVp.startsAt &&
          submittedAt <= activeVp.endsAt;

        const mode = isInActiveVp ? 'vp' : 'practice';
        const vpId = isInActiveVp ? activeVp.id : null;
        const pinnedRev =
          isInActiveVp && activeVp.pinnedRevisions?.[problem.id] !== undefined
            ? activeVp.pinnedRevisions[problem.id]
            : problem.active_package_rev;
        const suiteType = pinnedRev > 0 ? 'full' : 'sample_only';

        const env = checkJudgeEnvironment();
        const info = db
          .prepare(
            `INSERT INTO submissions (
              contest_id, problem_id, problem_index, vp_id, mode, language, toolchain,
              source_code, package_revision, suite_type, status, verdict, submitted_at
            ) VALUES (?, ?, ?, ?, ?, 'GNU C++23', ?, ?, ?, ?, 'queued', 'QUEUED', ?)`
          )
          .run(
            problem.contest_id,
            problem.id,
            problem.problem_index,
            vpId,
            mode,
            env.toolchain || 'GNU C++23',
            sourceCode,
            pinnedRev,
            suiteType,
            submittedAt
          );

        const subId = Number(info.lastInsertRowid);
        enqueueSubmission(subId);

        const created = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
        const hideDiag = Boolean(activeVp?.integrity?.hidePrivateDiagnostics);
        sendJson(res, 201, {
          ok: true,
          submission: sanitizeSubmissionForClient(created, hideDiag)
        });
        return;
      }

      // Submissions list & single submission detail
      if (req.method === 'GET' && pathname === '/api/submissions') {
        const db = getDb();
        const contestId = parsedUrl.searchParams.get('contestId');
        const problemId = parsedUrl.searchParams.get('problemId');
        const vpId = parsedUrl.searchParams.get('vpId');

        let sql = 'SELECT * FROM submissions WHERE 1=1';
        const params = [];
        if (contestId) {
          sql += ' AND contest_id = ?';
          params.push(Number(contestId));
        }
        if (problemId) {
          sql += ' AND UPPER(problem_id) = ?';
          params.push(problemId.toUpperCase());
        }
        if (vpId) {
          sql += ' AND vp_id = ?';
          params.push(Number(vpId));
        }
        sql += ' ORDER BY id DESC LIMIT 100';

        const rows = db.prepare(sql).all(...params);
        const items = rows.map((s) => {
          const activeVp = getActiveContestVp(s.contest_id);
          return sanitizeSubmissionForClient(
            s,
            Boolean(activeVp?.integrity?.hidePrivateDiagnostics)
          );
        });
        sendJson(res, 200, { submissions: items });
        return;
      }

      const subDetailMatch = pathname.match(/^\/api\/submissions\/(\d+)$/);
      if (req.method === 'GET' && subDetailMatch) {
        const subId = parseInt(subDetailMatch[1], 10);
        const db = getDb();
        const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
        if (!row) {
          sendJson(res, 404, { error: `Submission #${subId} not found` });
          return;
        }
        const activeVp = getActiveContestVp(row.contest_id);
        sendJson(res, 200, {
          submission: sanitizeSubmissionForClient(
            row,
            Boolean(activeVp?.integrity?.hidePrivateDiagnostics)
          )
        });
        return;
      }

      // Virtual Participation endpoints
      if (req.method === 'POST' && pathname === '/api/vp/start') {
        const body = await readJsonBody(req);
        const vp = startVirtualParticipation({
          contestId: Number(body.contestId),
          startInSeconds: Number(body.startInSeconds) || 0,
          customStartTimeMs: body.customStartTimeMs ?? null,
          durationSeconds: body.durationSeconds ? Number(body.durationSeconds) : null,
          title: body.title || null
        });
        sendJson(res, 201, { ok: true, vp });
        return;
      }

      const vpGetMatch = pathname.match(/^\/api\/vp\/(\d+)$/);
      if (req.method === 'GET' && vpGetMatch) {
        const vpId = parseInt(vpGetMatch[1], 10);
        const vp = getVpById(vpId);
        if (!vp) {
          sendJson(res, 404, { error: `Virtual participation #${vpId} not found` });
          return;
        }
        sendJson(res, 200, { vp });
        return;
      }

      const vpFinishMatch = pathname.match(/^\/api\/vp\/(\d+)\/finish$/);
      if (req.method === 'POST' && vpFinishMatch) {
        const vpId = parseInt(vpFinishMatch[1], 10);
        const db = getDb();
        const now = getNowMs();
        db.prepare(
          "UPDATE virtual_participations SET ends_at = CASE WHEN ends_at > ? THEN ? ELSE ends_at END WHERE id = ?"
        ).run(now, now, vpId);
        const vp = getVpById(vpId);
        sendJson(res, 200, { ok: true, vp });
        return;
      }

      // Static files from public/
      let relPath = pathname === '/' ? '/index.html' : pathname;
      let filePath = path.resolve(PUBLIC_DIR, '.' + relPath);
      if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        // SPA client-side routing fallback for non-API/non-asset paths
        if (!pathname.startsWith('/api/') && !pathname.startsWith('/vendor/')) {
          filePath = path.join(PUBLIC_DIR, 'index.html');
        } else {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.woff2' ? 'public, max-age=86400' : 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  return server;
}

export async function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 4321);
  const host = options.host || '127.0.0.1';
  // Ensure database is initialized, unpause queue on server startup, and recover any interrupted judge jobs under their original IDs
  getDb();
  setQueuePaused(false);
  const recovered = recoverInterruptedSubmissions();
  const server = createCfojHttpServer();

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({
        server,
        port: actualPort,
        url: `http://${host}:${actualPort}`,
        recoveredSubmissions: recovered,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          })
      });
    });
  });
}

// Run directly if invoked as main script
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() ===
    path.resolve(fileURLToPath(import.meta.url)).toLowerCase();

if (isMain) {
  startServer()
    .then(({ url, recoveredSubmissions }) => {
      console.log(`Offline CFOJ server listening at ${url}`);
      console.log(`Data directory: ${DATA_DIR}`);
      if (recoveredSubmissions > 0) {
        console.log(`Recovered ${recoveredSubmissions} interrupted submission(s) into the judge queue.`);
      }
    })
    .catch((err) => {
      console.error('Failed to start Offline CFOJ server:', err);
      process.exit(1);
    });
}
