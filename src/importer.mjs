import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ROOT_DIR, getDb, getNowMs, getSetting } from './db.mjs';
import {
  parsePublishedTutorialHtml,
  prepareProblemEditorialSection,
  writeWholeRoundEditorialMarkdownFiles
} from './editorial.mjs';
import { judgeEvents } from './judge.mjs';
import { TRANSLATION_SCHEMA, runProviderStructuredJob } from './providers.mjs';
import {
  compareProblemIndices,
  extractProtectedFragments,
  hasCfMitigatedChallengeHeader,
  isCloudflareChallengeHtml,
  isCloudflareChallengeResponse,
  localizeHtmlAssets,
  parseContestProblemsHtml,
  stampDocumentContestId,
  validateParsedContestProblems,
  validateTranslatedStatement
} from './statement.mjs';
import { prepareProblemTestPackage } from './testgen.mjs';

let lastRemoteFetchAt = 0;
const MIN_REMOTE_INTERVAL_MS = 1200;
const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const activeTestRegenContests = new Set();

export function isContestTestRegenRunning(contestId) {
  return activeTestRegenContests.has(Number(contestId));
}

export function parseContestIdInput(input) {
  const s = String(input ?? '').trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const urlMatch = s.match(/codeforces\.com\/(?:contest|gym)\/(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);
  throw new Error(`Invalid contest ID '${s}'. Enter a numeric Codeforces contest ID (e.g. 4).`);
}

function getCodeforcesBaseUrl(options = {}) {
  const base =
    options.codeforcesBaseUrl ||
    process.env.CFOJ_CF_BASE_URL ||
    getSetting('codeforces_base_url', '') ||
    'https://codeforces.com';
  return String(base).replace(/\/+$/, '');
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createFetchError({ code, category, message, messageZh, httpStatus = null, cfMitigated = null, extra = {} }) {
  const err = new Error(message);
  err.code = code;
  err.category = category;
  err.messageZh = messageZh || message;
  err.httpStatus = httpStatus;
  err.cfMitigated = cfMitigated;
  Object.assign(err, extra);
  return err;
}

async function rateLimitedFetch(url, retries = 3, options = {}) {
  if (getSetting('offline_mode', 'false') === 'true') {
    throw createFetchError({
      code: 'OFFLINE_MODE',
      category: 'network_failure',
      message: `Offline mode is active; network request blocked for ${url}`,
      messageZh: `当前处于严格离线模式，已阻止对 ${url} 的网络请求`
    });
  }

  const minInterval = options.minIntervalMs ?? MIN_REMOTE_INTERVAL_MS;
  let attempt = 0;
  let delayMs = options.initialBackoffMs ?? 350;

  while (true) {
    const elapsed = Date.now() - lastRemoteFetchAt;
    if (elapsed < minInterval) {
      await sleep(minInterval - elapsed);
    }
    lastRemoteFetchAt = Date.now();
    attempt++;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'OfflineCFOJ/1.0 (Local Windows Practice Judge)',
          Accept: 'text/html,application/json,*/*',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      const cfMitigated = res.headers?.get?.('cf-mitigated') || null;
      const isChallengeHeader = hasCfMitigatedChallengeHeader(res.headers);

      // Do not retry a browser challenge; return immediately so caller can transition to browser verification
      if (!isChallengeHeader && (res.status === 429 || res.status >= 500)) {
        if (attempt <= retries) {
          await sleep(delayMs);
          delayMs *= 2;
          continue;
        }
      }

      const buf = Buffer.from(await res.arrayBuffer());
      return {
        status: res.status,
        ok: res.ok,
        headers: res.headers,
        cfMitigated,
        isChallengeHeader,
        buffer: buf,
        text: () => buf.toString('utf8')
      };
    } catch (err) {
      if (attempt <= retries) {
        await sleep(delayMs);
        delayMs *= 2;
        continue;
      }
      throw createFetchError({
        code: 'NETWORK_FAILURE',
        category: 'network_failure',
        message: `Network failure while fetching ${url}: ${err.message}`,
        messageZh: `网络请求失败 (${url})：${err.message}`
      });
    }
  }
}

function getFixtureDir(contestId) {
  return path.join(ROOT_DIR, 'fixtures', 'codeforces', `contest${contestId}`);
}

export function issueBrowserTransferToken(
  contestId,
  expectedIndices = [],
  provider = null,
  ttlMs = DEFAULT_TOKEN_TTL_MS
) {
  const db = getDb();
  const now = getNowMs();
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = now + Math.max(5000, Number(ttlMs) || DEFAULT_TOKEN_TTL_MS);
  const prov = provider || getSetting('ai_provider', 'codex');

  db.prepare(
    `INSERT INTO browser_transfer_tokens (
      token, contest_id, expected_indices_json, provider, created_at, expires_at, used_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL)`
  ).run(token, Number(contestId), JSON.stringify(expectedIndices), prov, now, expiresAt);

  return {
    token,
    contestId: Number(contestId),
    expectedIndices,
    provider: prov,
    createdAt: now,
    expiresAt,
    targetUrl: `https://codeforces.com/contest/${contestId}/problems?locale=en`
  };
}

export function getActiveBrowserTransferToken(contestId) {
  const db = getDb();
  const now = getNowMs();
  const row = db
    .prepare(
      `SELECT *
       FROM browser_transfer_tokens
       WHERE contest_id = ?
         AND used_at IS NULL
         AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(Number(contestId), now);

  if (!row) return null;
  return {
    token: row.token,
    contestId: row.contest_id,
    expectedIndices: JSON.parse(row.expected_indices_json || '[]'),
    provider: row.provider,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    targetUrl: `https://codeforces.com/contest/${row.contest_id}/problems?locale=en`
  };
}

export function ensureBrowserTransferTokenForPendingContest(contestId) {
  const existing = getActiveBrowserTransferToken(contestId);
  if (existing) return existing;

  const db = getDb();
  const probs = db
    .prepare('SELECT problem_index FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
    .all(Number(contestId));
  const expectedIndices = probs.map((p) => p.problem_index.toUpperCase());
  return issueBrowserTransferToken(contestId, expectedIndices);
}

async function fetchContestApiStandings(contestId, cacheDir, options = {}) {
  const cacheFile = path.join(cacheDir, 'contest.standings.json');
  if (fs.existsSync(cacheFile) && !options.forceFetch) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }

  const fixtureFile = path.join(getFixtureDir(contestId), 'contest.standings.json');
  const preferFixture = Boolean(options.useFixture);

  if (preferFixture && fs.existsSync(fixtureFile)) {
    const raw = fs.readFileSync(fixtureFile, 'utf8');
    fs.writeFileSync(cacheFile, raw, 'utf8');
    return JSON.parse(raw);
  }

  const baseUrl = getCodeforcesBaseUrl(options);
  try {
    const apiUrl = `${baseUrl}/api/contest.standings?contestId=${contestId}`;
    const res = await rateLimitedFetch(apiUrl, 2, options);
    const bodyText = res.text();

    if (isCloudflareChallengeResponse(bodyText, res.headers)) {
      throw createFetchError({
        code: 'CLOUDFLARE_CHALLENGE',
        category: 'browser_challenge',
        httpStatus: res.status,
        cfMitigated: res.cfMitigated || 'challenge',
        message: `Codeforces API returned a Cloudflare challenge (HTTP ${res.status}) for contest ${contestId}.`,
        messageZh: `Codeforces API 返回了 Cloudflare 验证挑战 (HTTP ${res.status})。`
      });
    }

    if (res.status === 429) {
      throw createFetchError({
        code: 'RATE_LIMITED',
        category: 'rate_limited',
        httpStatus: 429,
        message: `Rate limited by Codeforces API (HTTP 429) while fetching contest ${contestId}.`,
        messageZh: `请求比赛 #${contestId} 元数据时被 Codeforces API 限流 (HTTP 429)。`
      });
    }

    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw createFetchError({
        code: 'ACCESS_DENIED',
        category: 'access_denied',
        httpStatus: res.status,
        message: `Access denied by Codeforces API (HTTP ${res.status}) for contest ${contestId}.`,
        messageZh: `Codeforces API 拒绝访问比赛 #${contestId} (HTTP ${res.status})。`
      });
    }

    if (res.ok) {
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch (e) {
        throw createFetchError({
          code: 'PARSE_ERROR',
          category: 'parse_error',
          message: `Invalid JSON from Codeforces API for contest ${contestId}: ${e.message}`,
          messageZh: `Codeforces API 返回的比赛 #${contestId} 元数据 JSON 无法解析。`
        });
      }
      if (parsed.status === 'OK' && parsed.result) {
        fs.writeFileSync(cacheFile, JSON.stringify(parsed, null, 2), 'utf8');
        return parsed;
      }
      const comment = String(parsed.comment || 'API status FAILED');
      if (/limit exceeded/i.test(comment)) {
        throw createFetchError({
          code: 'RATE_LIMITED',
          category: 'rate_limited',
          httpStatus: 429,
          message: `Codeforces API rate limit exceeded: ${comment}`,
          messageZh: `Codeforces API 调用频率超限：${comment}`
        });
      }
      throw createFetchError({
        code: 'ACCESS_DENIED',
        category: 'access_denied',
        httpStatus: 400,
        message: `Codeforces API rejected contest ${contestId}: ${comment}`,
        messageZh: `Codeforces API 拒绝了比赛 #${contestId} 请求：${comment}`
      });
    }

    throw createFetchError({
      code: 'NETWORK_FAILURE',
      category: 'network_failure',
      httpStatus: res.status,
      message: `Codeforces API returned HTTP ${res.status} for contest ${contestId}.`,
      messageZh: `Codeforces API 返回异常状态码 HTTP ${res.status}。`
    });
  } catch (err) {
    // Allow offline sandboxed fixture fallback ONLY when network is unreachable in sandbox for a bundled fixture contest
    if (
      !options.strictNetworkOnly &&
      !options.disableFixtureFallback &&
      err.category === 'network_failure' &&
      fs.existsSync(fixtureFile) &&
      getSetting('allow_fixture_fallback', 'true') === 'true'
    ) {
      const raw = fs.readFileSync(fixtureFile, 'utf8');
      fs.writeFileSync(cacheFile, raw, 'utf8');
      return JSON.parse(raw);
    }
    throw err;
  }
}

