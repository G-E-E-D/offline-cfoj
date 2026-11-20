const I18N = {
  en: {
    appTitle: 'Offline CFOJ',
    navContests: 'Contests',
    navProblemset: 'Problemset',
    navSubmissions: 'Submissions',
    navSettings: 'Settings & Providers',
    langSwitchBtn: '中文 / EN (Current: EN)',
    importRoundTitle: 'Import a Codeforces Round by Contest ID',
    importRoundDesc: 'Enter a public finished contest ID (for example 4). Fetches statements, localizes assets, translates into Simplified Chinese, builds and validates 50+ test cases per batch problem, and writes local Markdown editorials.',
    contestIdPlaceholder: 'Contest ID (e.g. 4)',
    providerLabel: 'AI Provider',
    prepareRoundBtn: 'Prepare Round',
    importingBtn: 'Preparing Round...',
    uploadSavedHtmlLabel: 'Optional: Upload browser-saved problems.html (if site is offline/blocked)',
    contestsLibraryTitle: 'Prepared Contests Library',
    noContestsYet: 'No contests imported yet. Enter contest ID 4 above and click Prepare Round.',
    colContest: 'Contest',
    colProblems: 'Problems',
    colSolved: 'Solved',
    colReadiness: 'Offline Readiness',
    colDataLocation: 'Disk Data Location',
    colActions: 'Actions',
    offlineReadyBadge: 'OFFLINE READY',
    incompleteBadge: 'INCOMPLETE',
    openContestBtn: 'Open Contest',
    startVpBtn: 'Start Virtual Contest (VP)',
    scheduleVpBtn: 'Schedule VP',
    readEditorialBtn: 'Editorial (Markdown)',
    editorialLockedBtn: 'Editorial Locked (Active VP)',
    reimportBtn: 'Re-import / Resume',
    problemOrderTitle: 'Contest Problems & Local Readiness',
    colIndex: '#',
    colTitle: 'Title',
    colLimits: 'Time / Memory',
    colStages: 'Preparation Stages (Fetch / zh-CN / Tests / Editorial)',
    colJudgeCapability: 'Local Judging Mode',
    colStatus: 'Status',
    repairBtn: 'Repair',
    solvedBadge: 'SOLVED',
    attemptedBadge: 'ATTEMPTED',
    unsolvedBadge: 'UNSOLVED',
    spoilersHiddenBadge: 'Tags & Rating Hidden (Active VP)',
    vpActiveTitle: 'Virtual Participation in Progress',
    vpScheduledTitle: 'Virtual Participation Scheduled',
    vpFinishedTitle: 'Virtual Participation Completed (Finalized Scoreboard)',
    vpCountdownLabel: 'Time Remaining',
    vpStartsInLabel: 'Starts In',
    vpFinishEarlyBtn: 'Finish VP Now',
    vpStandingsTitle: 'Standings (Local VP + Historical Codeforces Comparison)',
    colRank: 'Rank',
    colParticipant: 'Participant',
    colPoints: 'Solved / Pts',
    colPenalty: 'Penalty',
    secInput: 'Input',
    secOutput: 'Output',
    secExamples: 'Examples',
    secNote: 'Note',
    copyBtn: 'Copy',
    copiedBtn: 'Copied!',
    compareEnBtn: 'Toggle Original English Comparison',
    missingZhBanner: 'Showing original English statement — Simplified Chinese translation is missing or failed protected-fragment validation.',
    regenerateZhBtn: 'Regenerate Chinese Translation',
    editorTitle: 'GNU C++23 Source Editor',
    insertTemplateBtn: 'C++23 Template',
    uploadCppBtn: 'Upload .cpp',
    runSamplesBtn: 'Run Samples (Unscored)',
    runCustomBtn: 'Run Custom Input (Unscored)',
    submitBtn: 'Submit to Local Judge',
    submittingBtn: 'Judging...',
    customInputLabel: 'Custom Input Data',
    sampleRunHeader: 'UNSCORED SAMPLE-ONLY RUN (Not recorded in submission history)',
    customRunHeader: 'UNSCORED CUSTOM INPUT RUN (Not recorded in submission history)',
    recentSubmissionsTitle: 'Problem Submissions',
    allSubmissionsTitle: 'All Local Submissions',
    colSubId: 'ID',
    colWhen: 'Time',
    colMode: 'Mode',
    colVerdict: 'Verdict',
    colRuntime: 'Time',
    colMemory: 'Memory',
    colPkgRev: 'Suite Rev',
    modeVp: 'VIRTUAL (VP)',
    modePractice: 'PRACTICE',
    editorialPageTitle: 'Whole-Round Local Markdown Editorial',
    editorialDiskFileLabel: 'Local Disk File:',
    viewRenderedTab: 'Rendered Editorial (Math & Diagrams)',
    viewRawMdTab: 'Raw Disk Markdown (.md)',
    filterContest: 'Contest ID',
    filterIndex: 'Index (A, B, A1...)',
    filterMinRating: 'Min Rating',
    filterMaxRating: 'Max Rating',
    filterTag: 'All Tags',
    filterStatus: 'All Solve Statuses',
    filterSearch: 'Search title or ID...',
    applyFilterBtn: 'Filter',
    resetFilterBtn: 'Reset',
    browserVerifyTitle: 'Human Verification Required in Browser (Cloudflare Challenge)',
    browserVerifyDesc: 'Contest metadata was imported, but Codeforces returned a browser challenge (cf-mitigated: challenge) for the problems page. Click "Continue in browser" to open the official contest problems page, complete verification until you see the statements, then click "Send this contest to CFOJ" in the extension.',
    continueInBrowserBtn: 'Continue in browser',
    fallbackUploadBtn: 'Fallback: Upload Saved problems.html',
    errCat_browser_challenge: 'Browser Verification Challenge (cf-mitigated: challenge)',
    errCat_rate_limited: 'Rate Limited by Codeforces (HTTP 429)',
    errCat_access_denied: 'Access Denied (HTTP 403/401 — Not a Browser Challenge)',
    errCat_network_failure: 'Network Connection Failure',
    errCat_parse_error: 'Statement Parsing / Problem List Validation Error',
    verdicts: {
      QUEUED: '[QUEUED] In Queue',
      COMPILING: '[COMPILING] Compiling GNU C++23...',
      RUNNING: '[RUNNING] Running Test',
      AC: '[AC] Accepted',
      WA: '[WA] Wrong Answer',
      CE: '[CE] Compilation Error',
      RE: '[RE] Runtime Error',
      TLE: '[TLE] Time Limit Exceeded',
      MLE: '[MLE] Memory Limit Exceeded',
      OLE: '[OLE] Output Limit Exceeded',
      JF: '[JF] Judge Failure',
      OK: '[OK] Executed'
    }
  },
  'zh-CN': {
    appTitle: 'Offline CFOJ 离线竞赛评测',
    navContests: '比赛题库',
    navProblemset: '日常题集',
    navSubmissions: '提交记录',
    navSettings: '设置与 AI 引擎',
    langSwitchBtn: 'EN / 中文 (当前: 中文)',
    importRoundTitle: '按比赛 ID 导入 Codeforces 整场比赛',
    importRoundDesc: '输入已结束的公开比赛数字 ID（如 4），自动抓取英文题面、本地化静态资源、翻译为简体中文并校验保护片段、为每道常规题生成并验证 50+ 组测试数据，同时生成整场本地 Markdown 题解。',
    contestIdPlaceholder: '比赛数字 ID（例如 4）',
    providerLabel: 'AI 提供商',
    prepareRoundBtn: '导入并准备整场比赛',
    importingBtn: '正在准备比赛数据...',
    uploadSavedHtmlLabel: '可选：上传浏览器保存的 problems.html（离线或受限环境下使用）',
    contestsLibraryTitle: '本地已准备的比赛库',
    noContestsYet: '尚未导入任何比赛。请在上方输入比赛 ID 4 并点击“导入并准备整场比赛”。',
    colContest: '比赛名称',
    colProblems: '题目数',
    colSolved: '已通过',
    colReadiness: '离线就绪状态',
    colDataLocation: '本地磁盘存储位置',
    colActions: '操作',
    offlineReadyBadge: '离线就绪 (OFFLINE READY)',
    incompleteBadge: '部分未就绪',
    openContestBtn: '进入比赛',
    startVpBtn: '开始虚拟参赛 (VP)',
    scheduleVpBtn: '预约开赛',
    readEditorialBtn: '查看题解 (Markdown)',
    editorialLockedBtn: '题解已锁定 (VP 进行中)',
    reimportBtn: '重新导入 / 断点续传',
    problemOrderTitle: '比赛题目与本地评测就绪状态',
    colIndex: '题号',
    colTitle: '题目名称',
    colLimits: '时间 / 内存限制',
    colStages: '准备进度（题面 / 中文翻译 / 测试数据 / 题解）',
    colJudgeCapability: '本地评测模式',
    colStatus: '状态',
    repairBtn: '修复 / 重试',
    solvedBadge: '已通过 (SOLVED)',
    attemptedBadge: '已尝试 (ATTEMPTED)',
    unsolvedBadge: '未提交 (UNSOLVED)',
    spoilersHiddenBadge: '标签与难度已隐藏 (VP 防剧透)',
    vpActiveTitle: '虚拟参赛 (VP) 进行中',
    vpScheduledTitle: '虚拟参赛 (VP) 已预约',
    vpFinishedTitle: '虚拟参赛 (VP) 已结束（成绩单已定格）',
    vpCountdownLabel: '剩余时间',
    vpStartsInLabel: '距开赛还有',
    vpFinishEarlyBtn: '提前结束虚拟赛',
    vpStandingsTitle: '排行榜（本地虚拟赛成绩 + Codeforces 历史榜单对比）',
    colRank: '排名',
    colParticipant: '选手',
    colPoints: '解题数 / 得分',
    colPenalty: '总罚时',
    secInput: '输入格式',
    secOutput: '输出格式',
    secExamples: '样例数据',
    secNote: '说明 / 提示',
    copyBtn: '复制',
    copiedBtn: '已复制!',
    compareEnBtn: '切换英文原题面对照',
    missingZhBanner: '当前显示英文原题面 — 简体中文翻译缺失或未通过受保护公式/字面量校验。',
    regenerateZhBtn: '重新生成中文翻译',
    editorTitle: 'GNU C++23 代码编辑器',
    insertTemplateBtn: '插入 C++23 模板',
    uploadCppBtn: '上传 .cpp 文件',
    runSamplesBtn: '运行样例 (仅样例·不计分)',
    runCustomBtn: '运行自定义输入 (不计分)',
    submitBtn: '提交评测 (完整本地测试集)',
    submittingBtn: '正在评测...',
    customInputLabel: '自定义测试输入',
    sampleRunHeader: '【仅样例测试运行 — 不计入正式提交历史】',
    customRunHeader: '【自定义输入运行 — 不计入正式提交历史】',
    recentSubmissionsTitle: '本题提交历史',
    allSubmissionsTitle: '全部本地提交记录',
    colSubId: '编号',
    colWhen: '提交时间',
    colMode: '模式',
    colVerdict: '评测结果 (Verdict)',
    colRuntime: '耗时',
    colMemory: '内存',
    colPkgRev: '数据包版本',
    modeVp: '虚拟赛 (VP)',
    modePractice: '日常练习 (Practice)',
    editorialPageTitle: '整场比赛本地 Markdown 题解阅读器',
    editorialDiskFileLabel: '本地磁盘文件路径：',
    viewRenderedTab: '渲染视图（公式与本地插图）',
    viewRawMdTab: '原始 Markdown 文件内容 (.md)',
    filterContest: '比赛 ID',
    filterIndex: '题号 (A, B, A1...)',
    filterMinRating: '最低难度',
    filterMaxRating: '最高难度',
    filterTag: '全部算法标签',
    filterStatus: '全部做题状态',
    filterSearch: '搜索题目名称或题号...',
    applyFilterBtn: '筛选',
    resetFilterBtn: '重置',
    browserVerifyTitle: '需要在浏览器中完成人工验证 (Cloudflare 验证挑战)',
    browserVerifyDesc: '比赛元数据已成功导入，但 Codeforces 对题面页返回了浏览器验证挑战 (cf-mitigated: challenge)。请点击下方“在浏览器中继续”打开官方完整题面页，完成验证并看到题目题面后，点击扩展按钮“发送本场比赛至 CFOJ”即可一键回传并自动继续准备。',
    continueInBrowserBtn: '在浏览器中继续 (Continue in browser)',
    fallbackUploadBtn: '备用方案：手动上传已保存的 problems.html',
    errCat_browser_challenge: '浏览器人工验证挑战 (cf-mitigated: challenge)',
    errCat_rate_limited: '服务器请求限流 (HTTP 429)',
    errCat_access_denied: '访问被拒绝 (HTTP 403/401 — 非浏览器验证挑战)',
    errCat_network_failure: '网络连接失败',
    errCat_parse_error: '题面解析或题号列表校验错误',
    verdicts: {
      QUEUED: '[QUEUED] 排队等待中',
      COMPILING: '[COMPILING] 正在编译 GNU C++23...',
      RUNNING: '[RUNNING] 正在运行测试点',
      AC: '[AC] 通过 (Accepted)',
      WA: '[WA] 答案错误 (Wrong Answer)',
      CE: '[CE] 编译错误 (Compilation Error)',
      RE: '[RE] 运行时错误 (Runtime Error)',
      TLE: '[TLE] 时间超限 (Time Limit Exceeded)',
      MLE: '[MLE] 内存超限 (Memory Limit Exceeded)',
      OLE: '[OLE] 输出超限 (Output Limit Exceeded)',
      JF: '[JF] 评测系统故障 (Judge Failure)',
      OK: '[OK] 运行完成'
    }
  }
};

