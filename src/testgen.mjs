import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, getDb, getNowMs, getSetting } from './db.mjs';
import {
  checkCaseOutput,
  compileCpp23,
  runSandboxedExecutable,
  runSandboxedPythonGeneratorBatch,
  validatePythonScriptSyntax
} from './judge.mjs';
import { TEST_SUITE_SCHEMA, runProviderStructuredJob } from './providers.mjs';

const TEST_SUITE_PROMPT = [
  'Design a complete, problem-specific test suite for the exact Codeforces problem provided in problemMaterials.',
  'Carefully read statement.descriptionHtml, statement.inputSpecHtml, statement.outputSpecHtml, statement.noteHtml, and statement.samples.',
  'STRICT INPUT FORMAT FIDELITY:',
  '- Match statement.inputSpecHtml and statement.samples 100% faithfully. NEVER invent a simplified or unrelated input format.',
  '- If the problem has multiple test cases per file (e.g. first line integer t followed by t test cases), EVERY generated test file MUST start with t and contain exactly t valid test cases satisfying BOTH per-case constraints (e.g. l <= r, value ranges) AND global sum constraints (e.g. sum of n <= limit).',
  '- If the problem has a single test case per file, output that exact single-test input format.',
  'FIELD CONTRACTS:',
  '1) generatorPy (Python 3 standard library ONLY: sys, random, math, string, collections, etc. — no third-party packages):',
  '   - Invoked as: python generator.py <seed> <category>',
  '   - Parse seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1, category = sys.argv[2] if len(sys.argv) > 2 else "random".',
  '   - Initialize rng = random.Random(seed) for deterministic reproducibility.',
  '   - Print ONLY the complete valid test input to stdout (LF newlines) and exit 0.',
  '   - CRITICAL: Different seed values MUST produce DISTINCT valid inputs (always vary t/values/structure using rng seeded with seed, even for minimum/maximum/boundary categories) so 50+ distinct test cases are guaranteed without duplicates.',
  '   - For small/edge categories (minimum, boundary, ties, special_structure, anti_greedy_plausible_wrong) and seeds 1..15, keep sizes modest enough that the brute-force oracleCpp runs quickly while still covering edge values and tricky traps.',
  '   - For maximum and stress_max_complexity, generate large valid inputs near upper bounds (staying fast in Python < 2s and strictly within all sum/value constraints).',
  '   - Only use category "exhaustive" when the ENTIRE input space of the problem has <= 100 distinct valid inputs total.',
  '2) validatorCpp (GNU C++23, compiled with g++ -std=gnu++23 -O2 -static -lstdc++exp):',
  '   - Reads stdin and strictly validates every constraint from inputSpecHtml (counts, ranges, l <= r, sum bounds, graph/string rules, no extra trailing tokens). Exit 0 iff valid, non-zero otherwise. Must accept all statement.samples and all generatorPy outputs.',
  '3) referenceCpp (GNU C++23): optimal AC solution passing all samples and max-size stress tests within timeLimitMs and memoryLimitMb. Use ios::sync_with_stdio(false); cin.tie(nullptr);.',
  '4) oracleCpp (GNU C++23): independent simpler/brute-force solution agreeing with referenceCpp on all samples and small generated cases.',
  '5) checkerType / checkerEps / checkerCpp / checkerSelfTests:',
  '   - Use checkerType="token" for unique-answer problems (with checkerCpp="" and checkerSelfTests=[]), "float" with checkerEps for floating-point tolerance, "exact" for exact whitespace matching, or "custom" ONLY when multiple valid outputs exist for the same input.',
  '   - If checkerType="custom": checkerCpp is GNU C++23 invoked as checker.exe <input_file> <candidate_output_file> <expected_answer_file> (argv[1..3]), exiting 0 for AC and 1 for WA; checkerSelfTests MUST include at least 2 distinct valid candidate outputs (shouldAccept=true) and at least 1 invalid candidate output (shouldAccept=false).',
  '6) wrongSolutions: 1-2 compiling GNU C++23 plausible wrong solutions (e.g. off-by-one, wrong greedy, missing edge case) that fail (WA/TLE/RE) on at least one generated test case or sample.',
  '7) seeds: array of at least 55 objects { "seed": <unique positive int>, "category": <string> } covering minimum, boundary, ties, special_structure, anti_greedy_plausible_wrong, maximum, and stress_max_complexity.'
].join('\n');

