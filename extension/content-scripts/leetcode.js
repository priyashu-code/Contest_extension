/**
 * LeetCode content script.
 * Works on contest pages like:
 *   https://leetcode.com/contest/weekly-contest-410/
 *
 * NOTE: LeetCode renders via Next.js and embeds page data in a
 * <script id="__NEXT_DATA__"> JSON blob. Field paths can shift between
 * deploys — if auto-parsing fails, the floating "Sync this contest"
 * button still works using the <time> tag fallback.
 */
(function () {
  const match = location.pathname.match(/\/contest\/([a-z0-9-]+)\/?$/i);
  if (!match) return;
  const slug = match[1];

  function tryParseNextData() {
    try {
      const script = document.getElementById('__NEXT_DATA__');
      if (!script) return null;
      const json = JSON.parse(script.textContent);
      const contest = json?.props?.pageProps?.contest;
      if (!contest?.startTime) return null;
      const startISO = new Date(contest.startTime * 1000).toISOString();
      const endISO = new Date((contest.startTime + (contest.duration || 5400)) * 1000).toISOString();
      return { startISO, endISO, name: contest.title };
    } catch {
      return null;
    }
  }

  function getContestMeta() {
    const parsed = tryParseNextData();
    const name = parsed?.name || document.title.replace(/\s*-\s*LeetCode.*/i, '').trim() || slug;
    const startISO = parsed?.startISO || window.ContestSyncCommon.findTimeTagISO();
    if (!startISO) {
      console.warn('[ContestSync][LeetCode] Could not determine start time for', slug);
    }
    return {
      platform: 'LeetCode',
      name,
      url: location.href.split('?')[0],
      startISO,
      endISO: parsed?.endISO || null
    };
  }

  function isRegisteredOnPage() {
    return Array.from(document.querySelectorAll('button, a')).some((el) =>
      /^registered$/i.test((el.textContent || '').trim())
    );
  }

  window.ContestSyncCommon.showFloatingButton(getContestMeta);

  let alreadyTriggered = isRegisteredOnPage();
  const observer = new MutationObserver(() => {
    if (!alreadyTriggered && isRegisteredOnPage()) {
      alreadyTriggered = true;
      window.ContestSyncCommon.sendRegistration(getContestMeta());
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
