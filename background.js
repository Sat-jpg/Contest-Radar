// Background service worker: refreshes the contest cache hourly and fires reminders.
import { getSettings, fetchContests, siteById, formatStart } from "./shared.js";

const REFRESH_ALARM = "refresh";
const REMIND_PREFIX = "remind:";

function ensureRefreshAlarm() {
  chrome.alarms.get(REFRESH_ALARM, (a) => {
    if (!a) chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 60 });
  });
}

async function scheduleReminders(contests, settings) {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms.filter((a) => a.name.startsWith(REMIND_PREFIX)).map((a) => chrome.alarms.clear(a.name))
  );
  if (!settings.notify) return;
  const now = Date.now();
  const horizon = now + 7 * 24 * 3600 * 1000;
  for (const c of contests) {
    const when = c.start - settings.remindMinutes * 60000;
    if (when > now && c.start < horizon) chrome.alarms.create(REMIND_PREFIX + c.id, { when });
  }
}

async function refresh() {
  const settings = await getSettings();
  try {
    const contests = await fetchContests(settings);
    await chrome.storage.local.set({ contests, fetchedAt: Date.now(), lastError: null });
    await scheduleReminders(contests, settings);
    return { ok: true, count: contests.length };
  } catch (e) {
    await chrome.storage.local.set({ lastError: e.message, lastErrorCode: e.code || null });
    return { ok: false, error: e.message, code: e.code || null };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureRefreshAlarm();
  if (details.reason === "install") chrome.runtime.openOptionsPage();
  else refresh();
});

chrome.runtime.onStartup.addListener(() => {
  ensureRefreshAlarm();
  refresh();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REFRESH_ALARM) return refresh();
  if (!alarm.name.startsWith(REMIND_PREFIX)) return;

  const id = alarm.name.slice(REMIND_PREFIX.length);
  const { contests = [] } = await chrome.storage.local.get("contests");
  const c = contests.find((x) => String(x.id) === id);
  if (!c) return;
  chrome.notifications.create(`contest:${c.id}`, {
    type: "basic",
    iconUrl: "icons/128.png",
    title: c.name,
    message: `${siteById(c.site).name} · starts ${formatStart(c.start)}`,
    priority: 2,
  });
});

chrome.notifications.onClicked.addListener(async (nid) => {
  if (!nid.startsWith("contest:")) return;
  const { contests = [] } = await chrome.storage.local.get("contests");
  const c = contests.find((x) => `contest:${x.id}` === nid);
  if (c) chrome.tabs.create({ url: c.url });
  chrome.notifications.clear(nid);
});

// Re-fetch when the user saves new settings.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") refresh();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "refresh") {
    refresh().then(sendResponse);
    return true; // keep the channel open for the async response
  }
});
