import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ROOT_DIR, getSetting } from './db.mjs';

export const TRANSLATION_SCHEMA = {
  type: 'object',
  required: ['title', 'descriptionHtml', 'inputSpecHtml', 'outputSpecHtml', 'samples'],
  properties: {
    title: { type: 'string' },
    descriptionHtml: { type: 'string' },
    inputSpecHtml: { type: 'string' },
    outputSpecHtml: { type: 'string' },
    noteHtml: { type: 'string' },
    samples: {
      type: 'array',
      items: {
        type: 'object',
        required: ['input', 'output'],
        properties: {
          input: { type: 'string' },
          output: { type: 'string' }
        }
      }
    }
  }
};

export const TEST_SUITE_SCHEMA = {
  type: 'object',
  required: [
    'planSummary',
    'checkerType',
    'generatorCpp',
    'validatorCpp',
    'referenceCpp',
    'oracleCpp',
    'wrongSolutions',
    'seeds'
  ],
  properties: {
    planSummary: { type: 'string' },
    checkerType: { type: 'string', enum: ['token', 'exact', 'float', 'custom'] },
    checkerEps: { type: 'number' },
    checkerCpp: { type: 'string' },
    checkerSelfTests: { type: 'array' },
    generatorCpp: { type: 'string' },
    validatorCpp: { type: 'string' },
    referenceCpp: { type: 'string' },
    oracleCpp: { type: 'string' },
    wrongSolutions: { type: 'array' },
    seeds: { type: 'array' }
  }
};

export const EDITORIAL_SCHEMA = {
  type: 'object',
  required: [
    'sourceType',
    'attributionEn',
    'attributionZh',
    'algorithmEn',
    'correctnessEn',
    'complexityEn',
    'markdownEn',
    'markdownZh',
    'solutionCpp'
  ],
  properties: {
    sourceType: { type: 'string', enum: ['published', 'ai'] },
    attributionEn: { type: 'string' },
    attributionZh: { type: 'string' },
    algorithmEn: { type: 'string' },
    correctnessEn: { type: 'string' },
    complexityEn: { type: 'string' },
    markdownEn: { type: 'string' },
    markdownZh: { type: 'string' },
    solutionCpp: { type: 'string' }
  }
};

export function validateAgainstSchema(obj, schema) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['Expected JSON object'] };
  }
  for (const req of schema.required || []) {
    if (obj[req] === undefined || obj[req] === null) {
      errors.push(`Missing required field '${req}'`);
    }
  }
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    if (obj[key] === undefined || obj[key] === null) continue;
    if (prop.type === 'string' && typeof obj[key] !== 'string') {
      errors.push(`Field '${key}' must be a string`);
    } else if (prop.type === 'number' && typeof obj[key] !== 'number') {
      errors.push(`Field '${key}' must be a number`);
    } else if (prop.type === 'array' && !Array.isArray(obj[key])) {
      errors.push(`Field '${key}' must be an array`);
    }
    if (prop.enum && !prop.enum.includes(obj[key])) {
      errors.push(`Field '${key}' must be one of [${prop.enum.join(', ')}]`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function getConfiguredExecutable(providerName) {
  const norm = normalizeProviderName(providerName);
  if (norm === 'codex') {
    return process.env.CFOJ_CODEX_BIN || getSetting('codex_bin', 'codex');
  }
  return process.env.CFOJ_AGY_BIN || getSetting('agy_bin', 'agy');
}

export function getFixtureExecutable(providerName) {
  const norm = normalizeProviderName(providerName);
  return path.join(
    ROOT_DIR,
    'fixtures',
    'providers',
    norm === 'codex' ? 'mock-codex.cmd' : 'mock-agy.cmd'
  );
}

export function normalizeProviderName(name) {
  const s = String(name || '').toLowerCase().trim();
  if (s === 'agy' || s === 'antigravity' || s === 'google' || s === 'google-antigravity') {
    return 'antigravity';
  }
  return 'codex';
}

function resolveExecutablePath(exe) {
  if (!exe) return null;
  if (path.isAbsolute(exe) || exe.includes('\\') || exe.includes('/')) {
    const abs = path.isAbsolute(exe) ? exe : path.resolve(ROOT_DIR, exe);
    if (fs.existsSync(abs)) return abs;
    return null;
  }
  const whereRes = spawnSync('where.exe', [exe], { encoding: 'utf8', timeout: 4000, windowsHide: true });
  if (whereRes.status === 0 && whereRes.stdout) {
    const first = whereRes.stdout.split(/\r?\n/)[0].trim();
    if (first && fs.existsSync(first)) return first;
  }
  return null;
}

function spawnCommandCapture(resolvedExe, args, options = {}) {
  const isCmdOrBat = /\.(cmd|bat)$/i.test(resolvedExe);
  const cmd = isCmdOrBat ? 'cmd.exe' : resolvedExe;
  const finalArgs = isCmdOrBat ? ['/d', '/s', '/c', `"${resolvedExe}" ${args.map(quoteCmdArg).join(' ')}`] : args;

  return new Promise((resolve) => {
    const child = spawn(cmd, finalArgs, {
      cwd: options.cwd || ROOT_DIR,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      windowsVerbatimArguments: isCmdOrBat
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      resolve({ status: 124, stdout, stderr: stderr + '\nProvider command timed out' });
    }, options.timeoutMs || 60000);

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ status: 127, stdout, stderr: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: code ?? 1, stdout, stderr });
    });

    if (options.stdinText !== undefined) {
      child.stdin.write(options.stdinText, 'utf8');
    }
    child.stdin.end();
  });
}

