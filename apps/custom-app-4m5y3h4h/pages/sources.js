import { chrome, paintFresh, startTicker, showError } from "../lib/chrome.js";
import { esc, SRC, HAZARDS, COVER, NA_WHY, RESOURCES, loadLive, loadSourcesExtra, fmtUTC, fmtMonth, rel, link, fmtNum, SEVS } from "../lib/model.js";

const LIVE_RULES = [
  ["Earthquakes (USGS)", "7 days after the event"],
  ["Tropical cyclones (NHC, EONET)", "3 days after the latest position"],
  ["Wildfires (EONET)", "30 days after the latest update"],
  ["Sea & lake ice (EONET)", "60 days after the latest update"],
  ["NWS alerts (floods, severe weather)", "until the alert's own end or expiry time"],
  ["Volcano alert notices (USGS HANS)", "3 days after the notice"],
  ["Smithsonian weekly volcano report", "14 days after the report"],
];

export default async function render(ctx) {
  const page = chrome(ctx.content, ctx.route.path);
  page.innerHTML = `<div class="tw-loading" role="status"><span class="spin" aria-hidden="true"></span>Loading source status…</div>`;
  let data, extra = null;
  try {
    data = await loadLive(ctx.db);
  } catch (err) {
    if (ctx.signal.aborted) return;
    paintFresh(ctx.content, null, true);
    showError(ctx, page, err);
    return;
  }
  try { extra = await loadSourcesExtra(ctx.db); } catch (e) { extra = null; }
  if (ctx.signal.aborted) return;
  const { sources, fetchedMs, events } = data;
  paintFresh(ctx.content, fetchedMs, false);
  const stop = startTicker(ctx.content, () => fetchedMs, ctx.signal);

  const srcRows = sources.map((s) => {
    const ok = s.status === "ok", info = SRC[s.source] || {};
    return `<tr>
      <td><strong>${esc(info.name || s.source)}</strong></td>
      <td><span class="pill ${ok ? "ok" : "bad"}">${ok ? "Fetched OK" : "Failed"}</span>${s.message ? `<br><span class="muted">${esc(s.message)}</span>` : ""}</td>
      <td>${fmtNum(s.n_raw)} received<br>${fmtNum(s.n_live_events)} live</td>
      <td>${s.run_at ? `${esc(fmtUTC(Date.parse(s.run_at)))}<br><span class="muted">${esc(rel(Date.parse(s.run_at)))}</span>` : "—"}</td>
      <td>${s.latency_ms != null ? fmtNum(s.latency_ms) + " ms" : "—"}</td>
      <td class="att">${link(info.url, "Home")}${link(info.docs, "API / docs")}</td></tr>`;
  }).join("");

  const covRows = extra ? extra.coverage.map((c) => `<tr><td><strong style="color:${(HAZARDS[c.hazard] || HAZARDS.other).color}">${esc((HAZARDS[c.hazard] || HAZARDS.other).label)}</strong></td><td>${fmtNum(c.n)}</td><td>${esc(fmtMonth(c.mn))} – ${esc(fmtMonth(c.mx))}</td><td class="muted">${esc(COVER[c.hazard] || (c.hazard === "weather" ? NA_WHY.timeline.weather : NA_WHY.timeline[c.hazard] || ""))}</td></tr>`).join("") : "";
  const greyed = ["weather", "ice", "drought", "landslide"].map((k) => `<li><strong>${esc(HAZARDS[k].label)}:</strong> ${esc(NA_WHY.timeline[k])}</li>`).join("");

  page.innerHTML = `<div class="doc">
  <div><h1>Sources &amp; method</h1><p class="lead">Where every marker comes from, how fresh it is, and how Planet Pulse normalises it. Everything on the globe is real data from the public feeds below — nothing is simulated.</p></div>
  <section class="card" aria-labelledby="fh"><h2 id="fh">Live feed status</h2>
    <p class="note" style="margin-bottom:10px">The live pipeline re-checks every feed <strong>hourly</strong>; the feeds were last pulled <strong>${esc(fmtUTC(fetchedMs))}</strong> (${esc(rel(fetchedMs))}). Each event also shows the timestamp the <em>source</em> gave it. ${fmtNum(events.length)} events are live right now.</p>
    <div class="tbl-wrap"><table class="tbl"><caption class="sr-only">Status of each live data source</caption><thead><tr><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Records</th><th scope="col">Last pulled</th><th scope="col">Fetch time</th><th scope="col">Links</th></tr></thead><tbody>${srcRows}</tbody></table></div></section>

  <div class="grid2">
    <section class="card" aria-labelledby="lh"><h2 id="lh">What counts as “live”</h2>
      <p class="note">Each hazard has its own live window, because sources keep records “open” for very different lengths of time. An event drops off the Live tab when its window ends; it stays in the Timeline.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Hazard / source</th><th scope="col">Live until</th></tr></thead><tbody>${LIVE_RULES.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table></div>
      <p class="note" style="margin-top:10px">NASA EONET's own volcano records are kept for the Timeline only: they are often years old. Current volcano activity comes from the USGS alert notices and the Smithsonian weekly report. A Smithsonian report for a volcano that also has a USGS alert is shown once, as the USGS alert.</p>
    </section>
    <section class="card" aria-labelledby="nh"><h2 id="nh">Normalisation &amp; de-duplication</h2>
      <ul>
        <li>Every feed is mapped to one event schema: hazard type, source, title, coordinates, severity, magnitude, and the <strong>source's own timestamps</strong> (shown in UTC and your local time).</li>
        <li><strong>Coordinates are preserved</strong> from the source. Where a source gives an area instead of a point (some NWS alerts, EONET polygons) the marker sits at the area's centre and the event panel says so.</li>
        <li>NWS alerts are de-duplicated by their VTEC event key (the latest message wins); cancelled and expired alerts are dropped.</li>
        <li>EONET storm records already covered by an NHC advisory are merged into the NHC record; EONET quakes near a USGS event in space and time are merged into USGS.</li>
        <li>Only Severe and Extreme NWS alerts are pulled.</li>
      </ul>
    </section>
  </div>

  <section class="card" aria-labelledby="th"><h2 id="th">Timeline history</h2>
    <p class="note" style="margin-bottom:10px">The Timeline is rebuilt <strong>daily</strong> from the USGS earthquake catalog and NASA EONET. Older time slices are fetched once and then frozen; only the most recent slices are re-read. ${extra && extra.slices ? `Latest build: ${fmtNum(extra.slices.ok)} of ${fmtNum(extra.slices.n)} time slices read successfully${extra.slices.err ? `, <strong>${fmtNum(extra.slices.err)} failed</strong>` : ""}.` : ""}</p>
    ${covRows ? `<div class="tbl-wrap"><table class="tbl"><caption class="sr-only">What the history holds for each hazard</caption><thead><tr><th scope="col">Hazard</th><th scope="col">Events</th><th scope="col">Span</th><th scope="col">What is (and is not) included</th></tr></thead><tbody>${covRows}</tbody></table></div>` : `<p class="note">History coverage could not be loaded.</p>`}
    <h3>Hazards with no verified history</h3>
    <p class="note">These are greyed out on the Timeline rather than filled with guesses:</p>
    <ul>${greyed}</ul>
    <p class="note" style="margin-top:10px">Because the sources differ, history is <strong>not a complete record</strong>: for example, earthquake counts before ${extra && extra.coverage.find((c) => c.hazard === "earthquake") ? "the last five years" : "recent years"} include only magnitude 6 and larger, and wildfire history includes only fires of 1,000 acres or more.</p>
  </section>

  <section class="card" aria-labelledby="ph"><h2 id="ph">Place search</h2>
    <ul>
      <li>Search uses the GeoNames list of cities with <strong>15,000 or more people</strong>${extra && extra.places ? ` (${fmtNum(extra.places.n)} cities in ${fmtNum(extra.places.c)} countries)` : ""}. It is refreshed daily, and only when GeoNames republishes it. Smaller towns and villages cannot be searched.</li>
      <li>Choosing a city draws a circle of the radius you pick around it and lists the events inside it, nearest first. Distances are straight-line (great-circle) from the city's centre, not travel distances.</li>
      <li>There is no street-level map: the app works from a bundled place list and does not call a live geocoder.</li>
    </ul>
  </section>

  <section class="card" aria-labelledby="sh"><h2 id="sh">How severity is drawn</h2>
    <p class="note">Severity is Planet Pulse's <em>display</em> scale, computed from each source's own measurements. It is not an official rating and is not comparable across hazard types.</p>
    <ul>
      <li><strong>Earthquakes:</strong> magnitude &lt;5 minor, 5–5.9 moderate, 6–6.9 severe, ≥7 extreme; on the Live tab raised to match a USGS PAGER alert level when present.</li>
      <li><strong>Tropical cyclones:</strong> sustained wind &lt;34 kt minor, 34–63 kt moderate, 64–95 kt severe, ≥96 kt extreme. Many historical storm records carry no wind speed and are shown as unrated.</li>
      <li><strong>Wildfires:</strong> reported burned area &lt;1,000 acres minor, 1,000–9,999 moderate, 10,000–99,999 severe, ≥100,000 extreme.</li>
      <li><strong>NWS alerts:</strong> only Severe and Extreme alerts are pulled, so they are shown as severe or extreme.</li>
      <li><strong>USGS volcano alerts:</strong> ADVISORY moderate, WATCH severe, WARNING extreme.</li>
      <li><strong>Smithsonian volcano reports, floods, sea ice, other:</strong> the source publishes no rating, so they are shown as unrated.</li>
    </ul>
    <p style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap">${SEVS.map((s) => `<span class="sev sev${s.n}">${esc(s.label)}</span>`).join("")}</p>
  </section>

  <section class="card att" aria-labelledby="ah"><h2 id="ah">Attribution</h2>
    <ul>
      <li>Data: NASA Earth Observatory Natural Event Tracker (EONET). Event records are compiled from the originating agencies named on each event. ${link(SRC.EONET.url, "Visit source")}</li>
      <li>Data: U.S. Geological Survey, Earthquake Hazards Program, and USGS Volcano Hazards Program (HANS). Public domain. ${link(SRC.USGS.url, "Visit source")}</li>
      <li>Data: NOAA / National Weather Service / National Hurricane Center. Public domain. ${link(SRC.NWS.url, "Visit source")}</li>
      <li>Data: Smithsonian Institution Global Volcanism Program and USGS, Weekly Volcanic Activity Report. ${link(SRC.GVP.url, "Visit source")}</li>
      <li>Places: GeoNames geographical database (cities15000), licensed CC BY 4.0. ${link("https://www.geonames.org/", "Visit source")}</li>
      <li>Base map: Natural Earth (public domain), 1:110m land polygons, bundled with the app.</li>
      <li>Planet Pulse is an independent project inspired by the public Terra Watch demo. It is not affiliated with or endorsed by NASA, USGS, NOAA, the Smithsonian or GeoNames.</li></ul></section>

  <section class="card" aria-labelledby="rh"><h2 id="rh">Official sources to follow</h2>
    <ul class="res" style="gap:8px">${RESOURCES.map((r) => `<li>${link(r.source_url, r.title)}<span>${esc(r.description)}</span></li>`).join("")}</ul>
    <p class="note" style="margin-top:10px">Emergency in your area? Contact your local emergency number.</p></section>
</div>`;
  return () => stop();
}
