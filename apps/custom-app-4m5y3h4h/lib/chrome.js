import { esc, rel, fmtUTC } from "./model.js";

const TABS = [
  { href: "home", path: "home", label: "Live" },
  { href: "timeline", path: "timeline", label: "Timeline" },
  { href: "sources", path: "sources", label: "Sources & method" },
];

const LOGO = `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false"><defs><radialGradient id="twg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#5ee6ff"/><stop offset="1" stop-color="#0a4f86"/></radialGradient></defs><circle cx="16" cy="16" r="13" fill="url(#twg)"/><path d="M4 16h24M16 3c5 4 5 22 0 26M16 3c-5 4-5 22 0 26" fill="none" stroke="#04101e" stroke-opacity=".55" stroke-width="1.2"/><circle cx="22" cy="11" r="3" fill="#ff5a3c"/><circle cx="22" cy="11" r="5.4" fill="none" stroke="#ff5a3c" stroke-opacity=".6"/></svg>`;

/** Draw header, disclaimer and page shell. Returns the element the page fills. */
export function chrome(content, current) {
  content.innerHTML = `
<div class="tw">
  <header class="tw-top">
    <a class="tw-brand" href="home">${LOGO}<span class="tw-name">Planet Pulse<small>Live hazard awareness</small></span></a>
    <nav class="tw-nav" aria-label="Primary">
      ${TABS.map((t) => `<a href="${t.href}"${t.path === current ? ' aria-current="page"' : ""}>${esc(t.label)}</a>`).join("")}
    </nav>
    <div class="tw-fresh" id="tw-fresh" role="status"><span class="dot" aria-hidden="true"></span><span class="txt">Loading data…</span></div>
  </header>
  <div class="tw-page" id="tw-page"></div>
  <footer class="tw-foot" role="contentinfo">
    <p><span aria-hidden="true">⚠</span> <strong>For information only.</strong> Planet Pulse is a situational-awareness dashboard, <strong>not</strong> an official emergency-warning, evacuation or life-safety system. Data can be delayed, incomplete or wrong. <strong>Always follow official local authorities</strong> and your national warning services. <a href="sources">Sources &amp; method</a></p>
  </footer>
</div>`;
  return content.querySelector("#tw-page");
}

/** Paint the freshness chip from the live pipeline's fetch time. */
export function paintFresh(content, fetchedMs, failed) {
  const el = content.querySelector("#tw-fresh");
  if (!el) return;
  const txt = el.querySelector(".txt");
  el.className = "tw-fresh";
  if (failed) { el.classList.add("bad"); txt.textContent = "Data unavailable"; el.title = "The hazard data could not be loaded."; return; }
  if (!fetchedMs) { el.classList.add("warn"); txt.textContent = "No data yet — run the pipeline"; el.title = "The data pipeline has not produced rows yet."; return; }
  const age = Date.now() - fetchedMs;
  const cls = age < 3 * 3600e3 ? "ok" : age < 12 * 3600e3 ? "warn" : "bad";
  el.classList.add(cls);
  txt.textContent = `Live feeds fetched ${rel(fetchedMs)}${cls === "bad" ? " · stale" : ""}`;
  el.title = `Live source feeds were last pulled ${fmtUTC(fetchedMs)}. The live pipeline runs hourly; the timeline history refreshes daily.`;
}

/** Keep the chip and every <time data-ms> honest while the page stays open. */
export function startTicker(content, getFetched, signal) {
  const tick = () => {
    paintFresh(content, getFetched(), false);
    content.querySelectorAll("time[data-ms]").forEach((t) => {
      const ms = Number(t.dataset.ms);
      if (ms) t.textContent = rel(ms);
    });
  };
  const id = setInterval(tick, 30000);
  signal.addEventListener("abort", () => clearInterval(id), { once: true });
  return () => clearInterval(id);
}

export function showError(ctx, target, err) {
  const msg = err && err.message ? err.message : String(err);
  target.innerHTML = `<div class="tw-error" role="alert"><h2>Couldn't load hazard data</h2><p>${esc(msg)}</p><p class="muted">The app reads the latest run of its data pipelines. If one has never run, open it and press Run.</p><button type="button" class="btn" data-act="retry">Try again</button></div>`;
  target.querySelector('[data-act="retry"]')?.addEventListener("click", () => ctx.reload(), { signal: ctx.signal });
  ctx.reportError(err);
}
