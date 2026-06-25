/**
 * Shared helpers for all platform content scripts.
 * Exposes window.ContestSyncCommon with:
 *   - sendRegistration(contest)   -> tells background.js to sync to calendar/notion
 *   - showFloatingButton(getContestFn) -> manual fallback "Sync this contest" button
 *   - alreadySynced(id) / markSynced(id) -> per-tab dedupe so we don't spam on re-renders
 */
(function () {
  const synced = new Set();

  async function sendRegistration(contest) {
    if (!contest || !contest.name || !contest.startISO) {
      console.warn('[ContestSync] Incomplete contest data, not syncing:', contest);
      return;
    }
    const dedupeKey = `${contest.platform}-${contest.name}-${contest.startISO}`;
    if (synced.has(dedupeKey)) return;
    synced.add(dedupeKey);

    try {
      const result = await browser.runtime.sendMessage({
        type: 'CONTEST_REGISTERED',
        contest
      });
      console.log('[ContestSync] Sync result:', result);
    } catch (err) {
      console.error('[ContestSync] Failed to message background:', err);
    }
  }

  function showFloatingButton(getContestFn, label = 'Sync this contest to my calendar') {
    if (document.getElementById('contest-sync-fab')) return;

    const btn = document.createElement('button');
    btn.id = 'contest-sync-fab';
    btn.textContent = `📅 ${label}`;
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 999999,
      padding: '10px 16px',
      background: '#4f46e5',
      color: '#fff',
      border: 'none',
      borderRadius: '999px',
      fontSize: '13px',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      cursor: 'pointer'
    });

    btn.addEventListener('click', async () => {
      const contest = getContestFn();
      btn.textContent = '⏳ Syncing…';
      await sendRegistration(contest);
      btn.textContent = '✅ Synced!';
      setTimeout(() => btn.remove(), 2000);
    });

    document.body.appendChild(btn);
  }

  function findTimeTagISO() {
    const timeEl = document.querySelector('time[datetime]');
    return timeEl ? new Date(timeEl.getAttribute('datetime')).toISOString() : null;
  }

  window.ContestSyncCommon = { sendRegistration, showFloatingButton, findTimeTagISO };
})();