async function fetchAndValidateContestProblems(
  contestId,
  expectedIndices,
  cacheDir,
  options = {}
) {
  const cacheFile = path.join(cacheDir, 'problems.html');

  const validateAndParse = (html, sourceUrl = '', writeToCache = false) => {
    let parsedHtml;
    try {
      parsedHtml = parseContestProblemsHtml(html);
    } catch (parseErr) {
      if (parseErr.code === 'CLOUDFLARE_CHALLENGE') {
        throw createFetchError({
          code: 'CLOUDFLARE_CHALLENGE',
          category: 'browser_challenge',
          cfMitigated: 'challenge',
          message: `Human verification required in browser for contest #${contestId} (Cloudflare challenge page detected).`,
          messageZh: `比赛 #${contestId} 需要在浏览器中完成人工验证（检测到 Cloudflare 验证挑战页面）。`
        });
      }
      throw createFetchError({
        code: 'PARSE_ERROR',
        category: 'parse_error',
        message: `Failed to parse contest #${contestId} statements HTML: ${parseErr.message}`,
        messageZh: `解析比赛 #${contestId} 题面 HTML 失败：${parseErr.message}`
      });
    }

    const val = validateParsedContestProblems({
      html,
      parsedHtml,
      expectedContestId: contestId,
      expectedIndices,
      sourceUrl
    });
    if (!val.ok) {
      throw createFetchError({
        code: val.code,
        category: 'parse_error',
        message: val.error,
        messageZh: val.errorZh,
        extra: {
          missingIndices: val.missingIndices,
          foundIndices: val.foundIndices,
          detectedContestId: val.detectedContestId
        }
      });
    }

    const stampedHtml = stampDocumentContestId(html, contestId);
    if (writeToCache) {
      fs.writeFileSync(cacheFile, stampedHtml, 'utf8');
    }
    return { html: stampedHtml, parsedHtml };
  };

  // 1. Uploaded HTML (from manual file upload fallback or browser extension transfer)
  if (options.uploadedProblemsHtml) {
    const res = validateAndParse(
      options.uploadedProblemsHtml,
      options.uploadedSourceUrl || '',
      true
    );
    return { ...res, source: 'uploaded' };
  }

  // 2. Cached problems.html on disk (offline reuse of cached statements)
  if (fs.existsSync(cacheFile) && !options.forceFetch) {
    const cachedHtml = fs.readFileSync(cacheFile, 'utf8');
    if (!isCloudflareChallengeHtml(cachedHtml)) {
      const res = validateAndParse(cachedHtml, '', false);
      return { ...res, source: 'cache' };
    }
  }

  // 3. Explicit fixture mode
  const fixtureFile = path.join(getFixtureDir(contestId), 'problems.html');
  if (options.useFixture && fs.existsSync(fixtureFile)) {
    const fixtureHtml = fs.readFileSync(fixtureFile, 'utf8');
    const res = validateAndParse(fixtureHtml, '', true);
    return { ...res, source: 'fixture' };
  }

  // 4. Default: Direct HTTP fetch of the official English problems page
  const baseUrl = getCodeforcesBaseUrl(options);
  const url = `${baseUrl}/contest/${contestId}/problems?locale=en`;

  try {
    const res = await rateLimitedFetch(url, 2, options);
    const html = res.text();

    // Check cf-mitigated: challenge header OR Cloudflare challenge body first
    if (isCloudflareChallengeResponse(html, res.headers)) {
      throw createFetchError({
        code: 'CLOUDFLARE_CHALLENGE',
        category: 'browser_challenge',
        httpStatus: res.status,
        cfMitigated: res.cfMitigated || 'challenge',
        message: `Human verification required in browser: Codeforces returned a challenge (HTTP ${res.status}${res.cfMitigated ? `, cf-mitigated: ${res.cfMitigated}` : ''}) for /contest/${contestId}/problems?locale=en.`,
        messageZh: `需要浏览器人工验证：Codeforces 对 /contest/${contestId}/problems?locale=en 返回了验证挑战 (HTTP ${res.status}${res.cfMitigated ? `, cf-mitigated: ${res.cfMitigated}` : ''})。`
      });
    }

    // Distinguish rate limiting (HTTP 429)
    if (res.status === 429) {
      throw createFetchError({
        code: 'RATE_LIMITED',
        category: 'rate_limited',
        httpStatus: 429,
        message: `Rate limited by Codeforces (HTTP 429 Too Many Requests) while fetching /contest/${contestId}/problems?locale=en.`,
        messageZh: `抓取题面页 /contest/${contestId}/problems?locale=en 时被服务器限流 (HTTP 429 Too Many Requests)，请稍后重试。`
      });
    }

    // Distinguish ordinary access denial (HTTP 401 / 403 / 404 without challenge)
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw createFetchError({
        code: 'ACCESS_DENIED',
        category: 'access_denied',
        httpStatus: res.status,
        message: `Access denied (HTTP ${res.status}) for /contest/${contestId}/problems?locale=en (no browser challenge header). The contest may be private or not publicly available.`,
        messageZh: `访问被拒绝 (HTTP ${res.status}，非浏览器验证挑战)：无法访问 /contest/${contestId}/problems?locale=en。`
      });
    }

    // Distinguish upstream server / network failure (HTTP 5xx)
    if (!res.ok) {
      throw createFetchError({
        code: 'NETWORK_FAILURE',
        category: 'network_failure',
        httpStatus: res.status,
        message: `Server error (HTTP ${res.status}) while fetching /contest/${contestId}/problems?locale=en.`,
        messageZh: `抓取 /contest/${contestId}/problems?locale=en 时服务器返回错误 (HTTP ${res.status})。`
      });
    }

    // Validate contest ID & expected problem indices before writing to cache
    const validated = validateAndParse(html, url, true);
    return { ...validated, source: 'direct_http' };
  } catch (err) {
    // Allow offline sandboxed fixture fallback ONLY when network is completely unreachable in sandbox for a bundled fixture contest
    if (
      !options.strictNetworkOnly &&
      !options.disableFixtureFallback &&
      err.category === 'network_failure' &&
      fs.existsSync(fixtureFile) &&
      getSetting('allow_fixture_fallback', 'true') === 'true'
    ) {
      const fixtureHtml = fs.readFileSync(fixtureFile, 'utf8');
      const validated = validateAndParse(fixtureHtml, '', true);
      return { ...validated, source: 'fixture' };
    }
    throw err;
  }
}

