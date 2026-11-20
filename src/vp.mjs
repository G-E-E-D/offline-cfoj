import { getDb, getNowMs } from './db.mjs';

export function startVirtualParticipation({
  contestId,
  startInSeconds = 0,
  customStartTimeMs = null,
  durationSeconds = null,
  title = null
}) {
  const db = getDb();
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
  if (!contest) {
    throw new Error(`Contest ${contestId} is not imported yet`);
  }

  // Abandon any previous active/scheduled VP for the same contest if starting a fresh one
  db.prepare(
    "UPDATE virtual_participations SET status = 'finished' WHERE contest_id = ? AND status IN ('scheduled', 'active')"
  ).run(contestId);

  const problems = db
    .prepare('SELECT id, active_package_rev FROM problems WHERE contest_id = ? ORDER BY sort_order ASC')
    .all(contestId);
  const pinnedRevisions = {};
  for (const p of problems) {
    pinnedRevisions[p.id] = p.active_package_rev || 0;
  }

  const now = getNowMs();
  const startsAt =
    customStartTimeMs !== null && customStartTimeMs !== undefined
      ? Number(customStartTimeMs)
      : now + Math.max(0, Number(startInSeconds) || 0) * 1000;
  const duration = Math.max(5, Number(durationSeconds) || contest.duration_seconds || 7200);
  const endsAt = startsAt + duration * 1000;
  const initialStatus = startsAt > now ? 'scheduled' : 'active';

  const vpTitle = title || `${contest.title_en} (VP)`;
  const scoringType = contest.type === 'CF' ? 'CF' : 'ICPC';

  const info = db
    .prepare(
      `INSERT INTO virtual_participations (
        contest_id, title, scoring_type, status, starts_at, ends_at,
        duration_seconds, pinned_revisions_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      contestId,
      vpTitle,
      scoringType,
      initialStatus,
      startsAt,
      endsAt,
      duration,
      JSON.stringify(pinnedRevisions),
      now
    );

  const vpId = Number(info.lastInsertRowid);
  return getVpById(vpId);
}

export function getVpById(vpId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM virtual_participations WHERE id = ?').get(vpId);
  if (!row) return null;
  return enrichVpState(row);
}

export function getActiveContestVp(contestId) {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM virtual_participations WHERE contest_id = ? AND status != 'abandoned' ORDER BY id DESC"
    )
    .all(contestId);

  for (const r of rows) {
    const state = enrichVpState(r);
    if (state.phase === 'scheduled' || state.phase === 'active' || state.phase === 'judging_pending') {
      return state;
    }
  }
  return null;
}

export function getLatestContestVp(contestId) {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM virtual_participations WHERE contest_id = ? ORDER BY id DESC LIMIT 1')
    .get(contestId);
  return row ? enrichVpState(row) : null;
}

export function listVirtualParticipations(contestId = null) {
  const db = getDb();
  const rows = contestId
    ? db
        .prepare('SELECT * FROM virtual_participations WHERE contest_id = ? ORDER BY id DESC')
        .all(contestId)
    : db.prepare('SELECT * FROM virtual_participations ORDER BY id DESC LIMIT 50').all();
  return rows.map(enrichVpState);
}

export function enrichVpState(vpRow) {
  const db = getDb();
  const now = getNowMs();

  const pendingRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM submissions
       WHERE vp_id = ?
         AND submitted_at >= ?
         AND submitted_at <= ?
         AND status IN ('queued', 'compiling', 'running')`
    )
    .get(vpRow.id, vpRow.starts_at, vpRow.ends_at);
  const pendingCount = pendingRow?.cnt || 0;

  let phase = 'active';
  let dbStatus = vpRow.status;

  if (vpRow.status === 'abandoned') {
    phase = 'abandoned';
  } else if (now < vpRow.starts_at) {
    phase = 'scheduled';
    dbStatus = 'scheduled';
  } else if (now < vpRow.ends_at && vpRow.status !== 'finished') {
    phase = 'active';
    dbStatus = 'active';
  } else if (pendingCount > 0) {
    phase = 'judging_pending';
    dbStatus = 'active';
  } else {
    phase = 'finished';
    dbStatus = 'finished';
  }

  const standings = computeVpStandings(vpRow);

  if (dbStatus !== vpRow.status || (phase === 'finished' && !vpRow.finalized_at)) {
    const finAt = phase === 'finished' ? vpRow.finalized_at || now : null;
    db.prepare(
      `UPDATE virtual_participations
       SET status = ?,
           finalized_at = COALESCE(finalized_at, ?),
           final_score_json = ?
       WHERE id = ?`
    ).run(dbStatus, finAt, JSON.stringify(standings.localUserRow), vpRow.id);
    vpRow.status = dbStatus;
    if (finAt) vpRow.finalized_at = finAt;
  }

  const isScheduled = phase === 'scheduled';
  const isActive = phase === 'active';
  const isJudgingPending = phase === 'judging_pending';

  return {
    id: vpRow.id,
    contestId: vpRow.contest_id,
    title: vpRow.title,
    scoringType: vpRow.scoring_type,
    status: vpRow.status,
    phase,
    startsAt: vpRow.starts_at,
    endsAt: vpRow.ends_at,
    durationSeconds: vpRow.duration_seconds,
    nowMs: now,
    untilStartMs: Math.max(0, vpRow.starts_at - now),
    remainingMs: isScheduled ? vpRow.duration_seconds * 1000 : Math.max(0, vpRow.ends_at - now),
    elapsedSeconds: isScheduled
      ? 0
      : Math.min(vpRow.duration_seconds, Math.max(0, Math.floor((now - vpRow.starts_at) / 1000))),
    pendingSubmissions: pendingCount,
    finalizedAt: vpRow.finalized_at || null,
    pinnedRevisions: JSON.parse(vpRow.pinned_revisions_json || '{}'),
    integrity: {
      hideProblems: isScheduled,
      hideEditorials: isScheduled || isActive,
      hideTagsAndRatings: isScheduled || isActive,
      hidePrivateDiagnostics: isScheduled || isActive
    },
    standings
  };
}

