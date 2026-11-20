import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ROOT_DIR, getDb, getNowMs, getSetting } from './db.mjs';

export const judgeEvents = new EventEmitter();
judgeEvents.setMaxListeners(100);

export const SANDBOX_EXE = path.join(ROOT_DIR, 'bin', 'cfoj-sandbox.exe');

export function resolveCompilerPath() {
  const configured = getSetting('compiler_path', 'C:\\YX\\mingw64\\bin\\g++.exe');
  if (configured && fs.existsSync(configured)) return configured;
  const fallback = 'C:\\YX\\mingw64\\bin\\g++.exe';
  if (fs.existsSync(fallback)) return fallback;
  return configured || 'g++';
}

let cachedToolchainDescription = null;

export function checkJudgeEnvironment() {
  const compilerPath = resolveCompilerPath();
  const sandboxExists = fs.existsSync(SANDBOX_EXE);
  const compilerExists = fs.existsSync(compilerPath);

  if (!sandboxExists) {
    return {
      ok: false,
      sandboxExists: false,
      compilerExists,
      compilerPath,
      sandboxPath: SANDBOX_EXE,
      error: `Sandbox runner binary not found at ${SANDBOX_EXE}. Run setup first: powershell -ExecutionPolicy Bypass -File .\\scripts\\setup.ps1`
    };
  }

  if (!compilerExists) {
    return {
      ok: false,
      sandboxExists: true,
      compilerExists: false,
      compilerPath,
      sandboxPath: SANDBOX_EXE,
      error: `GNU C++23 compiler not found at ${compilerPath}. Install MinGW-w64 GCC 14+ or update compiler_path in Settings.`
    };
  }

  const checkRun = spawnSync(SANDBOX_EXE, ['check', 'CFOJ.Run'], {
    encoding: 'utf8',
    timeout: 5000
  });
  const runSid = (checkRun.stdout || '').trim();
  if (checkRun.status !== 0 || !runSid.startsWith('S-1-15-')) {
    return {
      ok: false,
      sandboxExists: true,
      compilerExists: true,
      compilerPath,
      sandboxPath: SANDBOX_EXE,
      error: `AppContainer check failed: ${(checkRun.stderr || checkRun.stdout || 'unknown error').trim()}. Run setup: powershell -ExecutionPolicy Bypass -File .\\scripts\\setup.ps1`
    };
  }

  if (!cachedToolchainDescription) {
    const ver = spawnSync(compilerPath, ['--version'], { encoding: 'utf8', timeout: 5000 });
    const firstLine = ((ver.stdout || '').split(/\r?\n/)[0] || 'GNU C++23 (g++)').trim();
    cachedToolchainDescription = `${firstLine} [-std=gnu++23 -O2 -pipe -static]`;
  }

  return {
    ok: true,
    sandboxExists: true,
    compilerExists: true,
    compilerPath,
    sandboxPath: SANDBOX_EXE,
    runContainerSid: runSid,
    toolchain: cachedToolchainDescription
  };
}

export function invokeSandbox(spec) {
  return new Promise((resolve) => {
    if (!fs.existsSync(SANDBOX_EXE)) {
      resolve({
        status: 'FAIL',
        exitCode: 1,
        cpuMs: 0,
        wallMs: 0,
        peakMemoryBytes: 0,
        outputBytes: 0,
        detail: `Sandbox binary missing at ${SANDBOX_EXE}`
      });
      return;
    }
    const child = spawn(SANDBOX_EXE, ['run'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      resolve({
        status: 'FAIL',
        exitCode: 1,
        cpuMs: 0,
        wallMs: 0,
        peakMemoryBytes: 0,
        outputBytes: 0,
        detail: `Failed to spawn sandbox: ${err.message}`
      });
    });
    child.on('close', () => {
      const line = stdout.trim().split(/\r?\n/).pop() || '';
      try {
        const parsed = JSON.parse(line);
        resolve(parsed);
      } catch {
        resolve({
          status: 'FAIL',
          exitCode: 1,
          cpuMs: 0,
          wallMs: 0,
          peakMemoryBytes: 0,
          outputBytes: 0,
          detail: `Invalid sandbox response: ${line || stderr.trim() || 'empty output'}`
        });
      }
    });
    child.stdin.write(JSON.stringify(spec));
    child.stdin.end();
  });
}

