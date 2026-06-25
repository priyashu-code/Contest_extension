/**
 * AtCoder content script.
 * Works on contest pages like:
 *   https://atcoder.jp/contests/abc300
 *
 * AtCoder shows a green "Register" button which becomes a
 * "Register" -> "Cancel registration" link/button pair once registered.
 */
(function () {
  const match = location.pathname.match(/\/contests\/([a-z0-9-]+)/i);
  if (!match) return;
  const slug = match[1];

  function getContestMeta() {
    const name =
      document.querySelector('#contest-nav-tabs')?.previousElementSibling?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      document.title.replace(/\s*-\s*AtCoder.*/i, '').trim() ||
      slug;

    const startISO = window.ContestSyncCommon.findTimeTagISO();
    if (!startISO) {
      console.warn('[ContestSync][AtCoder] Could not determine start time from <time> tag.');
    }

    return {
      platform: 'AtCoder',
      name,
      url: `https://atcoder.jp/contests/${slug}`,
      startISO,
      endISO: null
    };
  }

  function isRegisteredOnPage() {
    return Array.from(document.querySelectorAll('a, button')).some((el) =>
      /cancel registration/i.test((el.textContent || '').trim())
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
