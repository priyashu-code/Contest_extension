/**
 * CodeChef content script.
 * Works on contest pages like:
 *   https://www.codechef.com/START150
 *   https://www.codechef.com/contests
 *
 * CodeChef's "Register" button typically becomes a disabled
 * "Registered" / "Participate" state once registration succeeds.
 */
(function () {
  const path = location.pathname;
  // Skip generic listing pages, only act on an actual contest page.
  if (path === '/' || path === '/contests' || path === '/contests/') return;

  function getContestMeta() {
    const name =
      document.querySelector('h1')?.textContent?.trim() ||
      document.title.replace(/\s*\|\s*CodeChef.*/i, '').trim();

    const startISO = window.ContestSyncCommon.findTimeTagISO();
    if (!startISO) {
      console.warn('[ContestSync][CodeChef] Could not determine start time from <time> tag.');
    }

    return {
      platform: 'CodeChef',
      name,
      url: location.href.split('?')[0],
      startISO,
      endISO: null
    };
  }

  function isRegisteredOnPage() {
    const bodyText = document.body.innerText || '';
    return /you have successfully registered/i.test(bodyText) ||
      Array.from(document.querySelectorAll('button')).some((b) =>
        /^(registered|participate)$/i.test((b.textContent || '').trim())
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