function quoteCmdArg(a) {
  const s = String(a);
  if (/^[a-zA-Z0-9._\-:\\/]+$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

export async function checkProviderStatus(providerName) {
  const norm = normalizeProviderName(providerName);
  const label = norm === 'codex' ? 'OpenAI Codex' : 'Google Antigravity';
  const cliInterface =
    norm === 'codex'
      ? 'codex exec --skip-git-repo-check --sandbox read-only --output-schema schema.json --output-last-message result.json -'
      : 'agy -p - --output-format json --json-schema schema.json';

  const configuredExe = getConfiguredExecutable(norm);
  const resolved = resolveExecutablePath(configuredExe);

  if (!resolved) {
    return {
      provider: norm,
      label,
      cliInterface,
      configuredExecutable: configuredExe,
      resolvedExecutable: null,
      installed: false,
      authenticated: false,
      isFixture: false,
      version: null,
      status: 'not_installed',
      message: `${label} CLI executable '${configuredExe}' was not found on this machine. Install '${norm === 'codex' ? 'codex' : 'agy'}' or configure the fixture executable in Settings.`
    };
  }

  const isFixture = resolved.toLowerCase().includes('mock-');
  const verRes = await spawnCommandCapture(resolved, ['--version'], { timeoutMs: 8000 });
  const combined = `${verRes.stdout}\n${verRes.stderr}`.trim();

  if (verRes.status !== 0) {
    const isVersionErr = /version|unsupported|unrecognized/i.test(combined);
    const isAuthErr = /auth|login|sign in|credential|unauthorized/i.test(combined);
    return {
      provider: norm,
      label,
      cliInterface,
      configuredExecutable: configuredExe,
      resolvedExecutable: resolved,
      installed: true,
      authenticated: false,
      isFixture,
      version: null,
      status: isVersionErr ? 'version_error' : isAuthErr ? 'auth_error' : 'error',
      message: combined || `${label} exited with code ${verRes.status}`
    };
  }

  const versionLine = verRes.stdout.trim().split(/\r?\n/)[0] || 'unknown';
  return {
    provider: norm,
    label,
    cliInterface,
    configuredExecutable: configuredExe,
    resolvedExecutable: resolved,
    installed: true,
    authenticated: true,
    isFixture,
    version: versionLine,
    status: 'ready',
    message: isFixture
      ? `${label} repeatable fixture adapter ready (${versionLine})`
      : `${label} CLI ready (${versionLine})`
  };
}

export async function runProviderStructuredJob({
  providerName,
  taskType,
  problemMaterials,
  schema,
  promptText,
  executableOverride = null,
  envOverride = null
}) {
  const norm = normalizeProviderName(providerName || getSetting('ai_provider', 'codex'));
  const label = norm === 'codex' ? 'OpenAI Codex' : 'Google Antigravity';
  const configuredExe = executableOverride || getConfiguredExecutable(norm);
  let resolved = resolveExecutablePath(configuredExe);

  // If the default CLI is not installed on this machine and fallback is enabled, check fixture
  if (!resolved && getSetting('allow_fixture_fallback', 'true') === 'true') {
    const fixtureExe = getFixtureExecutable(norm);
    if (fs.existsSync(fixtureExe)) {
      resolved = fixtureExe;
    }
  }

  if (!resolved) {
    const err = new Error(
      `${label} executable '${configuredExe}' not found. Install the CLI or enable fixture provider.`
    );
    err.code = 'PROVIDER_NOT_INSTALLED';
    throw err;
  }

  // Create isolated job directory containing ONLY the materials needed for this single problem job
  const jobDir = path.join(
    DATA_DIR,
    'tmp',
    `ai-${norm}-${taskType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  );
  fs.mkdirSync(jobDir, { recursive: true });

  const materialsFile = path.join(jobDir, 'problem-materials.json');
  const schemaFile = path.join(jobDir, 'schema.json');
  const resultFile = path.join(jobDir, 'result.json');

  const sanitizedMaterials = {
    taskType,
    contestId: problemMaterials.contestId,
    problemIndex: problemMaterials.problemIndex,
    title: problemMaterials.title,
    timeLimitMs: problemMaterials.timeLimitMs,
    memoryLimitMb: problemMaterials.memoryLimitMb,
    statement: problemMaterials.statement,
    protectedFragments: problemMaterials.protectedFragments,
    publishedHtml: problemMaterials.publishedHtml
  };

  fs.writeFileSync(materialsFile, JSON.stringify(sanitizedMaterials, null, 2), 'utf8');
  fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2), 'utf8');

  const fullPrompt = [
    `Task: ${taskType} for problem ${problemMaterials.contestId || ''}${problemMaterials.problemIndex || ''}`,
    promptText || 'Read problem-materials.json in the current directory and return JSON matching schema.json.',
    'Materials file: ./problem-materials.json',
    'Output JSON schema: ./schema.json'
  ].join('\n');

  try {
    let args;
    if (norm === 'codex') {
      // Documented OpenAI Codex non-interactive CLI
      args = [
        'exec',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
        '--output-schema',
        'schema.json',
        '--output-last-message',
        'result.json',
        '-'
      ];
    } else {
      // Documented Google Antigravity headless CLI
      args = ['-p', '-', '--output-format', 'json', '--json-schema', 'schema.json'];
    }

    const res = await spawnCommandCapture(resolved, args, {
      cwd: jobDir,
      stdinText: fullPrompt,
      env: envOverride || {},
      timeoutMs: 90000
    });

    const combinedErr = `${res.stderr || ''}\n${res.stdout || ''}`.trim();
    if (res.status !== 0) {
      const err = new Error(`${label} failed (exit ${res.status}): ${combinedErr}`);
      if (/auth|login|sign in|unauthorized|credential|session expired/i.test(combinedErr)) {
        err.code = 'PROVIDER_AUTH_ERROR';
      } else if (/version|unrecognized|unknown flag|unsupported/i.test(combinedErr)) {
        err.code = 'PROVIDER_VERSION_ERROR';
      } else {
        err.code = 'PROVIDER_EXEC_ERROR';
      }
      throw err;
    }

    let parsedOutput = null;
    if (norm === 'codex') {
      const rawText = fs.existsSync(resultFile)
        ? fs.readFileSync(resultFile, 'utf8')
        : res.stdout.trim();
      try {
        parsedOutput = JSON.parse(rawText);
      } catch (parseErr) {
        const err = new Error(`${label} returned invalid JSON: ${parseErr.message}`);
        err.code = 'PROVIDER_INVALID_JSON';
        throw err;
      }
    } else {
      // Antigravity JSON envelope
      let envelope;
      try {
        envelope = JSON.parse(res.stdout.trim());
      } catch (parseErr) {
        const err = new Error(`${label} returned invalid JSON envelope: ${parseErr.message}`);
        err.code = 'PROVIDER_INVALID_JSON';
        throw err;
      }
      if (envelope.status && envelope.status !== 'SUCCESS') {
        const err = new Error(
          `${label} returned status '${envelope.status}': ${envelope.error || envelope.response || 'failed'}`
        );
        err.code = 'PROVIDER_EXEC_ERROR';
        throw err;
      }
      if (envelope.structured_output && typeof envelope.structured_output === 'object') {
        parsedOutput = envelope.structured_output;
      } else if (typeof envelope.response === 'string') {
        try {
          parsedOutput = JSON.parse(envelope.response);
        } catch (parseErr) {
          const err = new Error(`${label} response is not valid JSON: ${parseErr.message}`);
          err.code = 'PROVIDER_INVALID_JSON';
          throw err;
        }
      } else {
        parsedOutput = envelope;
      }
    }

    const validation = validateAgainstSchema(parsedOutput, schema);
    if (!validation.valid) {
      const err = new Error(
        `${label} output failed schema validation: ${validation.errors.join('; ')}`
      );
      err.code = 'PROVIDER_SCHEMA_ERROR';
      throw err;
    }

    return {
      provider: norm,
      label,
      executable: resolved,
      isFixture: resolved.toLowerCase().includes('mock-'),
      data: parsedOutput
    };
  } finally {
    try {
      fs.rmSync(jobDir, { recursive: true, force: true });
    } catch {}
  }
}