function normalizeInputText(s) {
  const norm = String(s ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  return norm ? norm + '\n' : '';
}

function sha256Text(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export async function prepareProblemTestPackage(problemRow, options = {}) {
  const db = getDb();
  const now = getNowMs();

  if (problemRow.problem_type !== 'batch' && problemRow.missing_component) {
    const msg = `Cannot build local batch test suite for '${problemRow.problem_type}' problem: missing component '${problemRow.missing_component}'.`;
    db.prepare(
      "UPDATE problems SET test_prep_status = 'unsupported', test_prep_error = ?, updated_at = ? WHERE id = ?"
    ).run(msg, now, problemRow.id);
    return {
      ok: false,
      unsupported: true,
      error: msg
    };
  }

  db.prepare(
    "UPDATE problems SET test_prep_status = 'running', test_prep_error = NULL, updated_at = ? WHERE id = ?"
  ).run(now, problemRow.id);

  const maxRevRow = db
    .prepare('SELECT COALESCE(MAX(revision), 0) AS maxRev FROM test_packages WHERE problem_id = ?')
    .get(problemRow.id);
  const nextRev = (maxRevRow?.maxRev || 0) + 1;

  const problemBaseDir = path.join(
    DATA_DIR,
    'contests',
    String(problemRow.contest_id),
    'problems',
    problemRow.problem_index
  );
  const packagesDir = path.join(problemBaseDir, 'packages');
  const stagingDir = path.join(packagesDir, `staging-rev-${nextRev}`);
  const finalPkgDir = path.join(packagesDir, `rev-${nextRev}`);

  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.rmSync(finalPkgDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stagingDir, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(stagingDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(stagingDir, 'wrong_solutions'), { recursive: true });

  const providerName = options.provider || getSetting('ai_provider', 'codex');
  let statement = {};
  try {
    statement = JSON.parse(problemRow.statement_en_json || '{}');
  } catch {
    statement = {};
  }

  db.prepare(
    `INSERT INTO test_packages (
      problem_id, revision, status, provider, checker_type, sample_count, generated_count,
      categories_json, seeds_json, validation_json, package_dir, created_at
    ) VALUES (?, ?, 'validating', ?, 'token', 0, 0, '[]', '[]', '{}', ?, ?)`
  ).run(problemRow.id, nextRev, providerName, finalPkgDir, now);

  db.prepare('UPDATE problems SET candidate_package_rev = ? WHERE id = ?').run(nextRev, problemRow.id);

  try {
    const aiRes = await runProviderStructuredJob({
      providerName,
      taskType: 'test_suite',
      problemMaterials: {
        contestId: problemRow.contest_id,
        problemIndex: problemRow.problem_index,
        title: problemRow.title_en,
        timeLimitMs: problemRow.time_limit_ms,
        memoryLimitMb: problemRow.memory_limit_mb,
        statement
      },
      schema: TEST_SUITE_SCHEMA,
      promptText: TEST_SUITE_PROMPT,
      executableOverride: options.executableOverride || null,
      envOverride: options.envOverride || null
    });

    const plan = aiRes.data;
    const targetCount = Number(options.targetTestCount || getSetting('target_test_count', '50')) || 50;

    if (!plan.generatorPy || !String(plan.generatorPy).trim()) {
      throw new Error("AI test suite plan returned an empty 'generatorPy' Python generator script");
    }

    // Save source artifacts for offline reproducibility
    const genScriptPath = path.join(stagingDir, 'src', 'generator.py');
    const normalizedGenPy = String(plan.generatorPy).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    fs.writeFileSync(genScriptPath, normalizedGenPy, 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'src', 'validator.cpp'), plan.validatorCpp, 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'src', 'reference.cpp'), plan.referenceCpp, 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'src', 'oracle.cpp'), plan.oracleCpp, 'utf8');
    if (plan.checkerType === 'custom' && plan.checkerCpp) {
      fs.writeFileSync(path.join(stagingDir, 'src', 'checker.cpp'), plan.checkerCpp, 'utf8');
    }

    // 1. Syntax-check Python generator and compile all C++23 tools in parallel
    const [genCheck, valComp, refComp, oraComp, chkComp] = await Promise.all([
      validatePythonScriptSyntax(genScriptPath),
      compileCpp23(plan.validatorCpp, path.join(stagingDir, 'build-val'), 'validator.exe'),
      compileCpp23(plan.referenceCpp, path.join(stagingDir, 'build-ref'), 'reference.exe'),
      compileCpp23(plan.oracleCpp, path.join(stagingDir, 'build-ora'), 'oracle.exe'),
      plan.checkerType === 'custom' && plan.checkerCpp
        ? compileCpp23(plan.checkerCpp, stagingDir, 'checker.exe')
        : Promise.resolve({ ok: true, exePath: null })
    ]);
    if (!genCheck.ok) throw new Error(`Python generator syntax/runtime check failed: ${genCheck.diagnostics}`);
    if (!valComp.ok) throw new Error(`Validator compilation failed: ${valComp.diagnostics}`);
    if (!refComp.ok) throw new Error(`Reference solution compilation failed: ${refComp.diagnostics}`);
    if (!oraComp.ok) throw new Error(`Brute-force oracle compilation failed: ${oraComp.diagnostics}`);

    let checkerConfig = {
      type: plan.checkerType || 'token',
      eps: Number(plan.checkerEps) || 1e-6,
      exePath: null
    };

    const checkerSelfTestResults = [];
    if (plan.checkerType === 'custom') {
      if (!plan.checkerCpp) {
        throw new Error("Custom checker selected but 'checkerCpp' source is empty");
      }
      if (!chkComp.ok) throw new Error(`Semantic checker compilation failed: ${chkComp.diagnostics}`);
      checkerConfig.exePath = chkComp.exePath;

      // Test semantic checker with distinct valid answers and an invalid one
      const selfTests = Array.isArray(plan.checkerSelfTests) ? plan.checkerSelfTests : [];
      const validChecks = selfTests.filter((t) => t.shouldAccept);
      const invalidChecks = selfTests.filter((t) => !t.shouldAccept);
      if (validChecks.length < 2 || invalidChecks.length < 1) {
        throw new Error(
          `Semantic checker must be tested with at least 2 distinct valid answers and 1 invalid answer (got ${validChecks.length} valid, ${invalidChecks.length} invalid)`
        );
      }
      for (let i = 0; i < selfTests.length; i++) {
        const st = selfTests[i];
        const chkRes = await checkCaseOutput(
          checkerConfig,
          st.input,
          st.candidateOutput,
          st.expectedOutput
        );
        const passed = Boolean(chkRes.ok) === Boolean(st.shouldAccept) && !chkRes.judgeFailure;
        checkerSelfTestResults.push({
          index: i + 1,
          shouldAccept: Boolean(st.shouldAccept),
          actualAccept: Boolean(chkRes.ok),
          passed,
          comment: chkRes.comment
        });
        if (!passed) {
          throw new Error(
            `Semantic checker self-test #${i + 1} failed: expected accept=${st.shouldAccept}, got accept=${chkRes.ok} (${chkRes.comment})`
          );
        }
      }
    }

    const seenHashes = new Set();
    const casesManifest = [];
    const categoryCounts = {};
    const oracleCrossChecks = [];

    function recordCategory(cat) {
      const c = cat || 'generated';
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }

    // 2. Verify published samples against validator, reference solution, and oracle
    const samples = Array.isArray(statement.samples) ? statement.samples : [];
    for (let i = 0; i < samples.length; i++) {
      const sampleIn = normalizeInputText(samples[i].input);
      const sampleOut = normalizeInputText(samples[i].output);

      const valRun = await runSandboxedExecutable(valComp.exePath, sampleIn, {
        timeLimitMs: 3000,
        memoryLimitMb: 256
      });
      if (valRun.status !== 'OK' || valRun.exitCode !== 0) {
        throw new Error(
          `Sample #${i + 1} failed input validator (status=${valRun.status}, exit=${valRun.exitCode})`
        );
      }

      const refRun = await runSandboxedExecutable(refComp.exePath, sampleIn, {
        timeLimitMs: problemRow.time_limit_ms,
        memoryLimitMb: problemRow.memory_limit_mb
      });
      if (refRun.status !== 'OK') {
        throw new Error(`Reference solution failed on Sample #${i + 1}: ${refRun.status} (${refRun.detail || ''})`);
      }

      const refCheck = await checkCaseOutput(checkerConfig, sampleIn, refRun.stdout, sampleOut);
      if (!refCheck.ok) {
        throw new Error(
          `Reference solution output on Sample #${i + 1} disagreed with published sample output: ${refCheck.comment}`
        );
      }

      // Cross-check sample with oracle
      const oraRun = await runSandboxedExecutable(oraComp.exePath, sampleIn, {
        timeLimitMs: Math.max(problemRow.time_limit_ms, 3000),
        memoryLimitMb: problemRow.memory_limit_mb
      });
      if (oraRun.status === 'OK') {
        const oraCheck = await checkCaseOutput(checkerConfig, sampleIn, oraRun.stdout, refRun.stdout);
        if (!oraCheck.ok) {
          const disagreement = {
            caseName: `sample-${i + 1}`,
            category: 'sample',
            seed: null,
            input: sampleIn,
            referenceOutput: refRun.stdout,
            oracleOutput: oraRun.stdout,
            comment: oraCheck.comment
          };
          return await handleOracleDisagreement(db, problemRow, nextRev, stagingDir, finalPkgDir, disagreement);
        }
        oracleCrossChecks.push({ caseName: `sample-${i + 1}`, passed: true, comment: oraCheck.comment });
      }

      const idxStr = String(casesManifest.length + 1).padStart(3, '0');
      const inRel = `tests/${idxStr}-sample-${i + 1}.in`;
      const ansRel = `tests/${idxStr}-sample-${i + 1}.ans`;
      fs.writeFileSync(path.join(stagingDir, inRel), sampleIn, 'utf8');
      fs.writeFileSync(path.join(stagingDir, ansRel), normalizeInputText(refRun.stdout), 'utf8');

      seenHashes.add(sha256Text(sampleIn));
      recordCategory('sample');
      casesManifest.push({
        index: casesManifest.length + 1,
        name: `sample-${i + 1}`,
        category: 'sample',
        isSample: true,
        seed: null,
        inputFile: inRel,
        answerFile: ansRel
      });
    }

    // 3. Generate, validate, deduplicate, and cross-check generated test cases using Python generator
    const rawSeeds = Array.isArray(plan.seeds) ? plan.seeds : [];
    const plannedSeeds = [];
    const seenSeedNums = new Set();
    for (const s of rawSeeds) {
      const sv = Number(typeof s === 'object' ? s.seed : s);
      if (!Number.isInteger(sv) || seenSeedNums.has(sv)) continue;
      seenSeedNums.add(sv);
      plannedSeeds.push({
        seed: sv,
        category: (typeof s === 'object' ? s.category : null) || 'generated'
      });
    }
    const fallbackCategories = [
      'minimum',
      'boundary',
      'ties',
      'special_structure',
      'anti_greedy_plausible_wrong',
      'maximum',
      'stress_max_complexity'
    ];
    let nextExtraSeed = 1;
    const minPlannedCount = targetCount + 80;
    while (plannedSeeds.length < minPlannedCount) {
      while (seenSeedNums.has(nextExtraSeed)) nextExtraSeed++;
      seenSeedNums.add(nextExtraSeed);
      plannedSeeds.push({
        seed: nextExtraSeed,
        category: fallbackCategories[nextExtraSeed % fallbackCategories.length]
      });
      nextExtraSeed++;
    }

    const usedSeeds = [];
    let generatedCount = 0;
    const isExhaustiveSmallDomain = plannedSeeds.some((s) => s.category === 'exhaustive');
    const desiredGenerated = isExhaustiveSmallDomain
      ? Math.min(99, Math.max(targetCount, 99))
      : targetCount;

    const BATCH_SIZE = 16;
    for (let bStart = 0; bStart < plannedSeeds.length && generatedCount < desiredGenerated; bStart += BATCH_SIZE) {
      const batch = plannedSeeds.slice(bStart, bStart + BATCH_SIZE).map((seedItem) => ({
        seed: typeof seedItem === 'object' ? seedItem.seed : seedItem,
        category: (typeof seedItem === 'object' ? seedItem.category : null) || 'generated'
      }));

      const pyBatchRuns = await runSandboxedPythonGeneratorBatch(genScriptPath, batch, {
        memoryLimitMb: 512,
        outputLimitBytes: 32 * 1024 * 1024
      });

      const batchResults = await Promise.all(
        batch.map(async (seedItem, idx) => {
          const seedVal = seedItem.seed;
          const category = seedItem.category;
          const genRun = pyBatchRuns[idx];
          if (!genRun || genRun.status !== 'OK') {
            const errDetail = [genRun?.stderr?.trim(), genRun?.detail].filter(Boolean).join(' | ');
            throw new Error(`Python generator failed on seed ${seedVal} (${category}): ${genRun?.status || 'FAIL'}${errDetail ? ` (${errDetail})` : ''}`);
          }
          const normIn = normalizeInputText(genRun.stdout);
          if (!normIn) return null;
          const hash = sha256Text(normIn);

          const [valRun, refRun] = await Promise.all([
            runSandboxedExecutable(valComp.exePath, normIn, { timeLimitMs: 3000, memoryLimitMb: 256 }),
            runSandboxedExecutable(refComp.exePath, normIn, {
              timeLimitMs: problemRow.time_limit_ms,
              memoryLimitMb: problemRow.memory_limit_mb
            })
          ]);
          if (valRun.status !== 'OK' || valRun.exitCode !== 0) {
            const valErr = [valRun.stderr?.trim(), valRun.detail].filter(Boolean).join(' | ');
            const preview = normIn.slice(0, 120).replace(/\n/g, '\\n');
            throw new Error(
              `Generated input for seed ${seedVal} (category=${category}) failed validator (status=${valRun.status}, exit=${valRun.exitCode}${valErr ? `, ${valErr}` : ''}, preview="${preview}")`
            );
          }
          if (refRun.status !== 'OK') {
            throw new Error(
              `Reference solution failed on generated seed ${seedVal} (category=${category}): ${refRun.status}${refRun.detail ? ` (${refRun.detail})` : ''}`
            );
          }
          return {
            seedVal,
            category,
            normIn,
            hash,
            normAns: normalizeInputText(refRun.stdout)
          };
        })
      );

      for (const item of batchResults) {
        if (!item || generatedCount >= desiredGenerated) continue;
        const { seedVal, category, normIn, hash, normAns } = item;
        if (seenHashes.has(hash)) continue;

        // Cross-check small non-stress cases with independent brute-force oracle
        const oracleEligible =
          category !== 'maximum' &&
          category !== 'stress_max_complexity' &&
          normIn.length <= 4096;
        if (oracleCrossChecks.length < 15 && oracleEligible) {
          const oraRun = await runSandboxedExecutable(oraComp.exePath, normIn, {
            timeLimitMs: Math.max(problemRow.time_limit_ms, 3000),
            memoryLimitMb: problemRow.memory_limit_mb
          });
          if (oraRun.status === 'OK') {
            const oraCheck = await checkCaseOutput(checkerConfig, normIn, oraRun.stdout, normAns);
            if (!oraCheck.ok) {
              const disagreement = {
                caseName: `gen-${generatedCount + 1}`,
                category,
                seed: seedVal,
                input: normIn,
                referenceOutput: normAns,
                oracleOutput: normalizeInputText(oraRun.stdout),
                comment: oraCheck.comment
              };
              return await handleOracleDisagreement(
                db,
                problemRow,
                nextRev,
                stagingDir,
                finalPkgDir,
                disagreement
              );
            }
            oracleCrossChecks.push({
              caseName: `gen-${generatedCount + 1}`,
              seed: seedVal,
              category,
              passed: true,
              comment: oraCheck.comment
            });
          } else if (oraRun.status !== 'TLE') {
            throw new Error(
              `Brute-force oracle failed on small generated seed ${seedVal}: ${oraRun.status} (${oraRun.detail || ''})`
            );
          }
        }

        seenHashes.add(hash);
        generatedCount++;
        usedSeeds.push({ seed: seedVal, category, sha256: hash.slice(0, 16) });
        recordCategory(category);

        const idxStr = String(casesManifest.length + 1).padStart(3, '0');
        const inRel = `tests/${idxStr}-${category}-s${seedVal}.in`;
        const ansRel = `tests/${idxStr}-${category}-s${seedVal}.ans`;
        fs.writeFileSync(path.join(stagingDir, inRel), normIn, 'utf8');
        fs.writeFileSync(path.join(stagingDir, ansRel), normAns, 'utf8');

        casesManifest.push({
          index: casesManifest.length + 1,
          name: `test-${casesManifest.length + 1}`,
          category,
          isSample: false,
          seed: seedVal,
          inputFile: inRel,
          answerFile: ansRel
        });
      }
    }

    if (generatedCount < Math.min(targetCount, desiredGenerated)) {
      throw new Error(
        `Insufficient distinct valid generated cases: got ${generatedCount}, required ${Math.min(targetCount, desiredGenerated)}`
      );
    }

    // 4. Verify representative incorrect solutions are rejected by the suite
    const wrongResults = [];
    const wrongList = Array.isArray(plan.wrongSolutions) ? plan.wrongSolutions : [];
    for (let wIdx = 0; wIdx < wrongList.length; wIdx++) {
      const ws = wrongList[wIdx];
      const wName = ws.name || `wrong-${wIdx + 1}`;
      fs.writeFileSync(
        path.join(stagingDir, 'wrong_solutions', `${wName}.cpp`),
        ws.sourceCpp || '',
        'utf8'
      );
      const wComp = await compileCpp23(ws.sourceCpp || '', stagingDir, `wrong_${wIdx}.exe`);
      if (!wComp.ok) {
        throw new Error(`Representative wrong solution '${wName}' failed to compile: ${wComp.diagnostics}`);
      }

      let caughtOnTest = null;
      let caughtVerdict = 'AC';
      for (const tc of casesManifest) {
        const tcIn = fs.readFileSync(path.join(stagingDir, tc.inputFile), 'utf8');
        const tcAns = fs.readFileSync(path.join(stagingDir, tc.answerFile), 'utf8');
        const wRun = await runSandboxedExecutable(wComp.exePath, tcIn, {
          timeLimitMs: problemRow.time_limit_ms,
          memoryLimitMb: problemRow.memory_limit_mb
        });
        if (wRun.status !== 'OK') {
          caughtOnTest = tc.index;
          caughtVerdict = wRun.status;
          break;
        }
        const wChk = await checkCaseOutput(checkerConfig, tcIn, wRun.stdout, tcAns);
        if (!wChk.ok) {
          caughtOnTest = tc.index;
          caughtVerdict = 'WA';
          break;
        }
      }
      try {
        fs.rmSync(wComp.exePath, { force: true });
      } catch {}

      if (!caughtOnTest) {
        throw new Error(
          `Representative incorrect solution '${wName}' passed all ${casesManifest.length} test cases without being caught!`
        );
      }
      wrongResults.push({
        name: wName,
        rejected: true,
        verdict: caughtVerdict,
        caughtOnTest
      });
    }

    // Cleanup temporary tool build dirs except checker.exe
    for (const tmpBin of ['build-val', 'build-ref', 'build-ora', 'solution.cpp', 'compile.out', 'compile.err']) {
      try {
        fs.rmSync(path.join(stagingDir, tmpBin), { recursive: true, force: true });
      } catch {}
    }

    const validationReport = {
      valid: true,
      provider: aiRes.provider,
      providerLabel: aiRes.label,
      isFixture: aiRes.isFixture,
      generatorLanguage: 'python',
      generatorFile: 'src/generator.py',
      pythonVersion: genCheck.pythonVersion || null,
      planSummary: plan.planSummary,
      sampleCount: samples.length,
      generatedCount,
      totalCases: casesManifest.length,
      categoriesCovered: Object.keys(categoryCounts),
      categoryCounts,
      checkerType: checkerConfig.type,
      checkerSelfTests: checkerSelfTestResults,
      oracleCrossCheckCount: oracleCrossChecks.length,
      oracleDisagreement: null,
      wrongSolutionsTested: wrongResults,
      validatedAt: getNowMs()
    };

    const manifest = {
      problemId: problemRow.id,
      contestId: problemRow.contest_id,
      problemIndex: problemRow.problem_index,
      revision: nextRev,
      createdAt: getNowMs(),
      generator: {
        language: 'python',
        file: 'src/generator.py'
      },
      checker: {
        type: checkerConfig.type,
        eps: checkerConfig.eps
      },
      cases: casesManifest
    };

    fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(stagingDir, 'seeds.json'), JSON.stringify(usedSeeds, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(stagingDir, 'validation.json'),
      JSON.stringify(validationReport, null, 2),
      'utf8'
    );

    // 5. Atomic package publish: rename stagingDir -> finalPkgDir and flip active_package_rev
    fs.renameSync(stagingDir, finalPkgDir);

    const categoriesList = Object.keys(categoryCounts);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        "UPDATE test_packages SET status = 'superseded' WHERE problem_id = ? AND status = 'published' AND revision != ?"
      ).run(problemRow.id, nextRev);

      db.prepare(
        `UPDATE test_packages
         SET status = 'published',
             provider = ?,
             checker_type = ?,
             checker_eps = ?,
             sample_count = ?,
             generated_count = ?,
             categories_json = ?,
             seeds_json = ?,
             validation_json = ?,
             package_dir = ?
         WHERE problem_id = ? AND revision = ?`
      ).run(
        aiRes.provider,
        checkerConfig.type,
        checkerConfig.eps,
        samples.length,
        generatedCount,
        JSON.stringify(categoriesList),
        JSON.stringify(usedSeeds),
        JSON.stringify(validationReport),
        finalPkgDir,
        problemRow.id,
        nextRev
      );

      db.prepare(
        `UPDATE problems
         SET active_package_rev = ?,
             candidate_package_rev = ?,
             test_prep_status = 'ready',
             test_prep_error = NULL,
             updated_at = ?
         WHERE id = ?`
      ).run(nextRev, nextRev, getNowMs(), problemRow.id);
      db.exec('COMMIT');
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }

    return {
      ok: true,
      revision: nextRev,
      packageDir: finalPkgDir,
      validation: validationReport
    };
  } catch (err) {
    const failReport = {
      valid: false,
      error: err.message,
      failedAt: getNowMs()
    };
    db.prepare(
      "UPDATE test_packages SET status = 'failed_validation', validation_json = ? WHERE problem_id = ? AND revision = ?"
    ).run(JSON.stringify(failReport), problemRow.id, nextRev);

    db.prepare(
      "UPDATE problems SET test_prep_status = 'failed', test_prep_error = ?, updated_at = ? WHERE id = ?"
    ).run(err.message, getNowMs(), problemRow.id);

    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {}

    return {
      ok: false,
      revision: nextRev,
      error: err.message
    };
  }
}

