(() => {
  const statusEl = document.getElementById('page-status');
  const sendBtn = document.getElementById('send-contest-btn');
  const resultEl = document.getElementById('result-msg');
  const originInput = document.getElementById('cfoj-origin-input');

  let activeTabId = null;

  async function initPopup() {
    if (!globalThis.chrome?.tabs) {
      statusEl.textContent = 'Run inside Chrome/Edge extension popup on a Codeforces contest page.';
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs?.[0];
    if (!tab?.id || !tab.url || !/codeforces\.com\/(contest|gym)\//i.test(tab.url)) {
      statusEl.innerHTML =
        'Open a Codeforces contest problems page first:<br/><code>https://codeforces.com/contest/&lt;id&gt;/problems?locale=en</code>';
      sendBtn.disabled = true;
      return;
    }

    activeTabId = tab.id;

    // Ensure content.js is injected on the tab even if the extension was just installed/reloaded
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['content.js']
      });
    } catch {}

    chrome.tabs.sendMessage(activeTabId, { action: 'CFOJ_GET_PAGE_STATUS' }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) {
        statusEl.textContent =
          'Could not inspect page DOM. Reload the Codeforces tab after completing verification.';
        sendBtn.disabled = true;
        return;
      }

      if (resp.binding?.origin) {
        originInput.value = resp.binding.origin;
      }

      if (resp.isChallenge || resp.statementCount === 0) {
        statusEl.innerHTML =
          `Contest #${resp.contestId || '?'}: Complete the browser verification until the problem statements appear, then click below.<br/>` +
          `请先完成页面验证并确认题目题面已显示。`;
        sendBtn.disabled = true;
        return;
      }

      statusEl.innerHTML =
        `<strong>Detected Contest #${resp.contestId}</strong> (${resp.statementCount} problem statements ready)<br/>` +
        `已检测到比赛 #${resp.contestId}（共 ${resp.statementCount} 道题面就绪）`;
      sendBtn.disabled = false;
    });
  }

  sendBtn.onclick = () => {
    if (!activeTabId) return;
    sendBtn.disabled = true;
    resultEl.className = '';
    resultEl.textContent = 'Transferring contest statements to Offline CFOJ... / 正在传输题面...';

    chrome.tabs.sendMessage(
      activeTabId,
      {
        action: 'CFOJ_SEND_CONTEST',
        origin: originInput.value.trim()
      },
      (resp) => {
        if (chrome.runtime.lastError || !resp?.ok) {
          sendBtn.disabled = false;
          resultEl.className = 'msg-err';
          resultEl.textContent =
            resp?.error || chrome.runtime.lastError?.message || 'Transfer failed';
          return;
        }
        const indices = (resp.result?.importedProblems || []).join(', ');
        resultEl.className = 'msg-ok';
        resultEl.textContent = `✓ Sent Contest #${resp.result?.contestId} (${indices}) to Offline CFOJ! / 已成功导入并继续准备！`;
      }
    );
  };

  initPopup();
})();
