import { SITES, getSettings } from "./shared.js";

const $ = (id) => document.getElementById(id);
const msg = $("msg");

function renderSites(selected) {
  const wrap = $("sites");
  wrap.replaceChildren();
  for (const s of SITES) {
    const label = document.createElement("label");
    label.className = "check";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = s.id; cb.checked = selected.includes(s.id);
    const name = document.createElement("span"); name.textContent = s.name;
    label.append(cb, name);
    wrap.append(label);
  }
}

function setMsg(text, kind = "") {
  msg.textContent = text;
  msg.className = kind;
}

const s = await getSettings();
$("username").value = s.username;
$("apiKey").value = s.apiKey;
$("notify").checked = s.notify;
$("remindMinutes").value = String(s.remindMinutes);
renderSites(s.sites);

$("save").addEventListener("click", async () => {
  const sites = [...document.querySelectorAll("#sites input:checked")].map((c) => c.value);
  if (!sites.length) return setMsg("Pick at least one site.", "err");
  const username = $("username").value.trim();
  const apiKey = $("apiKey").value.trim();
  if (!username || !apiKey) return setMsg("Username and API key are both required.", "err");

  await chrome.storage.sync.set({
    username, apiKey, sites,
    notify: $("notify").checked,
    remindMinutes: Number($("remindMinutes").value),
  });
  setMsg("Saving…");
  const res = await chrome.runtime.sendMessage({ type: "refresh" });
  if (res?.ok) setMsg(`Saved · ${res.count} contests loaded`, "ok");
  else setMsg(res?.error || "Something went wrong.", "err");
});