async function fetchContestTutorialPage(contestId, tutorialUrl, cacheDir, options = {}) {
  const cacheFile = path.join(cacheDir, 'tutorial.html');
  if (fs.existsSync(cacheFile) && !options.forceFetch) {
    const cached = fs.readFileSync(cacheFile, 'utf8');
    if (!isCloudflareChallengeHtml(cached)) return cached;
  }

  const fixtureFile = path.join(getFixtureDir(contestId), 'tutorial.html');
  const preferFixture = options.useFixture || getSetting('offline_mode', 'false') === 'true';

  if (!preferFixture && tutorialUrl) {
    try {
      const res = await rateLimitedFetch(tutorialUrl, 2, options);
      const html = res.text();
      if (res.ok && !isCloudflareChallengeResponse(html, res.headers)) {
        fs.writeFileSync(cacheFile, html, 'utf8');
        return html;
      }
    } catch {
      // fall through to fixture or AI editorial fallback
    }
  }

  if (!options.strictNetworkOnly && fs.existsSync(fixtureFile)) {
    const html = fs.readFileSync(fixtureFile, 'utf8');
    fs.writeFileSync(cacheFile, html, 'utf8');
    return html;
  }

  return '';
}

function createAssetResolver(contestId, assetsDir, options = {}) {
  fs.mkdirSync(assetsDir, { recursive: true });
  const fixtureAssetsDir = path.join(getFixtureDir(contestId), 'assets');
  const baseUrl = getCodeforcesBaseUrl(options);

  return async function resolveAsset(rawUrl) {
    const parsedPath = rawUrl.split('?')[0];
    let baseName = path.posix.basename(parsedPath) || 'asset.bin';
    if (!/^[a-zA-Z0-9._-]+$/.test(baseName)) {
      const ext = path.posix.extname(baseName) || '.svg';
      baseName = `${crypto.createHash('md5').update(rawUrl).digest('hex').slice(0, 12)}${ext}`;
    }

    const targetPath = path.join(assetsDir, baseName);
    if (fs.existsSync(targetPath)) {
      return { localFilename: baseName, localPath: targetPath, cached: true };
    }

    const fixtureCandidate = path.join(fixtureAssetsDir, baseName);
    const preferFixture = options.useFixture || getSetting('offline_mode', 'false') === 'true';

    if (!preferFixture) {
      try {
        const fullUrl = rawUrl.startsWith('http')
          ? rawUrl
          : `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
        const res = await rateLimitedFetch(fullUrl, 2, options);
        if (res.ok && res.buffer.length > 0 && !isCloudflareChallengeResponse('', res.headers)) {
          fs.writeFileSync(targetPath, res.buffer);
          return { localFilename: baseName, localPath: targetPath, cached: false };
        }
      } catch (err) {
        if (options.strictNetworkOnly || !fs.existsSync(fixtureCandidate)) {
          throw new Error(`Failed to download statement asset ${rawUrl}: ${err.message}`);
        }
      }
    }

    if (!options.strictNetworkOnly && fs.existsSync(fixtureCandidate)) {
      fs.copyFileSync(fixtureCandidate, targetPath);
      return { localFilename: baseName, localPath: targetPath, cached: false };
    }

    throw new Error(`Asset unavailable offline: ${rawUrl}`);
  };
}

export async function translateSingleProblem(problemRow, options = {}) {
  const db = getDb();
  const providerName = options.provider || getSetting('ai_provider', 'codex');
  const recordFailure = errMsg => {
    // A failed retry must not hide a valid translation published by another job.
    db.prepare(`UPDATE problems SET
      translation_status = CASE WHEN translation_status='ready' AND statement_zh_json IS NOT NULL THEN 'ready' ELSE 'failed' END,
      translation_error = ?, updated_at = ? WHERE id = ? AND statement_en_json IS ?`)
      .run(errMsg, getNowMs(), problemRow.id, problemRow.statement_en_json);
  };

  let enStmt = null;
  try {
    enStmt = JSON.parse(problemRow.statement_en_json || 'null');
  } catch {
    enStmt = null;
  }
  if (!enStmt) {
    const msg = 'Cannot translate problem before English statement is fetched';
    db.prepare(
      "UPDATE problems SET translation_status = 'failed', translation_error = ?, updated_at = ? WHERE id = ?"
    ).run(msg, getNowMs(), problemRow.id);
    return { ok: false, error: msg };
  }

  try {
    const protectedFragments = extractProtectedFragments(enStmt);
    const aiRes = await runProviderStructuredJob({
      providerName,
      taskType: 'translate',
      problemMaterials: {
        contestId: problemRow.contest_id,
        problemIndex: problemRow.problem_index,
        title: enStmt.title || problemRow.title_en,
        timeLimitMs: problemRow.time_limit_ms,
        memoryLimitMb: problemRow.memory_limit_mb,
        statement: enStmt,
        protectedFragments
      },
      schema: TRANSLATION_SCHEMA,
      executableOverride: options.executableOverride || null,
      envOverride: options.envOverride || null
    });

    const candidateZh = {
      ...enStmt,
      title: aiRes.data.title,
      descriptionHtml: aiRes.data.descriptionHtml,
      inputSpecHtml: aiRes.data.inputSpecHtml,
      outputSpecHtml: aiRes.data.outputSpecHtml,
      noteHtml: aiRes.data.noteHtml,
      samples: aiRes.data.samples || enStmt.samples
    };

    const validation = validateTranslatedStatement(enStmt, candidateZh);
    if (!validation.valid) {
      const errMsg = 'Translation validation failed: ' + validation.errors.join('; ');
      recordFailure(errMsg);
      return { ok: false, error: errMsg, validation };
    }

    const problemDir = path.join(
      DATA_DIR,
      'contests',
      String(problemRow.contest_id),
      'problems',
      problemRow.problem_index
    );
    fs.mkdirSync(problemDir, { recursive: true });
    const target = path.join(problemDir, 'statement.zh-CN.json');
    const temp = target + '.' + crypto.randomUUID() + '.tmp';
    const json = JSON.stringify(candidateZh, null, 2);
    try {
      fs.writeFileSync(temp, json, { encoding: 'utf8', flag: 'wx' });
      db.exec('BEGIN IMMEDIATE');
      try {
        const updated = db.prepare(`UPDATE problems SET title_zh=?, statement_zh_json=?,
          translation_status='ready', translation_error=NULL, translation_provider=?, updated_at=?
          WHERE id=? AND statement_en_json=?`)
          .run(candidateZh.title, json, aiRes.provider, getNowMs(), problemRow.id, problemRow.statement_en_json);
        if (!updated.changes) throw new Error('The English statement changed during translation. Retry with the current statement.');
        fs.renameSync(temp, target);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } finally {
      fs.rmSync(temp, { force: true });
    }

    return { ok: true, statementZh: candidateZh, validation };
  } catch (err) {
    recordFailure(err.message);
    return { ok: false, error: err.message };
  }
}

function emitImportProgress(jobId, contestId, status, steps, error = null) {
  const db = getDb();
  const now = getNowMs();
  db.prepare(
    'UPDATE import_jobs SET status = ?, steps_json = ?, error = ?, updated_at = ? WHERE id = ?'
  ).run(status, JSON.stringify(steps), error, now, jobId);

  judgeEvents.emit('importProgress', {
    jobId,
    contestId,
    status,
    steps,
    error,
    updatedAt: now
  });
}

export async function importContest(contestIdInput, options = {}) {
  const contestId = parseContestIdInput(contestIdInput);
  const db = getDb();
  const now = getNowMs();
  const providerName = options.provider || getSetting('ai_provider', 'codex');

  const contestDir = path.join(DATA_DIR, 'contests', String(contestId));
  const cacheDir = path.join(contestDir, 'cache');
  const assetsDir = path.join(contestDir, 'assets');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const jobInfo = db
    .prepare(
      'INSERT INTO import_jobs (contest_id, status, provider, steps_json, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(contestId, 'running', providerName, '{}', now, now);
  const jobId = Number(jobInfo.lastInsertRowid);

  const steps = {
    contestId,
    provider: providerName,
    errorCategory: null,
    errorCode: null,
    errorMessage: null,
    errorMessageZh: null,
    browserVerification: null,
    problems: {}
  };

  try {
    // 1. Fetch contest metadata and standings from API (or cache/fixture)
    const apiData = await fetchContestApiStandings(contestId, cacheDir, options);
    const cfContest = apiData.result.contest;
    const cfProblems = [...(apiData.result.problems || [])];
    const cfRows = (apiData.result.rows || []).slice(0, 150);

    const expectedIndices = cfProblems
      .map((p) => String(p.index).toUpperCase())
      .sort(compareProblemIndices);

    // Persist contest metadata immediately so pending import is always preserved
    const existingContest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
    const titleZhDefault =
      contestId === 4
        ? 'Codeforces Beta Round 4 (仅限 Div. 2)'
        : existingContest?.title_zh || cfContest.name;

    if (!existingContest) {
      db.prepare(
        `INSERT INTO contests (
          id, title_en, title_zh, type, phase, duration_seconds, start_time_seconds,
          source_url, tutorial_url, data_dir, standings_json, imported_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        contestId,
        cfContest.name || `Codeforces Round ${contestId}`,
        titleZhDefault,
        cfContest.type || 'ICPC',
        cfContest.phase || 'FINISHED',
        cfContest.durationSeconds || 7200,
        cfContest.startTimeSeconds || null,
        `https://codeforces.com/contest/${contestId}`,
        null,
        contestDir,
        JSON.stringify(cfRows),
        now,
        now
      );
    } else {
      db.prepare(
        `UPDATE contests
         SET title_en = ?,
             type = ?,
             phase = ?,
             duration_seconds = ?,
             start_time_seconds = COALESCE(?, start_time_seconds),
             standings_json = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(
        cfContest.name || existingContest.title_en,
        cfContest.type || existingContest.type,
        cfContest.phase || existingContest.phase,
        cfContest.durationSeconds || existingContest.duration_seconds,
        cfContest.startTimeSeconds || null,
        JSON.stringify(cfRows),
        getNowMs(),
        contestId
      );
    }

    // Ensure problem rows from API metadata exist in SQLite before statement fetch
    for (let i = 0; i < expectedIndices.length; i++) {
      const idx = expectedIndices[i];
      const probId = `${contestId}${idx}`;
      const apiMeta = cfProblems.find((p) => String(p.index).toUpperCase() === idx) || {};
      const existingProb = db.prepare('SELECT * FROM problems WHERE id = ?').get(probId);
      if (!existingProb) {
        db.prepare(
          `INSERT INTO problems (
            id, contest_id, problem_index, sort_order, title_en, problem_type,
            points, rating, tags_json, source_url, fetch_status, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'batch', ?, ?, ?, ?, 'pending', ?)`
        ).run(
          probId,
          contestId,
          idx,
          i,
          apiMeta.name || `Problem ${idx}`,
          apiMeta.points || null,
          apiMeta.rating || null,
          JSON.stringify(apiMeta.tags || []),
          `https://codeforces.com/contest/${contestId}/problem/${idx}`,
          getNowMs()
        );
      }
      steps.problems[idx] = {
        index: idx,
        fetching:
          existingProb?.fetch_status === 'ready' && !options.forceRegenerate ? 'ready' : 'pending',
        translation:
          existingProb?.translation_status === 'ready' && !options.forceRegenerate
            ? 'ready'
            : 'pending',
        test_prep:
          existingProb?.test_prep_status === 'ready' &&
          existingProb?.active_package_rev > 0 &&
          !options.forceRegenerate
            ? 'ready'
            : 'pending',
        editorial_prep:
          existingProb?.editorial_prep_status === 'ready' &&
          existingProb?.editorial_verified === 1 &&
          !options.forceRegenerate
            ? 'ready'
            : 'pending'
      };
    }
    emitImportProgress(jobId, contestId, 'running', steps);

    // 2. Fetch and validate contest problems HTML page
    let parsedHtml = { problems: [], tutorialUrl: null };
    let statementFetchSource = null;

    // Check if all expected problems already have cached statements in SQLite and no forceFetch/upload
    const existingProbsAll = db
      .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
      .all(contestId);
    const allStatementsAlreadyCached =
      !options.forceFetch &&
      !options.uploadedProblemsHtml &&
      existingProbsAll.length > 0 &&
      existingProbsAll.every((p) => p.fetch_status === 'ready' && Boolean(p.statement_en_json)) &&
      !fs.existsSync(path.join(cacheDir, 'problems.html'));

    if (!allStatementsAlreadyCached) {
      try {
        const fetched = await fetchAndValidateContestProblems(
          contestId,
          expectedIndices,
          cacheDir,
          options
        );
        parsedHtml = fetched.parsedHtml;
        statementFetchSource = fetched.source;
      } catch (fetchErr) {
        steps.errorCategory = fetchErr.category || 'network_failure';
        steps.errorCode = fetchErr.code || 'FETCH_ERROR';
        steps.errorMessage = fetchErr.message;
        steps.errorMessageZh = fetchErr.messageZh || fetchErr.message;

        const isBrowserChallenge = fetchErr.category === 'browser_challenge';
        let browserTokenInfo = null;
        if (isBrowserChallenge) {
          browserTokenInfo = issueBrowserTransferToken(
            contestId,
            expectedIndices,
            providerName,
            options.tokenTtlMs || DEFAULT_TOKEN_TTL_MS
          );
          steps.browserVerification = {
            required: true,
            contestId,
            expectedIndices,
            targetUrl: browserTokenInfo.targetUrl,
            token: browserTokenInfo.token,
            expiresAt: browserTokenInfo.expiresAt
          };
        }

        // Preserve any problem that already had a cached statement, mark others awaiting_browser or failed
        for (const idx of expectedIndices) {
          const probId = `${contestId}${idx}`;
          const existingProb = db.prepare('SELECT * FROM problems WHERE id = ?').get(probId);
          if (existingProb?.statement_en_json && !options.forceFetch) {
            steps.problems[idx].fetching = 'ready';
          } else {
            const newFetchStatus = isBrowserChallenge ? 'awaiting_browser' : 'failed';
            db.prepare(
              'UPDATE problems SET fetch_status = ?, fetch_error = ?, updated_at = ? WHERE id = ?'
            ).run(newFetchStatus, fetchErr.message, getNowMs(), probId);
            steps.problems[idx].fetching = newFetchStatus;
            steps.problems[idx].fetchError = fetchErr.message;
            steps.problems[idx].fetchErrorCategory = steps.errorCategory;
          }
        }

        const jobStatus = isBrowserChallenge ? 'awaiting_browser' : 'failed';
        emitImportProgress(jobId, contestId, jobStatus, steps, fetchErr.message);

        return {
          ok: false,
          jobId,
          contestId,
          status: jobStatus,
          errorCategory: steps.errorCategory,
          errorCode: steps.errorCode,
          error: fetchErr.message,
          errorZh: steps.errorMessageZh,
          browserVerification: steps.browserVerification,
          steps,
          summary: getContestReadinessSummary(contestId)
        };
      }
    }

    if (parsedHtml.tutorialUrl) {
      db.prepare('UPDATE contests SET tutorial_url = ?, updated_at = ? WHERE id = ?').run(
        parsedHtml.tutorialUrl,
        getNowMs(),
        contestId
      );
    }

    const htmlByIndex = {};
    for (const hp of parsedHtml.problems) {
      htmlByIndex[hp.problemIndex.toUpperCase()] = hp;
    }

    const allIndicesSet = new Set([
      ...expectedIndices,
      ...Object.keys(htmlByIndex)
    ]);
    const orderedIndices = [...allIndicesSet].sort(compareProblemIndices);
    const assetResolver = createAssetResolver(contestId, assetsDir, options);

    // 3. Save and localize English statements FIRST (so downloads stay available even if an AI step fails)
    for (let i = 0; i < orderedIndices.length; i++) {
      const idx = orderedIndices[i];
      const probId = `${contestId}${idx}`;
      const apiMeta = cfProblems.find((p) => String(p.index).toUpperCase() === idx) || {};
      const domStmt = htmlByIndex[idx] || null;
      const existingProb = db.prepare('SELECT * FROM problems WHERE id = ?').get(probId);

      if (!steps.problems[idx]) {
        steps.problems[idx] = {
          index: idx,
          fetching: 'pending',
          translation: 'pending',
          test_prep: 'pending',
          editorial_prep: 'pending'
        };
      }

      if (
        existingProb &&
        existingProb.fetch_status === 'ready' &&
        existingProb.statement_en_json &&
        !options.forceRegenerate &&
        !domStmt
      ) {
        steps.problems[idx].fetching = 'ready';
        emitImportProgress(jobId, contestId, 'running', steps);
        continue;
      }

      steps.problems[idx].fetching = 'running';
      emitImportProgress(jobId, contestId, 'running', steps);

      if (!domStmt) {
        const fetchErr = `Statement for problem ${idx} not found in contest page`;
        db.prepare(
          "UPDATE problems SET sort_order = ?, fetch_status = 'failed', fetch_error = ?, updated_at = ? WHERE id = ?"
        ).run(i, fetchErr, getNowMs(), probId);
        steps.problems[idx].fetching = 'failed';
        steps.problems[idx].fetchError = fetchErr;
        emitImportProgress(jobId, contestId, 'running', steps);
        continue;
      }

      try {
        const descLoc = await localizeHtmlAssets(domStmt.descriptionHtml, contestId, assetResolver);
        const inLoc = await localizeHtmlAssets(domStmt.inputSpecHtml, contestId, assetResolver);
        const outLoc = await localizeHtmlAssets(domStmt.outputSpecHtml, contestId, assetResolver);
        const noteLoc = await localizeHtmlAssets(domStmt.noteHtml, contestId, assetResolver);

        const allAssets = [
          ...descLoc.assets,
          ...inLoc.assets,
          ...outLoc.assets,
          ...noteLoc.assets
        ];

        const statementEn = {
          problemId: probId,
          contestId,
          problemIndex: idx,
          title: domStmt.title || apiMeta.name || `Problem ${idx}`,
          timeLimitText: domStmt.timeLimitText,
          timeLimitMs: domStmt.timeLimitMs,
          memoryLimitText: domStmt.memoryLimitText,
          memoryLimitMb: domStmt.memoryLimitMb,
          inputFile: domStmt.inputFile,
          outputFile: domStmt.outputFile,
          descriptionHtml: descLoc.html,
          inputSpecHtml: inLoc.html,
          outputSpecHtml: outLoc.html,
          noteHtml: noteLoc.html,
          samples: domStmt.samples,
          assets: allAssets
        };
        statementEn.protectedFragments = extractProtectedFragments(statementEn);

        const probDir = path.join(contestDir, 'problems', idx);
        fs.mkdirSync(probDir, { recursive: true });
        fs.writeFileSync(
          path.join(probDir, 'statement.en.json'),
          JSON.stringify(statementEn, null, 2),
          'utf8'
        );

        if (!existingProb) {
          db.prepare(
            `INSERT INTO problems (
              id, contest_id, problem_index, sort_order, title_en, problem_type, missing_component,
              points, rating, tags_json, time_limit_ms, memory_limit_mb, input_file, output_file,
              source_url, statement_en_json, fetch_status, fetch_error, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', NULL, ?)`
          ).run(
            probId,
            contestId,
            idx,
            i,
            statementEn.title,
            domStmt.problemType || 'batch',
            domStmt.missingComponent || null,
            apiMeta.points || null,
            apiMeta.rating || null,
            JSON.stringify(apiMeta.tags || []),
            statementEn.timeLimitMs,
            statementEn.memoryLimitMb,
            statementEn.inputFile,
            statementEn.outputFile,
            `https://codeforces.com/contest/${contestId}/problem/${idx}`,
            JSON.stringify(statementEn),
            getNowMs()
          );
        } else {
          db.prepare(
            `UPDATE problems
             SET sort_order = ?,
                 title_en = ?,
                 problem_type = ?,
                 missing_component = ?,
                 points = COALESCE(?, points),
                 rating = COALESCE(?, rating),
                 tags_json = ?,
                 time_limit_ms = ?,
                 memory_limit_mb = ?,
                 input_file = ?,
                 output_file = ?,
                 statement_en_json = ?,
                 fetch_status = 'ready',
                 fetch_error = NULL,
                 updated_at = ?
             WHERE id = ?`
          ).run(
            i,
            statementEn.title,
            domStmt.problemType || existingProb.problem_type,
            domStmt.missingComponent || null,
            apiMeta.points || null,
            apiMeta.rating || null,
            JSON.stringify(apiMeta.tags || JSON.parse(existingProb.tags_json || '[]')),
            statementEn.timeLimitMs,
            statementEn.memoryLimitMb,
            statementEn.inputFile,
            statementEn.outputFile,
            JSON.stringify(statementEn),
            getNowMs(),
            probId
          );
        }

        steps.problems[idx].fetching = 'ready';
        steps.problems[idx].fetchError = null;
        emitImportProgress(jobId, contestId, 'running', steps);
      } catch (assetErr) {
        steps.problems[idx].fetching = 'failed';
        steps.problems[idx].fetchError = assetErr.message;
        db.prepare(
          "UPDATE problems SET fetch_status = 'failed', fetch_error = ?, updated_at = ? WHERE id = ?"
        ).run(assetErr.message, getNowMs(), probId);
        emitImportProgress(jobId, contestId, 'running', steps);
      }
    }

    // 4. Discover and parse published contest tutorial
    const contestRow = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
    const problemRows = db
      .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
      .all(contestId);

    const tutorialHtml = await fetchContestTutorialPage(
      contestId,
      contestRow.tutorial_url,
      cacheDir,
      options
    );
    const parsedTutorial = parsePublishedTutorialHtml(tutorialHtml, contestId, problemRows);

    // 5. Per-problem Translation, Test Suite Generation, and Editorial Preparation
    for (const prob of problemRows) {
      const idx = prob.problem_index;

      if (
        options.onlyProblemIndex &&
        options.onlyProblemIndex.toUpperCase() !== idx.toUpperCase()
      ) {
        continue;
      }

      if (prob.fetch_status !== 'ready') {
        continue;
      }

      // Stage 2: Translation (EN -> zh-CN)
      const freshProb1 = db.prepare('SELECT * FROM problems WHERE id = ?').get(prob.id);
      if (
        freshProb1.translation_status === 'ready' &&
        freshProb1.statement_zh_json &&
        !options.forceRegenerate
      ) {
        steps.problems[idx].translation = 'ready';
      } else if (!options.skipTranslation) {
        steps.problems[idx].translation = 'running';
        emitImportProgress(jobId, contestId, 'running', steps);
        const trRes = await translateSingleProblem(freshProb1, options);
        steps.problems[idx].translation = trRes.ok ? 'ready' : 'failed';
        if (!trRes.ok) steps.problems[idx].translationError = trRes.error;
        emitImportProgress(jobId, contestId, 'running', steps);
      }

      // Stage 3: Test Suite Preparation & Validation
      const freshProb2 = db.prepare('SELECT * FROM problems WHERE id = ?').get(prob.id);
      if (
        freshProb2.test_prep_status === 'ready' &&
        freshProb2.active_package_rev > 0 &&
        !options.forceRegenerate
      ) {
        steps.problems[idx].test_prep = 'ready';
      } else if (!options.skipTestPrep) {
        steps.problems[idx].test_prep = 'running';
        emitImportProgress(jobId, contestId, 'running', steps);
        const tpRes = await prepareProblemTestPackage(freshProb2, options);
        steps.problems[idx].test_prep = tpRes.ok
          ? 'ready'
          : tpRes.unsupported
            ? 'unsupported'
            : 'failed';
        if (!tpRes.ok) steps.problems[idx].testPrepError = tpRes.error;
        emitImportProgress(jobId, contestId, 'running', steps);
      }

      // Stage 4: Editorial Preparation (Published or AI Fallback, verified against test suite)
      const freshProb3 = db.prepare('SELECT * FROM problems WHERE id = ?').get(prob.id);
      if (
        freshProb3.editorial_prep_status === 'ready' &&
        freshProb3.editorial_verified === 1 &&
        !options.forceRegenerate
      ) {
        steps.problems[idx].editorial_prep = 'ready';
      } else if (!options.skipEditorial) {
        steps.problems[idx].editorial_prep = 'running';
        emitImportProgress(jobId, contestId, 'running', steps);
        const pubSec = parsedTutorial.sectionsByIndex[idx] || null;
        const edRes = await prepareProblemEditorialSection(
          freshProb3,
          pubSec,
          assetResolver,
          options
        );
        steps.problems[idx].editorial_prep = edRes.ok ? 'ready' : 'failed';
        if (!edRes.ok) steps.problems[idx].editorialError = edRes.error;
        emitImportProgress(jobId, contestId, 'running', steps);
      }

      // Support deterministic interruption test (Acceptance #5)
      if (
        options.interruptAfterProblemIndex &&
        options.interruptAfterProblemIndex.toUpperCase() === idx.toUpperCase()
      ) {
        writeWholeRoundEditorialMarkdownFiles(contestId);
        emitImportProgress(
          jobId,
          contestId,
          'interrupted',
          steps,
          `Import interrupted after problem ${idx}`
        );
        return {
          ok: false,
          interrupted: true,
          jobId,
          contestId,
          steps,
          summary: getContestReadinessSummary(contestId)
        };
      }
    }

    writeWholeRoundEditorialMarkdownFiles(contestId);

    const finalProbs = db
      .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
      .all(contestId);
    const allComplete =
      finalProbs.length > 0 &&
      finalProbs.every(
        (p) =>
          p.fetch_status === 'ready' &&
          p.translation_status === 'ready' &&
          (p.test_prep_status === 'ready' || p.test_prep_status === 'unsupported') &&
          p.editorial_prep_status === 'ready'
      );

    const finalStatus = allComplete ? 'completed' : 'partial';
    emitImportProgress(jobId, contestId, finalStatus, steps);

    return {
      ok: allComplete,
      jobId,
      contestId,
      status: finalStatus,
      statementFetchSource,
      steps,
      summary: getContestReadinessSummary(contestId)
    };
  } catch (err) {
    steps.errorCategory = err.category || 'network_failure';
    steps.errorCode = err.code || 'IMPORT_ERROR';
    steps.errorMessage = err.message;
    steps.errorMessageZh = err.messageZh || err.message;
    emitImportProgress(jobId, contestId, 'failed', steps, err.message);
    return {
      ok: false,
      jobId,
      contestId,
      status: 'failed',
      errorCategory: steps.errorCategory,
      errorCode: steps.errorCode,
      error: err.message,
      errorZh: steps.errorMessageZh,
      steps
    };
  }
}

