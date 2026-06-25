/**
 * HackerRank content script.
 * Works on contest pages like:
 *   https://www.hackerrank.com/contests/<slug>
 */
(function () {
  const match = location.pathname.match(/\/contests\/([a-z0-9-]+)/i);
  if (!match) return;
  const slug = match[1];

  function getContestMeta() {
    const name =
      document.querySelector('h1')?.textContent?.trim() ||
      document.title.replace(/\s*\|\s*HackerRank.*/i, '').trim() ||
      slug;

    const startISO = window.ContestSyncCommon.findTimeTagISO();
    if (!startISO) {
      console.warn('[ContestSync][HackerRank] Could not determine start time from <time> tag.');
    }

    return {
      platform: 'HackerRank',
      name,
      url: location.href.split('?')[0],
      startISO,
      endISO: null
    };
  }

  function isRegisteredOnPage() {
    const bodyText = document.body.innerText || '';
    return /you.{0,3}re (in|registered)/i.test(bodyText) ||
      Array.from(document.querySelectorAll('button, a')).some((el) =>
        /registered/i.test((el.textContent || '').trim())
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
