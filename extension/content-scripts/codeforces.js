/**
 * Codeforces content script.
 * Works on contest pages like:
 *   https://codeforces.com/contest/1234
 *   https://codeforces.com/contestRegistration/1234
 */
(async function () {
  const match = location.pathname.match(/\/contest(?:Registration)?\/(\d+)/);
  if (!match) return;
  const contestId = match[1];

  async function fetchContestMeta() {
    const resp = await browser.runtime.sendMessage({
      type: 'FETCH_JSON',
      url: 'https://codeforces.com/api/contest.list'
    });
    if (resp?.error) {
      console.warn('[ContestSync][CF] API error:', resp.error);
      return null;
    }
    const contest = resp.data?.result?.find((c) => String(c.id) === contestId);
    if (!contest) return null;

    const startISO = new Date(contest.startTimeSeconds * 1000).toISOString();
    const endISO = new Date((contest.startTimeSeconds + contest.durationSeconds) * 1000).toISOString();
    return {
      platform: 'Codeforces',
      name: contest.name,
      url: `https://codeforces.com/contest/${contestId}`,
      startISO,
      endISO
    };
  }

  function isRegisteredOnPage() {
    const bodyText = document.body.innerText || '';
    return /you have registered for this contest/i.test(bodyText) ||
      Array.from(document.querySelectorAll('a')).some((a) => /unregister/i.test(a.textContent || ''));
  }

  const contestMeta = await fetchContestMeta();
  if (!contestMeta) return;

  // Manual fallback button — always available.
  window.ContestSyncCommon.showFloatingButton(() => contestMeta);

  // Auto-detect: watch for the "registered" state appearing after the user
  // clicks Register (Codeforces re-renders the page / shows a confirmation).
  let alreadyTriggered = isRegisteredOnPage();
  const observer = new MutationObserver(() => {
    if (!alreadyTriggered && isRegisteredOnPage()) {
      alreadyTriggered = true;
      window.ContestSyncCommon.sendRegistration(contestMeta);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
