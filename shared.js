// Shared helpers used by the popup, options page and background worker.

export const SITES = [
  { id: "codeforces.com", name: "Codeforces", short: "CF", color: "#1f8acb" },
  { id: "codechef.com", name: "CodeChef", short: "CC", color: "#7b5e47" },
  { id: "atcoder.jp", name: "AtCoder", short: "AC", color: "#3f3f46" },
  { id: "leetcode.com", name: "LeetCode", short: "LC", color: "#e8930c" },
  { id: "geeksforgeeks.org", name: "GeeksforGeeks", short: "GfG", color: "#2f8d46" },
  { id: "naukri.com/code360", name: "Code360", short: "360", color: "#e2621b" },
  { id: "topcoder.com", name: "Topcoder", short: "TC", color: "#1c9ad6" },
];

export const siteById = (id) =>
  SITES.find((s) => s.id === id) || { id, name: id, short: "?", color: "#64748b" };

export const DEFAULTS = {
  username: "marcusm9x",
  apiKey: "d15b8b344935fbad738ff03fb57aa21e9bee8ecf",
  sites: ["codeforces.com", "codechef.com", "atcoder.jp", "leetcode.com"],
  notify: true,
  remindMinutes: 15,
};

export async function getSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

const API = "https://clist.by/api/v4/contest/";

// One request per site keeps us well under clist.by's rate limit (10 req/min)
// and avoids popular sites crowding out the rest of a single shared result page.
async function fetchSite(site, { username, apiKey }, sinceIso) {
  const params = new URLSearchParams({
    format: "json",
    resource: site,
    end__gt: sinceIso,
    order_by: "start",
    limit: "100",
  });
  let res;
  try {
    res = await fetch(`${API}?${params}`, {
      headers: { Authorization: `ApiKey ${username}:${apiKey}` },
    });
  } catch {
    throw new Error("Couldn't reach clist.by. Check your connection.");
  }
  if (res.status === 401 || res.status === 403) throw new Error("clist.by rejected your username or API key.");
  if (res.status === 429) throw new Error("clist.by rate limit hit. Try again in a minute.");
  if (!res.ok) throw new Error(`clist.by returned HTTP ${res.status}.`);
  const data = await res.json();
  return (data.objects || []).map((c) => ({
    id: c.id,
    name: c.event,
    site: c.resource,
    url: c.href,
    start: Date.parse(c.start + "Z"),
    end: Date.parse(c.end + "Z"),
    duration: c.duration,
  }));
}

export async function fetchContests(settings) {
  if (!settings.username || !settings.apiKey) {
    const err = new Error("Add your clist.by username and API key in Settings.");
    err.code = "NO_KEY";
    throw err;
  }
  const sinceIso = new Date().toISOString().slice(0, 19);
  const lists = await Promise.all(settings.sites.map((s) => fetchSite(s, settings, sinceIso)));
  return lists.flat().sort((a, b) => a.start - b.start);
}

export function formatDuration(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d >= 2) return `${d}d${h ? ` ${h}h` : ""}`;
  const totalH = d * 24 + h;
  return [totalH && `${totalH}h`, m && `${m}m`].filter(Boolean).join(" ") || "0m";
}

export function formatRelative(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatStart(ts) {
  const date = new Date(ts);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

export function googleCalendarUrl(c) {
  const fmt = (ts) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: c.name,
    dates: `${fmt(c.start)}/${fmt(c.end)}`,
    details: c.url,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
