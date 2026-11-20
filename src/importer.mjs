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
  isCloudflareChallengeHtml,
  localizeHtmlAssets,
  parseContestProblemsHtml,
  validateTranslatedStatement
} from './statement.mjs';
import { prepareProblemTestPackage } from './testgen.mjs';

let lastRemoteFetchAt = 0;
const MIN_REMOTE_INTERVAL_MS = 1200;

export function parseContestIdInput(input) {
  const s = String(input ?? '').trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const urlMatch = s.match(/codeforces\.com\/(?:contest|gym)\/(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);
  throw new Error(`Invalid contest ID '${s}'. Enter a numeric Codeforces contest ID (e.g. 4).`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimitedFetch(url, retries = 3) {
  if (getSetting('offline_mode', 'false') === 'true') {
    const err = new Error(`Offline mode is active; network request blocked for ${url}`);
    err.code = 'OFFLINE_MODE';
    throw err;
  }

  let attempt = 0;
  let delayMs = 400;
  while (true) {
    const elapsed = Date.now() - lastRemoteFetchAt;
    if (elapsed < MIN_REMOTE_INTERVAL_MS) {
      await sleep(MIN_REMOTE_INTERVAL_MS - elapsed);
    }
    lastRemoteFetchAt = Date.now();
    attempt++;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'OfflineCFOJ/1.0 (Local Windows Practice Judge)',
          Accept: 'text/html,application/json,*/*'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        if (attempt <= retries) {
          await sleep(delayMs);
          delayMs *= 2;
          continue;
        }
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { status: res.status, ok: res.ok, buffer: buf, text: () => buf.toString('utf8') };
    } catch (err) {
      if (attempt <= retries) {
        await sleep(delayMs);
        delayMs *= 2;
        continue;
      }
      throw err;
    }
  }
}

function getFixtureDir(contestId) {
  return path.join(ROOT_DIR, 'fixtures', 'codeforces', `contest${contestId}`);
}

async function fetchContestApiStandings(contestId, cacheDir, options = {}) {
  const cacheFile = path.join(cacheDir, 'contest.standings.json');
  if (fs.existsSync(cacheFile) && !options.forceFetch) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }

  const fixtureFile = path.join(getFixtureDir(contestId), 'contest.standings.json');
  const preferFixture = options.useFixture || getSetting('offline_mode', 'false') === 'true';

  if (!preferFixture) {
    try {
      const apiUrl = `https://codeforces.com/api/contest.standings?contestId=${contestId}`;
      const res = await rateLimitedFetch(apiUrl, 2);
      if (res.ok) {
        const parsed = JSON.parse(res.text());
        if (parsed.status === 'OK' && parsed.result) {
          fs.writeFileSync(cacheFile, JSON.stringify(parsed, null, 2), 'utf8');
          return parsed;
        }
      }
    } catch (err) {
      if (options.strictNetworkOnly || !fs.existsSync(fixtureFile)) {
        throw new Error(`Failed to fetch Codeforces API for contest ${contestId}: ${err.message}`);
      }
    }
  }

  if (!options.strictNetworkOnly && fs.existsSync(fixtureFile)) {
    const raw = fs.readFileSync(fixtureFile, 'utf8');
    fs.writeFileSync(cacheFile, raw, 'utf8');
    return JSON.parse(raw);
  }

  throw new Error(`Contest ${contestId} metadata unavailable from Codeforces API and no local cache/fixture exists.`);
}

async function fetchContestProblemsPage(contestId, cacheDir, options = {}) {
  const cacheFile = path.join(cacheDir, 'problems.html');
  if (options.uploadedProblemsHtml) {
    fs.writeFileSync(cacheFile, options.uploadedProblemsHtml, 'utf8');
    return options.uploadedProblemsHtml;
  }
  if (fs.existsSync(cacheFile) && !options.forceFetch) {
    const cached = fs.readFileSync(cacheFile, 'utf8');
    if (!isCloudflareChallengeHtml(cached)) return cached;
  }

  const fixtureFile = path.join(getFixtureDir(contestId), 'problems.html');
  const preferFixture = options.useFixture || getSetting('offline_mode', 'false') === 'true';

  if (!preferFixture) {
    try {
      const url = `https://codeforces.com/contest/${contestId}/problems`;
      const res = await rateLimitedFetch(url, 2);
      const html = res.text();
      if (res.ok && !isCloudflareChallengeHtml(html)) {
        fs.writeFileSync(cacheFile, html, 'utf8');
        return html;
      }
      if (isCloudflareChallengeHtml(html) && options.strictNetworkOnly) {
        const err = new Error(
          `Codeforces returned an anti-bot challenge (HTTP ${res.status}) for /contest/${contestId}/problems. Upload a browser-saved HTML page or use local fixture.`
        );
        err.code = 'CLOUDFLARE_CHALLENGE';
        throw err;
      }
    } catch (err) {
      if (options.strictNetworkOnly || !fs.existsSync(fixtureFile)) {
        throw err;
      }
    }
  }

  if (!options.strictNetworkOnly && fs.existsSync(fixtureFile)) {
    const html = fs.readFileSync(fixtureFile, 'utf8');
    fs.writeFileSync(cacheFile, html, 'utf8');
    return html;
  }

  throw new Error(
    `Could not fetch problem statements for contest ${contestId}. Save https://codeforces.com/contest/${contestId}/problems from your browser and import the HTML file, or retry when online.`
  );
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
      const res = await rateLimitedFetch(tutorialUrl, 2);
      const html = res.text();
      if (res.ok && !isCloudflareChallengeHtml(html)) {
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
          : `https://codeforces.com${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
        const res = await rateLimitedFetch(fullUrl, 2);
        if (res.ok && res.buffer.length > 0) {
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
      promptText:
        'Translate all statement prose and section headings into Simplified Chinese while preserving math formulas, bounds, variable names, code blocks, literal output tokens, sample pairs, and figure references.',
      executableOverride: options.executableOverride || null,
      envOverride: options.envOverride || null
    });

    const candidateZh = {
      ...enStmt,
      title: aiRes.data.title,
      descriptionHtml: aiRes.data.descriptionHtml,
      inputSpecHtml: aiRes.data.inputSpecHtml,
      outputSpecHtml: aiRes.data.outputSpecHtml,
      noteHtml: aiRes.data.noteHtml ?? enStmt.noteHtml ?? '',
      samples: aiRes.data.samples || enStmt.samples
    };

    const validation = validateTranslatedStatement(enStmt, candidateZh);
    if (!validation.valid) {
      const errMsg = `Protected-fragment check failed: ${validation.errors.join('; ')}`;
      db.prepare(
        "UPDATE problems SET translation_status = 'failed', translation_error = ?, translation_provider = ?, updated_at = ? WHERE id = ?"
      ).run(errMsg, aiRes.provider, getNowMs(), problemRow.id);
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
    fs.writeFileSync(
      path.join(problemDir, 'statement.zh-CN.json'),
      JSON.stringify(candidateZh, null, 2),
      'utf8'
    );

    db.prepare(
      `UPDATE problems
       SET title_zh = ?,
           statement_zh_json = ?,
           translation_status = 'ready',
           translation_error = NULL,
           translation_provider = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      candidateZh.title,
      JSON.stringify(candidateZh),
      aiRes.provider,
      getNowMs(),
      problemRow.id
    );

    return { ok: true, statementZh: candidateZh, validation };
  } catch (err) {
    db.prepare(
      "UPDATE problems SET translation_status = 'failed', translation_error = ?, updated_at = ? WHERE id = ?"
    ).run(err.message, getNowMs(), problemRow.id);
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
    problems: {}
  };

  try {
    // 1. Fetch contest metadata and standings from API (or cache/fixture)
    const apiData = await fetchContestApiStandings(contestId, cacheDir, options);
    const cfContest = apiData.result.contest;
    const cfProblems = [...(apiData.result.problems || [])];
    const cfRows = (apiData.result.rows || []).slice(0, 150);

    // 2. Fetch contest problems HTML page
    let parsedHtml = { problems: [], tutorialUrl: null };
    let htmlFetchError = null;
    try {
      const problemsHtml = await fetchContestProblemsPage(contestId, cacheDir, options);
      parsedHtml = parseContestProblemsHtml(problemsHtml);
    } catch (err) {
      htmlFetchError = err.message;
    }

    const htmlByIndex = {};
    for (const hp of parsedHtml.problems) {
      htmlByIndex[hp.problemIndex.toUpperCase()] = hp;
    }

    // Discover union of problems in contest order (including A1, A2, etc.)
    const allIndicesSet = new Set([
      ...cfProblems.map((p) => String(p.index).toUpperCase()),
      ...Object.keys(htmlByIndex)
    ]);
    const orderedIndices = [...allIndicesSet].sort(compareProblemIndices);

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
        parsedHtml.tutorialUrl || `https://codeforces.com/blog/entry/169`,
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
             tutorial_url = COALESCE(?, tutorial_url),
             standings_json = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(
        cfContest.name || existingContest.title_en,
        cfContest.type || existingContest.type,
        cfContest.phase || existingContest.phase,
        cfContest.durationSeconds || existingContest.duration_seconds,
        cfContest.startTimeSeconds || null,
        parsedHtml.tutorialUrl || existingContest.tutorial_url,
        JSON.stringify(cfRows),
        getNowMs(),
        contestId
      );
    }

    // Initialize per-problem progress display
    for (let i = 0; i < orderedIndices.length; i++) {
      const idx = orderedIndices[i];
      const existingProb = db
        .prepare('SELECT * FROM problems WHERE id = ?')
        .get(`${contestId}${idx}`);
      steps.problems[idx] = {
        index: idx,
        fetching: existingProb?.fetch_status === 'ready' && !options.forceRegenerate ? 'ready' : 'pending',
        translation:
          existingProb?.translation_status === 'ready' && !options.forceRegenerate ? 'ready' : 'pending',
        test_prep:
          existingProb?.test_prep_status === 'ready' && existingProb?.active_package_rev > 0 && !options.forceRegenerate
            ? 'ready'
            : 'pending',
        editorial_prep:
          existingProb?.editorial_prep_status === 'ready' && existingProb?.editorial_verified === 1 && !options.forceRegenerate
            ? 'ready'
            : 'pending'
      };
    }
    emitImportProgress(jobId, contestId, 'running', steps);

    const assetResolver = createAssetResolver(contestId, assetsDir, options);

    // 3. Process fetching & statement preservation per problem
    for (let i = 0; i < orderedIndices.length; i++) {
      const idx = orderedIndices[i];
      const probId = `${contestId}${idx}`;
      const apiMeta = cfProblems.find((p) => String(p.index).toUpperCase() === idx) || {};
      const domStmt = htmlByIndex[idx] || null;
      const existingProb = db.prepare('SELECT * FROM problems WHERE id = ?').get(probId);

      // If already fetched and cached, preserve unless forceRegenerate
      if (existingProb && existingProb.fetch_status === 'ready' && existingProb.statement_en_json && !options.forceRegenerate && !domStmt) {
        steps.problems[idx].fetching = 'ready';
        emitImportProgress(jobId, contestId, 'running', steps);
        continue;
      }

      steps.problems[idx].fetching = 'running';
      emitImportProgress(jobId, contestId, 'running', steps);

      if (!domStmt) {
        const fetchErr = htmlFetchError || `Statement for problem ${idx} not found in contest page`;
        if (!existingProb) {
          db.prepare(
            `INSERT INTO problems (
              id, contest_id, problem_index, sort_order, title_en, problem_type,
              points, rating, tags_json, source_url, fetch_status, fetch_error, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'batch', ?, ?, ?, ?, 'failed', ?, ?)`
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
            fetchErr,
            getNowMs()
          );
        } else {
          db.prepare(
            "UPDATE problems SET sort_order = ?, fetch_status = CASE WHEN statement_en_json IS NOT NULL THEN 'ready' ELSE 'failed' END, fetch_error = ?, updated_at = ? WHERE id = ?"
          ).run(i, fetchErr, getNowMs(), probId);
        }
        steps.problems[idx].fetching = existingProb?.statement_en_json ? 'ready' : 'failed';
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

      if (options.onlyProblemIndex && options.onlyProblemIndex.toUpperCase() !== idx.toUpperCase()) {
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
      steps,
      summary: getContestReadinessSummary(contestId)
    };
  } catch (err) {
    emitImportProgress(jobId, contestId, 'failed', steps, err.message);
    return {
      ok: false,
      jobId,
      contestId,
      status: 'failed',
      error: err.message,
      steps
    };
  }
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
  if (stage === 'translation' || (stage === 'all' && fresh1.translation_status !== 'ready')) {
    results.translation = await translateSingleProblem(fresh1, options);
  }

  const fresh2 = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
  if (
    stage === 'test_prep' ||
    (stage === 'all' && (fresh2.test_prep_status !== 'ready' || fresh2.active_package_rev === 0))
  ) {
    results.test_prep = await prepareProblemTestPackage(fresh2, options);
  }

  const fresh3 = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
  if (
    stage === 'editorial_prep' ||
    (stage === 'all' && (fresh3.editorial_prep_status !== 'ready' || !fresh3.editorial_verified))
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

export function getContestReadinessSummary(contestId) {
  const db = getDb();
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) return null;

  const problems = db
    .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC, problem_index ASC')
    .all(contestId);

  const problemSummaries = problems.map((p) => {
    let stmtEn = null;
    try {
      stmtEn = p.statement_en_json ? JSON.parse(p.statement_en_json) : null;
    } catch {}
    const sampleCount = stmtEn?.samples?.length || 0;
    const canRead = p.fetch_status === 'ready' && Boolean(stmtEn);
    const canPracticeSamples = canRead && p.problem_type === 'batch' && sampleCount > 0;
    const canJudgeFull =
      canRead && p.problem_type === 'batch' && p.active_package_rev > 0 && p.test_prep_status === 'ready';
    const hasChinese = p.translation_status === 'ready' && Boolean(p.statement_zh_json);
    const hasEditorial = p.editorial_prep_status === 'ready' && p.editorial_verified === 1;

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
        reason: p.fetch_error || 'Statement not fetched yet',
        repairAction: 'retry_fetch'
      });
    }
    if (!hasChinese) {
      incompleteItems.push({
        stage: 'translation',
        reason: p.translation_error || 'Simplified Chinese translation missing or failed validation',
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

  const editorialEnExists = Boolean(contest.editorial_en_path && fs.existsSync(contest.editorial_en_path));
  const editorialZhExists = Boolean(contest.editorial_zh_path && fs.existsSync(contest.editorial_zh_path));

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
    problems: problemSummaries
  };
}