export async function receiveBrowserContestTransfer({
  token,
  contestId = null,
  pageUrl = '',
  html = '',
  assets = [],
  awaitPreparation = true,
  importOptions = {}
}) {
  const db = getDb();
  const now = getNowMs();

  if (!token || typeof token !== 'string') {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_TOKEN',
      category: 'access_denied',
      error: 'Missing or invalid browser transfer token.',
      errorZh: '缺少或无效的浏览器传输令牌。'
    };
  }

  const tokenRow = db
    .prepare('SELECT * FROM browser_transfer_tokens WHERE token = ?')
    .get(token.trim());

  if (!tokenRow) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_TOKEN',
      category: 'access_denied',
      error: 'Unrecognized browser transfer token.',
      errorZh: '无法识别的浏览器传输令牌。'
    };
  }

  if (tokenRow.used_at !== null) {
    return {
      ok: false,
      status: 403,
      code: 'TOKEN_ALREADY_USED',
      category: 'access_denied',
      error: 'This browser transfer token has already been used (single-use token).',
      errorZh: '该浏览器传输令牌已被使用过（一次性令牌不可重复使用）。'
    };
  }

  if (now > tokenRow.expires_at) {
    return {
      ok: false,
      status: 403,
      code: 'TOKEN_EXPIRED',
      category: 'access_denied',
      error: 'This browser transfer token has expired. Click "Continue in browser" in CFOJ to issue a fresh token.',
      errorZh: '该浏览器传输令牌已过期，请在 CFOJ 中重新点击“在浏览器中继续”以生成新令牌。'
    };
  }

  const targetContestId = tokenRow.contest_id;
  if (
    contestId !== null &&
    contestId !== undefined &&
    String(contestId).trim() !== '' &&
    Number(contestId) !== Number(targetContestId)
  ) {
    return {
      ok: false,
      status: 400,
      code: 'CONTEST_MISMATCH',
      category: 'parse_error',
      expectedContestId: targetContestId,
      detectedContestId: Number(contestId),
      error: `Contest ID mismatch: pending import is bound to contest #${targetContestId}, but browser payload specifies contest #${contestId}.`,
      errorZh: `比赛 ID 不匹配：待导入比赛为 #${targetContestId}，但浏览器发送的是比赛 #${contestId}。`
    };
  }

  let expectedIndices = JSON.parse(tokenRow.expected_indices_json || '[]');
  if (!expectedIndices.length) {
    const dbProbs = db
      .prepare('SELECT problem_index FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
      .all(targetContestId);
    expectedIndices = dbProbs.map((p) => p.problem_index.toUpperCase());
  }

  // Parse and validate HTML before consuming token or touching cache!
  let parsedHtml;
  try {
    parsedHtml = parseContestProblemsHtml(html);
  } catch (parseErr) {
    const isChall = parseErr.code === 'CLOUDFLARE_CHALLENGE';
    return {
      ok: false,
      status: 400,
      code: isChall ? 'CLOUDFLARE_CHALLENGE' : 'PARSE_ERROR',
      category: isChall ? 'browser_challenge' : 'parse_error',
      error: isChall
        ? 'The browser tab is still showing the Cloudflare challenge page. Complete human verification until problem statements appear, then click "Send this contest to CFOJ".'
        : `Failed to parse contest HTML: ${parseErr.message}`,
      errorZh: isChall
        ? '浏览器标签页仍处于 Cloudflare 验证页面，请先完成人工验证直到题目题面显示后再点击“发送本场比赛至 CFOJ”。'
        : `解析题面 HTML 失败：${parseErr.message}`
    };
  }

  const val = validateParsedContestProblems({
    html,
    parsedHtml,
    expectedContestId: targetContestId,
    expectedIndices,
    sourceUrl: pageUrl
  });

  if (!val.ok) {
    return {
      ok: false,
      status: 400,
      code: val.code,
      category: 'parse_error',
      expectedContestId: targetContestId,
      detectedContestId: val.detectedContestId || null,
      missingIndices: val.missingIndices || [],
      foundIndices: val.foundIndices || [],
      error: val.error,
      errorZh: val.errorZh
    };
  }

  // Mark single-use token consumed atomically
  const updateRes = db
    .prepare('UPDATE browser_transfer_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL')
    .run(now, token.trim());
  if (updateRes.changes === 0) {
    return {
      ok: false,
      status: 403,
      code: 'TOKEN_ALREADY_USED',
      category: 'access_denied',
      error: 'This browser transfer token has already been used.',
      errorZh: '该浏览器传输令牌已被使用过。'
    };
  }

  // Write captured diagram assets (if any) and validated HTML to cache
  const contestDir = path.join(DATA_DIR, 'contests', String(targetContestId));
  const cacheDir = path.join(contestDir, 'cache');
  const assetsDir = path.join(contestDir, 'assets');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  if (Array.isArray(assets)) {
    for (const item of assets) {
      if (!item || !item.dataBase64) continue;
      const rawName = item.filename || path.posix.basename((item.url || '').split('?')[0]) || '';
      const safeName = path.basename(rawName);
      if (safeName && /^[a-zA-Z0-9._-]+$/.test(safeName)) {
        try {
          fs.writeFileSync(
            path.join(assetsDir, safeName),
            Buffer.from(item.dataBase64, 'base64')
          );
        } catch {}
      }
    }
  }

  const stampedHtml = stampDocumentContestId(html, targetContestId);
  fs.writeFileSync(path.join(cacheDir, 'problems.html'), stampedHtml, 'utf8');

  judgeEvents.emit('browserTransferReceived', {
    contestId: targetContestId,
    problemCount: parsedHtml.problems.length,
    indices: val.foundIndices
  });

  const runPromise = importContest(targetContestId, {
    ...importOptions,
    provider: importOptions.provider || tokenRow.provider,
    uploadedProblemsHtml: stampedHtml,
    uploadedSourceUrl: pageUrl
  });

  if (!awaitPreparation) {
    runPromise.catch(() => {});
    return {
      ok: true,
      status: 202,
      contestId: targetContestId,
      importedProblems: val.foundIndices,
      resumedInBackground: true
    };
  }

  const importResult = await runPromise;
  return {
    ok: true,
    status: 200,
    contestId: targetContestId,
    importedProblems: val.foundIndices,
    importResult
  };
}

