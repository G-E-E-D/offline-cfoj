(() => {
  const STORAGE_KEY = 'cfoj_transfer_binding';
  const DEFAULT_ORIGIN = 'http://127.0.0.1:4321';

  function parseHashBinding() {
    const hash = String(location.hash || '');
    if (!hash.includes('cfoj_token=')) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const token = params.get('cfoj_token');
    const contestId = params.get('cfoj_contest');
    const origin = params.get('cfoj_origin') || DEFAULT_ORIGIN;
    if (!token) return null;

    const binding = {
      token,
      contestId: contestId ? Number(contestId) : detectPageContestId(),
      origin: origin.replace(/\/+$/, ''),
      savedAt: Date.now()
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(binding));
    } catch {}
    try {
      if (globalThis.chrome?.storage?.local) {
        globalThis.chrome.storage.local.set({ [STORAGE_KEY]: binding });
      }
    } catch {}

    // Clean the token from the visible URL bar so it is never leaked
    try {
      history.replaceState(null, document.title, location.pathname + location.search);
    } catch {}
    return binding;
  }

  function getSavedBinding() {
    const fromHash = parseHashBinding();
    if (fromHash) return fromHash;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function detectPageContestId(doc = document, urlStr = location.href) {
    const m = String(urlStr).match(/\/(?:contest|gym)\/(\d+)/i);
    if (m) return Number(m[1]);
    const bodyAttr = doc.body?.getAttribute('data-contest-id');
    if (bodyAttr && /^\d+$/.test(bodyAttr)) return Number(bodyAttr);
    const link = doc.querySelector('a[href*="/contest/"]');
    if (link) {
      const lm = (link.getAttribute('href') || '').match(/\/contest\/(\d+)/i);
      if (lm) return Number(lm[1]);
    }
    return null;
  }

  function isChallengePage(doc = document) {
    const title = (doc.title || '').trim();
    if (/^Just a moment\.\.\.$/i.test(title)) return true;
    if (doc.querySelector('#challenge-error-text, #cf-challenge-running')) return true;
    return false;
  }

  // Restore MathJax / KaTeX DOM nodes inside a cloned statement back to original $$$...$$$ TeX
  function restoreOriginalMathInClone(root) {
    // MathJax v2 stores original TeX inside <script type="math/tex"> or <script type="math/tex; mode=display">
    const mathScripts = [...root.querySelectorAll('script[type^="math/tex"]')];
    for (const sc of mathScripts) {
      const tex = (sc.textContent || '').trim();
      const marker = root.ownerDocument.createTextNode(`$$$${tex}$$$`);
      sc.parentNode.replaceChild(marker, sc);
    }

    // KaTeX stores original TeX inside <annotation encoding="application/x-tex">
    const katexNodes = [...root.querySelectorAll('.katex')];
    for (const kn of katexNodes) {
      const ann = kn.querySelector('annotation[encoding="application/x-tex"]');
      if (ann) {
        const tex = (ann.textContent || '').trim();
        const marker = root.ownerDocument.createTextNode(`$$$${tex}$$$`);
        kn.parentNode.replaceChild(marker, kn);
      }
    }

    // Remove MathJax rendered preview/output spans so only the $$$...$$$ TeX remains
    const mjTrash = root.querySelectorAll(
      '.MathJax_Preview, .MathJax, .MathJax_Display, .MathJax_SVG, .MathJax_CHTML, mjx-container, .MJX_Assistive_MathML'
    );
    for (const el of mjTrash) {
      el.remove();
    }
  }

  function stripUnsafeElements(root) {
    const unsafe = root.querySelectorAll('script, style, iframe, object, embed, form, input, button');
    for (const el of unsafe) {
      el.remove();
    }
    const all = root.querySelectorAll('*');
    for (const el of all) {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || ( (name === 'href' || name === 'src') && attr.value.trim().toLowerCase().startsWith('javascript:') )) {
          el.removeAttribute(attr.name);
        }
      }
    }
  }

  async function captureImageAssetBytes(imgUrl) {
    try {
      const res = await fetch(imgUrl, { credentials: 'same-origin' });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const cleanPath = imgUrl.split('?')[0];
      const filename = cleanPath.split('/').pop() || 'diagram.png';
      return {
        url: imgUrl,
        filename,
        dataBase64: btoa(binary)
      };
    } catch {
      return null;
    }
  }

  // Capture ONLY the displayed contest material (statements, sample blocks, math, diagrams, tutorial links).
  // Never accesses or transmits cookies, session storage, or account headers.
  async function extractDisplayedContestMaterial(doc = document, pageUrl = location.href) {
    if (isChallengePage(doc)) {
      throw new Error(
        'Cloudflare verification is still active on this tab. Please complete the challenge until the problem statements are visible.'
      );
    }

    const contestId = detectPageContestId(doc, pageUrl);
    let holders = [...doc.querySelectorAll('.problemindexholder')];

    if (holders.length === 0) {
      const singleStmts = [...doc.querySelectorAll('.problem-statement')];
      holders = singleStmts.map((stmt) => {
        const wrapper = doc.createElement('div');
        wrapper.className = 'problemindexholder';
        const titleText = stmt.querySelector('.header .title')?.textContent?.trim() || 'A. Problem';
        const idxMatch = titleText.match(/^([A-Z]\d*)\s*\./i);
        wrapper.setAttribute('problemindex', idxMatch ? idxMatch[1].toUpperCase() : 'A');
        wrapper.appendChild(stmt.cloneNode(true));
        return wrapper;
      });
    }

    if (holders.length === 0) {
      throw new Error(
        'No Codeforces problem statements (.problem-statement) were found on this page. Open https://codeforces.com/contest/<id>/problems?locale=en first.'
      );
    }

    const problemIndices = [];
    const holderHtmlBlocks = [];
    const imageUrlsToCapture = new Set();

    for (const h of holders) {
      const clone = h.cloneNode(true);
      let idx = (clone.getAttribute('problemindex') || '').trim().toUpperCase();
      if (!idx) {
        const tText = clone.querySelector('.header .title')?.textContent?.trim() || 'A.';
        const m = tText.match(/^([A-Z]\d*)\s*\./i);
        idx = m ? m[1].toUpperCase() : 'A';
        clone.setAttribute('problemindex', idx);
      }
      problemIndices.push(idx);

      restoreOriginalMathInClone(clone);

      // Normalize image URLs inside the statement
      for (const img of clone.querySelectorAll('img')) {
        const rawSrc = img.getAttribute('src') || '';
        if (!rawSrc) continue;
        try {
          const absUrl = new URL(rawSrc, pageUrl).href;
          img.setAttribute('src', absUrl);
          imageUrlsToCapture.add(absUrl);
        } catch {}
      }

      stripUnsafeElements(clone);
      holderHtmlBlocks.push(clone.outerHTML);
    }

    // Capture tutorial/materials sidebar links only
    let sidebarHtml = '';
    const sidebarBox = doc.querySelector('.sidebar-menu');
    if (sidebarBox) {
      const sbClone = sidebarBox.cloneNode(true);
      stripUnsafeElements(sbClone);
      sidebarHtml = `<div id="sidebar">${sbClone.outerHTML}</div>`;
    }

    const capturedAssets = [];
    for (const imgUrl of imageUrlsToCapture) {
      const asset = await captureImageAssetBytes(imgUrl);
      if (asset) capturedAssets.push(asset);
    }

    const cleanHtml = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head><meta charset="utf-8" /><title>Codeforces Contest Problems</title></head>',
      `<body data-contest-id="${contestId || ''}">`,
      sidebarHtml,
      ...holderHtmlBlocks,
      '</body>',
      '</html>'
    ].join('\n');

    return {
      contestId,
      pageUrl,
      problemIndices,
      html: cleanHtml,
      assets: capturedAssets
    };
  }

  async function resolveTransferBinding(contestId, overrideOrigin = null, overrideToken = null) {
    const saved = getSavedBinding();
    const origin = (overrideOrigin || saved?.origin || DEFAULT_ORIGIN).replace(/\/+$/, '');
    if (overrideToken) {
      return { origin, token: overrideToken, contestId };
    }
    if (saved?.token && (!saved.contestId || !contestId || Number(saved.contestId) === Number(contestId))) {
      return { origin, token: saved.token, contestId: saved.contestId || contestId };
    }

    // Query loopback CFOJ for an already-pending browser import token for this contest
    const q = contestId ? `?contestId=${encodeURIComponent(contestId)}` : '';
    const res = await fetch(`${origin}/api/browser-import/pending${q}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.pending?.token) {
      throw new Error(
        data.error ||
          `No pending browser import token found in Offline CFOJ for contest #${contestId || '?'}. Click "Continue in browser" in CFOJ first.`
      );
    }
    return {
      origin,
      token: data.pending.token,
      contestId: data.pending.contestId
    };
  }

  async function sendContestToCfoj(options = {}) {
    const extracted = await extractDisplayedContestMaterial(
      options.document || document,
      options.pageUrl || location.href
    );
    const binding = await resolveTransferBinding(
      options.contestId ?? extracted.contestId,
      options.origin || null,
      options.token || null
    );

    const res = await fetch(`${binding.origin}/api/browser-import/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CFOJ-Token': binding.token
      },
      body: JSON.stringify({
        token: binding.token,
        contestId: extracted.contestId,
        pageUrl: extracted.pageUrl,
        html: extracted.html,
        assets: extracted.assets,
        awaitPreparation: options.awaitPreparation !== false
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || `CFOJ rejected transfer (${res.status})`);
      err.code = data.code || 'TRANSFER_REJECTED';
      err.data = data;
      throw err;
    }

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    return data;
  }

  function injectFloatingTransferButton() {
    if (document.getElementById('cfoj-extension-floating-bar')) return;
    const hasStatements = document.querySelectorAll('.problem-statement').length > 0;
    const saved = getSavedBinding();
    if (!hasStatements && !saved) return;

    const bar = document.createElement('div');
    bar.id = 'cfoj-extension-floating-bar';
    bar.style.cssText = [
      'position:fixed',
      'bottom:18px',
      'right:18px',
      'z-index:2147483647',
      'background:#0f172a',
      'color:#f1f5f9',
      'border:2px solid #38bdf8',
      'border-radius:10px',
      'padding:10px 14px',
      'box-shadow:0 10px 25px rgba(0,0,0,0.45)',
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:13px',
      'display:flex',
      'align-items:center',
      'gap:10px'
    ].join(';');

    const cid = detectPageContestId();
    const stmtCount = document.querySelectorAll('.problem-statement').length;

    const label = document.createElement('span');
    label.id = 'cfoj-extension-status-text';
    label.textContent = hasStatements
      ? `CFOJ • Contest #${cid || '?'} (${stmtCount} problems)`
      : `CFOJ • Complete verification to send Contest #${saved?.contestId || cid || '?'}`;

    const btn = document.createElement('button');
    btn.id = 'cfoj-send-contest-btn';
    btn.type = 'button';
    btn.textContent = 'Send this contest to CFOJ / 发送本场比赛至 CFOJ';
    btn.disabled = !hasStatements;
    btn.style.cssText = [
      'background:#0284c7',
      'color:#ffffff',
      'border:1px solid #38bdf8',
      'border-radius:7px',
      'padding:6px 12px',
      'font-weight:600',
      'cursor:' + (hasStatements ? 'pointer' : 'not-allowed'),
      'opacity:' + (hasStatements ? '1' : '0.6')
    ].join(';');

    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = 'Sending to Offline CFOJ... / 正在发送至 CFOJ...';
      try {
        const res = await sendContestToCfoj();
        btn.style.background = '#15803d';
        btn.textContent = `✓ Sent (${(res.importedProblems || []).join(', ')}) to CFOJ!`;
      } catch (err) {
        btn.disabled = false;
        btn.style.background = '#b91c1c';
        btn.textContent = 'Retry: Send this contest to CFOJ';
        label.textContent = `Error: ${err.message}`;
      }
    };

    bar.appendChild(label);
    bar.appendChild(btn);
    document.body?.appendChild(bar);
  }

  // Expose helper for extension popup messages and automated headless browser tests
  globalThis.__CFOJ_EXTENSION__ = {
    extractDisplayedContestMaterial,
    sendContestToCfoj,
    parseHashBinding,
    getSavedBinding,
    injectFloatingTransferButton
  };

  if (globalThis.chrome?.runtime?.onMessage) {
    globalThis.chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.action === 'CFOJ_GET_PAGE_STATUS') {
        const cid = detectPageContestId();
        const count = document.querySelectorAll('.problem-statement').length;
        const binding = getSavedBinding();
        sendResponse({
          ok: true,
          contestId: cid,
          statementCount: count,
          isChallenge: isChallengePage(),
          binding
        });
        return true;
      }
      if (msg?.action === 'CFOJ_SEND_CONTEST') {
        sendContestToCfoj({
          origin: msg.origin || null,
          token: msg.token || null
        })
          .then((res) => sendResponse({ ok: true, result: res }))
          .catch((err) =>
            sendResponse({ ok: false, error: err.message, code: err.code, data: err.data })
          );
        return true;
      }
      return false;
    });
  }

  parseHashBinding();
  injectFloatingTransferButton();
})();
