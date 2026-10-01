import { siteById, formatDuration, formatRelative, googleCalendarUrl } from "./shared.js";

const STALE_MS = 30 * 60 * 1000;
const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refresh");
const tpl = document.getElementById("row-tpl");

let tab = "today";
let state = { contests: [], fetchedAt: 0, lastError: null, lastErrorCode: null };

try { tab = localStorage.getItem("tab") || "today"; } catch {}

function dayLabel(ts) {
  const d = new Date(ts), now = new Date();
  const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tmr.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function filterContests() {
  const now = Date.now();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const weekOut = now + 7 * 86400000;
  return state.contests.filter((c) => {
    if (c.end <= now) return false;
    if (tab === "today") return c.start <= endOfToday.getTime();
    if (tab === "week") return c.start <= weekOut;
    return true;
  });
}

function emptyState(title, text, withSettingsButton) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;
  if (withSettingsButton) {
    const b = document.createElement("button");
    b.className = "btn"; b.textContent = "Open settings";
    div.append(document.createElement("br"));
    b.onclick = () => chrome.runtime.openOptionsPage();
    div.append(b);
  }
  return div;
}

function render() {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  listEl.replaceChildren();

  if (state.lastErrorCode === "NO_KEY" && !state.contests.length) {
    listEl.append(emptyState("Connect clist.by", "Paste your free clist.by API key to load contests.", true));
    statusEl.textContent = "";
    return;
  }

  const items = filterContests();
  const now = Date.now();
  if (!items.length) {
    const msg = tab === "today" ? "Nothing scheduled for today on your selected sites." : "No upcoming contests found.";
    listEl.append(emptyState("All clear", msg, false));
  }

  for (const c of items) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const live = c.start <= now;
    node.classList.toggle("live", live);
    node.querySelector(".day").textContent = dayLabel(c.start);
    node.querySelector(".clock").textContent = new Date(c.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const name = node.querySelector(".name");
    name.textContent = c.name; // textContent: never inject API data as HTML
    name.href = c.url;
    name.title = c.name;
    node.querySelector(".site").textContent = siteById(c.site).name;
    node.querySelector(".dur").textContent = formatDuration(c.duration);
    node.querySelector(".countdown").textContent = live
      ? `${formatRelative(c.end - now)} left`
      : `in ${formatRelative(c.start - now)}`;
    node.querySelector(".cal").href = googleCalendarUrl(c);
    listEl.append(node);
  }

  if (state.lastError && state.lastErrorCode !== "NO_KEY") {
    statusEl.innerHTML = "";
    const span = document.createElement("span");
    span.className = "error"; span.textContent = state.lastError;
    statusEl.append(span);
  } else if (state.fetchedAt) {
    statusEl.textContent = `${items.length} contest${items.length === 1 ? "" : "s"} · updated ${formatRelative(now - state.fetchedAt)} ago`;
  }
}

async function load() {
  state = { ...state, ...(await chrome.storage.local.get(["contests", "fetchedAt", "lastError", "lastErrorCode"])) };
  state.contests ||= [];
  render();
}

async function refresh() {
  refreshBtn.classList.add("spinning");
  statusEl.textContent = "Refreshing…";
  await chrome.runtime.sendMessage({ type: "refresh" });
  refreshBtn.classList.remove("spinning");
  await load();
}

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    tab = t.dataset.tab;
    try { localStorage.setItem("tab", tab); } catch {}
    render();
  })
);
refreshBtn.addEventListener("click", refresh);
document.getElementById("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

await load();
if (!state.fetchedAt || Date.now() - state.fetchedAt > STALE_MS) refresh();
setInterval(render, 30000); // keep countdowns fresh while the popup is open
