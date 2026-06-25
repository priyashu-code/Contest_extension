const listEl = document.getElementById('list');

async function render(contests) {
  if (!contests || contests.length === 0) {
    listEl.innerHTML = '<div class="empty">No upcoming contests cached yet.<br>Set up clist.by in Settings, then hit "Check now".</div>';
    return;
  }

  const { registeredContests } = await browser.storage.local.get('registeredContests');
  const registeredSet = new Set(registeredContests || []);

  listEl.innerHTML = contests.slice(0, 15).map((c, i) => {
    const start = new Date(c.start);
    const niceTime = start.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const url = c.href || '';
    const isRegistered = registeredSet.has(normalize(url));
    const badge = isRegistered
      ? '<span class="badge registered">✅ Registered</span>'
      : '<span class="badge">Not registered yet</span>';
    return `
      <div class="item" data-url="${escapeHtml(url)}" data-idx="${i}">
        <div class="name">${escapeHtml(c.event)}</div>
        <div class="meta">${escapeHtml(c.resource)} · ${niceTime}</div>
        ${badge}
      </div>`;
  }).join('');

  listEl.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', () => {
      const url = el.getAttribute('data-url');
      if (url) browser.tabs.create({ url });
    });
  });
}

function normalize(url) {
  return (url || '').replace(/\/+$/, '').toLowerCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function load() {
  const { lastContests } = await browser.storage.local.get('lastContests');
  render(lastContests);
}

document.getElementById('refresh').addEventListener('click', async () => {
  listEl.innerHTML = '<div class="empty">Checking…</div>';
  await browser.runtime.sendMessage({ type: 'POLL_NOW' });
  await load();
});

document.getElementById('openOptions').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

load();
