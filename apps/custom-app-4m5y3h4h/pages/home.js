import { chrome, paintFresh, startTicker, showError } from "../lib/chrome.js";
import { createGlobe } from "../lib/globe.js";
import { HAZARD_ORDER, SEVS, SRC, WINDOWS, loadLive, fmtUTC, rel, fmtNum, distKm, sevLabel, trunc, esc } from "../lib/model.js";
import { PLACE, getPlaces } from "../lib/state.js";
import { hz, ea, chipsHtml, naNote, feedItemHtml, detailHtml, placeSearch } from "../lib/ui.js";

// Filter state lives at module level so a Reload keeps the reader's view.
const reduced = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ST = { offH: new Set(), offS: new Set(), win: "all", minSev: 0, q: "", sort: "sev", mode: "globe", auto: !reduced, sel: null };
const PAGE = 50;

export default async function render(ctx) {
  const page = chrome(ctx.content, ctx.route.path);
  page.innerHTML = `<div class="tw-loading" role="status"><span class="spin" aria-hidden="true"></span>Loading live hazard data…</div>`;

  let data;
  try {
    data = await loadLive(ctx.db);
  } catch (err) {
    if (ctx.signal.aborted) return;
    paintFresh(ctx.content, null, true);
    showError(ctx, page, err);
    return;
  }
  if (ctx.signal.aborted) return;
  const { events, sources } = data;
  const fetchedMs = data.fetchedMs;
  paintFresh(ctx.content, fetchedMs, false);
  const stopTicker = startTicker(ctx.content, () => fetchedMs, ctx.signal);

  if (!events.length) {
    page.innerHTML = `<div class="tw-error" role="status"><h2>No live hazard events right now</h2><p>The hourly pipeline ran but found nothing inside its live windows. That usually means every source feed was unreachable — see Sources &amp; method for each feed's status.</p><button type="button" class="btn" data-act="reload">Reload</button></div>`;
    page.querySelector('[data-act="reload"]').addEventListener("click", () => ctx.reload(), { signal: ctx.signal });
    return () => stopTicker();
  }

  for (const e of events) e._hay = [e.title, e.description, e.area, e.hazard_label, e.source_name, ...(e.meta.origin_agencies || [])].join(" ").toLowerCase();
  const byId = new Map(events.map((e) => [e.event_id, e]));
  const srcKeys = sources.map((s) => s.source);
  const srcInfo = Object.fromEntries(sources.map((s) => [s.source, s]));
  if (ST.sel && !byId.has(ST.sel)) ST.sel = null;

  page.innerHTML = `
<div class="tw-place" id="place"></div>
<section class="tw-kpis" id="kpis" aria-label="Summary counts"></section>
<div class="tw-main">
  <aside class="panel filters" id="filters" aria-label="Filters">
    <div class="panel-h"><h2>Filters</h2><span>
      <button type="button" class="link-btn filters-toggle" id="ftoggle" aria-expanded="false" aria-controls="fswrap">Show</button>
      <button type="button" class="link-btn" id="reset">Reset</button></span></div>
    <div class="fs-wrap" id="fswrap">
      <fieldset><legend>Hazard type</legend><div class="chips" id="chips"></div><div id="nanote"></div></fieldset>
      <fieldset><legend>Time window</legend><div class="seg" id="win"></div><p class="note" style="margin-top:6px">Uses each source's own event timestamp. Only events inside their live window are loaded at all (quakes 7 days, storms 3, fires 30, ice 60, NWS alerts until they expire).</p></fieldset>
      <div>
        <label class="field">Minimum severity<select id="sev">
          <option value="0">All (incl. unrated)</option><option value="1">Minor and above</option><option value="2">Moderate and above</option><option value="3">Severe and above</option><option value="4">Extreme only</option></select></label>
        <label class="field">Search<input id="q" type="search" placeholder="Name, place, agency…" autocomplete="off"></label>
      </div>
      <fieldset><legend>Data sources</legend><div class="srcs" id="srcs"></div></fieldset>
      <div id="srcwarn" role="status"></div>
    </div>
  </aside>
  <section class="panel stage" aria-label="Hazard map">
    <div class="globe-host" id="globe"></div>
    <div class="stage-bar">
      <div class="glass tog" role="group" aria-label="Map projection">
        <button type="button" data-mode="globe">Globe</button><button type="button" data-mode="flat">Flat map</button></div>
      <div class="glass ctl" role="group" aria-label="Map controls">
        <button type="button" data-z="in" aria-label="Zoom in">+</button>
        <button type="button" data-z="out" aria-label="Zoom out">−</button>
        <button type="button" data-z="reset" aria-label="Reset view" class="txt">Reset</button>
        <button type="button" data-z="spin" aria-pressed="false" class="txt" id="spin">Auto-rotate</button></div>
    </div>
    <div class="legend glass" aria-label="Map legend">
      <div class="row"><span>Marker size &amp; ring = severity:</span>
        ${SEVS.slice(1).map((s) => `<span class="sv"><i style="--c:${s.color};width:${6 + s.n * 2.6}px;height:${6 + s.n * 2.6}px"></i>${esc(s.label)}</span>`).join("")}</div>
      <div class="row"><span>Shape &amp; colour = hazard type (see filters). No ring = source gives no severity.</span></div>
    </div>
    <div class="stage-hint glass" id="hint"></div>
    <div class="stage-msg" id="stagemsg" hidden></div>
  </section>
  <aside class="panel side" id="side" aria-label="Events"></aside>
</div>`;

  const q = (s) => page.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ctx.signal });

  // ------------------------------------------------ static controls
  const chipsEl = q("#chips"), srcsEl = q("#srcs"), winEl = q("#win");
  chipsEl.innerHTML = chipsHtml(HAZARD_ORDER.filter((k) => k !== "other" || events.some((e) => e.hazard === "other")), "home");
  q("#nanote").innerHTML = naNote("home", HAZARD_ORDER);
  srcsEl.innerHTML = srcKeys.map((k) => `<button type="button" class="src-btn${srcInfo[k].status === "ok" ? "" : " err"}" data-s="${ea(k)}" aria-pressed="true"><span class="d" aria-hidden="true"></span><span>${esc((SRC[k] || {}).name || k)}${srcInfo[k].status === "ok" ? "" : " · unavailable"}</span><span class="cnt">0</span></button>`).join("");
  winEl.innerHTML = WINDOWS.map((w) => `<button type="button" data-w="${w.v}" aria-pressed="false">${esc(w.label)}</button>`).join("");
  const bad = sources.filter((s) => s.status !== "ok");
  q("#srcwarn").innerHTML = bad.length ? `<p class="srcwarn"><strong>Feed problem:</strong> ${bad.map((s) => esc((SRC[s.source] || {}).name || s.source)).join(", ")} could not be fetched in the latest run, so its events are missing — the map may be incomplete.</p>` : "";
  q("#sev").value = String(ST.minSev);
  q("#q").value = ST.q;

  // ------------------------------------------------ globe
  const tipHtml = (e) => `<b>${esc(trunc(e.title, 70))}</b><span class="muted">${esc(hz(e.hazard).label)} · ${esc(sevLabel(e.severity))} · ${esc(rel(e.event_ts_ms))}</span>`;
  const globe = createGlobe(q("#globe"), { tipHtml, onSelect: (id) => select(id, { fly: true }) });
  globe.setMode(ST.mode); globe.setAuto(ST.auto);
  const paintMapUi = () => {
    page.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === ST.mode)));
    q("#spin").setAttribute("aria-pressed", String(ST.auto));
    q("#spin").hidden = ST.mode !== "globe";
    q("#hint").textContent = ST.mode === "globe" ? "Drag to rotate · scroll to zoom · click a marker" : "Drag to pan · scroll to zoom · click a marker";
  };
  paintMapUi();

  // ------------------------------------------------ place search
  const ps = placeSearch(q("#place"), {
    signal: ctx.signal,
    onPick: (p, km) => { PLACE.cur = p; PLACE.km = km; ST.sort = "near"; ST.auto = false; globe.setAuto(false); paintMapUi(); applyPlace(true); },
    onRadius: (km) => { PLACE.km = km; applyPlace(true); },
    onClear: () => { PLACE.cur = null; PLACE.km = 100; if (ST.sort === "near") ST.sort = "sev"; globe.setPlace(null); globe.reset(); applyPlace(false); },
  });
  getPlaces(ctx.db).then((list) => { if (!ctx.signal.aborted) ps.setPlaces(list); }).catch(() => { if (!ctx.signal.aborted) ps.fail(); });
  if (PLACE.cur) ps.setPlace(PLACE.cur, PLACE.km);

  function applyPlace(fly) {
    const p = PLACE.cur;
    for (const e of events) e._d = p ? distKm(p.lat, p.lon, e.lat, e.lon) : null;
    ps.setPlace(p, PLACE.km);
    globe.setPlace(p ? { lat: p.lat, lon: p.lon, km: PLACE.km, name: p.name } : null);
    if (p && fly) globe.fitRadius(p.lat, p.lon, PLACE.km);
    feedLimit = PAGE;
    apply();
  }

  // ------------------------------------------------ filtering
  let shown = [], feedLimit = PAGE;
  const winMs = () => WINDOWS.find((w) => w.v === ST.win).ms;
  function pass(e, skip) {
    const ql = ST.q.trim().toLowerCase(), wm = winMs(), now = Date.now();
    if (skip !== "s" && ST.offS.has(e.source)) return false;
    if (skip !== "h" && ST.offH.has(e.hazard)) return false;
    if (e.severity < ST.minSev) return false;
    if (wm !== Infinity && !(e.event_ts_ms != null && now - e.event_ts_ms <= wm)) return false;
    if (ql && !e._hay.includes(ql)) return false;
    return true;
  }
  const inRad = (e) => !PLACE.cur || (e._d != null && e._d <= PLACE.km);
  const sortFn = () => (ST.sort === "near" && PLACE.cur ? (a, b) => a._d - b._d
    : ST.sort === "new" ? (a, b) => (b.event_ts_ms || 0) - (a.event_ts_ms || 0)
    : (a, b) => b.severity - a.severity || (b.event_ts_ms || 0) - (a.event_ts_ms || 0));
  const where = () => (PLACE.cur ? `within ${fmtNum(PLACE.km)} km of ${PLACE.cur.name}` : null);

  function paintKpis() {
    const n = (f) => shown.filter(f).length;
    const newest = Math.max(0, ...shown.map((e) => e.event_ts_ms || 0));
    const okSrc = sources.filter((s) => s.status === "ok").length;
    const w = where();
    const k = [
      { k: "Live events", v: fmtNum(shown.length), s: w ? w : `of ${fmtNum(events.length)} live worldwide` },
      { k: "Severe or extreme", v: fmtNum(n((e) => e.severity >= 3)), s: "on Planet Pulse's display scale", hot: n((e) => e.severity >= 3) > 0 },
      { k: "Wildfires · Quakes", v: `${fmtNum(n((e) => e.hazard === "wildfire"))} · ${fmtNum(n((e) => e.hazard === "earthquake"))}`, s: "shown on the map" },
      { k: "Storms · Floods · Volcanoes", v: `${fmtNum(n((e) => e.hazard === "cyclone" || e.hazard === "weather"))} · ${fmtNum(n((e) => e.hazard === "flood"))} · ${fmtNum(n((e) => e.hazard === "volcano"))}`, s: "storms & weather · floods · volcanoes" },
      { k: "Newest report", v: newest ? rel(newest) : "—", s: newest ? fmtUTC(newest) : `${okSrc}/${sources.length} sources online` },
    ];
    q("#kpis").innerHTML = k.map((x) => `<div class="kpi${x.hot ? " hot" : ""}"><div class="k">${esc(x.k)}</div><div class="v">${esc(x.v)}</div><div class="s">${esc(x.s)}</div></div>`).join("");
  }

  function paintControls() {
    const cnt = Object.create(null), scnt = Object.create(null);
    for (const e of events) { if (!inRad(e)) continue; if (pass(e, "h")) cnt[e.hazard] = (cnt[e.hazard] || 0) + 1; if (pass(e, "s")) scnt[e.source] = (scnt[e.source] || 0) + 1; }
    chipsEl.querySelectorAll(".chip[data-h]").forEach((b) => {
      b.setAttribute("aria-pressed", String(!ST.offH.has(b.dataset.h)));
      b.querySelector(".cnt").textContent = fmtNum(cnt[b.dataset.h] || 0);
      b.setAttribute("aria-label", `${hz(b.dataset.h).label}: ${cnt[b.dataset.h] || 0} events`);
    });
    srcsEl.querySelectorAll(".src-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(!ST.offS.has(b.dataset.s)));
      b.querySelector(".cnt").textContent = fmtNum(scnt[b.dataset.s] || 0);
    });
    winEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === ST.win)));
  }

  function paintStageMsg() {
    const m = q("#stagemsg");
    if (shown.length || PLACE.cur) { m.hidden = true; return; }
    m.hidden = false;
    m.innerHTML = `<div><strong>No events match these filters</strong><span>Try a wider time window, a lower severity, or turn more hazard types back on.</span><button type="button" class="btn primary" data-act="reset">Reset filters</button></div>`;
    m.querySelector('[data-act="reset"]').addEventListener("click", resetFilters, { signal: ctx.signal });
  }

  function apply() {
    const base = events.filter((e) => pass(e));
    for (const e of base) e._a = inRad(e) ? 1 : 0.22;
    shown = base.filter(inRad).sort(sortFn());
    if (ST.sel && !shown.some((e) => e.event_id === ST.sel)) ST.sel = null;
    globe.setEvents(base);
    globe.setSelected(ST.sel);
    paintKpis(); paintControls(); paintStageMsg();
    paintSide();
  }
  function resetFilters() {
    ST.offH.clear(); ST.offS.clear(); ST.win = "all"; ST.minSev = 0; ST.q = ""; ST.sort = PLACE.cur ? "near" : "sev"; feedLimit = PAGE;
    q("#sev").value = "0"; q("#q").value = "";
    apply();
  }

  // ------------------------------------------------ side panel: feed or detail
  const side = q("#side");
  function paintSide() {
    if (ST.sel && byId.has(ST.sel)) paintDetail(byId.get(ST.sel));
    else paintFeed();
  }
  function paintFeed() {
    const w = where();
    side.innerHTML = `<div class="side-h"><h2 id="feedh">${w ? "Near " + esc(PLACE.cur.name) : "Event feed"}</h2><span class="cnt" id="feedcnt" role="status"></span>
      <label class="sr-only" for="sort">Sort events</label>
      <select id="sort">${PLACE.cur ? '<option value="near">Nearest first</option>' : ""}<option value="sev">Most severe first</option><option value="new">Newest first</option></select></div>
      <ul class="feed" id="feed" aria-labelledby="feedh"></ul><div id="morewrap"></div>`;
    const sortEl = side.querySelector("#sort"); sortEl.value = ST.sort;
    on(sortEl, "change", () => { ST.sort = sortEl.value; feedLimit = PAGE; apply(); });
    const list = side.querySelector("#feed");
    const slice = shown.slice(0, feedLimit);
    side.querySelector("#feedcnt").textContent = `${fmtNum(shown.length)} event${shown.length === 1 ? "" : "s"}`;
    if (!shown.length) {
      const msg = PLACE.cur ? `No live events ${esc(w)} with these filters. Try a larger radius.` : "No events match the current filters.";
      list.outerHTML = `<div class="empty-note"><strong>Nothing to show</strong><span>${msg}</span><button type="button" class="btn" data-act="reset">Reset filters</button></div>`;
      side.querySelector('[data-act="reset"]').addEventListener("click", resetFilters, { signal: ctx.signal });
      return;
    }
    list.innerHTML = slice.map((e) => feedItemHtml(e, { near: !!PLACE.cur })).join("");
    if (shown.length > slice.length) {
      side.querySelector("#morewrap").innerHTML = `<button type="button" class="btn more" data-act="more">Show ${Math.min(PAGE, shown.length - slice.length)} more (${fmtNum(shown.length - slice.length)} hidden)</button>`;
    }
  }
  function paintDetail(e) {
    side.innerHTML = detailHtml(e, { placeName: PLACE.cur ? PLACE.cur.name : null });
  }

  // ------------------------------------------------ selection
  function select(id, o = {}) {
    if (id && !byId.has(id)) return;
    ST.sel = id || null;
    if (ST.sel && ST.auto) { ST.auto = false; globe.setAuto(false); paintMapUi(); }
    globe.setSelected(ST.sel, { fly: !!o.fly });
    paintSide();
    if (ST.sel) side.querySelector("#dtitle")?.focus({ preventScroll: true });
    else if (o.focusId) {
      const b = side.querySelector(`.ev[data-id="${CSS.escape(o.focusId)}"]`);
      if (b) { b.focus(); b.scrollIntoView({ block: "nearest" }); }
    }
  }

  // ------------------------------------------------ events
  on(side, "click", (ev) => {
    const t = ev.target.closest("button"); if (!t) return;
    if (t.classList.contains("ev")) select(t.dataset.id, { fly: true });
    else if (t.dataset.act === "back") select(null, { focusId: ST.sel });
    else if (t.dataset.act === "more") {
      const before = feedLimit; feedLimit += PAGE; paintFeed();
      side.querySelectorAll(".ev")[before]?.focus();
    }
  });
  on(side, "keydown", (ev) => { if (ev.key === "Escape" && ST.sel) select(null, { focusId: ST.sel }); });
  on(side, "mouseover", (ev) => { const b = ev.target.closest(".ev"); globe.setHover(b ? b.dataset.id : null); });
  on(side, "mouseleave", () => globe.setHover(null));
  on(side, "focusin", (ev) => { const b = ev.target.closest(".ev"); globe.setHover(b ? b.dataset.id : null); });

  on(chipsEl, "click", (ev) => {
    const b = ev.target.closest(".chip[data-h]"); if (!b) return;
    const k = b.dataset.h; ST.offH.has(k) ? ST.offH.delete(k) : ST.offH.add(k); feedLimit = PAGE; apply();
  });
  on(srcsEl, "click", (ev) => {
    const b = ev.target.closest(".src-btn"); if (!b) return;
    const k = b.dataset.s; ST.offS.has(k) ? ST.offS.delete(k) : ST.offS.add(k); feedLimit = PAGE; apply();
  });
  on(winEl, "click", (ev) => { const b = ev.target.closest("button"); if (!b) return; ST.win = b.dataset.w; feedLimit = PAGE; apply(); });
  on(q("#sev"), "change", (ev) => { ST.minSev = Number(ev.target.value) || 0; feedLimit = PAGE; apply(); });
  let qt = 0;
  on(q("#q"), "input", (ev) => { ST.q = ev.target.value; clearTimeout(qt); qt = setTimeout(() => { feedLimit = PAGE; apply(); }, 180); });
  on(q("#reset"), "click", resetFilters);
  on(q("#ftoggle"), "click", (ev) => {
    const f = q("#filters"), open = !f.classList.contains("open");
    f.classList.toggle("open", open); ev.currentTarget.setAttribute("aria-expanded", String(open)); ev.currentTarget.textContent = open ? "Hide" : "Show";
  });
  page.querySelectorAll("[data-mode]").forEach((b) => on(b, "click", () => { ST.mode = b.dataset.mode; globe.setMode(ST.mode); paintMapUi(); if (PLACE.cur) globe.fitRadius(PLACE.cur.lat, PLACE.cur.lon, PLACE.km); }));
  page.querySelectorAll("[data-z]").forEach((b) => on(b, "click", () => {
    const z = b.dataset.z;
    if (z === "in") globe.zoomBy(1.5); else if (z === "out") globe.zoomBy(1 / 1.5); else if (z === "reset") globe.reset();
    else { ST.auto = !ST.auto; globe.setAuto(ST.auto); paintMapUi(); }
  }));

  if (PLACE.cur) { ST.auto = false; globe.setAuto(false); paintMapUi(); }
  applyPlace(false);
  if (PLACE.cur) globe.fitRadius(PLACE.cur.lat, PLACE.cur.lon, PLACE.km);
  if (ST.sel) globe.setSelected(ST.sel, { fly: true });

  return () => { clearTimeout(qt); stopTicker(); globe.destroy(); };
}
