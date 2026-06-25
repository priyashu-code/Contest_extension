import './lib/browser-polyfill.js';

/**
 * ===================================================================
 * Contest Sync — background service worker
 * ===================================================================
 * Responsibilities:
 *  1. Poll clist.by every POLL_INTERVAL_MIN minutes for upcoming
 *     contests on Codeforces / LeetCode / CodeChef / HackerRank / AtCoder.
 *     Fire a browser notification the first time a contest is seen.
 *  2. Listen for "registered" messages from the per-site content
 *     scripts (fired when the user successfully registers for a
 *     contest on that site).
 *  3. On registration: create a Google Calendar event (with 1-day and
 *     1-hour-before reminders) and, if configured, a Notion database row.
 * ===================================================================
 */

const POLL_INTERVAL_MIN = 30; // how often to check for new contests
const ALARM_NAME = 'contest-sync-poll';
const SEEN_KEY = 'seenContestIds';
const SETTINGS_KEY = 'settings';

const RESOURCES = [
  'codeforces.com',
  'leetcode.com',
  'codechef.com',
  'hackerrank.com',
  'atcoder.jp'
];

// ---------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------
browser.runtime.onInstalled.addListener(() => {
  browser.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MIN });
  pollContests(); // run once immediately on install
});

browser.runtime.onStartup.addListener(() => {
  browser.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MIN });
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) pollContests();
});

// Messages from content scripts (registration detected) or popup/options
browser.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === 'CONTEST_REGISTERED') {
    return handleRegistration(msg.contest);
  }
  if (msg?.type === 'POLL_NOW') {
    return pollContests();
  }
  if (msg?.type === 'TEST_GOOGLE_AUTH') {
    return getGoogleToken(true);
  }
  if (msg?.type === 'FETCH_JSON') {
    try {
      const res = await fetch(msg.url);
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return { data: await res.json() };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ---------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------
async function getSettings() {
  const { [SETTINGS_KEY]: settings } = await browser.storage.local.get(SETTINGS_KEY);
  return settings || {};
}

async function getSeenIds() {
  const { [SEEN_KEY]: seen } = await browser.storage.local.get(SEEN_KEY);
  return new Set(seen || []);
}

async function saveSeenIds(set) {
  await browser.storage.local.set({ [SEEN_KEY]: Array.from(set) });
}

// ---------------------------------------------------------------
// 1. Contest discovery via clist.by
// ---------------------------------------------------------------
async function pollContests() {
  const settings = await getSettings();
  if (!settings.clistUsername || !settings.clistApiKey) {
    console.log('[ContestSync] clist.by credentials not set, skipping poll');
    return;
  }

  const now = new Date().toISOString();
  const url = new URL('https://clist.by/api/v2/contest/');
  url.searchParams.set('username', settings.clistUsername);
  url.searchParams.set('api_key', settings.clistApiKey);
  url.searchParams.set('resource__in', RESOURCES.join(','));
  url.searchParams.set('start__gt', now);
  url.searchParams.set('order_by', 'start');
  url.searchParams.set('limit', '50');
  url.searchParams.set('format', 'json');

  let data;
  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`clist.by responded ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error('[ContestSync] Failed to fetch contests:', err);
    return;
  }

  const seen = await getSeenIds();
  const contests = data?.objects || [];

  for (const contest of contests) {
    const id = String(contest.id);
    if (seen.has(id)) continue;
    seen.add(id);

    notifyNewContest(contest);
  }

  await saveSeenIds(seen);
  await browser.storage.local.set({
    lastContests: contests.slice(0, 25),
    lastPolledAt: Date.now()
  });
}

function notifyNewContest(contest) {
  const start = new Date(contest.start);
  const niceTime = start.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  browser.notifications.create(`contest-${contest.id}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon128.png'),
    title: `New contest: ${contest.event}`,
    message: `${contest.resource} — starts ${niceTime}. Register on the site to auto-sync it to your calendar.`,
    priority: 2
  });
}

