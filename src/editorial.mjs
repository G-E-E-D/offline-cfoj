import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, getDb, getNowMs, getSetting } from './db.mjs';
import {
  checkCaseOutput,
  compileCpp23,
  loadProblemTestSuite,
  runSandboxedExecutable
} from './judge.mjs';
import { EDITORIAL_SCHEMA, runProviderStructuredJob } from './providers.mjs';
import { decodeHtmlEntities } from './statement.mjs';

export function parsePublishedTutorialHtml(html, contestId, problems = []) {
  if (!html) {
    return { title: null, author: null, sourceUrl: null, sectionsByIndex: {} };
  }

  const titleMatch = html.match(/<div\s+class=["']title["'][^>]*>([\s\S]*?)<\/div>/i);
  const urlMatch = titleMatch ? titleMatch[1].match(/href=["']([^"']+)["']/i) : null;
  const titleText = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '')).trim()
    : `Contest ${contestId} Tutorial`;
  const authorMatch = html.match(/class=["'][^"']*rated-user[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const author = authorMatch
    ? decodeHtmlEntities(authorMatch[1].replace(/<[^>]+>/g, '')).trim()
    : 'Codeforces Editorial Author';

  const headingRe = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings = [...html.matchAll(headingRe)];
  const sectionsByIndex = {};

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const hText = decodeHtmlEntities(h[2].replace(/<[^>]+>/g, '')).trim();
    const startIdx = h.index + h[0].length;
    const endIdx = i + 1 < headings.length ? headings[i + 1].index : html.length;
    const bodyHtml = html.slice(startIdx, endIdx).trim();

    for (const prob of problems) {
      const idx = prob.problem_index.toUpperCase();
      // Match patterns like "4A", "Div. 2 A", "Problem A", or exact problem title
      const patterns = [
        new RegExp(`\\b${contestId}\\s*${idx}\\b`, 'i'),
        new RegExp(`\\bDiv\\.?\\s*[1234]\\s+${idx}\\b`, 'i'),
        new RegExp(`^\\s*${idx}\\s*[.—\\-:]`, 'i'),
        new RegExp(`\\bProblem\\s+${idx}\\b`, 'i')
      ];
      if (prob.title_en && prob.title_en.length >= 4) {
        const escapedTitle = prob.title_en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push(new RegExp(escapedTitle, 'i'));
      }
      if (patterns.some((re) => re.test(hText))) {
        sectionsByIndex[idx] = {
          heading: hText,
          html: bodyHtml
        };
      }
    }
  }

  return {
    title: titleText,
    author,
    sourceUrl: urlMatch ? urlMatch[1] : `https://codeforces.com/contest/${contestId}`,
    sectionsByIndex
  };
}

export async function verifyEditorialSolution(problemRow, solutionCpp) {
  if (!solutionCpp || !solutionCpp.trim()) {
    return { verified: false, error: 'No accompanying C++23 solution provided' };
  }
  const suite = loadProblemTestSuite(problemRow);
  if (!suite.cases.length) {
    return { verified: false, error: 'No test cases available to verify editorial solution' };
  }

  const comp = await compileCpp23(solutionCpp);
  if (!comp.ok) {
    if (comp.workDir) {
      try {
        fs.rmSync(comp.workDir, { recursive: true, force: true });
      } catch {}
    }
    return {
      verified: false,
      error: `Editorial solution failed to compile: ${comp.diagnostics}`
    };
  }

  try {
    let maxTimeMs = 0;
    let maxMemBytes = 0;
    const BATCH = 8;
    for (let i = 0; i < suite.cases.length; i += BATCH) {
      const slice = suite.cases.slice(i, i + BATCH);
      const batchRes = await Promise.all(
        slice.map(async (tc) => {
          const runRes = await runSandboxedExecutable(comp.exePath, tc.input, {
            timeLimitMs: problemRow.time_limit_ms,
            memoryLimitMb: problemRow.memory_limit_mb
          });
          if (runRes.status !== 'OK') {
            return {
              ok: false,
              tc,
              runRes,
              error: `Editorial solution failed on test #${tc.index} (${tc.name}): ${runRes.status} (${runRes.detail || ''})`
            };
          }
          const chk = await checkCaseOutput(suite.checker, tc.input, runRes.stdout, tc.expected);
          if (!chk.ok) {
            return {
              ok: false,
              tc,
              runRes,
              error: `Editorial solution produced Wrong Answer on test #${tc.index} (${tc.name}): ${chk.comment}`
            };
          }
          return { ok: true, tc, runRes };
        })
      );
      for (const r of batchRes) {
        maxTimeMs = Math.max(maxTimeMs, r.runRes.cpuMs || 0);
        maxMemBytes = Math.max(maxMemBytes, r.runRes.peakMemoryBytes || 0);
        if (!r.ok) {
          return { verified: false, error: r.error };
        }
      }
    }
    return {
      verified: true,
      casesChecked: suite.cases.length,
      packageRevision: suite.revision,
      maxTimeMs,
      maxMemBytes
    };
  } finally {
    if (comp.workDir) {
      try {
        fs.rmSync(comp.workDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

export async function prepareProblemEditorialSection(
  problemRow,
  publishedSection,
  assetResolver,
  options = {}
) {
  const db = getDb();
  const now = getNowMs();
  const providerName = options.provider || getSetting('ai_provider', 'codex');

  db.prepare(
    "UPDATE problems SET editorial_prep_status = 'running', editorial_prep_error = NULL, updated_at = ? WHERE id = ?"
  ).run(now, problemRow.id);

  try {
    let publishedHtml = publishedSection?.html || '';
    if (publishedHtml && assetResolver) {
      const imgRegex = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*?)>/gi;
      const matches = [...publishedHtml.matchAll(imgRegex)];
      for (const m of matches) {
        const rawUrl = m[3];
        const resolved = await assetResolver(rawUrl);
        publishedHtml = publishedHtml.replace(m[0], `<img${m[1]}src="assets/${resolved.localFilename}"${m[4]}>`);
      }
    }

    let statement = {};
    try {
      statement = JSON.parse(problemRow.statement_en_json || '{}');
    } catch {
      statement = {};
    }

    const aiRes = await runProviderStructuredJob({
      providerName,
      taskType: 'editorial',
      problemMaterials: {
        contestId: problemRow.contest_id,
        problemIndex: problemRow.problem_index,
        title: problemRow.title_en,
        timeLimitMs: problemRow.time_limit_ms,
        memoryLimitMb: problemRow.memory_limit_mb,
        statement,
        publishedHtml
      },
      schema: EDITORIAL_SCHEMA,
      promptText: publishedHtml
        ? 'Convert and translate the published contest tutorial explanation into English and Simplified Chinese Markdown with relative asset paths (assets/...).'
        : 'Generate a clearly attributed AI editorial with algorithm, correctness argument, time and space complexity checked against problem limits, and a GNU C++23 solution.',
      executableOverride: options.executableOverride || null,
      envOverride: options.envOverride || null
    });

    const ed = aiRes.data;
    const sourceType = publishedHtml ? 'published' : 'ai';

    // Rewrite any /api/contests/<id>/assets/<file> in markdown to relative assets/<file>
    const normalizeAssetLinks = (md) =>
      String(md || '').replace(
        new RegExp(`/api/contests/${problemRow.contest_id}/assets/([a-zA-Z0-9._-]+)`, 'g'),
        'assets/$1'
      );

    const verifyRes = await verifyEditorialSolution(problemRow, ed.solutionCpp);

    const sectionData = {
      problemId: problemRow.id,
      contestId: problemRow.contest_id,
      problemIndex: problemRow.problem_index,
      titleEn: problemRow.title_en,
      titleZh: problemRow.title_zh || problemRow.title_en,
      sourceType,
      provider: aiRes.provider,
      providerLabel: aiRes.label,
      isFixture: aiRes.isFixture,
      attributionEn: ed.attributionEn,
      attributionZh: ed.attributionZh,
      algorithmEn: ed.algorithmEn,
      correctnessEn: ed.correctnessEn,
      complexityEn: ed.complexityEn,
      markdownEn: normalizeAssetLinks(ed.markdownEn),
      markdownZh: normalizeAssetLinks(ed.markdownZh),
      solutionCpp: ed.solutionCpp,
      verification: verifyRes,
      updatedAt: getNowMs()
    };

    const sectionPath = path.join(
      DATA_DIR,
      'contests',
      String(problemRow.contest_id),
      'problems',
      problemRow.problem_index,
      'editorial.section.json'
    );
    fs.mkdirSync(path.dirname(sectionPath), { recursive: true });
    fs.writeFileSync(sectionPath, JSON.stringify(sectionData, null, 2), 'utf8');

    if (!verifyRes.verified) {
      db.prepare(
        `UPDATE problems
         SET editorial_prep_status = 'failed',
             editorial_prep_error = ?,
             editorial_source = ?,
             editorial_provider = ?,
             editorial_verified = 0,
             updated_at = ?
         WHERE id = ?`
      ).run(verifyRes.error, sourceType, aiRes.provider, getNowMs(), problemRow.id);

      writeWholeRoundEditorialMarkdownFiles(problemRow.contest_id);
      return { ok: false, error: verifyRes.error, section: sectionData };
    }

    db.prepare(
      `UPDATE problems
       SET editorial_prep_status = 'ready',
           editorial_prep_error = NULL,
           editorial_source = ?,
           editorial_provider = ?,
           editorial_verified = 1,
           updated_at = ?
       WHERE id = ?`
    ).run(sourceType, aiRes.provider, getNowMs(), problemRow.id);

    writeWholeRoundEditorialMarkdownFiles(problemRow.contest_id);
    return { ok: true, section: sectionData };
  } catch (err) {
    db.prepare(
      `UPDATE problems
       SET editorial_prep_status = 'failed',
           editorial_prep_error = ?,
           editorial_verified = 0,
           updated_at = ?
       WHERE id = ?`
    ).run(err.message, getNowMs(), problemRow.id);
    writeWholeRoundEditorialMarkdownFiles(problemRow.contest_id);
    return { ok: false, error: err.message };
  }
}

export function writeWholeRoundEditorialMarkdownFiles(contestId) {
  const db = getDb();
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) return null;

  const problems = db
    .prepare('SELECT * FROM problems WHERE contest_id = ? ORDER BY sort_order ASC, problem_index ASC')
    .all(contestId);

  const contestDir = path.join(DATA_DIR, 'contests', String(contestId));
  fs.mkdirSync(contestDir, { recursive: true });

  const enLines = [
    `# ${contest.title_en} — Contest Editorial`,
    '',
    `- **Contest ID:** ${contest.id}`,
    `- **Source URL:** ${contest.source_url}`,
    contest.tutorial_url ? `- **Original Tutorial Link:** ${contest.tutorial_url}` : null,
    '',
    '## Contents',
    ''
  ].filter((l) => l !== null);

  const zhLines = [
    `# ${contest.title_zh || contest.title_en} — 比赛题解`,
    '',
    `- **比赛编号：** ${contest.id}`,
    `- **原比赛链接：** ${contest.source_url}`,
    contest.tutorial_url ? `- **官方题解链接：** ${contest.tutorial_url}` : null,
    '',
    '## 目录',
    ''
  ].filter((l) => l !== null);

  for (const p of problems) {
    enLines.push(`- [${p.problem_index}. ${p.title_en}](#problem-${p.problem_index})`);
    zhLines.push(
      `- [${p.problem_index}. ${p.title_zh || p.title_en}](#problem-${p.problem_index})`
    );
  }
  enLines.push('', '---', '');
  zhLines.push('', '---', '');

  let allReady = problems.length > 0;
  let anyReady = false;

  for (const p of problems) {
    const sectionFile = path.join(
      contestDir,
      'problems',
      p.problem_index,
      'editorial.section.json'
    );
    let sec = null;
    if (fs.existsSync(sectionFile)) {
      try {
        sec = JSON.parse(fs.readFileSync(sectionFile, 'utf8'));
      } catch {
        sec = null;
      }
    }

    enLines.push(`## ${p.problem_index}. ${p.title_en} {#problem-${p.problem_index}}`, '');
    zhLines.push(
      `## ${p.problem_index}. ${p.title_zh || p.title_en} {#problem-${p.problem_index}}`,
      ''
    );

    if (sec) {
      anyReady = true;
      const badgeEn =
        sec.sourceType === 'published'
          ? `Published Tutorial (${sec.attributionEn})`
          : `AI-Generated Fallback Editorial (${sec.attributionEn})`;
      const badgeZh =
        sec.sourceType === 'published'
          ? `官方发布题解（${sec.attributionZh}）`
          : `AI 补充生成题解（${sec.attributionZh}）`;

      const verEn = sec.verification?.verified
        ? `Verified against local test package rev #${sec.verification.packageRevision} (${sec.verification.casesChecked}/${sec.verification.casesChecked} cases AC, max ${sec.verification.maxTimeMs} ms)`
        : `UNVERIFIED (${sec.verification?.error || 'needs repair'})`;
      const verZh = sec.verification?.verified
        ? `已通过本地测试数据 rev #${sec.verification.packageRevision} 验证（${sec.verification.casesChecked}/${sec.verification.casesChecked} 测试点 AC，最大耗时 ${sec.verification.maxTimeMs} ms）`
        : `未通过验证（${sec.verification?.error || '需修复'}）`;

      if (!sec.verification?.verified) allReady = false;

      enLines.push(
        `- **Source & Attribution:** ${badgeEn}`,
        `- **Problem Limits:** ${p.time_limit_ms} ms / ${p.memory_limit_mb} MB`,
        `- **Validation Status:** ${verEn}`,
        `- **Algorithm Summary:** ${sec.algorithmEn}`,
        `- **Correctness Argument:** ${sec.correctnessEn}`,
        `- **Complexity Check:** ${sec.complexityEn}`,
        '',
        sec.markdownEn,
        '',
        '### Reference Solution (GNU C++23)',
        '',
        '```cpp',
        (sec.solutionCpp || '').trim(),
        '```',
        '',
        '---',
        ''
      );

      zhLines.push(
        `- **题解来源与署名：** ${badgeZh}`,
        `- **题目时空限制：** ${p.time_limit_ms} ms / ${p.memory_limit_mb} MB`,
        `- **代码验证状态：** ${verZh}`,
        '',
        sec.markdownZh,
        '',
        '### 参考代码 (GNU C++23)',
        '',
        '```cpp',
        (sec.solutionCpp || '').trim(),
        '```',
        '',
        '---',
        ''
      );
    } else {
      allReady = false;
      enLines.push(
        `> *Editorial section for ${p.problem_index} is pending or failed preparation (${p.editorial_prep_error || 'not yet generated'}). Use the Repair action in the contest page to regenerate.*`,
        '',
        '---',
        ''
      );
      zhLines.push(
        `> *${p.problem_index} 题解尚未就绪或生成失败（${p.editorial_prep_error || '待生成'}）。可在比赛页面点击“修复”重新生成。*`,
        '',
        '---',
        ''
      );
    }
  }

  const enPath = path.join(contestDir, 'editorial.en.md');
  const zhPath = path.join(contestDir, 'editorial.zh-CN.md');
  fs.writeFileSync(enPath, enLines.join('\n'), 'utf8');
  fs.writeFileSync(zhPath, zhLines.join('\n'), 'utf8');

  const edStatus = allReady ? 'ready' : anyReady ? 'partial' : 'pending';
  db.prepare(
    'UPDATE contests SET editorial_en_path = ?, editorial_zh_path = ?, editorial_status = ?, updated_at = ? WHERE id = ?'
  ).run(enPath, zhPath, edStatus, getNowMs(), contestId);

  return { enPath, zhPath, status: edStatus };
}