export async function repairProblemStage(problemId, stage = 'all', options = {}) {
  const db = getDb();
  const prob = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
  if (!prob) throw new Error(`Problem ${problemId} not found`);

  const contestId = prob.contest_id;
  const contestDir = path.join(DATA_DIR, 'contests', String(contestId));
  const cacheDir = path.join(contestDir, 'cache');
  const assetsDir = path.join(contestDir, 'assets');
  const assetResolver = createAssetResolver(contestId, assetsDir, options);

  const results = {};

  if (stage === 'fetching' || (stage === 'all' && prob.fetch_status !== 'ready')) {
    const res = await importContest(contestId, {
      ...options,
      onlyProblemIndex: prob.problem_index,
      skipTranslation: stage === 'fetching',
      skipTestPrep: stage === 'fetching',
      skipEditorial: stage === 'fetching'
    });
    results.fetching = res;
  }

  const fresh1 = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
  if (
    fresh1.fetch_status === 'ready' &&
    (stage === 'translation' || (stage === 'all' && fresh1.translation_status !== 'ready'))
  ) {
    results.translation = await translateSingleProblem(fresh1, options);
  }

  const fresh2 = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
  if (
    fresh2.fetch_status === 'ready' &&
    (stage === 'test_prep' ||
      (stage === 'all' && (fresh2.test_prep_status !== 'ready' || fresh2.active_package_rev === 0)))
  ) {
    results.test_prep = await prepareProblemTestPackage(fresh2, options);
  }

  const fresh3 = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
  if (
    fresh3.fetch_status === 'ready' &&
    (stage === 'editorial_prep' ||
      (stage === 'all' && (fresh3.editorial_prep_status !== 'ready' || !fresh3.editorial_verified)))
  ) {
    const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
    const allProbs = db
      .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
      .all(contestId);
    const tutorialHtml = await fetchContestTutorialPage(
      contestId,
      contest?.tutorial_url,
      cacheDir,
      options
    );
    const parsedTutorial = parsePublishedTutorialHtml(tutorialHtml, contestId, allProbs);
    const pubSec = parsedTutorial.sectionsByIndex[fresh3.problem_index] || null;
    results.editorial_prep = await prepareProblemEditorialSection(
      fresh3,
      pubSec,
      assetResolver,
      options
    );
  }

  return {
    problemId,
    stage,
    results,
    summary: getContestReadinessSummary(contestId)
  };
}

