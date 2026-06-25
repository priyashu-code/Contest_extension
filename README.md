# Contest Sync — Calendar & Notion

A cross-browser extension (Chrome, Edge, Brave, Firefox) that:

1. **Notifies you** when a new contest appears on Codeforces, LeetCode, CodeChef, HackerRank, or AtCoder.
2. **Auto-creates a Google Calendar event** (with reminders 1 day before + 1 hour before) the moment you register for a contest on that site.
3. Optionally **logs the same contest as a row in a Notion database**.

It works on any of the supported platforms, for anyone who installs it — not just you — since each person connects their own Google/Notion accounts in the Settings page.

---

## 1. Install the extension (unpacked, for now)

**Chrome / Edge / Brave:**
1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on "Developer mode" (top right).
3. Click "Load unpacked" and select the `extension/` folder.

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on" and select `extension/manifest.json`.
   (For a permanent install you'd submit it to addons.mozilla.org, or self-sign via `web-ext sign`.)

After loading, click the extension icon → **Settings** to connect your accounts.

---

## 2. Set up contest discovery (clist.by) — required

This powers the "new contest available" notification.

1. Create a free account at https://clist.by and grab your API key from https://clist.by/api/v2/doc/
2. In the extension's Settings page, paste your clist.by **username** and **API key**.
3. Click "Check for new contests now" to test it. After that it polls automatically every 30 minutes.
