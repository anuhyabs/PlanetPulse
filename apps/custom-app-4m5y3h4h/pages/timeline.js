import { chrome, paintFresh, startTicker, showError } from "../lib/chrome.js";
import { createGlobe } from "../lib/globe.js";
import { HAZARD_ORDER, AVAIL, COVER, SEVS, loadHistory, fmtDay, fmtMonth, fmtNum, distKm, sevLabel, trunc, esc } from "../lib/model.js";
import { PLACE, getPlaces, loadFresh } from "../lib/state.js";
import { hz, chipsHtml, naNote, feedItemHtml, detailHtml, placeSearch } from "../lib/ui.js";

const DAY = 864e5;
const SPANS = [{ d: 1, label: "Preceding 1 day" }, { d: 7, label: "Preceding 1 week" }, { d: 30, label: "Preceding 1 month" }, { d: 365, label: "Preceding 1 year" }, { d: 1825, label: "Preceding 5 years" }, { d: 3650, label: "Preceding 10 years" }, { d: 0, label: "Cumulative (since From)" }];
const SPEEDS = [{ v: 1, label: "×1" }, { v: 4, label: "×4" }, { v: 16, label: "×16" }];
const MAXDRAW = 6000;
const PAGE = 50;
const ST = { offH: new Set(), minSev: 0, q: "", sort: "new", mode: "globe", spanD: 30, speed: 4, cur: null, sel: null, from: null, to: null };