export async function regenerateContestTestData(contestIdInput, options = {}) {
  const contestId = parseContestIdInput(contestIdInput);
  const db = getDb();
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) {
    const err = new Error(`Contest ${contestId} not found`);
    err.statusCode = 404;
    throw err;
  }

  if (activeTestRegenContests.has(contestId)) {
    const err = new Error(`Test data regeneration is already running for contest #${contestId}.`);
    err.statusCode = 409;
    err.code = 'ALREADY_RUNNING';
    throw err;
  }

  const providerName = options.provider || getSetting('ai_provider', 'codex');
  const now = getNowMs();
  const problemRows = db
    .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC, problem_index ASC')
    .all(contestId);

  const jobInfo = db
    .prepare(
      'INSERT INTO import_jobs (contest_id, status, provider, steps_json, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(contestId, 'running', providerName, '{}', now, now);
  const jobId = Number(jobInfo.lastInsertRowid);

  const steps = {
    jobType: 'regenerate_tests',
    contestId,
    provider: providerName,
    totalProblems: problemRows.length,
    completedProblems: 0,
    problems: {}
  };
  for (const p of problemRows) {
    steps.problems[p.problem_index] = {
      index: p.problem_index,
      problemId: p.id,
      fetching: p.fetch_status || 'pending',
      translation: p.translation_status || 'pending',
      test_prep: p.fetch_status === 'ready' && p.statement_en_json ? 'pending' : 'skipped',
      editorial_prep: p.editorial_prep_status || 'pending'
    };
  }

  activeTestRegenContests.add(contestId);
  const results = [];

  try {
    emitImportProgress(jobId, contestId, 'running', steps);

    for (const prob of problemRows) {
      const idx = prob.problem_index;
      const freshProb = db.prepare('SELECT * FROM problems WHERE id = ?').get(prob.id);
      if (!freshProb || freshProb.fetch_status !== 'ready' || !freshProb.statement_en_json) {
        steps.problems[idx].test_prep = 'skipped';
        steps.problems[idx].testPrepError = 'English statement not fetched yet';
        steps.completedProblems++;
        results.push({
          problemId: prob.id,
          index: idx,
          ok: false,
          skipped: true,
          error: 'English statement not fetched yet'
        });
        emitImportProgress(jobId, contestId, 'running', steps);
        continue;
      }

      steps.problems[idx].test_prep = 'running';
      steps.problems[idx].testPrepError = null;
      emitImportProgress(jobId, contestId, 'running', steps);

      const tpRes = await prepareProblemTestPackage(freshProb, {
        provider: providerName,
        targetTestCount: options.targetTestCount,
        executableOverride: options.executableOverride || null,
        envOverride: options.envOverride || null
      });

      steps.problems[idx].test_prep = tpRes.ok
        ? 'ready'
        : tpRes.unsupported
          ? 'unsupported'
          : 'failed';
      if (!tpRes.ok) steps.problems[idx].testPrepError = tpRes.error;
      steps.completedProblems++;
      results.push({
        problemId: prob.id,
        index: idx,
        ...tpRes
      });
      emitImportProgress(jobId, contestId, 'running', steps);
    }

    const allOk =
      results.length > 0 &&
      results.every((r) => r.ok || r.unsupported);
    const finalStatus = allOk ? 'completed' : 'partial';
    emitImportProgress(jobId, contestId, finalStatus, steps);

    return {
      ok: allOk,
      jobId,
      contestId,
      status: finalStatus,
      provider: providerName,
      results,
      summary: getContestReadinessSummary(contestId)
    };
  } catch (err) {
    emitImportProgress(jobId, contestId, 'failed', steps, err.message);
    return {
      ok: false,
      jobId,
      contestId,
      status: 'failed',
      provider: providerName,
      error: err.message,
      results,
      summary: getContestReadinessSummary(contestId)
    };
  } finally {
    activeTestRegenContests.delete(contestId);
  }
}