export async function compileCpp23(sourceCode, targetDir = null, outName = 'solution.exe') {
  const envCheck = checkJudgeEnvironment();
  if (!envCheck.ok) {
    return {
      ok: false,
      judgeFailure: true,
      diagnostics: envCheck.error,
      toolchain: 'GNU C++23'
    };
  }

  const workDir =
    targetDir ||
    path.join(DATA_DIR, 'tmp', `compile-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(workDir, { recursive: true });

  const srcPath = path.join(workDir, 'solution.cpp');
  const exePath = path.join(workDir, outName);
  const outPath = path.join(workDir, 'compile.out');
  const errPath = path.join(workDir, 'compile.err');

  fs.writeFileSync(srcPath, sourceCode, 'utf8');

  const compilerDir = path.dirname(envCheck.compilerPath);
  const spec = {
    container: 'CFOJ.Compile',
    args: [
      envCheck.compilerPath,
      '-std=gnu++23',
      '-O2',
      '-pipe',
      '-static',
      '-s',
      '-Wl,--stack=67108864',
      '-o',
      exePath,
      srcPath,
      '-lstdc++exp'
    ],
    cwd: workDir,
    env: [
      `PATH=${compilerDir};C:\\Windows\\System32`,
      `TEMP=${workDir}`,
      `TMP=${workDir}`
    ],
    stdoutFile: outPath,
    stderrFile: errPath,
    timeLimitMs: 20000,
    wallLimitMs: 35000,
    memoryLimitBytes: 1024 * 1024 * 1024,
    maxProcesses: 16,
    outputLimitBytes: 2 * 1024 * 1024,
    stderrLimitBytes: 256 * 1024,
    grantRW: [workDir]
  };

  const res = await invokeSandbox(spec);
  const errText = fs.existsSync(errPath) ? fs.readFileSync(errPath, 'utf8') : '';
  const outText = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  const diagnostics = [errText, outText].filter(Boolean).join('\n').trim();

  if (res.status === 'FAIL') {
    return {
      ok: false,
      judgeFailure: true,
      diagnostics: `Compiler sandbox failure: ${res.detail || diagnostics}`,
      toolchain: envCheck.toolchain,
      workDir
    };
  }

  if (res.status !== 'OK' || !fs.existsSync(exePath)) {
    return {
      ok: false,
      judgeFailure: false,
      diagnostics: diagnostics || res.detail || `Compilation failed (${res.status})`,
      toolchain: envCheck.toolchain,
      workDir
    };
  }

  // Grant CFOJ.Run read/execute access to the compile directory and binary once
  spawnSync(SANDBOX_EXE, ['grant', 'CFOJ.Run', 'rx', workDir], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true
  });

  return {
    ok: true,
    exePath,
    workDir,
    diagnostics,
    cpuMs: res.cpuMs,
    wallMs: res.wallMs,
    toolchain: envCheck.toolchain
  };
}

export async function runSandboxedExecutable(exePath, inputContent, limits = {}, extraOpts = {}) {
  const runDir = path.join(
    DATA_DIR,
    'tmp',
    `run-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  const stdinPath = path.join(runDir, 'stdin.txt');
  const stdoutPath = path.join(runDir, 'stdout.txt');
  const stderrPath = path.join(runDir, 'stderr.txt');
  fs.writeFileSync(stdinPath, inputContent ?? '', 'utf8');

  if (extraOpts.files) {
    for (const [relName, content] of Object.entries(extraOpts.files)) {
      fs.writeFileSync(path.join(runDir, relName), content ?? '', 'utf8');
    }
  }

  const timeLimitMs = Number(limits.timeLimitMs) || 2000;
  const memoryLimitMb = Number(limits.memoryLimitMb) || 256;
  const outputLimitBytes = Number(limits.outputLimitBytes) || 16 * 1024 * 1024;

  const spec = {
    container: 'CFOJ.Run',
    args: [exePath, ...(extraOpts.args || [])],
    cwd: runDir,
    env: ['SystemRoot=C:\\Windows'],
    stdinFile: stdinPath,
    stdoutFile: stdoutPath,
    stderrFile: stderrPath,
    timeLimitMs,
    wallLimitMs: Math.max(timeLimitMs * 3 + 1500, 3000),
    memoryLimitBytes: memoryLimitMb * 1024 * 1024,
    maxProcesses: 1,
    outputLimitBytes,
    stderrLimitBytes: 64 * 1024,
    grantRW: [runDir],
    grantRX: [path.dirname(exePath)]
  };

  try {
    const res = await invokeSandbox(spec);
    const stdout = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, 'utf8') : '';
    const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8') : '';
    return {
      ...res,
      stdout,
      stderr
    };
  } finally {
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
}

function tokenize(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

function normalizeLines(text) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  return lines.map((l) => l.replace(/\s+$/, ''));
}

export async function checkCaseOutput(checkerConfig, inputText, userOutput, expectedOutput) {
  const type = checkerConfig?.type || 'token';

  if (type === 'exact') {
    const uLines = normalizeLines(userOutput);
    const eLines = normalizeLines(expectedOutput);
    const maxLen = Math.max(uLines.length, eLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (uLines[i] !== eLines[i]) {
        return {
          ok: false,
          comment: `Line ${i + 1} differs: expected ${JSON.stringify(eLines[i] ?? '<EOF>')}, got ${JSON.stringify(uLines[i] ?? '<EOF>')}`
        };
      }
    }
    return { ok: true, comment: `ok (${uLines.length} line${uLines.length === 1 ? '' : 's'})` };
  }

  if (type === 'float') {
    const eps = Number(checkerConfig?.eps) || 1e-6;
    const uTokens = tokenize(userOutput);
    const eTokens = tokenize(expectedOutput);
    if (uTokens.length !== eTokens.length) {
      return {
        ok: false,
        comment: `Token count mismatch: expected ${eTokens.length}, got ${uTokens.length}`
      };
    }
    for (let i = 0; i < eTokens.length; i++) {
      const ut = uTokens[i];
      const et = eTokens[i];
      if (ut === et) continue;
      const un = Number(ut);
      const en = Number(et);
      if (Number.isFinite(un) && Number.isFinite(en)) {
        const diff = Math.abs(un - en);
        const scale = Math.max(1, Math.abs(en));
        if (diff <= eps || diff / scale <= eps) continue;
        return {
          ok: false,
          comment: `Token #${i + 1} out of tolerance (eps=${eps}): expected ${et}, got ${ut} (err=${(diff / scale).toExponential(2)})`
        };
      }
      return {
        ok: false,
        comment: `Token #${i + 1} differs: expected '${et}', got '${ut}'`
      };
    }
    return { ok: true, comment: `ok (${eTokens.length} tokens, eps=${eps})` };
  }

  if (type === 'custom' && checkerConfig?.exePath && fs.existsSync(checkerConfig.exePath)) {
    const res = await runSandboxedExecutable(
      checkerConfig.exePath,
      '',
      { timeLimitMs: 3000, memoryLimitMb: 256 },
      {
        args: ['input.txt', 'user_output.txt', 'expected_output.txt'],
        files: {
          'input.txt': inputText ?? '',
          'user_output.txt': userOutput ?? '',
          'expected_output.txt': expectedOutput ?? ''
        }
      }
    );
    const comment = (res.stdout || res.stderr || res.detail || '').trim().slice(0, 300);
    if (res.status === 'OK' && res.exitCode === 0) {
      return { ok: true, comment: comment || 'ok (semantic checker)' };
    }
    if (res.exitCode === 1 || res.exitCode === 2) {
      return { ok: false, comment: comment || 'Wrong Answer (semantic checker rejected output)' };
    }
    return {
      ok: false,
      judgeFailure: true,
      comment: `Semantic checker failed (${res.status}, exit ${res.exitCode}): ${comment}`
    };
  }

  // Default: standard Codeforces token comparison (wcmp)
  const uTokens = tokenize(userOutput);
  const eTokens = tokenize(expectedOutput);
  const minLen = Math.min(uTokens.length, eTokens.length);
  for (let i = 0; i < minLen; i++) {
    if (uTokens[i] !== eTokens[i]) {
      return {
        ok: false,
        comment: `Token #${i + 1} differs: expected '${eTokens[i].slice(0, 64)}', got '${uTokens[i].slice(0, 64)}'`
      };
    }
  }
  if (uTokens.length !== eTokens.length) {
    return {
      ok: false,
      comment: `Token count mismatch: expected ${eTokens.length} token(s), got ${uTokens.length}`
    };
  }
  return { ok: true, comment: `ok (${eTokens.length} token${eTokens.length === 1 ? '' : 's'})` };
}

export function loadProblemTestSuite(problemRow, preferredRevision = null) {
  const db = getDb();
  const rev =
    preferredRevision !== null && preferredRevision > 0
      ? preferredRevision
      : problemRow.active_package_rev;

  if (rev > 0) {
    const pkg = db
      .prepare('SELECT * FROM test_packages WHERE problem_id = ? AND revision = ?')
      .get(problemRow.id, rev);
    if (pkg && fs.existsSync(pkg.package_dir)) {
      const manifestPath = path.join(pkg.package_dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const cases = [];
        for (const c of manifest.cases || []) {
          const inPath = path.join(pkg.package_dir, c.inputFile);
          const ansPath = path.join(pkg.package_dir, c.answerFile);
          if (fs.existsSync(inPath) && fs.existsSync(ansPath)) {
            cases.push({
              index: cases.length + 1,
              name: c.name || `test-${cases.length + 1}`,
              category: c.category || (c.isSample ? 'sample' : 'generated'),
              isSample: Boolean(c.isSample),
              input: fs.readFileSync(inPath, 'utf8'),
              expected: fs.readFileSync(ansPath, 'utf8')
            });
          }
        }
        const checkerExe = path.join(pkg.package_dir, 'checker.exe');
        return {
          revision: pkg.revision,
          suiteType: 'full',
          checker: {
            type: pkg.checker_type || manifest.checker?.type || 'token',
            eps: pkg.checker_eps || manifest.checker?.eps || 1e-6,
            exePath: fs.existsSync(checkerExe) ? checkerExe : null
          },
          cases
        };
      }
    }
  }

  // Fallback to statement samples if no full package is published
  let samples = [];
  if (problemRow.statement_en_json) {
    try {
      const st = JSON.parse(problemRow.statement_en_json);
      samples = st.samples || [];
    } catch {
      samples = [];
    }
  }
  return {
    revision: 0,
    suiteType: 'sample_only',
    checker: { type: 'token', eps: 1e-6, exePath: null },
    cases: samples.map((s, idx) => ({
      index: idx + 1,
      name: `sample-${idx + 1}`,
      category: 'sample',
      isSample: true,
      input: s.input,
      expected: s.output
    }))
  };
}

function previewText(s, maxLen = 400) {
  const str = String(s ?? '');
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n... [truncated ${str.length - maxLen} chars]`;
}

// Sequential submission execution queue
const submissionQueue = [];
let queueActive = false;
let queuePaused = false;

export function setQueuePaused(paused) {
  queuePaused = Boolean(paused);
  if (!queuePaused) {
    processQueue();
  }
  return queuePaused;
}

export function enqueueSubmission(submissionId) {
  if (!submissionQueue.includes(submissionId)) {
    submissionQueue.push(submissionId);
  }
  if (!queuePaused) {
    processQueue();
  }
}

export function recoverInterruptedSubmissions() {
  const db = getDb();
  const rows = db
    .prepare("SELECT id FROM submissions WHERE status IN ('queued', 'compiling', 'running') ORDER BY id ASC")
    .all();
  for (const r of rows) {
    db.prepare(
      "UPDATE submissions SET status = 'queued', verdict = 'QUEUED', current_test = 0 WHERE id = ?"
    ).run(r.id);
    enqueueSubmission(r.id);
  }
  return rows.length;
}

async function processQueue() {
  if (queueActive || queuePaused) return;
  queueActive = true;
  while (submissionQueue.length > 0 && !queuePaused) {
    const subId = submissionQueue.shift();
    try {
      await judgeSingleSubmission(subId);
    } catch (err) {
      const db = getDb();
      db.prepare(
        "UPDATE submissions SET status = 'final', verdict = 'JF', compiler_output = ?, judged_at = ? WHERE id = ?"
      ).run(`Internal judge error: ${err.message}`, getNowMs(), subId);
      emitSubmissionState(subId);
    }
  }
  queueActive = false;
}

function emitSubmissionState(submissionId) {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
  if (sub) {
    judgeEvents.emit('submissionUpdate', sub);
  }
}

async function judgeSingleSubmission(submissionId) {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
  if (!sub) return;

  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(sub.problem_id);
  if (!problem) {
    db.prepare(
      "UPDATE submissions SET status = 'final', verdict = 'JF', compiler_output = 'Problem record not found', judged_at = ? WHERE id = ?"
    ).run(getNowMs(), submissionId);
    emitSubmissionState(submissionId);
    return;
  }

  if (problem.problem_type !== 'batch' && problem.missing_component) {
    db.prepare(
      "UPDATE submissions SET status = 'final', verdict = 'JF', compiler_output = ?, judged_at = ? WHERE id = ?"
    ).run(
      `Problem type '${problem.problem_type}' cannot be judged locally yet: missing component '${problem.missing_component}'.`,
      getNowMs(),
      submissionId
    );
    emitSubmissionState(submissionId);
    return;
  }

  const suite = loadProblemTestSuite(problem, sub.package_revision);
  if (!suite.cases.length) {
    db.prepare(
      "UPDATE submissions SET status = 'final', verdict = 'JF', compiler_output = 'No test cases available for this problem', judged_at = ? WHERE id = ?"
    ).run(getNowMs(), submissionId);
    emitSubmissionState(submissionId);
    return;
  }

  db.prepare(
    "UPDATE submissions SET status = 'compiling', verdict = 'COMPILING', total_tests = ?, package_revision = ?, suite_type = ? WHERE id = ?"
  ).run(suite.cases.length, suite.revision, suite.suiteType, submissionId);
  emitSubmissionState(submissionId);

  const comp = await compileCpp23(sub.source_code);
  try {
    if (!comp.ok) {
      const verdict = comp.judgeFailure ? 'JF' : 'CE';
      db.prepare(
        "UPDATE submissions SET status = 'final', verdict = ?, toolchain = ?, compiler_output = ?, judged_at = ? WHERE id = ?"
      ).run(verdict, comp.toolchain || sub.toolchain, comp.diagnostics || '', getNowMs(), submissionId);
      emitSubmissionState(submissionId);
      maybeFinalizeVpAfterSubmission(sub.vp_id);
      return;
    }

    db.prepare(
      "UPDATE submissions SET status = 'running', verdict = 'RUNNING', toolchain = ?, compiler_output = ? WHERE id = ?"
    ).run(comp.toolchain, comp.diagnostics || '', submissionId);
    emitSubmissionState(submissionId);

    let maxTimeMs = 0;
    let maxMemoryBytes = 0;
    const caseResults = [];
    let finalVerdict = 'AC';
    let firstFailedTest = null;
    let failedCaseDetail = null;

    for (const tc of suite.cases) {
      db.prepare('UPDATE submissions SET current_test = ? WHERE id = ?').run(tc.index, submissionId);
      emitSubmissionState(submissionId);

      const runRes = await runSandboxedExecutable(comp.exePath, tc.input, {
        timeLimitMs: problem.time_limit_ms,
        memoryLimitMb: problem.memory_limit_mb
      });

      maxTimeMs = Math.max(maxTimeMs, runRes.cpuMs || 0);
      maxMemoryBytes = Math.max(maxMemoryBytes, runRes.peakMemoryBytes || 0);

      let caseVerdict = 'AC';
      let comment = '';

      if (runRes.status === 'FAIL') {
        caseVerdict = 'JF';
        comment = runRes.detail || 'Sandbox execution failure';
      } else if (runRes.status === 'TLE') {
        caseVerdict = 'TLE';
        comment = runRes.detail || `Time limit exceeded (${runRes.cpuMs} ms > ${problem.time_limit_ms} ms)`;
      } else if (runRes.status === 'MLE') {
        caseVerdict = 'MLE';
        comment = runRes.detail || 'Memory limit exceeded';
      } else if (runRes.status === 'OLE') {
        caseVerdict = 'OLE';
        comment = runRes.detail || 'Output limit exceeded';
      } else if (runRes.status === 'RE') {
        caseVerdict = 'RE';
        comment = runRes.detail || `Runtime error (exit ${runRes.exitCode})`;
      } else {
        const chk = await checkCaseOutput(suite.checker, tc.input, runRes.stdout, tc.expected);
        if (chk.judgeFailure) {
          caseVerdict = 'JF';
          comment = chk.comment;
        } else if (!chk.ok) {
          caseVerdict = 'WA';
          comment = chk.comment;
        } else {
          caseVerdict = 'AC';
          comment = chk.comment;
        }
      }

      caseResults.push({
        index: tc.index,
        name: tc.name,
        category: tc.category,
        isSample: tc.isSample,
        verdict: caseVerdict,
        timeMs: runRes.cpuMs || 0,
        memoryBytes: runRes.peakMemoryBytes || 0,
        comment
      });

      if (caseVerdict !== 'AC') {
        finalVerdict = caseVerdict;
        firstFailedTest = tc.index;
        failedCaseDetail = {
          index: tc.index,
          name: tc.name,
          category: tc.category,
          isSample: tc.isSample,
          verdict: caseVerdict,
          timeMs: runRes.cpuMs || 0,
          memoryBytes: runRes.peakMemoryBytes || 0,
          checkerComment: comment,
          inputPreview: previewText(tc.input),
          userOutputPreview: previewText(runRes.stdout),
          expectedOutputPreview: previewText(tc.expected)
        };
        break;
      }
    }

    db.prepare(
      `UPDATE submissions
       SET status = 'final',
           verdict = ?,
           time_ms = ?,
           memory_bytes = ?,
           first_failed_test = ?,
           failed_case_json = ?,
           case_results_json = ?,
           judged_at = ?
       WHERE id = ?`
    ).run(
      finalVerdict,
      maxTimeMs,
      maxMemoryBytes,
      firstFailedTest,
      failedCaseDetail ? JSON.stringify(failedCaseDetail) : null,
      JSON.stringify(caseResults),
      getNowMs(),
      submissionId
    );
    emitSubmissionState(submissionId);
    maybeFinalizeVpAfterSubmission(sub.vp_id);
  } finally {
    if (comp.workDir) {
      try {
        fs.rmSync(comp.workDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }
}

export function maybeFinalizeVpAfterSubmission(vpId) {
  if (!vpId) return;
  const db = getDb();
  const vp = db.prepare('SELECT * FROM virtual_participations WHERE id = ?').get(vpId);
  if (!vp) return;
  const now = getNowMs();
  if (now < vp.ends_at && vp.status !== 'finished') return;

  const pending = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM submissions WHERE vp_id = ? AND status IN ('queued', 'compiling', 'running')"
    )
    .get(vpId);

  if ((pending?.cnt || 0) === 0) {
    db.prepare(
      "UPDATE virtual_participations SET status = 'finished', finalized_at = COALESCE(finalized_at, ?) WHERE id = ?"
    ).run(now, vpId);
    judgeEvents.emit('vpFinalized', { vpId });
  }
}

export async function runSampleOrCustomTest(problemRow, sourceCode, mode = 'samples', customInput = '') {
  const comp = await compileCpp23(sourceCode);
  if (!comp.ok) {
    if (comp.workDir) {
      try {
        fs.rmSync(comp.workDir, { recursive: true, force: true });
      } catch {}
    }
    return {
      ok: false,
      verdict: comp.judgeFailure ? 'JF' : 'CE',
      toolchain: comp.toolchain,
      compilerOutput: comp.diagnostics || '',
      cases: []
    };
  }

  try {
    const suite = loadProblemTestSuite(problemRow);
    const casesToRun =
      mode === 'custom'
        ? [
            {
              index: 1,
              name: 'custom',
              isSample: false,
              input: customInput ?? '',
              expected: null
            }
          ]
        : suite.cases.filter((c) => c.isSample);

    const results = [];
    for (const tc of casesToRun) {
      const runRes = await runSandboxedExecutable(comp.exePath, tc.input, {
        timeLimitMs: problemRow.time_limit_ms,
        memoryLimitMb: problemRow.memory_limit_mb
      });

      let verdict = 'OK';
      let comment = '';
      if (runRes.status === 'FAIL') {
        verdict = 'JF';
        comment = runRes.detail || 'Sandbox failure';
      } else if (runRes.status !== 'OK') {
        verdict = runRes.status;
        comment = runRes.detail || runRes.status;
      } else if (tc.expected !== null && tc.expected !== undefined) {
        const chk = await checkCaseOutput(suite.checker, tc.input, runRes.stdout, tc.expected);
        verdict = chk.judgeFailure ? 'JF' : chk.ok ? 'AC' : 'WA';
        comment = chk.comment;
      }

      results.push({
        index: tc.index,
        name: tc.name,
        verdict,
        timeMs: runRes.cpuMs || 0,
        memoryBytes: runRes.peakMemoryBytes || 0,
        input: previewText(tc.input, 1000),
        output: previewText(runRes.stdout, 1000),
        stderr: previewText(runRes.stderr, 500),
        expected: tc.expected !== null ? previewText(tc.expected, 1000) : null,
        comment
      });
    }

    const overallVerdict =
      mode === 'custom'
        ? results[0]?.verdict || 'OK'
        : results.every((r) => r.verdict === 'AC')
          ? 'AC'
          : results.find((r) => r.verdict !== 'AC')?.verdict || 'WA';

    return {
      ok: true,
      mode: mode === 'custom' ? 'custom_input' : 'sample_only',
      verdict: overallVerdict,
      toolchain: comp.toolchain,
      compilerOutput: comp.diagnostics || '',
      cases: results
    };
  } finally {
    if (comp.workDir) {
      try {
        fs.rmSync(comp.workDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