export function computeVpStandings(vpRow) {
  const db = getDb();
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(vpRow.contest_id);
  const problems = db
    .prepare(
      'SELECT id, problem_index, title_en, title_zh, points, sort_order FROM problems WHERE contest_id = ? ORDER BY sort_order ASC'
    )
    .all(vpRow.contest_id);

  // Only submissions received by backend within [starts_at, ends_at] belong to the VP scoreboard
  const vpSubmissions = db
    .prepare(
      `SELECT *
       FROM submissions
       WHERE vp_id = ?
         AND submitted_at >= ?
         AND submitted_at <= ?
       ORDER BY submitted_at ASC, id ASC`
    )
    .all(vpRow.id, vpRow.starts_at, vpRow.ends_at);

  const scoringType = vpRow.scoring_type || contest?.type || 'ICPC';
  const durationMinutes = Math.max(1, Math.floor((vpRow.duration_seconds || 7200) / 60));

  let totalPoints = 0;
  let totalPenalty = 0;
  const problemResults = [];

  for (let idx = 0; idx < problems.length; idx++) {
    const p = problems[idx];
    const subs = vpSubmissions.filter((s) => s.problem_id === p.id);

    let solved = false;
    let solveTimeSeconds = null;
    let solveTimeMinutes = null;
    let rejectedCount = 0;
    let pendingCount = 0;
    let earnedPoints = 0;
    let problemPenalty = 0;

    for (const s of subs) {
      if (s.status !== 'final') {
        pendingCount++;
        continue;
      }
      if (s.verdict === 'AC') {
        solved = true;
        solveTimeSeconds = Math.max(0, Math.floor((s.submitted_at - vpRow.starts_at) / 1000));
        solveTimeMinutes = Math.floor(solveTimeSeconds / 60);
        if (scoringType === 'CF') {
          const base = Number(p.points) || (idx + 1) * 500;
          const decay = (base / (2 * durationMinutes)) * solveTimeMinutes;
          earnedPoints = Math.max(Math.round(base * 0.3), Math.round(base - decay - rejectedCount * 50));
        } else {
          earnedPoints = 1;
          problemPenalty = solveTimeMinutes + rejectedCount * 20;
        }
        break;
      }
      // Under Codeforces / ICPC rules, Compilation Error (CE) and Judge Failure (JF) do not incur a 20-minute penalty
      if (s.verdict !== 'CE' && s.verdict !== 'JF') {
        rejectedCount++;
      }
    }

    if (solved) {
      totalPoints += earnedPoints;
      totalPenalty += problemPenalty;
    }

    problemResults.push({
      problemId: p.id,
      problemIndex: p.problem_index,
      solved,
      points: earnedPoints,
      rejectedAttemptCount: rejectedCount,
      pendingCount,
      bestSubmissionTimeSeconds: solveTimeSeconds,
      solveTimeMinutes,
      penaltyMinutes: problemPenalty
    });
  }

  const localUserRow = {
    rank: 1,
    handle: 'You (Virtual Participant)',
    isLocalUser: true,
    participantType: 'VIRTUAL',
    points: totalPoints,
    penalty: totalPenalty,
    problemResults
  };

  let historicalRows = [];
  if (contest?.standings_json) {
    try {
      const rawRows = JSON.parse(contest.standings_json);
      historicalRows = rawRows.slice(0, 60).map((r) => ({
        rank: r.rank,
        handle: r.party?.members?.[0]?.handle || 'Contestant',
        isLocalUser: false,
        participantType: r.party?.participantType || 'CONTESTANT',
        points: r.points,
        penalty: r.penalty,
        problemResults: (r.problemResults || []).map((pr, i) => ({
          problemIndex: problems[i]?.problem_index || String.fromCharCode(65 + i),
          solved: (pr.points || 0) > 0,
          points: pr.points || 0,
          rejectedAttemptCount: pr.rejectedAttemptCount || 0,
          bestSubmissionTimeSeconds: pr.bestSubmissionTimeSeconds || null
        }))
      }));
    } catch {
      historicalRows = [];
    }
  }

  const combined = [localUserRow, ...historicalRows];
  combined.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    return (a.isLocalUser ? 0 : 1) - (b.isLocalUser ? 0 : 1);
  });

  combined.forEach((row, i) => {
    row.rank = i + 1;
  });

  return {
    scoringType,
    rulesDescriptionEn:
      scoringType === 'CF'
        ? 'Codeforces Dynamic Points: problem points decay with solve minute; -50 pts per wrong attempt (min 30% of base points). Tie-break by higher points.'
        : 'ICPC Rules: 1 point per solved problem. Penalty = solve time (in full minutes from VP start) + 20 minutes per eligible wrong attempt before first Accepted. Compilation Errors do not add penalty. Tie-break: most problems solved, then lowest total penalty.',
    rulesDescriptionZh:
      scoringType === 'CF'
        ? 'Codeforces 动态分值规则：题目得分随通过分钟数递减，每次错误提交扣 50 分（保底为题目基础分的 30%）。按总分从高到低排名。'
        : 'ICPC 赛制规则：每通过一题得 1 分。罚时 = 首次通过距开赛的整分钟数 + 首次通过前每次有效错误提交 × 20 分钟（编译错误 CE 不计罚时）。排名先按解题数降序，再按总罚时升序。',
    problems: problems.map((p) => ({
      id: p.id,
      index: p.problem_index,
      titleEn: p.title_en,
      titleZh: p.title_zh
    })),
    localUserRow,
    historicalCount: historicalRows.length,
    rows: combined
  };
}