// ---------------------------------------------------------------
// 2 & 3. Registration -> Calendar + Notion
// ---------------------------------------------------------------
async function handleRegistration(contest) {
  // contest: { platform, name, url, startISO, endISO }
  const settings = await getSettings();
  const results = { calendar: false, notion: false };

  await markRegistered(contest.url);

  if (settings.googleEnabled) {
    try {
      await createCalendarEvent(contest, settings);
      results.calendar = true;
    } catch (err) {
      console.error('[ContestSync] Calendar sync failed:', err);
    }
  }

  if (settings.notionEnabled && settings.notionToken && settings.notionDatabaseId) {
    try {
      await createNotionRow(contest, settings);
      results.notion = true;
    } catch (err) {
      console.error('[ContestSync] Notion sync failed:', err);
    }
  }

  browser.notifications.create(`reg-${Date.now()}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon128.png'),
    title: `Synced: ${contest.name}`,
    message: [
      results.calendar ? '✅ Added to Google Calendar' : null,
      results.notion ? '✅ Logged in Notion' : null,
      (!results.calendar && !results.notion) ? '⚠️ Nothing synced — check extension options' : null
    ].filter(Boolean).join('\n'),
    priority: 1
  });

  if (results.calendar || results.notion) {
    await markRegistered(contest.url);
  }

  return results;
}

async function markRegistered(url) {
  const normalized = normalizeUrl(url);
  const { registeredContests } = await browser.storage.local.get('registeredContests');
  const set = new Set(registeredContests || []);
  set.add(normalized);
  await browser.storage.local.set({ registeredContests: Array.from(set) });
}

function normalizeUrl(url) {
  return (url || '').replace(/\/+$/, '').toLowerCase();
}

// ---------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------
async function getGoogleToken(interactive) {
  const settings = await getSettings();
  if (!settings.googleClientId) {
    throw new Error('Google Client ID not set in options.');
  }

  const redirectUri = browser.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', settings.googleClientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events');
  authUrl.searchParams.set('prompt', interactive ? 'consent' : 'none');

  const redirectedTo = await browser.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive
  });

  const hash = new URL(redirectedTo).hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  if (!token) throw new Error('Google auth did not return a token.');

  // Cache token with rough expiry (Google tokens are short-lived, ~1hr)
  const expiresIn = Number(params.get('expires_in') || 3600);
  await browser.storage.local.set({
    googleToken: token,
    googleTokenExpiry: Date.now() + (expiresIn - 60) * 1000
  });

  return token;
}

async function getValidGoogleToken() {
  const { googleToken, googleTokenExpiry } = await browser.storage.local.get([
    'googleToken', 'googleTokenExpiry'
  ]);
  if (googleToken && googleTokenExpiry && Date.now() < googleTokenExpiry) {
    return googleToken;
  }
  // Try silent refresh first, fall back to interactive
  try {
    return await getGoogleToken(false);
  } catch {
    return await getGoogleToken(true);
  }
}

async function createCalendarEvent(contest, settings) {
  const token = await getValidGoogleToken();

  const event = {
    summary: `🏆 ${contest.name}`,
    description: `Auto-synced by Contest Sync.\nPlatform: ${contest.platform}\nLink: ${contest.url}`,
    start: { dateTime: contest.startISO },
    end: { dateTime: contest.endISO || addHoursISO(contest.startISO, 2) },
    source: { title: contest.platform, url: contest.url },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 }
      ]
    }
  };

  const calendarId = settings.googleCalendarId || 'primary';
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }
}

function addHoursISO(isoString, hours) {
  const d = new Date(isoString);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

// ---------------------------------------------------------------
// Notion
// ---------------------------------------------------------------
async function createNotionRow(contest, settings) {
  const body = {
    parent: { database_id: settings.notionDatabaseId },
    properties: {
      Name: { title: [{ text: { content: contest.name } }] },
      Platform: { select: { name: contest.platform } },
      Start: { date: { start: contest.startISO } },
      Link: { url: contest.url }
    }
  };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API error ${res.status}: ${text}`);
  }
}