const DEFAULT_CPP23_TEMPLATE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`;

const state = {
  lang: localStorage.getItem('cfoj_lang') || 'en',
  systemStatus: null,
  currentRoute: '',
  currentProblem: null,
  currentContest: null,
  currentEditorial: null,
  showEnglishComparison: false,
  editorialViewMode: 'rendered',
  activeVpTimer: null,
  draftSaveTimer: null,
  uploadedProblemsHtml: null
};

function t(key) {
  const dict = I18N[state.lang] || I18N.en;
  return dict[key] ?? I18N.en[key] ?? key;
}

function formatVerdict(verdict, currentTest = 0, totalTests = 0, firstFailedTest = null) {
  const dict = (I18N[state.lang] || I18N.en).verdicts;
  const base = dict[verdict] || `[${verdict}] ${verdict}`;
  if (verdict === 'RUNNING' && currentTest > 0) {
    return state.lang === 'zh-CN'
      ? `${base} #${currentTest}/${totalTests || '?'}`
      : `${base} #${currentTest}/${totalTests || '?'}`;
  }
  if (verdict !== 'AC' && verdict !== 'CE' && verdict !== 'QUEUED' && verdict !== 'COMPILING' && firstFailedTest) {
    return state.lang === 'zh-CN'
      ? `${base} (于测试点 #${firstFailedTest})`
      : `${base} on test #${firstFailedTest}`;
  }
  return base;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDurationClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMemory(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(b / 1024)} KB`;
}

// Local KaTeX math rendering for Codeforces $$$...$$$, $$...$$, and $...$
export function renderMathInHtml(html) {
  if (!html) return '';
  const katexObj = globalThis.katex;
  const renderTex = (tex, displayMode) => {
    const clean = tex
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
    if (!katexObj || typeof katexObj.renderToString !== 'function') {
      return `<code class="math-fallback">${escapeHtml(clean)}</code>`;
    }
    try {
      return katexObj.renderToString(clean, {
        displayMode,
        throwOnError: false,
        strict: false
      });
    } catch {
      return `<code class="math-fallback">${escapeHtml(clean)}</code>`;
    }
  };

  // Protect <pre> and <code> blocks before math replacement
  const protectedBlocks = [];
  let out = html.replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
    const token = `@@CFOJ_CODE_${protectedBlocks.length}@@`;
    protectedBlocks.push(m);
    return token;
  });

  // 1. Codeforces $$$...$$$
  out = out.replace(/\$\$\$([\s\S]*?)\$\$\$/g, (_, tex) => renderTex(tex, false));
  // 2. Display $$...$$
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => renderTex(tex, true));
  // 3. Inline $...$ (single line)
  out = out.replace(/\$([^\$\n]+?)\$/g, (_, tex) => renderTex(tex, false));

  // Restore protected code blocks
  out = out.replace(/@@CFOJ_CODE_(\d+)@@/g, (_, idx) => protectedBlocks[Number(idx)]);
  return out;
}

// Lightweight local Markdown -> HTML renderer with relative asset path resolution & anchor IDs
export function renderMarkdownToHtml(mdText, contestId) {
  if (!mdText) return '';
  const lines = mdText.replace(/\r\n/g, '\n').split('\n');
  const htmlOut = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      htmlOut.push('</ul>');
      inList = false;
    }
  };

  const formatInline = (text) => {
    let s = escapeHtml(text);
    // Images ![alt](src) with relative assets/... resolution
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      let resolvedSrc = src.trim();
      if (resolvedSrc.startsWith('assets/') && contestId) {
        resolvedSrc = `/api/contests/${contestId}/${resolvedSrc}`;
      }
      return `<img src="${resolvedSrc}" alt="${alt}" class="editorial-img" />`;
    });
    // Links [text](href)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const h = href.trim();
      if (h.startsWith('#problem-')) {
        return `<a href="javascript:void(0)" data-scroll-target="${h.slice(1)}">${label}</a>`;
      }
      return `<a href="${h}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    // Inline code `...`
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **...**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *...*
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      closeList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        htmlOut.push(
          `<pre data-lang="${escapeHtml(codeLang)}"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
        );
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      let rawTitle = headingMatch[2].trim();
      let idAttr = '';
      const anchorMatch = rawTitle.match(/\{#([a-zA-Z0-9_-]+)\}\s*$/);
      if (anchorMatch) {
        idAttr = ` id="${escapeHtml(anchorMatch[1])}"`;
        rawTitle = rawTitle.slice(0, anchorMatch.index).trim();
      }
      htmlOut.push(`<h${level}${idAttr}>${formatInline(rawTitle)}</h${level}>`);
      continue;
    }

    if (/^---+\s*$/.test(line.trim())) {
      closeList();
      htmlOut.push('<hr style="border:0;border-top:1px solid var(--border);margin:1.25rem 0;" />');
      continue;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        htmlOut.push('<ul>');
        inList = true;
      }
      htmlOut.push(`<li>${formatInline(line.trim().slice(2))}</li>`);
      continue;
    }

    if (line.trim().startsWith('> ')) {
      closeList();
      htmlOut.push(`<blockquote>${formatInline(line.trim().slice(2))}</blockquote>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    htmlOut.push(`<p>${formatInline(line)}</p>`);
  }
  closeList();

  return renderMathInHtml(htmlOut.join('\n'));
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.locked) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return { status: res.status, ok: res.ok, data };
}

function updateTopbarChrome() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    el.textContent = t(k);
  });
  const langLabel = document.getElementById('lang-toggle-label');
  if (langLabel) langLabel.textContent = t('langSwitchBtn');

  const hash = location.hash || '#/contests';
  document.querySelectorAll('.main-nav .nav-link').forEach((a) => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', hash.startsWith(href));
  });
}

async function refreshSystemStatus() {
  try {
    const { data } = await apiFetch('/api/status');
    state.systemStatus = data;
    const pill = document.getElementById('env-status-pill');
    if (pill) {
      pill.textContent = data.judgeEnvironment?.ok
        ? 'GNU C++23 Ready (AppContainer)'
        : 'Judge Setup Needed';
      pill.className = `env-pill ${data.judgeEnvironment?.ok ? 'badge-ok' : 'badge-err'}`;
    }
    const vpPill = document.getElementById('active-vp-banner-pill');
    if (vpPill) {
      const activeVp = data.activeVps?.[0];
      if (activeVp) {
        vpPill.classList.remove('hidden');
        const clock =
          activeVp.phase === 'scheduled'
            ? `${t('vpStartsInLabel')} ${formatDurationClock(activeVp.untilStartMs)}`
            : `${t('vpCountdownLabel')} ${formatDurationClock(activeVp.remainingMs)}`;
        vpPill.textContent = `VP #${activeVp.contestId} • ${clock}`;
        vpPill.onclick = () => {
          location.hash = `#/contest/${activeVp.contestId}`;
        };
      } else {
        vpPill.classList.add('hidden');
      }
    }
  } catch {}
}

// Switch interface and statement/editorial language in 1 click without losing draft, route, scroll, or VP
async function toggleLanguage() {
  const editorEl = document.getElementById('code-editor-textarea');
  const customInEl = document.getElementById('custom-input-textarea');
  const savedDraftText = editorEl ? editorEl.value : null;
  const savedCustomIn = customInEl ? customInEl.value : null;
  const savedScrollY = window.scrollY;

  state.lang = state.lang === 'en' ? 'zh-CN' : 'en';
  localStorage.setItem('cfoj_lang', state.lang);
  updateTopbarChrome();

  // Persist to backend asynchronously
  apiFetch('/api/settings', {
    method: 'POST',
    body: JSON.stringify({ ui_language: state.lang })
  }).catch(() => {});

  // Re-render current view from in-memory / disk state without re-fetching network
  if (state.currentProblem && location.hash.startsWith('#/problem/')) {
    renderProblemViewFromData(state.currentProblem, savedDraftText, savedCustomIn);
  } else if (state.currentEditorial && location.hash.startsWith('#/editorial/')) {
    renderEditorialViewFromData(state.currentEditorial);
  } else if (state.currentContest && location.hash.startsWith('#/contest/')) {
    renderContestViewFromData(state.currentContest);
  } else {
    await handleRouteChange(false);
  }

  window.scrollTo(0, savedScrollY);
}