export default async function render(ctx) {
  const page = chrome(ctx.content, ctx.route.path);
  page.innerHTML = `<div class="tw-loading" role="status"><span class="spin" aria-hidden="true"></span>Loading event history… (about 50,000 events)</div>`;

  let hist, fresh;
  try {
    [hist, fresh] = await Promise.all([loadHistory(ctx.db), loadFresh(ctx.db)]);
  } catch (err) {
    if (ctx.signal.aborted) return;
    paintFresh(ctx.content, null, true);
    showError(ctx, page, err);
    return;
  }
  if (ctx.signal.aborted) return;
  paintFresh(ctx.content, fresh, false);
  const stopTicker = startTicker(ctx.content, () => fresh, ctx.signal);
  const events = hist.events;
  if (!events.length) {
    page.innerHTML = `<div class="tw-error" role="status"><h2>The history is empty</h2><p>The daily history pipeline has not produced events yet. Run it once from its page, then reload.</p><button type="button" class="btn" data-act="reload">Reload</button></div>`;
    page.querySelector('[data-act="reload"]').addEventListener("click", () => ctx.reload(), { signal: ctx.signal });
    return () => stopTicker();
  }

  const NOW = Date.now();
  let MIN = Infinity;
  for (const e of events) { if (e.t0 < MIN) MIN = e.t0; e._hay = e.title.toLowerCase(); }
  MIN = Math.floor(MIN / DAY) * DAY;
  const Y0 = new Date(MIN).getUTCFullYear(), Y1 = new Date(NOW).getUTCFullYear();
  // Time range shown by the slider: LO..HI (set from the From / To years, or from the data under the current filters).
  let LO = MIN, HI = NOW, fromY = Y0, toY = Y1, autoFrom = Y0;
  const isCum = () => ST.spanD === 0;
  const spanMs = () => (isCum() ? ST.cur - LO : ST.spanD * DAY);
  const winStart = () => (isCum() ? LO : Math.max(LO, ST.cur - ST.spanD * DAY));
  const byId = new Map(events.map((e) => [e.event_id, e]));
  // Earthquake depth changes over time: find where the smaller (M<6) quakes start.
  let smallFrom = Infinity;
  for (const e of events) if (e.hazard === "earthquake" && e.magnitude_value != null && e.magnitude_value < 6 && e.t0 < smallFrom) smallFrom = e.t0;
  if (ST.cur == null || ST.cur > NOW) ST.cur = NOW;
  if (ST.sel && !byId.has(ST.sel)) ST.sel = null;
  const cov = Object.create(null);
  for (const e of events) { const c = cov[e.hazard] || (cov[e.hazard] = { n: 0, mn: Infinity, mx: 0 }); c.n++; if (e.t0 < c.mn) c.mn = e.t0; if (e.t0 > c.mx) c.mx = e.t0; }

  page.innerHTML = `
<div class="tw-place" id="place"></div>
<section class="panel tl" aria-label="Time controls">
  <div class="tl-row">
    <button type="button" class="btn primary tl-play" id="play" aria-pressed="false">▶ Play</button>
    <div class="tl-date" role="status" aria-live="polite"><strong id="curd"></strong><span id="winlab" class="muted"></span></div>
    <label class="tl-sel">Window <select id="span">${SPANS.map((s) => `<option value="${s.d}">${s.label}</option>`).join("")}</select></label>
    <label class="tl-sel">From <select id="yfrom"></select></label>
    <label class="tl-sel">To <select id="yto"></select></label>
    <label class="tl-sel">Speed <select id="speed">${SPEEDS.map((s) => `<option value="${s.v}">${s.label}</option>`).join("")}</select></label>
    <button type="button" class="btn" id="tonow">Jump to today</button>
  </div>
  <div class="tl-hist" id="hist" aria-hidden="true"></div>
  <div class="tl-years" id="years" aria-hidden="true"></div>
  <input id="slider" class="tl-slider" type="range" min="0" max="1" step="1" aria-label="Date shown on the map">
  <div class="tl-axis"><span id="axl"></span><span id="cutnote" class="tl-cut" hidden></span><span id="axr"></span></div>
  <div class="tl-key" id="tlkey"></div>
</section>
<section class="tw-kpis" id="kpis" aria-label="Summary counts"></section>
<div class="tw-main">
  <aside class="panel filters" id="filters" aria-label="Filters">
    <div class="panel-h"><h2>Filters</h2><span>
      <button type="button" class="link-btn filters-toggle" id="ftoggle" aria-expanded="false" aria-controls="fswrap">Show</button>
      <button type="button" class="link-btn" id="reset">Reset</button></span></div>
    <div class="fs-wrap" id="fswrap">
      <fieldset><legend>Hazard type</legend><div class="chips" id="chips"></div><div id="nanote"></div></fieldset>
      <div>
        <label class="field">Minimum severity<select id="sev">
          <option value="0">All (incl. unrated)</option><option value="1">Minor and above</option><option value="2">Moderate and above</option><option value="3">Severe and above</option><option value="4">Extreme only</option></select></label>
        <label class="field">Search<input id="q" type="search" placeholder="Name or place…" autocomplete="off"></label>
      </div>
      <fieldset><legend>What this history covers</legend><ul class="cov" id="cov"></ul></fieldset>
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
        <button type="button" data-z="reset" aria-label="Reset view" class="txt">Reset</button></div>
    </div>
    <div class="legend glass" aria-label="Map legend">
      <div class="row"><span>Marker size &amp; ring = severity:</span>
        ${SEVS.slice(1).map((s) => `<span class="sv"><i style="--c:${s.color};width:${6 + s.n * 2.6}px;height:${6 + s.n * 2.6}px"></i>${esc(s.label)}</span>`).join("")}</div>
      <div class="row" id="capnote"><span>Shape &amp; colour = hazard type. No ring = source gives no severity.</span></div>
    </div>
    <div class="stage-hint glass" id="hint"></div>
    <div class="stage-msg" id="stagemsg" hidden></div>
  </section>
  <aside class="panel side" id="side" aria-label="Events"></aside>
</div>`;

  const q = (s) => page.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ctx.signal });
  const chipsEl = q("#chips"), slider = q("#slider"), playBtn = q("#play");

  chipsEl.innerHTML = chipsHtml(HAZARD_ORDER.filter((k) => k !== "other"), "timeline");
  q("#nanote").innerHTML = naNote("timeline", HAZARD_ORDER);
  q("#sev").value = String(ST.minSev); q("#q").value = ST.q;
  q("#span").value = String(ST.spanD); q("#speed").value = String(ST.speed);
  q("#cov").innerHTML = [...AVAIL.timeline].filter((k) => cov[k]).map((k) => `<li style="--c:${hz(k).color}"><strong>${esc(hz(k).label)}</strong> · ${fmtNum(cov[k].n)} events · ${esc(fmtMonth0(cov[k].mn))}–${esc(fmtMonth0(cov[k].mx))}<br><span class="muted">${esc(COVER[k] || "")}</span></li>`).join("");
  function fmtMonth0(ms) { return fmtMonth(ms); }

  const tipHtml = (e) => `<b>${esc(trunc(e.title, 70))}</b><span class="muted">${esc(hz(e.hazard).label)} · ${esc(sevLabel(e.severity))} · ${esc(fmtDay(e.t0))}</span>`;
  const globe = createGlobe(q("#globe"), { tipHtml, onSelect: (id) => select(id, { fly: true }) });
  globe.setMode(ST.mode); globe.setAuto(false);
  const paintMapUi = () => {
    page.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === ST.mode)));
    q("#hint").textContent = ST.mode === "globe" ? "Drag to rotate · scroll to zoom · click a marker" : "Drag to pan · scroll to zoom · click a marker";
  };
  paintMapUi();

  // ------------------------------------------------ place search
  const ps = placeSearch(q("#place"), {
    signal: ctx.signal,
    onPick: (p, km) => { PLACE.cur = p; PLACE.km = km; applyPlace(true); },
    onRadius: (km) => { PLACE.km = km; applyPlace(true); },
    onClear: () => { PLACE.cur = null; PLACE.km = 100; globe.setPlace(null); globe.reset(); applyPlace(false); },
  });
  getPlaces(ctx.db).then((list) => { if (!ctx.signal.aborted) ps.setPlaces(list); }).catch(() => { if (!ctx.signal.aborted) ps.fail(); });
  if (PLACE.cur) ps.setPlace(PLACE.cur, PLACE.km);

  // ------------------------------------------------ filtering
  let base = [], win = [], feedLimit = PAGE, raf = 0, timer = 0, hbars = [];
  const pass = (e) => {
    if (ST.offH.has(e.hazard) || e.severity < ST.minSev) return false;
    const ql = ST.q.trim().toLowerCase();
    return !ql || e._hay.includes(ql);
  };
  const inRad = (e) => !PLACE.cur || (e._d != null && e._d <= PLACE.km);
  const inWin = (e) => e.t0 <= ST.cur + DAY - 1 && e.t1 >= winStart();
  const sortFn = () => (ST.sort === "near" && PLACE.cur ? (a, b) => a._d - b._d
    : ST.sort === "sev" ? (a, b) => b.severity - a.severity || b.t0 - a.t0
    : (a, b) => b.t0 - a.t0);
  const where = () => (PLACE.cur ? `within ${fmtNum(PLACE.km)} km of ${PLACE.cur.name}` : null);

  function applyPlace(fly) {
    const p = PLACE.cur;
    for (const e of events) e._d = p ? distKm(p.lat, p.lon, e.lat, e.lon) : null;
    if (p && ST.sort !== "near") ST.sort = "near";
    if (!p && ST.sort === "near") ST.sort = "new";
    ps.setPlace(p, PLACE.km);
    globe.setPlace(p ? { lat: p.lat, lon: p.lon, km: PLACE.km, name: p.name } : null);
    if (p && fly) globe.fitRadius(p.lat, p.lon, PLACE.km);
    rebase();
  }
  function rebase() {
    base = events.filter((e) => pass(e) && inRad(e));
    computeRange();
    paintHist();
    feedLimit = PAGE;
    refresh(true);
  }
  function refresh(force) {
    win = base.filter(inWin);
    const pool = win.length > MAXDRAW ? win.slice().sort((a, b) => b.severity - a.severity || b.t0 - a.t0).slice(0, MAXDRAW) : win;
    for (const e of pool) e._a = 1;
    globe.setEvents(pool);
    q("#capnote").innerHTML = win.length > MAXDRAW ? `<span class="warn-t">Showing the ${fmtNum(MAXDRAW)} most severe of ${fmtNum(win.length)} events in this window — shorten the window, raise the From year or filter to see them all.</span>` : `<span>Shape &amp; colour = hazard type. No ring = source gives no severity.</span>`;
    win.sort(sortFn());
    if (ST.sel && !win.some((e) => e.event_id === ST.sel)) { ST.sel = null; force = true; }
    globe.setSelected(ST.sel);
    paintTime(); paintKpis(); paintControls(); paintStageMsg(); paintHistHi();
    if (force || !ST.sel) paintSide();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(false); }); };

  function paintTime() {
    slider.value = String(Math.min(Number(slider.max), Math.round((ST.cur - LO) / DAY)));
    q("#curd").textContent = fmtDay(ST.cur);
    q("#winlab").textContent = isCum() ? ` · cumulative: ${fmtDay(LO)} to ${fmtDay(ST.cur)}` : ` · showing ${fmtDay(winStart())} to ${fmtDay(ST.cur)}`;
    slider.setAttribute("aria-valuetext", fmtDay(ST.cur));
    const cut = q("#cutnote"), early = !ST.offH.has("earthquake") && ST.cur < smallFrom && smallFrom !== Infinity;
    cut.hidden = !early;
    if (early) cut.textContent = `Before ${fmtMonth(smallFrom)} only M6+ earthquakes are in the history — this part of the map is much sparser than reality.`;
    playBtn.textContent = playing ? "⏸ Pause" : "▶ Play"; playBtn.setAttribute("aria-pressed", String(playing));
  }
  function paintKpis() {
    const n = (f) => win.filter(f).length;
    let big = null;
    for (const e of win) if (e.hazard === "earthquake" && e.magnitude_value != null && (!big || e.magnitude_value > big.magnitude_value)) big = e;
    const w = where();
    const k = [
      { k: isCum() ? "Events so far (cumulative)" : "Events in window", v: fmtNum(win.length), s: w ? w : isCum() ? `since ${fmtDay(LO)}` : `of ${fmtNum(events.length)} in the history` },
      { k: "Severe or extreme", v: fmtNum(n((e) => e.severity >= 3)), s: "on Planet Pulse's display scale", hot: n((e) => e.severity >= 3) > 0 },
      { k: "Earthquakes · Wildfires", v: `${fmtNum(n((e) => e.hazard === "earthquake"))} · ${fmtNum(n((e) => e.hazard === "wildfire"))}`, s: "in this window" },
      { k: "Storms · Floods · Volcanoes", v: `${fmtNum(n((e) => e.hazard === "cyclone"))} · ${fmtNum(n((e) => e.hazard === "flood"))} · ${fmtNum(n((e) => e.hazard === "volcano"))}`, s: "in this window" },
      { k: "Largest quake", v: big ? `M${big.magnitude_value.toFixed(1)}` : "—", s: big ? trunc(big.title.replace(/^M [\d.]+ - /, ""), 40) : "none in this window" },
    ];
    q("#kpis").innerHTML = k.map((x) => `<div class="kpi${x.hot ? " hot" : ""}"><div class="k">${esc(x.k)}</div><div class="v">${esc(x.v)}</div><div class="s">${esc(x.s)}</div></div>`).join("");
  }
  function paintControls() {
    const cnt = Object.create(null);
    for (const e of events) { if (!inRad(e) || e.severity < ST.minSev || !inWin(e)) continue; const ql = ST.q.trim().toLowerCase(); if (ql && !e._hay.includes(ql)) continue; cnt[e.hazard] = (cnt[e.hazard] || 0) + 1; }
    chipsEl.querySelectorAll(".chip[data-h]").forEach((b) => {
      b.setAttribute("aria-pressed", String(!ST.offH.has(b.dataset.h)));
      b.querySelector(".cnt").textContent = fmtNum(cnt[b.dataset.h] || 0);
      b.setAttribute("aria-label", `${hz(b.dataset.h).label}: ${cnt[b.dataset.h] || 0} events in window`);
    });
  }
  function paintStageMsg() {
    const m = q("#stagemsg");
    if (win.length) { m.hidden = true; return; }
    m.hidden = false;
    m.innerHTML = `<div><strong>No events in this window</strong><span>${PLACE.cur ? "Nothing recorded " + esc(where()) + " in this period. Try a longer window or a larger radius." : "Move the slider, lengthen the window, or turn more hazard types back on."}</span></div>`;
  }

  // yearly bars: how many events per year under the current filters
  // The range (From / To years) the slider covers. Auto start = first year with events under the current filters.
  function computeRange() {
    let mn = Infinity;
    for (const e of base) if (e.t0 < mn) mn = e.t0;
    autoFrom = mn === Infinity ? Y0 : new Date(mn).getUTCFullYear();
    toY = ST.to == null ? Y1 : ST.to;
    fromY = Math.min(ST.from == null ? autoFrom : ST.from, toY);
    LO = Date.UTC(fromY, 0, 1);
    HI = toY >= Y1 ? NOW : Date.UTC(toY, 11, 31);
    ST.cur = Math.max(LO, Math.min(HI, ST.cur));
    const ys = []; for (let y = Y0; y <= Y1; y++) ys.push(y);
    const opts = (auto) => `<option value="">${auto}</option>` + ys.map((y) => `<option value="${y}">${y}</option>`).join("");
    const yf = q("#yfrom"), yt = q("#yto");
    yf.innerHTML = opts(`Auto (${autoFrom})`); yt.innerHTML = opts("Latest");
    yf.value = ST.from == null ? "" : String(ST.from); yt.value = ST.to == null ? "" : String(ST.to);
    slider.max = String(Math.max(1, Math.floor((HI - LO) / DAY)));
    q("#axl").textContent = fmtDay(LO);
    q("#axr").textContent = HI >= NOW ? "Today" : fmtDay(HI);
    q("#tonow").textContent = HI >= NOW ? "Jump to today" : "Jump to end";
  }
  // Yearly bars (events per year under the current filters) with a running-total line; aligned with the slider.
  function paintHist() {
    const n = toY - fromY + 1, counts = new Array(n).fill(0);
    for (const e of base) { const y = new Date(e.t0).getUTCFullYear(); if (y >= fromY && y <= toY) counts[y - fromY]++; }
    const days = [], offs = []; let off = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.max(LO, Date.UTC(fromY + i, 0, 1)), e = Math.min(HI, Date.UTC(fromY + i + 1, 0, 1));
      const d = Math.max(1, (e - s) / DAY); days.push(d); offs.push(off); off += d;
    }
    const mx = Math.max(1, ...counts), sum = counts.reduce((a, b) => a + b, 0), maxRun = Math.max(1, sum);
    let run = 0; const pts = ["0,100"];
    counts.forEach((c, i) => { run += c; pts.push(`${(((offs[i] + days[i]) / off) * 1000).toFixed(1)},${(100 - (run / maxRun) * 100).toFixed(1)}`); });
    q("#hist").innerHTML = `<div class="tl-bars">${counts.map((c, i) => `<i data-y="${fromY + i}" title="${fromY + i}: ${fmtNum(c)} events" style="flex:${days[i]} 1 0;height:${Math.max(c ? 6 : 0, Math.round((c / mx) * 100))}%"></i>`).join("")}</div><svg class="tl-cum" viewBox="0 0 1000 100" preserveAspectRatio="none"><polyline points="${pts.join(" ")}"/></svg>`;
    hbars = [...q("#hist .tl-bars").children];
    q("#years").innerHTML = counts.map((c, i) => { const y = fromY + i; return n <= 14 || y % 5 === 0 ? `<span style="left:${(((offs[i] + days[i] / 2) / off) * 100).toFixed(2)}%">${y}</span>` : ""; }).join("");
    q("#tlkey").innerHTML = `<span><i class="kb"></i>Bars: events per year</span><span><i class="kl"></i>Line: running total (${fmtNum(sum)} events, ${fromY}–${toY})</span>`;
  }
  function paintHistHi() {
    const a = new Date(winStart()).getUTCFullYear(), b = new Date(ST.cur).getUTCFullYear();
    hbars.forEach((el) => el.classList.toggle("in", Number(el.dataset.y) >= a && Number(el.dataset.y) <= b));
  }

  // ------------------------------------------------ side panel
  const side = q("#side");
  function paintSide() {
    if (ST.sel && byId.has(ST.sel)) side.innerHTML = detailHtml(byId.get(ST.sel), { history: true, placeName: PLACE.cur ? PLACE.cur.name : null });
    else paintFeed();
  }
  function paintFeed() {
    const w = where();
    side.innerHTML = `<div class="side-h"><h2 id="feedh">${w ? "Near " + esc(PLACE.cur.name) : "Events in window"}</h2><span class="cnt" id="feedcnt" role="status"></span>
      <label class="sr-only" for="sort">Sort events</label>
      <select id="sort">${PLACE.cur ? '<option value="near">Nearest first</option>' : ""}<option value="new">Newest first</option><option value="sev">Most severe first</option></select></div>
      <ul class="feed" id="feed" aria-labelledby="feedh"></ul><div id="morewrap"></div>`;
    const sortEl = side.querySelector("#sort"); sortEl.value = ST.sort;
    on(sortEl, "change", () => { ST.sort = sortEl.value; feedLimit = PAGE; refresh(true); });
    const list = side.querySelector("#feed"), slice = win.slice(0, feedLimit);
    side.querySelector("#feedcnt").textContent = `${fmtNum(win.length)} event${win.length === 1 ? "" : "s"}`;
    if (!win.length) {
      list.outerHTML = `<div class="empty-note"><strong>Nothing in this window</strong><span>${PLACE.cur ? "Try a longer window or a larger radius." : "Move the slider or lengthen the window."}</span></div>`;
      return;
    }
    list.innerHTML = slice.map((e) => feedItemHtml(e, { history: true, near: !!PLACE.cur })).join("");
    if (win.length > slice.length) side.querySelector("#morewrap").innerHTML = `<button type="button" class="btn more" data-act="more">Show ${Math.min(PAGE, win.length - slice.length)} more (${fmtNum(win.length - slice.length)} hidden)</button>`;
  }
  function select(id, o = {}) {
    if (id && !byId.has(id)) return;
    ST.sel = id || null;
    if (ST.sel) { stop(); const e = byId.get(ST.sel); if (!win.includes(e)) { ST.cur = Math.min(HI, Math.max(e.t0, ST.cur)); refresh(true); } }
    globe.setSelected(ST.sel, { fly: !!o.fly });
    paintSide();
    if (ST.sel) side.querySelector("#dtitle")?.focus({ preventScroll: true });
    else if (o.focusId) { const b = side.querySelector(`.ev[data-id="${CSS.escape(o.focusId)}"]`); if (b) { b.focus(); b.scrollIntoView({ block: "nearest" }); } }
  }

  // ------------------------------------------------ play
  let playing = false;
  function stop() { playing = false; clearInterval(timer); timer = 0; paintTime(); }
  function start() {
    if (ST.cur >= HI - DAY) ST.cur = Math.min(HI, isCum() ? LO : LO + ST.spanD * DAY);
    playing = true; clearInterval(timer);
    timer = setInterval(() => {
      const total = Math.max(DAY, HI - LO);
      const step = Math.max(DAY, Math.min(spanMs() / 6, total / 350), total / 400) * ST.speed;
      ST.cur = Math.min(HI, ST.cur + step);
      if (ST.cur >= HI) stop();
      schedule();
    }, 160);
    paintTime();
  }

  // ------------------------------------------------ events
  on(playBtn, "click", () => (playing ? stop() : start()));
  on(slider, "input", () => { const v = Number(slider.value); stop(); ST.cur = Math.min(HI, LO + v * DAY); schedule(); });
  on(q("#tonow"), "click", () => { stop(); ST.cur = HI; refresh(false); });
  on(q("#yfrom"), "change", (ev) => { stop(); ST.from = ev.target.value ? Number(ev.target.value) : null; if (ST.from != null && ST.to != null && ST.from > ST.to) ST.to = ST.from; rebase(); });
  on(q("#yto"), "change", (ev) => { stop(); ST.to = ev.target.value ? Number(ev.target.value) : null; if (ST.to != null && ST.from != null && ST.from > ST.to) ST.from = ST.to; rebase(); });
  on(q("#span"), "change", (ev) => { ST.spanD = Number(ev.target.value); feedLimit = PAGE; refresh(true); });
  on(q("#speed"), "change", (ev) => { ST.speed = Number(ev.target.value); });
  on(q("#hist"), "click", (ev) => { const b = ev.target.closest("i[data-y]"); if (!b) return; stop(); ST.cur = Math.max(LO, Math.min(HI, Date.UTC(Number(b.dataset.y), 11, 31))); refresh(false); });
  on(side, "click", (ev) => {
    const t = ev.target.closest("button"); if (!t) return;
    if (t.classList.contains("ev")) select(t.dataset.id, { fly: true });
    else if (t.dataset.act === "back") select(null, { focusId: ST.sel });
    else if (t.dataset.act === "more") { const before = feedLimit; feedLimit += PAGE; paintFeed(); side.querySelectorAll(".ev")[before]?.focus(); }
  });
  on(side, "keydown", (ev) => { if (ev.key === "Escape" && ST.sel) select(null, { focusId: ST.sel }); });
  on(side, "mouseover", (ev) => { const b = ev.target.closest(".ev"); globe.setHover(b ? b.dataset.id : null); });
  on(side, "mouseleave", () => globe.setHover(null));
  on(chipsEl, "click", (ev) => { const b = ev.target.closest(".chip[data-h]"); if (!b) return; const k = b.dataset.h; ST.offH.has(k) ? ST.offH.delete(k) : ST.offH.add(k); rebase(); });
  on(q("#sev"), "change", (ev) => { ST.minSev = Number(ev.target.value) || 0; rebase(); });
  let qt = 0;
  on(q("#q"), "input", (ev) => { ST.q = ev.target.value; clearTimeout(qt); qt = setTimeout(rebase, 200); });
  on(q("#reset"), "click", () => { ST.offH.clear(); ST.minSev = 0; ST.q = ""; q("#sev").value = "0"; q("#q").value = ""; rebase(); });
  on(q("#ftoggle"), "click", (ev) => { const f = q("#filters"), open = !f.classList.contains("open"); f.classList.toggle("open", open); ev.currentTarget.setAttribute("aria-expanded", String(open)); ev.currentTarget.textContent = open ? "Hide" : "Show"; });
  page.querySelectorAll("[data-mode]").forEach((b) => on(b, "click", () => { ST.mode = b.dataset.mode; globe.setMode(ST.mode); paintMapUi(); if (PLACE.cur) globe.fitRadius(PLACE.cur.lat, PLACE.cur.lon, PLACE.km); }));
  page.querySelectorAll("[data-z]").forEach((b) => on(b, "click", () => { const z = b.dataset.z; if (z === "in") globe.zoomBy(1.5); else if (z === "out") globe.zoomBy(1 / 1.5); else globe.reset(); }));

  applyPlace(false);
  if (PLACE.cur) globe.fitRadius(PLACE.cur.lat, PLACE.cur.lon, PLACE.km);
  if (ST.sel) globe.setSelected(ST.sel, { fly: true });

  return () => { clearTimeout(qt); clearInterval(timer); if (raf) cancelAnimationFrame(raf); stopTicker(); globe.destroy(); };
}
