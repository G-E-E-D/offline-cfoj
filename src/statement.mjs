import crypto from 'node:crypto';
import path from 'node:path';

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&rarr;/gi, '→')
    .replace(/&larr;/gi, '←')
    .replace(/&le;/gi, '≤')
    .replace(/&ge;/gi, '≥')
    .replace(/&ne;/gi, '≠')
    .replace(/&hellip;/gi, '…')
    .replace(/&times;/gi, '×')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/gi, '&');
}

export function extractPreSampleText(preInnerHtml) {
  if (!preInnerHtml) return '';
  let s = preInnerHtml;
  // Codeforces uses <div class="test-example-line ...">line</div> without newlines between divs
  if (/<div[^>]*class=["'][^"']*test-example-line/i.test(s)) {
    s = s.replace(/<div[^>]*class=["'][^"']*test-example-line[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi, '$1\n');
  }
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeHtmlEntities(s);
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Preserve internal whitespace and line breaks; remove only leading newline from <pre>\n
  if (s.startsWith('\n')) s = s.slice(1);
  return s;
}

export function sanitizeHtmlFragment(html) {
  if (!html) return '';
  let s = html;
  // Remove dangerous tags completely
  s = s.replace(/<\s*(script|style|iframe|object|embed|form|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*(script|style|iframe|object|embed|form|link|meta)[^>]*\/?>/gi, '');
  // Remove inline event handlers and javascript: href/src
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\s+(href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, '');
  return s.trim();
}

export async function localizeHtmlAssets(html, contestId, assetResolver) {
  if (!html) return { html: '', assets: [] };
  const assets = [];
  const imgRegex = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*?)>/gi;
  const matches = [...html.matchAll(imgRegex)];
  let outHtml = html;

  for (const m of matches) {
    const fullTag = m[0];
    const beforeSrc = m[1];
    const quote = m[2];
    const rawUrl = m[3];
    const afterSrc = m[4];

    if (rawUrl.startsWith(`/api/contests/${contestId}/assets/`)) {
      const localFilename = path.posix.basename(rawUrl);
      assets.push({
        originalUrl: rawUrl,
        localFilename,
        apiPath: rawUrl,
        relativePath: `assets/${localFilename}`
      });
      continue;
    }

    const resolved = await assetResolver(rawUrl);
    const apiPath = `/api/contests/${contestId}/assets/${resolved.localFilename}`;
    assets.push({
      originalUrl: rawUrl,
      localFilename: resolved.localFilename,
      apiPath,
      relativePath: `assets/${resolved.localFilename}`
    });
    const newTag = `<img${beforeSrc}src=${quote}${apiPath}${quote}${afterSrc}>`;
    outHtml = outHtml.replace(fullTag, newTag);
  }

  return { html: sanitizeHtmlFragment(outHtml), assets };
}

function stripSectionTitle(sectionHtml) {
  if (!sectionHtml) return '';
  return sectionHtml.replace(/^\s*<div\s+class=["']section-title["'][^>]*>[\s\S]*?<\/div>\s*/i, '').trim();
}

function extractBalancedDivByClass(html, className, startPos = 0) {
  const openRe = new RegExp(`<div\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, 'gi');
  openRe.lastIndex = startPos;
  const match = openRe.exec(html);
  if (!match) return null;

  const contentStart = match.index + match[0].length;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = contentStart;
  let depth = 1;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return {
          outerStart: match.index,
          outerEnd: m.index + m[0].length,
          inner: html.slice(contentStart, m.index),
          openTag: match[0]
        };
      }
    } else if (!m[0].endsWith('/>')) {
      depth++;
    }
  }
  return null;
}

function extractFirstPlainDivAfter(html, startPos, stopPos) {
  const openRe = /<div\b([^>]*)>/gi;
  openRe.lastIndex = startPos;
  const match = openRe.exec(html);
  if (!match || match.index >= stopPos) return '';

  const contentStart = match.index + match[0].length;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = contentStart;
  let depth = 1;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return html.slice(contentStart, m.index);
      }
    } else if (!m[0].endsWith('/>')) {
      depth++;
    }
  }
  return '';
}

function stripTagsAndTitle(html) {
  if (!html) return '';
  const withoutTitle = html.replace(/<div\s+class=["']property-title["'][^>]*>[\s\S]*?<\/div>/gi, '');
  return decodeHtmlEntities(withoutTitle.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function parseTimeLimitMs(str) {
  const m = String(str || '').match(/([0-9]+(?:\.[0-9]+)?)\s*(second|sec|s|ms|millisecond)/i);
  if (!m) return 2000;
  const val = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('ms') || unit.startsWith('milli')) return Math.round(val);
  return Math.round(val * 1000);
}

export function parseMemoryLimitMb(str) {
  const m = String(str || '').match(/([0-9]+(?:\.[0-9]+)?)\s*(megabyte|mb|gigabyte|gb|kilobyte|kb)/i);
  if (!m) return 256;
  const val = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('g')) return Math.round(val * 1024);
  if (unit.startsWith('k')) return Math.max(16, Math.round(val / 1024));
  return Math.round(val);
}

export function compareProblemIndices(a, b) {
  const re = /^([A-Z]+)(\d*)$/i;
  const ma = String(a).trim().match(re);
  const mb = String(b).trim().match(re);
  if (ma && mb) {
    const la = ma[1].toUpperCase();
    const lb = mb[1].toUpperCase();
    if (la !== lb) return la.localeCompare(lb);
    const na = ma[2] ? parseInt(ma[2], 10) : 0;
    const nb = mb[2] ? parseInt(mb[2], 10) : 0;
    return na - nb;
  }
  return String(a).localeCompare(String(b));
}

export function isCloudflareChallengeHtml(html) {
  if (!html) return false;
  return (
    /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html) ||
    /challenges\.cloudflare\.com/i.test(html) ||
    /_cf_chl_opt/i.test(html)
  );
}

export function parseSingleProblemStatementDom(stmtInnerHtml, fallbackIndex = 'A') {
  const headerBox = extractBalancedDivByClass(stmtInnerHtml, 'header');
  const headerInner = headerBox ? headerBox.inner : '';

  const titleBox = extractBalancedDivByClass(headerInner, 'title');
  const rawTitle = stripTagsAndTitle(titleBox ? titleBox.inner : '') || `${fallbackIndex}. Problem`;
  const titleMatch = rawTitle.match(/^([A-Z]\d*)\s*\.\s*(.+)$/i);
  const problemIndex = titleMatch ? titleMatch[1].toUpperCase() : fallbackIndex;
  const cleanTitle = titleMatch ? titleMatch[2].trim() : rawTitle;

  const tlBox = extractBalancedDivByClass(headerInner, 'time-limit');
  const mlBox = extractBalancedDivByClass(headerInner, 'memory-limit');
  const inFileBox = extractBalancedDivByClass(headerInner, 'input-file');
  const outFileBox = extractBalancedDivByClass(headerInner, 'output-file');

  const timeLimitText = stripTagsAndTitle(tlBox ? tlBox.inner : '') || '2 seconds';
  const memoryLimitText = stripTagsAndTitle(mlBox ? mlBox.inner : '') || '256 megabytes';
  const inputFile = stripTagsAndTitle(inFileBox ? inFileBox.inner : '') || 'standard input';
  const outputFile = stripTagsAndTitle(outFileBox ? outFileBox.inner : '') || 'standard output';

  const inputSpecBox = extractBalancedDivByClass(stmtInnerHtml, 'input-specification');
  const interactionBox = extractBalancedDivByClass(stmtInnerHtml, 'interaction');
  const outputSpecBox = extractBalancedDivByClass(stmtInnerHtml, 'output-specification');
  const sampleTestsBox = extractBalancedDivByClass(stmtInnerHtml, 'sample-tests');
  const noteBox = extractBalancedDivByClass(stmtInnerHtml, 'note');

  const afterHeaderPos = headerBox ? headerBox.outerEnd : 0;
  const firstSectionPos = Math.min(
    ...[inputSpecBox, interactionBox, outputSpecBox, sampleTestsBox, noteBox]
      .filter(Boolean)
      .map((b) => b.outerStart),
    stmtInnerHtml.length
  );

  const descriptionRaw = extractFirstPlainDivAfter(stmtInnerHtml, afterHeaderPos, firstSectionPos);
  const inputSpecRaw = inputSpecBox ? stripSectionTitle(inputSpecBox.inner) : '';
  const interactionRaw = interactionBox ? stripSectionTitle(interactionBox.inner) : '';
  const outputSpecRaw = outputSpecBox
    ? stripSectionTitle(outputSpecBox.inner)
    : interactionRaw
      ? interactionRaw
      : '';
  const noteRaw = noteBox ? stripSectionTitle(noteBox.inner) : '';

  // Extract sample pairs
  const samples = [];
  if (sampleTestsBox) {
    const stHtml = sampleTestsBox.inner;
    const inputs = [];
    const outputs = [];
    let pos = 0;
    while (pos < stHtml.length) {
      const inBox = extractBalancedDivByClass(stHtml, 'input', pos);
      if (!inBox) break;
      const preMatch = inBox.inner.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) inputs.push(extractPreSampleText(preMatch[1]));
      pos = inBox.outerEnd;
    }
    pos = 0;
    while (pos < stHtml.length) {
      const outBox = extractBalancedDivByClass(stHtml, 'output', pos);
      if (!outBox) break;
      const preMatch = outBox.inner.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) outputs.push(extractPreSampleText(preMatch[1]));
      pos = outBox.outerEnd;
    }
    const pairCount = Math.min(inputs.length, outputs.length);
    for (let i = 0; i < pairCount; i++) {
      samples.push({ input: inputs[i], output: outputs[i] });
    }
  }

  let problemType = 'batch';
  let missingComponent = null;
  if (interactionBox || /This is an interactive problem/i.test(stmtInnerHtml)) {
    problemType = 'interactive';
    missingComponent = 'interactor_binary';
  } else if (/output-only problem/i.test(stmtInnerHtml)) {
    problemType = 'output_only';
    missingComponent = 'answer_archive';
  }

  return {
    problemIndex,
    title: cleanTitle,
    timeLimitText,
    timeLimitMs: parseTimeLimitMs(timeLimitText),
    memoryLimitText,
    memoryLimitMb: parseMemoryLimitMb(memoryLimitText),
    inputFile,
    outputFile,
    problemType,
    missingComponent,
    descriptionHtml: sanitizeHtmlFragment(descriptionRaw),
    inputSpecHtml: sanitizeHtmlFragment(inputSpecRaw),
    outputSpecHtml: sanitizeHtmlFragment(outputSpecRaw),
    noteHtml: sanitizeHtmlFragment(noteRaw),
    samples
  };
}

export function parseContestProblemsHtml(html) {
  if (isCloudflareChallengeHtml(html)) {
    const err = new Error('Blocked by Codeforces Cloudflare anti-bot challenge (HTTP 403 / Turnstile).');
    err.code = 'CLOUDFLARE_CHALLENGE';
    throw err;
  }

  // Discover tutorial links in sidebar
  let tutorialUrl = null;
  const linkMatches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of linkMatches) {
    const href = m[1];
    const label = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, '')).trim();
    if (/tutorial|editorial|analysis|разбор/i.test(label)) {
      tutorialUrl = href.startsWith('http') ? href : `https://codeforces.com${href.startsWith('/') ? '' : '/'}${href}`;
      break;
    }
  }

  const problems = [];
  let pos = 0;
  while (pos < html.length) {
    const holder = extractBalancedDivByClass(html, 'problemindexholder', pos);
    if (!holder) break;
    const attrMatch = holder.openTag.match(/problemindex=["']([^"']+)["']/i);
    const fallbackIdx = attrMatch ? attrMatch[1].toUpperCase() : 'A';
    const stmtBox = extractBalancedDivByClass(holder.inner, 'problem-statement');
    if (stmtBox) {
      problems.push(parseSingleProblemStatementDom(stmtBox.inner, fallbackIdx));
    }
    pos = holder.outerEnd;
  }

  if (problems.length === 0) {
    const singleStmt = extractBalancedDivByClass(html, 'problem-statement');
    if (singleStmt) {
      problems.push(parseSingleProblemStatementDom(singleStmt.inner, 'A'));
    }
  }

  problems.sort((a, b) => compareProblemIndices(a.problemIndex, b.problemIndex));
  return { problems, tutorialUrl };
}

export function extractProtectedFragments(statement) {
  const combinedHtml = [
    statement.descriptionHtml || '',
    statement.inputSpecHtml || '',
    statement.outputSpecHtml || '',
    statement.noteHtml || ''
  ].join('\n');

  const mathSet = new Set();
  for (const m of combinedHtml.matchAll(/\$\$\$([\s\S]*?)\$\$\$/g)) {
    const expr = m[1].trim().replace(/\s+/g, ' ');
    if (expr) mathSet.add(expr);
  }

  const codeSet = new Set();
  for (const m of combinedHtml.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gi)) {
    const tok = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '')).trim();
    if (tok) codeSet.add(tok);
  }

  const imgSet = new Set();
  for (const m of combinedHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    imgSet.add(m[1].trim());
  }

  return {
    math: [...mathSet],
    codeTokens: [...codeSet],
    images: [...imgSet],
    sampleHashes: (statement.samples || []).map((s) =>
      crypto.createHash('sha256').update(`${s.input}\0${s.output}`).digest('hex')
    )
  };
}

export function validateTranslatedStatement(enStatement, zhStatement) {
  const errors = [];
  if (!zhStatement || typeof zhStatement !== 'object') {
    return { valid: false, errors: ['Translation payload is empty or not an object'] };
  }

  const zhCombined = [
    zhStatement.title || '',
    zhStatement.descriptionHtml || '',
    zhStatement.inputSpecHtml || '',
    zhStatement.outputSpecHtml || '',
    zhStatement.noteHtml || ''
  ].join('\n');

  if (!/[\u4e00-\u9fff]/.test(zhCombined)) {
    errors.push('Translated statement does not contain Simplified Chinese characters');
  }
  if (!zhStatement.descriptionHtml || !zhStatement.inputSpecHtml || !zhStatement.outputSpecHtml) {
    errors.push('Translated statement is missing required sections (description, inputSpec, or outputSpec)');
  }

  const protectedFrags = extractProtectedFragments(enStatement);
  const normalizedZh = zhCombined.replace(/\s+/g, ' ');

  for (const expr of protectedFrags.math) {
    if (!normalizedZh.includes(expr)) {
      errors.push(`Protected math formula missing or altered in translation: $$$${expr}$$$`);
    }
  }

  for (const tok of protectedFrags.codeTokens) {
    if (!zhCombined.includes(tok)) {
      errors.push(`Protected literal token/code '${tok}' missing in translation`);
    }
  }

  for (const imgSrc of protectedFrags.images) {
    if (!zhCombined.includes(imgSrc)) {
      errors.push(`Protected figure/image reference '${imgSrc}' missing in translation`);
    }
  }

  const zhSamples = zhStatement.samples || [];
  const enSamples = enStatement.samples || [];
  if (zhSamples.length !== enSamples.length) {
    errors.push(`Sample count mismatch: expected ${enSamples.length}, got ${zhSamples.length}`);
  } else {
    for (let i = 0; i < enSamples.length; i++) {
      if (zhSamples[i].input !== enSamples[i].input || zhSamples[i].output !== enSamples[i].output) {
        errors.push(`Sample #${i + 1} data was modified during translation`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    protectedCounts: {
      math: protectedFrags.math.length,
      codeTokens: protectedFrags.codeTokens.length,
      images: protectedFrags.images.length,
      samples: enSamples.length
    }
  };
}
