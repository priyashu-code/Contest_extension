const $ = (id) => document.getElementById(id);

async function loadSettings() {
  const { settings } = await browser.storage.local.get('settings');
  const s = settings || {};

  $('clistUsername').value = s.clistUsername || '';
  $('clistApiKey').value = s.clistApiKey || '';

  $('googleEnabled').checked = !!s.googleEnabled;
  $('googleClientId').value = s.googleClientId || '';
  $('googleCalendarId').value = s.googleCalendarId || '';

  $('notionEnabled').checked = !!s.notionEnabled;
  $('notionToken').value = s.notionToken || '';
  $('notionDatabaseId').value = s.notionDatabaseId || '';

  $('extId').textContent = browser.runtime.id;
}

async function patchSettings(patch) {
  const { settings } = await browser.storage.local.get('settings');
  const merged = { ...(settings || {}), ...patch };
  await browser.storage.local.set({ settings: merged });
  return merged;
}

function flashStatus(el, message, ok = true) {
  el.textContent = message;
  el.className = `status ${ok ? 'ok' : 'err'}`;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

document.addEventListener('DOMContentLoaded', loadSettings);

$('saveClist').addEventListener('click', async () => {
  await patchSettings({
    clistUsername: $('clistUsername').value.trim(),
    clistApiKey: $('clistApiKey').value.trim()
  });
  flashStatus($('clistStatus'), 'Saved.');
});

$('pollNow').addEventListener('click', async () => {
  flashStatus($('clistStatus'), 'Checking…');
  try {
    await browser.runtime.sendMessage({ type: 'POLL_NOW' });
    flashStatus($('clistStatus'), 'Checked — you will be notified of any new contests.');
  } catch (err) {
    flashStatus($('clistStatus'), `Error: ${err.message}`, false);
  }
});

$('saveGoogle').addEventListener('click', async () => {
  await patchSettings({
    googleEnabled: $('googleEnabled').checked,
    googleClientId: $('googleClientId').value.trim(),
    googleCalendarId: $('googleCalendarId').value.trim()
  });
  flashStatus($('googleStatus'), 'Saved.');
});

$('testGoogle').addEventListener('click', async () => {
  flashStatus($('googleStatus'), 'Opening Google sign-in…');
  try {
    await browser.runtime.sendMessage({ type: 'TEST_GOOGLE_AUTH' });
    flashStatus($('googleStatus'), 'Connected to Google Calendar.');
  } catch (err) {
    flashStatus($('googleStatus'), `Error: ${err.message}`, false);
  }
});

$('saveNotion').addEventListener('click', async () => {
  await patchSettings({
    notionEnabled: $('notionEnabled').checked,
    notionToken: $('notionToken').value.trim(),
    notionDatabaseId: $('notionDatabaseId').value.trim()
  });
  flashStatus($('notionStatus'), 'Saved.');
});