export function getContestReadinessSummary(contestId) {
  const db = getDb();
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) return null;

  const problems = db
    .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC, problem_index ASC')
    .all(contestId);

  let awaitingBrowserCount = 0;

  const problemSummaries = problems.map((p) => {
    let stmtEn = null;
    try {
      stmtEn = p.statement_en_json ? JSON.parse(p.statement_en_json) : null;
    } catch {}
    const sampleCount = stmtEn?.samples?.length || 0;
    const canRead = p.fetch_status === 'ready' && Boolean(stmtEn);
    const canPracticeSamples = canRead && p.problem_type === 'batch' && sampleCount > 0;
    const canJudgeFull =
      canRead &&
      p.problem_type === 'batch' &&
      p.active_package_rev > 0 &&
      p.test_prep_status === 'ready';
    const hasChinese = p.translation_status === 'ready' && Boolean(p.statement_zh_json);
    const hasEditorial = p.editorial_prep_status === 'ready' && p.editorial_verified === 1;

    if (p.fetch_status === 'awaiting_browser') {
      awaitingBrowserCount++;
    }

    const activePkg =
      p.active_package_rev > 0
        ? db
            .prepare('SELECT * FROM test_packages WHERE problem_id = ? AND revision = ?')
            .get(p.id, p.active_package_rev)
        : null;
    const latestCandidatePkg =
      p.candidate_package_rev > p.active_package_rev
        ? db
            .prepare('SELECT * FROM test_packages WHERE problem_id = ? AND revision = ?')
            .get(p.id, p.candidate_package_rev)
        : null;

    const incompleteItems = [];
    if (!canRead) {
      incompleteItems.push({
        stage: 'fetching',
        reason:
          p.fetch_status === 'awaiting_browser'
            ? 'Human verification required in browser (cf-mitigated: challenge)'
            : p.fetch_error || 'Statement not fetched yet',
        repairAction:
          p.fetch_status === 'awaiting_browser' ? 'continue_in_browser' : 'retry_fetch'
      });
    }
    if (!hasChinese) {
      incompleteItems.push({
        stage: 'translation',
        reason:
          p.translation_error || 'Simplified Chinese translation missing or failed validation',
        repairAction: 'regenerate_translation'
      });
    }
    if (p.problem_type !== 'batch' && p.missing_component) {
      incompleteItems.push({
        stage: 'test_prep',
        reason: `Unsupported '${p.problem_type}' problem: missing local component '${p.missing_component}'`,
        repairAction: 'provide_component'
      });
    } else if (!canJudgeFull || p.test_prep_status === 'failed') {
      incompleteItems.push({
        stage: 'test_prep',
        reason: p.test_prep_error || 'Local test package not yet validated',
        repairAction: 'rebuild_test_package'
      });
    }
    if (!hasEditorial) {
      incompleteItems.push({
        stage: 'editorial_prep',
        reason: p.editorial_prep_error || 'Editorial section missing or solution unverified',
        repairAction: 'regenerate_editorial'
      });
    }

    return {
      id: p.id,
      contestId: p.contest_id,
      index: p.problem_index,
      titleEn: p.title_en,
      titleZh: p.title_zh,
      problemType: p.problem_type,
      missingComponent: p.missing_component,
      timeLimitMs: p.time_limit_ms,
      memoryLimitMb: p.memory_limit_mb,
      rating: p.rating,
      tags: JSON.parse(p.tags_json || '[]'),
      stages: {
        fetching: { status: p.fetch_status, error: p.fetch_error },
        translation: {
          status: p.translation_status,
          error: p.translation_error,
          provider: p.translation_provider
        },
        test_prep: {
          status: p.test_prep_status,
          error: p.test_prep_error,
          activeRevision: p.active_package_rev,
          candidateRevision: p.candidate_package_rev
        },
        editorial_prep: {
          status: p.editorial_prep_status,
          error: p.editorial_prep_error,
          source: p.editorial_source,
          provider: p.editorial_provider,
          verified: Boolean(p.editorial_verified)
        }
      },
      capabilities: {
        canRead,
        canPracticeSamples,
        canJudgeFull,
        hasChinese,
        hasEditorial,
        judgeModeLabel: canJudgeFull
          ? `Full Local Suite (Rev #${p.active_package_rev}: ${activePkg?.sample_count || 0} sample + ${activePkg?.generated_count || 0} generated)`
          : canPracticeSamples
            ? `Sample-Only (${sampleCount} sample${sampleCount === 1 ? '' : 's'})`
            : 'Statement-Only (Cannot Judge)'
      },
      activePackage: activePkg
        ? {
            revision: activePkg.revision,
            checkerType: activePkg.checker_type,
            sampleCount: activePkg.sample_count,
            generatedCount: activePkg.generated_count,
            categories: JSON.parse(activePkg.categories_json || '[]'),
            validation: JSON.parse(activePkg.validation_json || '{}')
          }
        : null,
      failedCandidatePackage: latestCandidatePkg
        ? {
            revision: latestCandidatePkg.revision,
            status: latestCandidatePkg.status,
            validation: JSON.parse(latestCandidatePkg.validation_json || '{}')
          }
        : null,
      incompleteItems
    };
  });

  const editorialEnExists = Boolean(
    contest.editorial_en_path && fs.existsSync(contest.editorial_en_path)
  );
  const editorialZhExists = Boolean(
    contest.editorial_zh_path && fs.existsSync(contest.editorial_zh_path)
  );

  const offlineReady =
    problemSummaries.length > 0 &&
    editorialEnExists &&
    editorialZhExists &&
    problemSummaries.every(
      (ps) =>
        ps.capabilities.canRead &&
        ps.capabilities.hasChinese &&
        (ps.problemType !== 'batch' || ps.capabilities.canJudgeFull) &&
        ps.capabilities.hasEditorial
    );

  let browserVerification = null;
  if (awaitingBrowserCount > 0) {
    const tokInfo = ensureBrowserTransferTokenForPendingContest(contest.id);
    browserVerification = {
      required: true,
      contestId: contest.id,
      expectedIndices: tokInfo.expectedIndices,
      targetUrl: tokInfo.targetUrl,
      token: tokInfo.token,
      expiresAt: tokInfo.expiresAt
    };
  }

  return {
    contestId: contest.id,
    titleEn: contest.title_en,
    titleZh: contest.title_zh,
    type: contest.type,
    durationSeconds: contest.duration_seconds,
    sourceUrl: contest.source_url,
    tutorialUrl: contest.tutorial_url,
    dataLocation: contest.data_dir,
    editorialFiles: {
      enPath: contest.editorial_en_path,
      zhPath: contest.editorial_zh_path,
      enExists: editorialEnExists,
      zhExists: editorialZhExists,
      status: contest.editorial_status
    },
    offlineReady,
    awaitingBrowserVerification: awaitingBrowserCount > 0,
    browserVerification,
    problems: problemSummaries
  };
}