async function handleOracleDisagreement(db, problemRow, nextRev, stagingDir, finalPkgDir, disagreement) {
  const errMsg = `Oracle disagreement on ${disagreement.caseName} (seed=${disagreement.seed ?? 'sample'}): reference output '${disagreement.referenceOutput.trim()}' != oracle output '${disagreement.oracleOutput.trim()}' (${disagreement.comment})`;
  const validationReport = {
    valid: false,
    error: errMsg,
    oracleDisagreement: disagreement,
    failedAt: getNowMs()
  };

  fs.writeFileSync(
    path.join(stagingDir, 'validation.json'),
    JSON.stringify(validationReport, null, 2),
    'utf8'
  );
  // Keep candidate dir on disk for inspection/reproduction, but mark failed_validation and keep out of active_package_rev!
  const failedDir = `${finalPkgDir}-failed`;
  fs.rmSync(failedDir, { recursive: true, force: true });
  fs.renameSync(stagingDir, failedDir);

  db.prepare(
    `UPDATE test_packages
     SET status = 'failed_validation',
         validation_json = ?,
         package_dir = ?
     WHERE problem_id = ? AND revision = ?`
  ).run(JSON.stringify(validationReport), failedDir, problemRow.id, nextRev);

  db.prepare(
    `UPDATE problems
     SET test_prep_status = 'failed',
         test_prep_error = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(errMsg, getNowMs(), problemRow.id);

  return {
    ok: false,
    revision: nextRev,
    oracleDisagreement: disagreement,
    error: errMsg
  };
}