// View 1: Contests Dashboard & Import Round
async function renderContestsDashboard() {
  const main = document.getElementById('app-main');
  const [{ data: contestsData }, { data: provData }] = await Promise.all([
    apiFetch('/api/contests'),
    apiFetch('/api/providers/status')
  ]);

  const selectedProvider = provData.selectedProvider || 'codex';
  const activeVp = state.systemStatus?.activeVps?.[0] || null;

  main.innerHTML = `
    ${
      activeVp
        ? `<div class="alert alert-warn" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
            <div>
              <strong>${activeVp.phase === 'scheduled' ? t('vpScheduledTitle') : t('vpActiveTitle')}:</strong>
              Contest #${activeVp.contestId} (${escapeHtml(activeVp.title)}) —
              <span style="font-family:var(--font-mono);font-weight:700;">
                ${activeVp.phase === 'scheduled' ? formatDurationClock(activeVp.untilStartMs) : formatDurationClock(activeVp.remainingMs)}
              </span>
            </div>
            <a href="#/contest/${activeVp.contestId}" class="btn btn-warning btn-sm">${t('openContestBtn')}</a>
          </div>`
        : ''
    }

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">${t('importRoundTitle')}</h2>
        <span class="badge badge-info">Codex (codex exec) &amp; Antigravity (agy -p)</span>
      </div>
      <p style="margin:0 0 1rem 0;color:var(--text-secondary);">${t('importRoundDesc')}</p>
      <form id="import-contest-form" style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;">
        <input
          type="text"
          id="import-contest-id-input"
          value="4"
          placeholder="${escapeHtml(t('contestIdPlaceholder'))}"
          aria-label="Contest ID"
          style="width:210px;font-family:var(--font-mono);font-weight:600;"
          required
        />
        <label style="display:inline-flex;align-items:center;gap:0.4rem;color:var(--text-secondary);font-size:0.9rem;">
          <span>${t('providerLabel')}:</span>
          <select id="import-provider-select">
            <option value="codex" ${selectedProvider === 'codex' ? 'selected' : ''}>OpenAI Codex (codex exec)</option>
            <option value="antigravity" ${selectedProvider === 'antigravity' ? 'selected' : ''}>Google Antigravity (agy -p)</option>
          </select>
        </label>
        <button type="submit" id="import-contest-btn" class="btn btn-primary">${t('prepareRoundBtn')}</button>
        <label class="btn btn-sm" style="cursor:pointer;">
          <span>${t('uploadSavedHtmlLabel')}</span>
          <input type="file" id="import-html-file" accept=".html,.htm" class="hidden" />
        </label>
        <span id="uploaded-html-indicator" class="badge hidden"></span>
      </form>
      <div id="import-progress-box" class="hidden" style="margin-top:1rem;"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">${t('contestsLibraryTitle')}</h2>
        <a href="#/problemset" class="btn btn-sm">${t('navProblemset')} &rarr;</a>
      </div>
      ${
        contestsData.contests.length === 0
          ? `<p style="color:var(--text-muted);">${t('noContestsYet')}</p>`
          : `<div class="table-wrap">
              <table class="data-table" id="contests-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>${t('colContest')}</th>
                    <th>${t('colProblems')}</th>
                    <th>${t('colSolved')}</th>
                    <th>${t('colReadiness')}</th>
                    <th>${t('colDataLocation')}</th>
                    <th>${t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${contestsData.contests
                    .map((c) => {
                      const title = state.lang === 'zh-CN' ? c.titleZh || c.titleEn : c.titleEn;
                      return `<tr>
                        <td style="font-family:var(--font-mono);font-weight:700;">#${c.id}</td>
                        <td>
                          <a href="#/contest/${c.id}" style="font-weight:600;font-size:1rem;">${escapeHtml(title)}</a>
                          <div style="font-size:0.8rem;color:var(--text-muted);">${c.type} • ${Math.round(c.durationSeconds / 60)} min</div>
                        </td>
                        <td style="font-family:var(--font-mono);">${c.problemCount}</td>
                        <td style="font-family:var(--font-mono);">${c.solvedCount} / ${c.problemCount}</td>
                        <td>
                          <span class="badge ${c.offlineReady ? 'badge-ok' : 'badge-warn'}">
                            ${c.offlineReady ? t('offlineReadyBadge') : t('incompleteBadge')}
                          </span>
                        </td>
                        <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);">
                          ${escapeHtml(c.dataDir)}
                        </td>
                        <td>
                          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                            <a href="#/contest/${c.id}" class="btn btn-primary btn-sm">${t('openContestBtn')}</a>
                            <a href="#/editorial/${c.id}" class="btn btn-sm">${t('readEditorialBtn')}</a>
                          </div>
                        </td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>`
      }
    </div>
  `;

  const htmlFileInput = document.getElementById('import-html-file');
  const htmlIndicator = document.getElementById('uploaded-html-indicator');
  state.uploadedProblemsHtml = null;
  if (htmlFileInput) {
    htmlFileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      state.uploadedProblemsHtml = await file.text();
      if (htmlIndicator) {
        htmlIndicator.textContent = `Loaded ${file.name} (${state.uploadedProblemsHtml.length} bytes)`;
        htmlIndicator.classList.remove('hidden');
      }
    };
  }

  const form = document.getElementById('import-contest-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const cid = document.getElementById('import-contest-id-input').value.trim();
      const prov = document.getElementById('import-provider-select').value;
      const btn = document.getElementById('import-contest-btn');
      const progBox = document.getElementById('import-progress-box');
      btn.disabled = true;
      btn.textContent = t('importingBtn');
      progBox.classList.remove('hidden');
      progBox.innerHTML = `<div class="alert alert-info">Preparing contest ${escapeHtml(cid)} with ${escapeHtml(prov)}...</div>`;

      try {
        const { data } = await apiFetch('/api/contests/import', {
          method: 'POST',
          body: JSON.stringify({
            contestId: cid,
            provider: prov,
            uploadedProblemsHtml: state.uploadedProblemsHtml
          })
        });
        await refreshSystemStatus();
        if (data.status === 'awaiting_browser' || data.contestId) {
          location.hash = `#/contest/${data.contestId || cid}`;
          return;
        }
        location.hash = `#/contest/${cid}`;
      } catch (err) {
        progBox.innerHTML = `<div class="alert alert-err">${escapeHtml(err.message)}</div>`;
        btn.disabled = false;
        btn.textContent = t('prepareRoundBtn');
      }
    };
  }
}

// View 2: Single Contest Page (Problems, Readiness Matrix, Virtual Participation, Scoreboard)
async function loadAndRenderContestView(contestId) {
  const { data } = await apiFetch(`/api/contests/${contestId}`);
  state.currentContest = data;
  renderContestViewFromData(data);
}

function renderContestViewFromData(contest) {
  const main = document.getElementById('app-main');
  const title = state.lang === 'zh-CN' ? contest.titleZh || contest.titleEn : contest.titleEn;
  const activeVp = contest.activeVp;
  const latestVp = contest.latestVp;
  const vpToShow = activeVp || latestVp;

  const renderStagePill = (label, stObj) => {
    const st = stObj?.status || 'pending';
    const cls =
      st === 'ready'
        ? 'badge-ok'
        : st === 'failed'
          ? 'badge-err'
          : st === 'running'
            ? 'badge-info'
            : 'badge-warn';
    const disp = st === 'awaiting_browser'
      ? (state.lang === 'zh-CN' ? '待浏览器验证' : 'AWAITING BROWSER')
      : st.toUpperCase();
    return `<span class="badge ${cls}" title="${escapeHtml(stObj?.error || st)}">${label}: ${disp}</span>`;
  };

  const bVer = contest.browserVerification || contest.lastImportJob?.steps?.browserVerification || null;
  const lastErrCat = contest.lastImportJob?.steps?.errorCategory || null;
  const lastErrMsg =
    state.lang === 'zh-CN'
      ? contest.lastImportJob?.steps?.errorMessageZh || contest.lastImportJob?.error
      : contest.lastImportJob?.steps?.errorMessage || contest.lastImportJob?.error;
  const continueHref = bVer
    ? `${bVer.targetUrl}#cfoj_token=${encodeURIComponent(bVer.token)}&cfoj_contest=${encodeURIComponent(contest.contestId)}&cfoj_origin=${encodeURIComponent(location.origin)}`
    : `https://codeforces.com/contest/${contest.contestId}/problems?locale=en`;

  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
            <span class="badge badge-info">#${contest.contestId}</span>
            <h1 class="card-title" style="font-size:1.4rem;">${escapeHtml(title)}</h1>
            <span class="badge ${contest.offlineReady ? 'badge-ok' : 'badge-warn'}" id="contest-offline-badge">
              ${contest.offlineReady ? t('offlineReadyBadge') : t('incompleteBadge')}
            </span>
          </div>
          <div style="font-size:0.86rem;color:var(--text-secondary);margin-top:0.35rem;">
            ${contest.type} • ${Math.round(contest.durationSeconds / 60)} min •
            <strong>${t('colDataLocation')}:</strong>
            <code style="font-family:var(--font-mono);">${escapeHtml(contest.dataLocation)}</code>
          </div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;">
            Editorial Markdown files:
            <code>${escapeHtml(contest.editorialFiles?.enPath || '')}</code> |
            <code>${escapeHtml(contest.editorialFiles?.zhPath || '')}</code>
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          ${
            !activeVp
              ? `<button type="button" id="start-vp-now-btn" class="btn btn-primary">${t('startVpBtn')}</button>
                 <button type="button" id="schedule-vp-btn" class="btn">${t('scheduleVpBtn')}</button>`
              : `<button type="button" id="finish-vp-now-btn" class="btn btn-warning">${t('vpFinishEarlyBtn')}</button>`
          }
          ${
            activeVp?.integrity?.hideEditorials
              ? `<button type="button" class="btn" disabled title="Locked during active Virtual Participation">${t('editorialLockedBtn')}</button>`
              : `<a href="#/editorial/${contest.contestId}" id="open-editorial-link" class="btn">${t('readEditorialBtn')}</a>`
          }
          <button type="button" id="reimport-contest-btn" class="btn btn-sm">${t('reimportBtn')}</button>
        </div>
      </div>

      ${
        contest.awaitingBrowserVerification && bVer
          ? `<div class="alert alert-warn" id="browser-verification-panel" style="margin-top:0.85rem;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:0.85rem;">
                <div style="flex:1;min-width:280px;">
                  <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.35rem;">
                    <strong>${t('browserVerifyTitle')}</strong>
                    <span class="badge badge-warn">cf-mitigated: challenge</span>
                    <span class="badge">Expected: ${escapeHtml((bVer.expectedIndices || []).join(', '))}</span>
                  </div>
                  <div style="font-size:0.88rem;line-height:1.55;">${t('browserVerifyDesc')}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.45rem;align-items:flex-end;">
                  <a
                    href="${escapeHtml(continueHref)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    id="continue-in-browser-btn"
                    data-target-url="${escapeHtml(continueHref)}"
                    data-token="${escapeHtml(bVer.token)}"
                    class="btn btn-primary"
                  >
                    ${t('continueInBrowserBtn')} &nearr;
                  </a>
                  <label class="btn btn-sm" style="cursor:pointer;">
                    <span>${t('fallbackUploadBtn')}</span>
                    <input type="file" id="contest-fallback-html-file" accept=".html,.htm" class="hidden" />
                  </label>
                </div>
              </div>
            </div>`
          : lastErrCat && lastErrCat !== 'browser_challenge' && !contest.offlineReady
            ? `<div class="alert alert-err" id="import-error-category-banner" data-error-category="${escapeHtml(lastErrCat)}" style="margin-top:0.85rem;">
                <div><strong>${escapeHtml(t('errCat_' + lastErrCat) || lastErrCat)}:</strong> ${escapeHtml(lastErrMsg || '')}</div>
              </div>`
            : ''
      }

      ${
        vpToShow
          ? `<div class="alert ${activeVp ? 'alert-warn' : 'alert-ok'}" id="vp-status-panel" style="margin-top:0.75rem;">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
                <div>
                  <strong>${
                    vpToShow.phase === 'scheduled'
                      ? t('vpScheduledTitle')
                      : vpToShow.phase === 'active' || vpToShow.phase === 'judging_pending'
                        ? t('vpActiveTitle')
                        : t('vpFinishedTitle')
                  }</strong>
                  <span class="badge" style="margin-left:0.5rem;">VP #${vpToShow.id} (${vpToShow.scoringType})</span>
                  ${
                    vpToShow.spoilersHidden || vpToShow.integrity?.hideEditorials
                      ? `<span class="badge badge-warn" style="margin-left:0.35rem;">${t('spoilersHiddenBadge')}</span>`
                      : ''
                  }
                </div>
                <div style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;" id="vp-live-clock">
                  ${
                    vpToShow.phase === 'scheduled'
                      ? `${t('vpStartsInLabel')}: ${formatDurationClock(vpToShow.untilStartMs)}`
                      : vpToShow.phase === 'active'
                        ? `${t('vpCountdownLabel')}: ${formatDurationClock(vpToShow.remainingMs)}`
                        : `Final Score: ${vpToShow.standings?.localUserRow?.points || 0} solved (Penalty: ${vpToShow.standings?.localUserRow?.penalty || 0}m)`
                  }
                </div>
              </div>
              <div style="font-size:0.83rem;margin-top:0.4rem;opacity:0.9;">
                ${escapeHtml(
                  state.lang === 'zh-CN'
                    ? vpToShow.standings?.rulesDescriptionZh
                    : vpToShow.standings?.rulesDescriptionEn
                )}
              </div>
            </div>`
          : ''
      }
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">${t('problemOrderTitle')}</h2>
        ${contest.spoilersHidden ? `<span class="badge badge-warn">${t('spoilersHiddenBadge')}</span>` : ''}
      </div>
      ${
        contest.problemsHiddenUntilStart
          ? `<div class="alert alert-warn" id="vp-future-hidden-notice">
              ${
                state.lang === 'zh-CN'
                  ? '比赛尚未开始：根据竞赛完整性规则，题目列表在预约的虚拟参赛开始前保持隐藏。'
                  : 'Contest integrity: Future contest problems are hidden until the scheduled Virtual Participation start time.'
              }
            </div>`
          : `<div class="table-wrap">
              <table class="data-table" id="contest-problems-table">
                <thead>
                  <tr>
                    <th>${t('colIndex')}</th>
                    <th>${t('colTitle')}</th>
                    <th>${t('colLimits')}</th>
                    <th>${t('colStages')}</th>
                    <th>${t('colJudgeCapability')}</th>
                    <th>${t('colStatus')}</th>
                    <th>${t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${contest.problems
                    .map((p) => {
                      const pTitle = state.lang === 'zh-CN' ? p.titleZh || p.titleEn : p.titleEn;
                      const st = p.stages || {};
                      const hasIncomplete = (p.incompleteItems || []).length > 0;
                      const solveCls =
                        p.solveStatus === 'solved'
                          ? 'badge-ok'
                          : p.solveStatus === 'attempted'
                            ? 'badge-warn'
                            : '';
                      const solveText =
                        p.solveStatus === 'solved'
                          ? t('solvedBadge')
                          : p.solveStatus === 'attempted'
                            ? t('attemptedBadge')
                            : t('unsolvedBadge');

                      return `<tr data-problem-row="${escapeHtml(p.id)}">
                        <td style="font-family:var(--font-mono);font-weight:700;font-size:1rem;">
                          <a href="#/problem/${p.id}">${escapeHtml(p.index)}</a>
                        </td>
                        <td>
                          <a href="#/problem/${p.id}" style="font-weight:600;font-size:1rem;">${escapeHtml(pTitle)}</a>
                          ${
                            !contest.spoilersHidden && p.tags?.length
                              ? `<div style="margin-top:0.2rem;display:flex;gap:0.25rem;flex-wrap:wrap;">
                                  ${p.rating ? `<span class="badge">*${p.rating}</span>` : ''}
                                  ${p.tags.map((tg) => `<span class="badge">${escapeHtml(tg)}</span>`).join('')}
                                </div>`
                              : ''
                          }
                        </td>
                        <td style="font-family:var(--font-mono);font-size:0.84rem;">
                          ${p.timeLimitMs} ms / ${p.memoryLimitMb} MB
                        </td>
                        <td>
                          <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                            ${renderStagePill('Fetch', st.fetching)}
                            ${renderStagePill('zh-CN', st.translation)}
                            ${renderStagePill(`Tests(r${st.test_prep?.activeRevision || 0})`, st.test_prep)}
                            ${renderStagePill(`Editorial(${st.editorial_prep?.source || '-'})`, st.editorial_prep)}
                          </div>
                          ${
                            hasIncomplete
                              ? `<div style="margin-top:0.35rem;font-size:0.8rem;color:#fda4af;">
                                  ${p.incompleteItems.map((it) => `<div>• [${escapeHtml(it.stage)}] ${escapeHtml(it.reason)}</div>`).join('')}
                                </div>`
                              : ''
                          }
                        </td>
                        <td>
                          <span class="badge ${p.capabilities?.canJudgeFull ? 'badge-ok' : 'badge-warn'}">
                            ${escapeHtml(p.capabilities?.judgeModeLabel || '')}
                          </span>
                          ${
                            p.activePackage
                              ? `<div style="font-size:0.76rem;color:var(--text-muted);margin-top:0.2rem;">
                                  Checker: ${escapeHtml(p.activePackage.checkerType)} •
                                  Categories: ${escapeHtml((p.activePackage.categories || []).join(', '))}
                                </div>`
                              : ''
                          }
                        </td>
                        <td><span class="badge ${solveCls}">${solveText}</span></td>
                        <td>
                          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                            <a href="#/problem/${p.id}" class="btn btn-primary btn-sm">Solve</a>
                            ${
                              hasIncomplete
                                ? `<button type="button" class="btn btn-warning btn-sm repair-prob-btn" data-prob-id="${escapeHtml(p.id)}">${t('repairBtn')}</button>`
                                : ''
                            }
                          </div>
                        </td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>`
      }
    </div>

    ${
      vpToShow?.standings
        ? `<div class="card" id="vp-standings-card">
            <div class="card-header">
              <h2 class="card-title">${t('vpStandingsTitle')}</h2>
              <span class="badge badge-info">Rank #${vpToShow.standings.localUserRow.rank} of ${vpToShow.standings.rows.length}</span>
            </div>
            <div class="table-wrap">
              <table class="data-table" id="vp-standings-table">
                <thead>
                  <tr>
                    <th>${t('colRank')}</th>
                    <th>${t('colParticipant')}</th>
                    <th>${t('colPoints')}</th>
                    <th>${t('colPenalty')}</th>
                    ${vpToShow.standings.problems
                      .map((p) => `<th style="text-align:center;">${escapeHtml(p.index)}</th>`)
                      .join('')}
                  </tr>
                </thead>
                <tbody>
                  ${vpToShow.standings.rows
                    .slice(0, 25)
                    .map((row) => {
                      return `<tr class="${row.isLocalUser ? 'local-user-row' : ''}">
                        <td style="font-family:var(--font-mono);">${row.rank}</td>
                        <td>
                          ${escapeHtml(row.handle)}
                          ${row.isLocalUser ? '<span class="badge badge-ok" style="margin-left:0.4rem;">LOCAL VP</span>' : ''}
                        </td>
                        <td style="font-family:var(--font-mono);font-weight:700;">${row.points}</td>
                        <td style="font-family:var(--font-mono);">${row.penalty}</td>
                        ${(row.problemResults || [])
                          .map((pr) => {
                            if (pr.solved) {
                              const plus =
                                pr.rejectedAttemptCount > 0 ? `+${pr.rejectedAttemptCount}` : '+';
                              const minStr =
                                pr.bestSubmissionTimeSeconds !== null
                                  ? `${Math.floor(pr.bestSubmissionTimeSeconds / 60)}:${String(pr.bestSubmissionTimeSeconds % 60).padStart(2, '0')}`
                                  : '';
                              return `<td style="text-align:center;color:#86efac;font-family:var(--font-mono);">
                                <strong>${plus}</strong>
                                <div style="font-size:0.75rem;">${minStr}</div>
                              </td>`;
                            }
                            if (pr.rejectedAttemptCount > 0) {
                              return `<td style="text-align:center;color:#fda4af;font-family:var(--font-mono);">-${pr.rejectedAttemptCount}</td>`;
                            }
                            return `<td style="text-align:center;color:var(--text-muted);">.</td>`;
                          })
                          .join('')}
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>`
        : ''
    }
  `;

  const startVpBtn = document.getElementById('start-vp-now-btn');
  if (startVpBtn) {
    startVpBtn.onclick = async () => {
      await apiFetch('/api/vp/start', {
        method: 'POST',
        body: JSON.stringify({ contestId: contest.contestId, startInSeconds: 0 })
      });
      await refreshSystemStatus();
      await loadAndRenderContestView(contest.contestId);
    };
  }

  const schedVpBtn = document.getElementById('schedule-vp-btn');
  if (schedVpBtn) {
    schedVpBtn.onclick = async () => {
      const secStr = prompt(
        state.lang === 'zh-CN'
          ? '请输入距离开赛的秒数（例如 60 表示 1 分钟后开始）：'
          : 'Enter seconds until scheduled VP start (e.g. 60 for 1 minute from now):',
        '60'
      );
      if (secStr === null) return;
      await apiFetch('/api/vp/start', {
        method: 'POST',
        body: JSON.stringify({
          contestId: contest.contestId,
          startInSeconds: Math.max(5, parseInt(secStr, 10) || 60)
        })
      });
      await refreshSystemStatus();
      await loadAndRenderContestView(contest.contestId);
    };
  }

  const finishVpBtn = document.getElementById('finish-vp-now-btn');
  if (finishVpBtn && activeVp) {
    finishVpBtn.onclick = async () => {
      await apiFetch(`/api/vp/${activeVp.id}/finish`, { method: 'POST', body: '{}' });
      await refreshSystemStatus();
      await loadAndRenderContestView(contest.contestId);
    };
  }

  const reimportBtn = document.getElementById('reimport-contest-btn');
  if (reimportBtn) {
    reimportBtn.onclick = async () => {
      reimportBtn.disabled = true;
      reimportBtn.textContent = t('importingBtn');
      await apiFetch('/api/contests/import', {
        method: 'POST',
        body: JSON.stringify({ contestId: contest.contestId })
      });
      await loadAndRenderContestView(contest.contestId);
    };
  }

  document.querySelectorAll('.repair-prob-btn').forEach((btn) => {
    btn.onclick = async () => {
      const pid = btn.getAttribute('data-prob-id');
      btn.disabled = true;
      btn.textContent = '...';
      await apiFetch(`/api/problems/${pid}/repair`, {
        method: 'POST',
        body: JSON.stringify({ stage: 'all' })
      });
      await loadAndRenderContestView(contest.contestId);
    };
  });

  const fallbackHtmlInput = document.getElementById('contest-fallback-html-file');
  if (fallbackHtmlInput) {
    fallbackHtmlInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const htmlText = await file.text();
      await apiFetch('/api/contests/import', {
        method: 'POST',
        body: JSON.stringify({
          contestId: contest.contestId,
          uploadedProblemsHtml: htmlText
        })
      });
      await loadAndRenderContestView(contest.contestId);
    };
  }
}

// View 3: Problem Workspace (Bilingual Statement, Samples Copy, C++23 Editor, Sample/Custom Runner, Judge Submission)
async function loadAndRenderProblemView(problemId) {
  const { status, data } = await apiFetch(`/api/problems/${problemId}`);
  if (status === 403 && data.locked) {
    const main = document.getElementById('app-main');
    main.innerHTML = `
      <div class="card">
        <div class="alert alert-warn">
          <strong>${escapeHtml(state.lang === 'zh-CN' ? data.errorZh || data.error : data.error)}</strong>
        </div>
        <a href="#/contest/${data.activeVp?.contestId || ''}" class="btn btn-primary">&larr; ${t('navContests')}</a>
      </div>
    `;
    return;
  }
  state.currentProblem = data;
  renderProblemViewFromData(data);
}

function renderProblemViewFromData(prob, overrideDraft = null, overrideCustomIn = null) {
  const main = document.getElementById('app-main');
  const wantZh = state.lang === 'zh-CN';
  const hasZh = prob.translationStatus === 'ready' && Boolean(prob.statementZh);
  const displayedStmt = wantZh && hasZh ? prob.statementZh : prob.statementEn || {};
  const isFallbackEn = wantZh && !hasZh;

  const displayTitle =
    wantZh && hasZh
      ? `${prob.index}. ${prob.titleZh || displayedStmt.title}`
      : `${prob.index}. ${prob.titleEn || displayedStmt.title}`;

  const localDraftKey = `cfoj_draft_${prob.id}`;
  const initialCode =
    overrideDraft !== null
      ? overrideDraft
      : localStorage.getItem(localDraftKey) ||
        prob.draft?.sourceCode ||
        DEFAULT_CPP23_TEMPLATE;
  const initialCustomIn =
    overrideCustomIn !== null
      ? overrideCustomIn
      : prob.draft?.customInput || prob.statementEn?.samples?.[0]?.input || '';

  const samples = displayedStmt.samples || prob.statementEn?.samples || [];
  const capabilityLabel = prob.readiness?.capabilities?.judgeModeLabel || 'Local Suite';

  main.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.85rem;">
      <div class="problem-tabs" style="margin-bottom:0;">
        <a href="#/contest/${prob.contestId}" class="problem-tab">&larr; #${prob.contestId}</a>
        ${(prob.contestProblems || [])
          .map(
            (cp) =>
              `<a href="#/problem/${cp.id}" class="problem-tab ${cp.id === prob.id ? 'active' : ''}">
                ${escapeHtml(cp.index)}. ${escapeHtml(state.lang === 'zh-CN' ? cp.titleZh || cp.titleEn : cp.titleEn)}
              </a>`
          )
          .join('')}
      </div>
      <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
        <button type="button" id="toggle-en-compare-btn" class="btn btn-sm">${t('compareEnBtn')}</button>
        ${
          prob.editorialLocked
            ? `<button type="button" class="btn btn-sm" disabled>${t('editorialLockedBtn')}</button>`
            : `<a href="#/editorial/${prob.contestId}?problem=${prob.index}" id="problem-editorial-link" class="btn btn-sm">${t('readEditorialBtn')} (${prob.index})</a>`
        }
      </div>
    </div>

    ${
      prob.problemType !== 'batch' && prob.missingComponent
        ? `<div class="alert alert-warn">
            <strong>Unsupported Task Type (${escapeHtml(prob.problemType)}):</strong>
            Statement is available for offline reading, but local judging requires missing component:
            <code>${escapeHtml(prob.missingComponent)}</code>.
          </div>`
        : ''
    }

    ${
      isFallbackEn
        ? `<div class="alert alert-warn" id="missing-zh-banner" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.6rem;">
            <div>
              <strong>${t('missingZhBanner')}</strong>
              ${prob.translationError ? `<div style="font-size:0.82rem;margin-top:0.2rem;">Reason: ${escapeHtml(prob.translationError)}</div>` : ''}
            </div>
            <button type="button" id="regenerate-translation-btn" class="btn btn-warning btn-sm">${t('regenerateZhBtn')}</button>
          </div>`
        : ''
    }

    <div class="workspace-split">
      <!-- Left: Problem Statement -->
      <section class="statement-pane" id="statement-pane">
        <div class="statement-header">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
            <h1 class="statement-title" id="problem-statement-title">${escapeHtml(displayTitle)}</h1>
            <span class="badge ${prob.activePackageRev > 0 ? 'badge-ok' : 'badge-warn'}" id="judge-suite-mode-badge">
              ${escapeHtml(capabilityLabel)}
            </span>
          </div>
          <div class="statement-limits">
            <span>⏱ ${prob.timeLimitMs} ms</span>
            <span>•</span>
            <span>💾 ${prob.memoryLimitMb} MB</span>
            <span>•</span>
            <span>📥 ${escapeHtml(prob.inputFile)} / 📤 ${escapeHtml(prob.outputFile)}</span>
            ${
              prob.spoilersHidden
                ? `<span class="badge badge-warn">${t('spoilersHiddenBadge')}</span>`
                : `${prob.rating ? `<span class="badge">*${prob.rating}</span>` : ''}
                   ${(prob.tags || []).map((tg) => `<span class="badge">${escapeHtml(tg)}</span>`).join('')}`
            }
          </div>
        </div>

        <div class="statement-body" id="statement-prose-container">
          <div id="stmt-desc">${renderMathInHtml(displayedStmt.descriptionHtml || '')}</div>

          ${
            state.showEnglishComparison && wantZh && hasZh
              ? `<div class="alert alert-info" style="margin-top:0.8rem;">
                  <strong>Original English Statement (Comparison):</strong>
                  <div>${renderMathInHtml(prob.statementEn?.descriptionHtml || '')}</div>
                </div>`
              : ''
          }

          <h2 class="section-heading" id="sec-input-heading">${t('secInput')}</h2>
          <div id="stmt-input-spec">${renderMathInHtml(displayedStmt.inputSpecHtml || '')}</div>

          <h2 class="section-heading" id="sec-output-heading">${t('secOutput')}</h2>
          <div id="stmt-output-spec">${renderMathInHtml(displayedStmt.outputSpecHtml || '')}</div>

          <h2 class="section-heading" id="sec-examples-heading">${t('secExamples')}</h2>
          <div id="stmt-samples-list">
            ${samples
              .map(
                (s, idx) => `
              <div class="sample-box">
                <div class="sample-grid">
                  <div class="sample-col">
                    <div class="sample-col-header">
                      <span>${t('secInput')} #${idx + 1}</span>
                      <button type="button" class="btn btn-sm copy-sample-btn" data-copy-text="${escapeHtml(s.input)}">${t('copyBtn')}</button>
                    </div>
                    <pre class="sample-pre" data-sample-input="${idx}">${escapeHtml(s.input)}</pre>
                  </div>
                  <div class="sample-col">
                    <div class="sample-col-header">
                      <span>${t('secOutput')} #${idx + 1}</span>
                      <button type="button" class="btn btn-sm copy-sample-btn" data-copy-text="${escapeHtml(s.output)}">${t('copyBtn')}</button>
                    </div>
                    <pre class="sample-pre" data-sample-output="${idx}">${escapeHtml(s.output)}</pre>
                  </div>
                </div>
              </div>`
              )
              .join('')}
          </div>

          ${
            displayedStmt.noteHtml
              ? `<h2 class="section-heading">${t('secNote')}</h2>
                 <div id="stmt-note">${renderMathInHtml(displayedStmt.noteHtml)}</div>`
              : ''
          }
        </div>
      </section>

      <!-- Right: GNU C++23 Editor, Sample/Custom Runner, Live Verdict, Submissions -->
      <section class="editor-pane">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;">
          <div>
            <strong>${t('editorTitle')}</strong>
            <span class="badge" style="margin-left:0.35rem;">-std=gnu++23 -O2</span>
          </div>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
            <button type="button" id="insert-template-btn" class="btn btn-sm">${t('insertTemplateBtn')}</button>
            <label class="btn btn-sm" style="cursor:pointer;">
              <span>${t('uploadCppBtn')}</span>
              <input type="file" id="upload-cpp-input" accept=".cpp,.cc,.cxx,.h,.hpp" class="hidden" />
            </label>
          </div>
        </div>

        <div class="code-editor-shell">
          <div class="code-line-numbers" id="editor-line-numbers">1</div>
          <textarea
            id="code-editor-textarea"
            class="code-textarea"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            aria-label="GNU C++23 Source Code Editor"
          ></textarea>
        </div>

        <div style="margin-top:0.75rem;display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;justify-content:space-between;">
          <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
            <button type="button" id="run-samples-btn" class="btn">${t('runSamplesBtn')}</button>
            <button type="button" id="run-custom-btn" class="btn">${t('runCustomBtn')}</button>
          </div>
          <button type="button" id="submit-solution-btn" class="btn btn-success">${t('submitBtn')}</button>
        </div>

        <details style="margin-top:0.65rem;">
          <summary style="cursor:pointer;font-size:0.86rem;color:var(--text-secondary);">${t('customInputLabel')}</summary>
          <textarea
            id="custom-input-textarea"
            rows="4"
            style="width:100%;margin-top:0.4rem;font-family:var(--font-mono);font-size:0.85rem;"
          ></textarea>
        </details>

        <div id="live-verdict-box" style="margin-top:0.85rem;"></div>

        <div style="margin-top:1.1rem;border-top:1px solid var(--border);padding-top:0.85rem;">
          <h3 style="margin:0 0 0.6rem 0;font-size:0.98rem;">${t('recentSubmissionsTitle')}</h3>
          <div id="problem-submissions-list">
            ${renderSubmissionsMiniTable(prob.submissions || [])}
          </div>
        </div>
      </section>
    </div>
  `;

  const editorEl = document.getElementById('code-editor-textarea');
  const lineNumsEl = document.getElementById('editor-line-numbers');
  const customInEl = document.getElementById('custom-input-textarea');

  editorEl.value = initialCode;
  customInEl.value = initialCustomIn;

  const updateLineNumbers = () => {
    const count = Math.max(1, editorEl.value.split('\n').length);
    const nums = [];
    for (let i = 1; i <= count; i++) nums.push(i);
    lineNumsEl.textContent = nums.join('\n');
    lineNumsEl.scrollTop = editorEl.scrollTop;
  };
  updateLineNumbers();

  const scheduleDraftSave = () => {
    localStorage.setItem(localDraftKey, editorEl.value);
    clearTimeout(state.draftSaveTimer);
    state.draftSaveTimer = setTimeout(() => {
      apiFetch(`/api/drafts/${prob.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          sourceCode: editorEl.value,
          customInput: customInEl.value
        })
      }).catch(() => {});
    }, 350);
  };

  editorEl.addEventListener('input', () => {
    updateLineNumbers();
    scheduleDraftSave();
  });
  editorEl.addEventListener('scroll', () => {
    lineNumsEl.scrollTop = editorEl.scrollTop;
  });
  editorEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editorEl.selectionStart;
      const end = editorEl.selectionEnd;
      editorEl.value = editorEl.value.slice(0, start) + '    ' + editorEl.value.slice(end);
      editorEl.selectionStart = editorEl.selectionEnd = start + 4;
      updateLineNumbers();
      scheduleDraftSave();
    }
  });
  customInEl.addEventListener('input', scheduleDraftSave);

  // Copy sample buttons
  document.querySelectorAll('.copy-sample-btn').forEach((btn) => {
    btn.onclick = async () => {
      const txt = btn.getAttribute('data-copy-text') || '';
      try {
        await navigator.clipboard.writeText(txt);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const orig = btn.textContent;
      btn.textContent = t('copiedBtn');
      setTimeout(() => {
        btn.textContent = orig;
      }, 1200);
    };
  });

  // Template & .cpp upload
  document.getElementById('insert-template-btn').onclick = () => {
    editorEl.value = DEFAULT_CPP23_TEMPLATE;
    updateLineNumbers();
    scheduleDraftSave();
  };

  document.getElementById('upload-cpp-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    editorEl.value = await file.text();
    updateLineNumbers();
    scheduleDraftSave();
  };

  const compareBtn = document.getElementById('toggle-en-compare-btn');
  if (compareBtn) {
    compareBtn.onclick = () => {
      state.showEnglishComparison = !state.showEnglishComparison;
      renderProblemViewFromData(state.currentProblem, editorEl.value, customInEl.value);
    };
  }

  const regenZhBtn = document.getElementById('regenerate-translation-btn');
  if (regenZhBtn) {
    regenZhBtn.onclick = async () => {
      regenZhBtn.disabled = true;
      regenZhBtn.textContent = '...';
      await apiFetch(`/api/problems/${prob.id}/repair`, {
        method: 'POST',
        body: JSON.stringify({ stage: 'translation' })
      });
      await loadAndRenderProblemView(prob.id);
    };
  }

  const verdictBox = document.getElementById('live-verdict-box');

  // Sample-only run
  document.getElementById('run-samples-btn').onclick = async () => {
    verdictBox.innerHTML = `<div class="alert alert-info">${t('sampleRunHeader')}<br/>${formatVerdict('COMPILING')}</div>`;
    try {
      const { data } = await apiFetch(`/api/problems/${prob.id}/run`, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'samples',
          sourceCode: editorEl.value
        })
      });
      verdictBox.innerHTML = renderSampleRunResultCard(data, t('sampleRunHeader'));
    } catch (err) {
      verdictBox.innerHTML = `<div class="alert alert-err">${escapeHtml(err.message)}</div>`;
    }
  };

  // Custom input run
  document.getElementById('run-custom-btn').onclick = async () => {
    verdictBox.innerHTML = `<div class="alert alert-info">${t('customRunHeader')}<br/>${formatVerdict('COMPILING')}</div>`;
    try {
      const { data } = await apiFetch(`/api/problems/${prob.id}/run`, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'custom',
          sourceCode: editorEl.value,
          customInput: customInEl.value
        })
      });
      verdictBox.innerHTML = renderSampleRunResultCard(data, t('customRunHeader'));
    } catch (err) {
      verdictBox.innerHTML = `<div class="alert alert-err">${escapeHtml(err.message)}</div>`;
    }
  };

  // Full suite submission
  const submitBtn = document.getElementById('submit-solution-btn');
  submitBtn.onclick = async () => {
    submitBtn.disabled = true;
    verdictBox.innerHTML = `<div class="alert alert-info" id="submission-result-banner">${formatVerdict('QUEUED')}</div>`;
    try {
      const { data } = await apiFetch(`/api/problems/${prob.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          sourceCode: editorEl.value
        })
      });
      if (data.submission) {
        updateProblemSubmissionState(data.submission);
      }
    } catch (err) {
      verdictBox.innerHTML = `<div class="alert alert-err">${escapeHtml(err.message)}</div>`;
    } finally {
      submitBtn.disabled = false;
    }
  };

  attachSubmissionDetailModalHandlers();
}

function renderSampleRunResultCard(res, headerText) {
  const vCls = `verdict-${res.verdict}`;
  return `
    <div class="alert ${res.verdict === 'AC' || res.verdict === 'OK' ? 'alert-ok' : 'alert-err'}" id="sample-run-result">
      <div style="font-size:0.78rem;font-family:var(--font-mono);opacity:0.9;margin-bottom:0.3rem;">${escapeHtml(headerText)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;">
        <span class="badge ${vCls}" id="sample-run-verdict">${escapeHtml(formatVerdict(res.verdict))}</span>
        <span style="font-size:0.78rem;font-family:var(--font-mono);">${escapeHtml(res.toolchain || '')}</span>
      </div>
      ${
        res.compilerOutput
          ? `<pre style="margin-top:0.5rem;padding:0.5rem;background:#090d16;border-radius:6px;font-size:0.8rem;overflow-x:auto;">${escapeHtml(res.compilerOutput)}</pre>`
          : ''
      }
      ${(res.cases || [])
        .map(
          (c) => `
          <div style="margin-top:0.55rem;padding-top:0.45rem;border-top:1px solid rgba(255,255,255,0.12);font-size:0.84rem;">
            <div>
              <strong>${escapeHtml(c.name)}:</strong>
              <span class="badge verdict-${c.verdict}">${escapeHtml(formatVerdict(c.verdict))}</span>
              <span style="font-family:var(--font-mono);font-size:0.78rem;margin-left:0.4rem;">${c.timeMs} ms / ${formatMemory(c.memoryBytes)}</span>
            </div>
            ${c.comment ? `<div style="font-family:var(--font-mono);font-size:0.78rem;margin-top:0.2rem;">${escapeHtml(c.comment)}</div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.3rem;">
              <div>
                <div style="font-size:0.74rem;opacity:0.8;">Input:</div>
                <pre style="margin:0;padding:0.35rem;background:#090d16;border-radius:4px;font-size:0.78rem;">${escapeHtml(c.input)}</pre>
              </div>
              <div>
                <div style="font-size:0.74rem;opacity:0.8;">Output:</div>
                <pre style="margin:0;padding:0.35rem;background:#090d16;border-radius:4px;font-size:0.78rem;">${escapeHtml(c.output)}</pre>
              </div>
            </div>
          </div>`
        )
        .join('')}
    </div>
  `;
}

function renderSubmissionBannerCard(sub) {
  const vCls = `verdict-${sub.verdict}`;
  const isFinal = sub.status === 'final';
  const alertCls = !isFinal
    ? 'alert-info'
    : sub.verdict === 'AC'
      ? 'alert-ok'
      : 'alert-err';

  return `
    <div class="alert ${alertCls}" id="submission-result-banner" data-sub-id="${sub.id}" data-verdict="${sub.verdict}">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <strong>#${sub.id}</strong>
          <span class="badge ${vCls}" id="submission-verdict-badge" style="margin-left:0.35rem;">
            ${escapeHtml(formatVerdict(sub.verdict, sub.currentTest, sub.totalTests, sub.firstFailedTest))}
          </span>
          <span class="badge" style="margin-left:0.3rem;">${sub.mode === 'vp' ? t('modeVp') : t('modePractice')}</span>
          <span class="badge" style="margin-left:0.3rem;">${sub.suiteType === 'full' ? `Suite Rev #${sub.packageRevision}` : 'Sample-Only'}</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.82rem;">
          ${sub.timeMs} ms • ${formatMemory(sub.memoryBytes)}
        </div>
      </div>
      ${
        sub.compilerOutput
          ? `<pre style="margin-top:0.5rem;padding:0.5rem;background:#090d16;border-radius:6px;font-size:0.8rem;overflow-x:auto;">${escapeHtml(sub.compilerOutput)}</pre>`
          : ''
      }
      ${
        sub.failedCase
          ? `<div style="margin-top:0.5rem;font-size:0.83rem;">
              <div><strong>First Failing Test #${sub.failedCase.index} (${escapeHtml(sub.failedCase.name)}):</strong> ${escapeHtml(sub.failedCase.checkerComment || '')}</div>
              ${
                !sub.diagnosticsHidden
                  ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem;margin-top:0.35rem;">
                      <div><div style="font-size:0.74rem;">Input</div><pre style="margin:0;padding:0.35rem;background:#090d16;border-radius:4px;font-size:0.76rem;">${escapeHtml(sub.failedCase.inputPreview)}</pre></div>
                      <div><div style="font-size:0.74rem;">Your Output</div><pre style="margin:0;padding:0.35rem;background:#090d16;border-radius:4px;font-size:0.76rem;">${escapeHtml(sub.failedCase.userOutputPreview)}</pre></div>
                      <div><div style="font-size:0.74rem;">Expected</div><pre style="margin:0;padding:0.35rem;background:#090d16;border-radius:4px;font-size:0.76rem;">${escapeHtml(sub.failedCase.expectedOutputPreview)}</pre></div>
                    </div>`
                  : ''
              }
            </div>`
          : ''
      }
    </div>
  `;
}

function renderSubmissionsMiniTable(submissions) {
  if (!submissions.length) {
    return `<div style="color:var(--text-muted);font-size:0.86rem;">No submissions yet.</div>`;
  }
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('colSubId')}</th>
            <th>${t('colMode')}</th>
            <th>${t('colVerdict')}</th>
            <th>${t('colRuntime')}</th>
            <th>${t('colMemory')}</th>
            <th>${t('colPkgRev')}</th>
          </tr>
        </thead>
        <tbody>
          ${submissions
            .slice(0, 12)
            .map(
              (s) => `
            <tr class="sub-row-clickable" data-sub-id="${s.id}" style="cursor:pointer;">
              <td style="font-family:var(--font-mono);font-weight:600;">#${s.id}</td>
              <td><span class="badge">${s.mode === 'vp' ? t('modeVp') : t('modePractice')}</span></td>
              <td>
                <span class="badge verdict-${s.verdict}">
                  ${escapeHtml(formatVerdict(s.verdict, s.currentTest, s.totalTests, s.firstFailedTest))}
                </span>
              </td>
              <td style="font-family:var(--font-mono);font-size:0.82rem;">${s.timeMs} ms</td>
              <td style="font-family:var(--font-mono);font-size:0.82rem;">${formatMemory(s.memoryBytes)}</td>
              <td style="font-family:var(--font-mono);font-size:0.8rem;">Rev #${s.packageRevision}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updateProblemSubmissionState(sub) {
  if (!state.currentProblem || state.currentProblem.id !== sub.problemId) return;
  const list = state.currentProblem.submissions || [];
  const idx = list.findIndex((x) => x.id === sub.id);
  if (idx >= 0) list[idx] = sub;
  else list.unshift(sub);
  state.currentProblem.submissions = list;

  const verdictBox = document.getElementById('live-verdict-box');
  if (verdictBox) {
    verdictBox.innerHTML = renderSubmissionBannerCard(sub);
  }
  const listBox = document.getElementById('problem-submissions-list');
  if (listBox) {
    listBox.innerHTML = renderSubmissionsMiniTable(list);
    attachSubmissionDetailModalHandlers();
  }
}

// View 4: Local Markdown Editorial Reader (#/editorial/:contestId)
async function loadAndRenderEditorialView(contestId, targetProblemIndex = null) {
  const { status, data } = await apiFetch(`/api/contests/${contestId}/editorial`);
  if (status === 403 && data.locked) {
    const main = document.getElementById('app-main');
    main.innerHTML = `
      <div class="card" id="editorial-locked-card">
        <div class="alert alert-warn">
          <strong>${escapeHtml(state.lang === 'zh-CN' ? data.errorZh || data.error : data.error)}</strong>
          <div style="margin-top:0.35rem;font-family:var(--font-mono);">
            ${t('vpCountdownLabel')}: ${formatDurationClock(data.remainingMs || 0)}
          </div>
        </div>
        <a href="#/contest/${contestId}" class="btn btn-primary">&larr; ${t('openContestBtn')}</a>
      </div>
    `;
    return;
  }
  state.currentEditorial = { ...data, targetProblemIndex };
  renderEditorialViewFromData(state.currentEditorial);
}

function renderEditorialViewFromData(ed) {
  const main = document.getElementById('app-main');
  const isZh = state.lang === 'zh-CN';
  const mdText = isZh ? ed.zhMarkdown || ed.enMarkdown : ed.enMarkdown || ed.zhMarkdown;
  const diskPath = isZh ? ed.zhPath : ed.enPath;

  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h1 class="card-title" style="font-size:1.35rem;">
            ${escapeHtml(isZh ? ed.titleZh : ed.titleEn)} — ${t('editorialPageTitle')}
          </h1>
          <div style="font-size:0.84rem;color:var(--text-secondary);margin-top:0.25rem;">
            <strong>${t('editorialDiskFileLabel')}</strong>
            <code id="editorial-disk-path" style="font-family:var(--font-mono);">${escapeHtml(diskPath || '')}</code>
          </div>
        </div>
        <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
          <a href="#/contest/${ed.contestId}" class="btn btn-sm">&larr; #${ed.contestId}</a>
          <button type="button" id="ed-mode-rendered-btn" class="btn btn-sm ${state.editorialViewMode === 'rendered' ? 'btn-primary' : ''}">${t('viewRenderedTab')}</button>
          <button type="button" id="ed-mode-raw-btn" class="btn btn-sm ${state.editorialViewMode === 'raw' ? 'btn-primary' : ''}">${t('viewRawMdTab')}</button>
        </div>
      </div>

      <div class="problem-tabs" id="editorial-section-nav">
        ${(ed.problems || [])
          .map(
            (p) => `
          <button type="button" class="problem-tab ed-jump-btn" data-jump-target="problem-${escapeHtml(p.index)}">
            ${escapeHtml(p.index)}. ${escapeHtml(isZh ? p.titleZh : p.titleEn)}
            <span class="badge ${p.verified ? 'badge-ok' : 'badge-warn'}" style="margin-left:0.3rem;">
              ${p.source === 'published' ? 'Published' : 'AI'}
            </span>
          </button>`
          )
          .join('')}
      </div>

      ${
        state.editorialViewMode === 'raw'
          ? `<pre id="editorial-raw-markdown" style="background:#090d16;border:1px solid var(--border);border-radius:8px;padding:1rem;overflow-x:auto;font-family:var(--font-mono);font-size:0.86rem;white-space:pre-wrap;">${escapeHtml(mdText)}</pre>`
          : `<div id="editorial-rendered-body" class="editorial-content">${renderMarkdownToHtml(mdText, ed.contestId)}</div>`
      }
    </div>
  `;

  document.getElementById('ed-mode-rendered-btn').onclick = () => {
    state.editorialViewMode = 'rendered';
    renderEditorialViewFromData(state.currentEditorial);
  };
  document.getElementById('ed-mode-raw-btn').onclick = () => {
    state.editorialViewMode = 'raw';
    renderEditorialViewFromData(state.currentEditorial);
  };

  const scrollToSection = (anchorId) => {
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.querySelectorAll('.ed-jump-btn').forEach((btn) => {
    btn.onclick = () => scrollToSection(btn.getAttribute('data-jump-target'));
  });
  document.querySelectorAll('[data-scroll-target]').forEach((a) => {
    a.onclick = () => scrollToSection(a.getAttribute('data-scroll-target'));
  });

  if (ed.targetProblemIndex) {
    setTimeout(() => scrollToSection(`problem-${ed.targetProblemIndex}`), 60);
  }
}

// View 5: Daily Practice Problemset with Filters
async function renderProblemsetView() {
  const main = document.getElementById('app-main');
  const { data } = await apiFetch('/api/problems');

  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">${t('navProblemset')}</h1>
      </div>
      <form id="problemset-filter-form" style="display:flex;flex-wrap:wrap;gap:0.55rem;margin-bottom:1rem;">
        <input type="text" id="pf-contest" placeholder="${escapeHtml(t('filterContest'))}" style="width:120px;" />
        <input type="text" id="pf-index" placeholder="${escapeHtml(t('filterIndex'))}" style="width:140px;" />
        <input type="number" id="pf-min-rating" placeholder="${escapeHtml(t('filterMinRating'))}" style="width:125px;" />
        <input type="number" id="pf-max-rating" placeholder="${escapeHtml(t('filterMaxRating'))}" style="width:125px;" />
        <select id="pf-tag">
          <option value="">${t('filterTag')}</option>
          ${(data.availableTags || []).map((tg) => `<option value="${escapeHtml(tg)}">${escapeHtml(tg)}</option>`).join('')}
        </select>
        <select id="pf-status">
          <option value="">${t('filterStatus')}</option>
          <option value="solved">${t('solvedBadge')}</option>
          <option value="attempted">${t('attemptedBadge')}</option>
          <option value="unsolved">${t('unsolvedBadge')}</option>
        </select>
        <input type="text" id="pf-search" placeholder="${escapeHtml(t('filterSearch'))}" style="flex:1;min-width:180px;" />
        <button type="submit" class="btn btn-primary">${t('applyFilterBtn')}</button>
        <button type="button" id="pf-reset-btn" class="btn">${t('resetFilterBtn')}</button>
      </form>
      <div id="problemset-table-container">
        ${renderProblemsetTableHtml(data.problems)}
      </div>
    </div>
  `;

  const form = document.getElementById('problemset-filter-form');
  const runFilter = async () => {
    const params = new URLSearchParams();
    const cid = document.getElementById('pf-contest').value.trim();
    const idx = document.getElementById('pf-index').value.trim();
    const minR = document.getElementById('pf-min-rating').value.trim();
    const maxR = document.getElementById('pf-max-rating').value.trim();
    const tag = document.getElementById('pf-tag').value;
    const status = document.getElementById('pf-status').value;
    const q = document.getElementById('pf-search').value.trim();
    if (cid) params.set('contestId', cid);
    if (idx) params.set('index', idx);
    if (minR) params.set('minRating', minR);
    if (maxR) params.set('maxRating', maxR);
    if (tag) params.set('tag', tag);
    if (status) params.set('status', status);
    if (q) params.set('q', q);

    const { data: filtered } = await apiFetch(`/api/problems?${params.toString()}`);
    document.getElementById('problemset-table-container').innerHTML = renderProblemsetTableHtml(
      filtered.problems
    );
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    runFilter();
  };
  document.getElementById('pf-reset-btn').onclick = () => {
    form.reset();
    runFilter();
  };
}

function renderProblemsetTableHtml(problems) {
  if (!problems.length) {
    return `<p style="color:var(--text-muted);">No matching problems found.</p>`;
  }
  return `
    <div class="table-wrap">
      <table class="data-table" id="problemset-table">
        <thead>
          <tr>
            <th>${t('colIndex')}</th>
            <th>${t('colTitle')}</th>
            <th>Tags / Rating</th>
            <th>${t('colLimits')}</th>
            <th>${t('colJudgeCapability')}</th>
            <th>${t('colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          ${problems
            .map((p) => {
              const title = state.lang === 'zh-CN' ? p.titleZh || p.titleEn : p.titleEn;
              const sCls =
                p.solveStatus === 'solved'
                  ? 'badge-ok'
                  : p.solveStatus === 'attempted'
                    ? 'badge-warn'
                    : '';
              const sTxt =
                p.solveStatus === 'solved'
                  ? t('solvedBadge')
                  : p.solveStatus === 'attempted'
                    ? t('attemptedBadge')
                    : t('unsolvedBadge');
              return `<tr>
                <td style="font-family:var(--font-mono);font-weight:700;">
                  <a href="#/problem/${p.id}">${escapeHtml(p.id)}</a>
                </td>
                <td>
                  <a href="#/problem/${p.id}" style="font-weight:600;">${escapeHtml(title)}</a>
                </td>
                <td>
                  ${
                    p.spoilersHidden
                      ? `<span class="badge badge-warn">${t('spoilersHiddenBadge')}</span>`
                      : `${p.rating ? `<span class="badge">*${p.rating}</span>` : ''}
                         ${(p.tags || []).map((tg) => `<span class="badge">${escapeHtml(tg)}</span>`).join(' ')}`
                  }
                </td>
                <td style="font-family:var(--font-mono);font-size:0.83rem;">${p.timeLimitMs} ms / ${p.memoryLimitMb} MB</td>
                <td>
                  <span class="badge ${p.canJudgeFull ? 'badge-ok' : 'badge-warn'}">
                    ${p.canJudgeFull ? `Full Suite (Rev #${p.activePackageRev})` : 'Sample-Only'}
                  </span>
                </td>
                <td><span class="badge ${sCls}">${sTxt} (${p.attempts})</span></td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

// View 6: Submissions History
async function renderSubmissionsView() {
  const main = document.getElementById('app-main');
  const { data } = await apiFetch('/api/submissions');

  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">${t('allSubmissionsTitle')}</h1>
      </div>
      ${
        data.submissions.length === 0
          ? `<p style="color:var(--text-muted);">No submissions recorded yet.</p>`
          : `<div class="table-wrap">
              <table class="data-table" id="all-submissions-table">
                <thead>
                  <tr>
                    <th>${t('colSubId')}</th>
                    <th>Problem</th>
                    <th>${t('colMode')}</th>
                    <th>${t('colVerdict')}</th>
                    <th>${t('colRuntime')}</th>
                    <th>${t('colMemory')}</th>
                    <th>${t('colPkgRev')}</th>
                    <th>Toolchain</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.submissions
                    .map(
                      (s) => `
                    <tr class="sub-row-clickable" data-sub-id="${s.id}" style="cursor:pointer;">
                      <td style="font-family:var(--font-mono);font-weight:700;">#${s.id}</td>
                      <td><a href="#/problem/${s.problemId}" style="font-weight:600;">${escapeHtml(s.problemId)}</a></td>
                      <td><span class="badge">${s.mode === 'vp' ? t('modeVp') : t('modePractice')}</span></td>
                      <td>
                        <span class="badge verdict-${s.verdict}">
                          ${escapeHtml(formatVerdict(s.verdict, s.currentTest, s.totalTests, s.firstFailedTest))}
                        </span>
                      </td>
                      <td style="font-family:var(--font-mono);">${s.timeMs} ms</td>
                      <td style="font-family:var(--font-mono);">${formatMemory(s.memoryBytes)}</td>
                      <td style="font-family:var(--font-mono);">Rev #${s.packageRevision} (${s.suiteType})</td>
                      <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-secondary);">${escapeHtml(s.toolchain)}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
      }
    </div>
  `;
  attachSubmissionDetailModalHandlers();
}

// View 7: Settings & AI Providers
async function renderSettingsView() {
  const main = document.getElementById('app-main');
  const [{ data: statusData }, { data: provData }, { data: catalogs }] = await Promise.all([
    apiFetch('/api/status'),
    apiFetch('/api/providers/status'),
    apiFetch('/api/providers/models')
  ]);

  const s = statusData.settings || {};
  const jEnv = statusData.judgeEnvironment || {};
  const codex = provData.providers?.codex || {};
  const agy = provData.providers?.antigravity || {};
  const chinese = state.lang === 'zh-CN';
  const cliDefault = chinese ? '使用 CLI 默认值' : 'Use CLI default';
  const modelProviders = [['codex', 'Codex', catalogs.codex], ['agy', 'Antigravity', catalogs.antigravity]];

  main.innerHTML = `
    <div class="hero-grid">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Local GNU C++23 Judge Backend</h2>
          <span class="badge ${jEnv.ok ? 'badge-ok' : 'badge-err'}">${jEnv.ok ? 'READY' : 'UNAVAILABLE'}</span>
        </div>
        <div style="font-size:0.88rem;line-height:1.8;">
          <div><strong>Toolchain:</strong> <code>${escapeHtml(jEnv.toolchain || 'Not found')}</code></div>
          <div><strong>Compiler Path:</strong> <code>${escapeHtml(jEnv.compilerPath || '')}</code></div>
          <div><strong>Sandbox Runner:</strong> <code>${escapeHtml(jEnv.sandboxPath || '')}</code></div>
          <div><strong>AppContainer SID (CFOJ.Run):</strong> <code>${escapeHtml(jEnv.runContainerSid || '')}</code></div>
          <div><strong>Data Backup Path:</strong> <code>${escapeHtml(statusData.dataDir || '')}</code></div>
          ${jEnv.error ? `<div class="alert alert-err" style="margin-top:0.5rem;">${escapeHtml(jEnv.error)}</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">${chinese ? 'AI 提供商状态' : 'AI Provider Status'}</h2>
        </div>
        <div style="font-size:0.88rem;">
          <div style="padding:0.6rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.65rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>OpenAI Codex (<code>codex exec</code>)</strong>
              <span class="badge ${codex.status === 'ready' ? 'badge-ok' : 'badge-warn'}">${escapeHtml(codex.status || 'unknown')}</span>
            </div>
            <div class="provider-location">${escapeHtml(codex.message || '')}</div>
          </div>
          <div style="padding:0.6rem;border:1px solid var(--border);border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>Google Antigravity (<code>agy -p</code>)</strong>
              <span class="badge ${agy.status === 'ready' ? 'badge-ok' : 'badge-warn'}">${escapeHtml(agy.status || 'unknown')}</span>
            </div>
            <div class="provider-location">${escapeHtml(agy.message || '')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">${chinese ? '配置' : 'Configuration'}</h2>
      </div>
      <form id="settings-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;">
        <label style="display:flex;flex-direction:column;gap:0.35rem;">
          <span>${chinese ? '默认 AI 提供商' : 'Active AI Provider'}</span>
          <select id="set-ai-provider">
            <option value="codex" ${s.ai_provider === 'codex' ? 'selected' : ''}>OpenAI Codex (codex exec)</option>
            <option value="antigravity" ${s.ai_provider === 'antigravity' ? 'selected' : ''}>Google Antigravity (agy -p)</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:0.35rem;">
          <span>${chinese ? 'Codex 可执行文件' : 'OpenAI Codex executable'}</span>
          <input type="text" id="set-codex-bin" value="${escapeHtml(s.codex_bin || 'codex')}" />
        </label>
        <label style="display:flex;flex-direction:column;gap:0.35rem;">
          <span>${chinese ? 'Antigravity CLI 可执行文件' : 'Google Antigravity CLI executable'}</span>
          <input type="text" id="set-agy-bin" value="${escapeHtml(s.agy_bin || 'agy')}" />
        </label>
        ${modelProviders.map(([prefix, name, catalog]) => `
          <div class="provider-option">
            <label for="set-${prefix}-model">${name} ${chinese ? '模型' : 'model'}</label>
            <select id="set-${prefix}-model">
              <option value="">${cliDefault}</option>
              ${catalog.models.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label || m.id)}</option>`).join('')}
              <option value=":custom">${chinese ? '输入模型 ID…' : 'Enter model ID…'}</option>
            </select>
            <input id="set-${prefix}-custom-model" class="hidden" type="text"
              aria-label="${name} model ID" placeholder="Model ID" value="${escapeHtml(s[prefix + '_model'])}" />
          </div>
          <label class="provider-option">${name} ${chinese ? '思考强度' : 'reasoning effort'}
            <select id="set-${prefix}-effort"></select>
          </label>
        `).join('')}
        <label style="display:flex;flex-direction:column;gap:0.35rem;">
          <span>Target Generated Cases per Batch Problem</span>
          <input type="number" id="set-target-tests" value="${escapeHtml(s.target_test_count || '50')}" min="5" max="200" />
        </label>
        <label style="display:flex;flex-direction:column;gap:0.35rem;">
          <span>GNU C++23 Compiler (g++.exe)</span>
          <input type="text" id="set-compiler-path" value="${escapeHtml(s.compiler_path || '')}" />
        </label>
        <label style="display:flex;flex-direction:column;gap:0.35rem;">
          <span>Offline Mode (Block all remote Codeforces fetches)</span>
          <select id="set-offline-mode">
            <option value="false" ${s.offline_mode !== 'true' ? 'selected' : ''}>Online / Normal</option>
            <option value="true" ${s.offline_mode === 'true' ? 'selected' : ''}>Strict Offline Mode</option>
          </select>
        </label>
        <div style="grid-column:1 / -1;display:flex;gap:0.6rem;flex-wrap:wrap;">
          <button type="submit" class="btn btn-primary">${chinese ? '保存设置' : 'Save Settings'}</button>
          <button type="button" id="use-fixture-providers-btn" class="btn">Use Repeatable Fixture Adapters (mock-codex / mock-agy)</button>
          <span id="settings-save-msg" class="badge badge-ok hidden">Saved!</span>
        </div>
      </form>
    </div>
  `;

  for (const [prefix, , catalog] of modelProviders) {
    const model = document.getElementById('set-' + prefix + '-model');
    const custom = document.getElementById('set-' + prefix + '-custom-model');
    const effort = document.getElementById('set-' + prefix + '-effort');
    const savedModel = s[prefix + '_model'] || '';
    model.value = savedModel && !catalog.models.some(m => m.id === savedModel) ? ':custom' : savedModel;
    const showLevels = selected => {
      custom.classList.toggle('hidden', model.value !== ':custom');
      custom.required = model.value === ':custom';
      const id = model.value === ':custom' ? custom.value.trim() : model.value;
      const known = catalog.models.find(m => m.id === id)?.efforts;
      const levels = known?.length ? known : catalog.efforts;
      effort.replaceChildren(new Option(cliDefault, ''), ...levels.map(level => new Option(level, level)));
      effort.value = levels.includes(selected) ? selected : '';
    };
    showLevels(s[prefix + '_effort']);
    model.onchange = custom.oninput = () => showLevels(effort.value);
    if (prefix === 'agy') effort.onchange = () => {
      const item = catalog.models.find(m => m.id === model.value);
      if (!item?.efforts?.includes(effort.value)) return;
      const sibling = item.id.replace(/-[^-]+$/, '-' + effort.value);
      if (catalog.models.some(m => m.id === sibling)) model.value = sibling;
    };
  }

  document.getElementById('use-fixture-providers-btn').onclick = () => {
    document.getElementById('set-codex-bin').value = provData.fixtures?.codex || 'codex';
    document.getElementById('set-agy-bin').value = provData.fixtures?.antigravity || 'agy';
  };

  document.getElementById('settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('settings-save-msg');
    const modelSettings = {};
    for (const [prefix] of modelProviders) {
      const selected = document.getElementById('set-' + prefix + '-model').value;
      modelSettings[prefix + '_model'] = selected === ':custom'
        ? document.getElementById('set-' + prefix + '-custom-model').value.trim() : selected;
      modelSettings[prefix + '_effort'] = document.getElementById('set-' + prefix + '-effort').value;
    }
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          ...modelSettings,
          ai_provider: document.getElementById('set-ai-provider').value,
          codex_bin: document.getElementById('set-codex-bin').value.trim(),
          agy_bin: document.getElementById('set-agy-bin').value.trim(),
          target_test_count: document.getElementById('set-target-tests').value.trim(),
          compiler_path: document.getElementById('set-compiler-path').value.trim(),
          offline_mode: document.getElementById('set-offline-mode').value
        })
      });
      await refreshSystemStatus();
      await renderSettingsView();
      const saved = document.getElementById('settings-save-msg');
      saved.textContent = chinese ? '设置已保存' : 'Settings saved';
      saved.classList.remove('hidden');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'badge badge-err';
    }
  };
}

function attachSubmissionDetailModalHandlers() {
  document.querySelectorAll('.sub-row-clickable').forEach((row) => {
    row.onclick = async () => {
      const subId = row.getAttribute('data-sub-id');
      const { data } = await apiFetch(`/api/submissions/${subId}`);
      const s = data.submission;
      if (!s) return;
      const modal = document.getElementById('modal-backdrop');
      document.getElementById('modal-title').textContent = `Submission #${s.id} — ${s.problemId} (${formatVerdict(s.verdict)})`;
      document.getElementById('modal-body').innerHTML = `
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.8rem;">
          <span class="badge verdict-${s.verdict}">${escapeHtml(formatVerdict(s.verdict, s.currentTest, s.totalTests, s.firstFailedTest))}</span>
          <span class="badge">${s.mode === 'vp' ? t('modeVp') : t('modePractice')}</span>
          <span class="badge">${s.timeMs} ms / ${formatMemory(s.memoryBytes)}</span>
          <span class="badge">Package Rev #${s.packageRevision}</span>
          <span class="badge">${escapeHtml(s.toolchain)}</span>
        </div>
        ${
          s.compilerOutput
            ? `<h4>Compiler Diagnostics</h4>
               <pre style="background:#090d16;padding:0.75rem;border-radius:6px;overflow-x:auto;">${escapeHtml(s.compilerOutput)}</pre>`
            : ''
        }
        <h4>Submitted Source Code (GNU C++23)</h4>
        <pre style="background:#090d16;padding:0.75rem;border-radius:6px;overflow-x:auto;font-family:var(--font-mono);font-size:0.84rem;">${escapeHtml(s.sourceCode)}</pre>
      `;
      modal.classList.remove('hidden');
    };
  });
}

async function handleRouteChange() {
  updateTopbarChrome();
  const hash = location.hash || '#/contests';
  state.currentRoute = hash;

  const contestMatch = hash.match(/^#\/contest\/(\d+)$/);
  if (contestMatch) {
    await loadAndRenderContestView(Number(contestMatch[1]));
    return;
  }

  const probMatch = hash.match(/^#\/problem\/([0-9]+[A-Za-z0-9]+)$/);
  if (probMatch) {
    await loadAndRenderProblemView(probMatch[1].toUpperCase());
    return;
  }

  const edMatch = hash.match(/^#\/editorial\/(\d+)(?:\?problem=([A-Za-z0-9]+))?/);
  if (edMatch) {
    await loadAndRenderEditorialView(Number(edMatch[1]), edMatch[2] || null);
    return;
  }

  if (hash.startsWith('#/problemset')) {
    await renderProblemsetView();
    return;
  }

  if (hash.startsWith('#/submissions')) {
    await renderSubmissionsView();
    return;
  }

  if (hash.startsWith('#/settings')) {
    await renderSettingsView();
    return;
  }

  await renderContestsDashboard();
}

function connectSseEvents() {
  const es = new EventSource('/api/events');
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'submissionUpdate' && msg.submission) {
        updateProblemSubmissionState(msg.submission);
      } else if (msg.type === 'vpFinalized') {
        refreshSystemStatus();
        if (location.hash.startsWith('#/contest/')) {
          handleRouteChange();
        }
      } else if (msg.type === 'browserTransferReceived' || (msg.type === 'importProgress' && msg.progress?.status === 'completed')) {
        refreshSystemStatus();
        if (location.hash.startsWith('#/contest/') || location.hash === '#/contests') {
          handleRouteChange();
        }
      }
    } catch {}
  };
}

// Live 1-second local countdown tick for active VPs
function startVpCountdownTicker() {
  setInterval(async () => {
    if (!state.systemStatus?.activeVps?.length) return;
    const vp = state.systemStatus.activeVps[0];
    if (vp.phase === 'active') {
      vp.remainingMs = Math.max(0, vp.remainingMs - 1000);
      if (vp.remainingMs === 0) {
        await refreshSystemStatus();
        if (location.hash.startsWith('#/contest/') || location.hash.startsWith('#/editorial/')) {
          await handleRouteChange();
        }
      }
    } else if (vp.phase === 'scheduled') {
      vp.untilStartMs = Math.max(0, vp.untilStartMs - 1000);
      if (vp.untilStartMs === 0) {
        await refreshSystemStatus();
        await handleRouteChange();
      }
    }

    const vpPill = document.getElementById('active-vp-banner-pill');
    if (vpPill && !vpPill.classList.contains('hidden')) {
      const clock =
        vp.phase === 'scheduled'
          ? `${t('vpStartsInLabel')} ${formatDurationClock(vp.untilStartMs)}`
          : `${t('vpCountdownLabel')} ${formatDurationClock(vp.remainingMs)}`;
      vpPill.textContent = `VP #${vp.contestId} • ${clock}`;
    }

    const liveClockEl = document.getElementById('vp-live-clock');
    if (liveClockEl && (vp.phase === 'active' || vp.phase === 'scheduled')) {
      liveClockEl.textContent =
        vp.phase === 'scheduled'
          ? `${t('vpStartsInLabel')}: ${formatDurationClock(vp.untilStartMs)}`
          : `${t('vpCountdownLabel')}: ${formatDurationClock(vp.remainingMs)}`;
    }
  }, 1000);
}

async function initApp() {
  document.getElementById('lang-toggle-btn').onclick = toggleLanguage;
  document.getElementById('modal-close-btn').onclick = () => {
    document.getElementById('modal-backdrop').classList.add('hidden');
  };
  document.getElementById('modal-backdrop').onclick = (e) => {
    if (e.target.id === 'modal-backdrop') {
      document.getElementById('modal-backdrop').classList.add('hidden');
    }
  };

  window.addEventListener('hashchange', () => handleRouteChange());

  await refreshSystemStatus();
  if (state.systemStatus?.settings?.ui_language && !localStorage.getItem('cfoj_lang')) {
    state.lang = state.systemStatus.settings.ui_language;
  }
  updateTopbarChrome();
  connectSseEvents();
  startVpCountdownTicker();
  await handleRouteChange();
}

initApp();
