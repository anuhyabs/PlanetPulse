import { esc } from "@corvic/live";
export { esc };

// ---------- vocabulary -------------------------------------------------------
export const HAZARDS = {
  wildfire:   { label: "Wildfire",         plural: "wildfires",          color: "#ff7a1a", icon: "🔥" },
  earthquake: { label: "Earthquake",       plural: "earthquakes",        color: "#b58cff", icon: "🌍" },
  cyclone:    { label: "Tropical cyclone", plural: "tropical cyclones",  color: "#2ee6c5", icon: "🌀" },
  flood:      { label: "Flood",            plural: "floods",             color: "#4c8dff", icon: "🌊" },
  weather:    { label: "Severe weather",   plural: "severe-weather events", color: "#ffd23f", icon: "⛈️" },
  volcano:    { label: "Volcano",          plural: "volcanoes",          color: "#ff4d6d", icon: "🌋" },
  drought:    { label: "Drought",          plural: "droughts",           color: "#d9a566", icon: "☀️" },
  ice:        { label: "Sea & lake ice",   plural: "sea-ice records",    color: "#c4ecff", icon: "🧊" },
  landslide:  { label: "Landslide",        plural: "landslides",         color: "#a98467", icon: "⛰️" },
  other:      { label: "Other",            plural: "other events",       color: "#9aa9bb", icon: "•" },
};
export const HAZARD_ORDER = ["wildfire", "earthquake", "cyclone", "flood", "weather", "volcano", "drought", "ice", "landslide", "other"];

// Hazards that have a verified source on each tab. Anything else is shown greyed: "no verified source".
export const AVAIL = {
  home: new Set(["wildfire", "earthquake", "cyclone", "flood", "weather", "volcano", "ice"]),
  timeline: new Set(["earthquake", "cyclone", "wildfire", "volcano", "flood"]),
};
export const NA_WHY = {
  home: {
    drought: "No verified live drought feed was found.",
    landslide: "No verified live landslide feed was found.",
  },
  timeline: {
    weather: "Heat, cold and storm history: NASA EONET holds only a handful of records (2015–2019). No verified long-run source was found.",
    ice: "Sea-ice history: NASA EONET holds only a few years of iceberg records. The national ice-centre archives could not be fetched.",
    drought: "Drought history: NASA EONET holds only a handful of records (2015–2018).",
    landslide: "Landslide history: NASA EONET holds only two records. NASA's landslide catalog could not be fetched.",
  },
};

export const COVER = {
  earthquake: "USGS earthquake catalog: magnitude 6+ from 1970; magnitude 4.5+ for the last five years. Smaller quakes are not included.",
  cyclone: "NASA EONET storm records (from 1999). Wind speed is known for only some of them.",
  wildfire: "NASA EONET wildfire records (from 2016). Only fires of 1,000 acres or more are included.",
  volcano: "NASA EONET volcano-activity records (from 1980). No alert level or size is published.",
  flood: "NASA EONET flood records (from 2015). Far fewer than real floods: treat as a sample.",
};

export const SEV_BASIS = {
  earthquake: "Magnitude: <5 minor · 5–5.9 moderate · 6–6.9 severe · ≥7 extreme",
  cyclone: "Sustained wind: <34 kt minor · 34–63 kt moderate · 64–95 kt severe · ≥96 kt extreme",
  wildfire: "Burned area: <1,000 acres minor · 1,000–9,999 moderate · 10,000–99,999 severe · ≥100,000 extreme",
};

export const SEVS = [
  { n: 0, label: "Unrated",  color: "#93a6bd" },
  { n: 1, label: "Minor",    color: "#ffe066" },
  { n: 2, label: "Moderate", color: "#ffa63d" },
  { n: 3, label: "Severe",   color: "#ff5252" },
  { n: 4, label: "Extreme",  color: "#ff3cac" },
];

export const SRC = {
  EONET: { name: "NASA EONET", url: "https://eonet.nasa.gov/", docs: "https://eonet.gsfc.nasa.gov/docs/v3" },
  USGS: { name: "USGS Earthquakes", url: "https://earthquake.usgs.gov/", docs: "https://earthquake.usgs.gov/fdsnws/event/1/" },
  NWS: { name: "NOAA NWS alerts", url: "https://www.weather.gov/", docs: "https://www.weather.gov/documentation/services-web-api" },
  NHC: { name: "NOAA NHC storms", url: "https://www.nhc.noaa.gov/", docs: "https://www.nhc.noaa.gov/productexamples/NHC_JSON_Sample.json" },
  HANS: { name: "USGS volcano alerts", url: "https://volcanoes.usgs.gov/", docs: "https://volcanoes.usgs.gov/hans-public/" },
  GVP: { name: "Smithsonian weekly volcano report", url: "https://volcano.si.edu/", docs: "https://volcano.si.edu/reports_weekly.cfm" },
};
const SRC_ORDER = ["EONET", "USGS", "NWS", "NHC", "HANS", "GVP"];

export const WINDOWS = [
  { v: "24h", label: "24 h", ms: 864e5 },
  { v: "7d", label: "7 days", ms: 6048e5 },
  { v: "30d", label: "30 days", ms: 2592e6 },
  { v: "all", label: "All live", ms: Infinity },
];

const COORD_BASIS = {
  point: "Point reported by the source",
  "polygon-centre": "Centre of the source's polygon (approximate)",
  "alert-polygon-centre": "Centre of the NWS alert polygon (approximate)",
  "first-affected-zone-centre": "Centre of the first affected NWS zone (approximate; the alert covers several areas)",
};
export const coordBasis = (b) => COORD_BASIS[b] || "Source-reported location";

// ---------- official resources (static) --------------------------------------
export const RESOURCES = [
  { title: "National Weather Service (weather.gov)", description: "Official U.S. watches, warnings and forecasts.", source_url: "https://www.weather.gov/" },
  { title: "National Hurricane Center", description: "Official tropical-cyclone advisories for the Atlantic and Eastern/Central Pacific.", source_url: "https://www.nhc.noaa.gov/" },
  { title: "USGS Earthquake Hazards Program", description: "Official U.S. earthquake information and Did You Feel It? reports.", source_url: "https://earthquake.usgs.gov/" },
  { title: "Tsunami.gov (NOAA Tsunami Warning Centers)", description: "Official tsunami alerts for the U.S., Canada and the Caribbean.", source_url: "https://www.tsunami.gov/" },
  { title: "Ready.gov — emergency alerts & preparedness", description: "How to receive Wireless Emergency Alerts and find your local emergency management office.", source_url: "https://www.ready.gov/alerts" },
  { title: "InciWeb — U.S. wildfire incident information", description: "Official incident pages, evacuation notices and closures for U.S. wildfires.", source_url: "https://inciweb.wildfire.gov/" },
  { title: "WMO Severe Weather Information Centre", description: "Official national warnings from meteorological services worldwide.", source_url: "https://severeweather.wmo.int/" },
  { title: "USGS Volcano Hazards Program", description: "Official U.S. volcano alert levels and notices.", source_url: "https://volcanoes.usgs.gov/" },
  { title: "Smithsonian Global Volcanism Program", description: "Weekly worldwide volcanic-activity reports and volcano profiles.", source_url: "https://volcano.si.edu/" },
];
const OFFICIAL = {
  earthquake: [2, 3], cyclone: [1, 0, 3], weather: [0], flood: [0], wildfire: [5],
  volcano: [7, 8, 6], drought: [0, 6], ice: [6], landslide: [6], other: [6],
};
export const officialFor = (hazard) => {
  const idx = [...(OFFICIAL[hazard] || [6]), 4];
  const seen = new Set();
  return idx.filter((i) => !seen.has(i) && seen.add(i)).map((i) => RESOURCES[i]);
};

// ---------- data -------------------------------------------------------------
const j = (s, d) => { if (!s) return d; try { return JSON.parse(s); } catch { return d; } };
const num = (v) => (v == null ? null : Number(v));

export async function loadLive(db) {
  const now = Date.now();
  const [ev, src] = await Promise.all([
    db.rows(`SELECT event_id, trigger_source AS source, source_name, hazard, hazard_label, title, description, lat, lon, coord_basis,
                    severity, severity_label, severity_basis, magnitude_value, magnitude_unit,
                    event_ts_ms, started_ts_ms, updated_ts_ms, expires_ts_ms, live_until_ms, source_url, secondary_url,
                    area, meta_json, track_json, run_at
             FROM live WHERE lat IS NOT NULL AND lon IS NOT NULL AND live_until_ms >= ${now}
             ORDER BY severity DESC, event_ts_ms DESC LIMIT 5000`),
    db.rows(`SELECT source, run_at, status, message, n_raw, n_live_events, latency_ms FROM lsrc LIMIT 50`),
  ]);
  const seen = new Set(), events = [];
  for (const e of ev) {
    if (seen.has(e.event_id)) continue;
    seen.add(e.event_id);
    events.push({
      ...e,
      severity: e.severity == null ? 0 : Number(e.severity),
      event_ts_ms: num(e.event_ts_ms), started_ts_ms: num(e.started_ts_ms), updated_ts_ms: num(e.updated_ts_ms), expires_ts_ms: num(e.expires_ts_ms), live_until_ms: num(e.live_until_ms),
      lat: Number(e.lat), lon: Number(e.lon), magnitude_value: e.magnitude_value == null ? null : Number(e.magnitude_value),
      meta: j(e.meta_json, {}),
      track: j(e.track_json, null),
      merged: [],
    });
  }
  const sources = src.map((s) => ({ ...s, n_raw: num(s.n_raw), n_live_events: num(s.n_live_events), latency_ms: num(s.latency_ms) }))
    .sort((a, b) => SRC_ORDER.indexOf(a.source) - SRC_ORDER.indexOf(b.source));
  const runMs = [...src.map((s) => Date.parse(s.run_at)), ...ev.map((e) => Date.parse(e.run_at))].filter((x) => Number.isFinite(x));
  return { events, sources, fetchedMs: runMs.length ? Math.max(...runMs) : null };
}

export async function loadHistory(db) {
  const now = Date.now();
  const hz = [...AVAIL.timeline].map((h) => `'${h}'`).join(",");
  const rows = await db.rows(`SELECT event_id, hazard, source, t0_ms, t1_ms, lat, lon, magnitude_value, magnitude_unit, severity, title, url
    FROM hist WHERE lat IS NOT NULL AND lon IS NOT NULL AND t0_ms <= ${now} AND hazard IN (${hz}) LIMIT 100000`);
  const events = rows.map((r) => {
    const t0 = Number(r.t0_ms), t1 = Math.max(t0, Number(r.t1_ms));
    return {
      event_id: r.event_id, hazard: r.hazard, source: r.source, source_name: (SRC[r.source] || {}).name || r.source,
      t0, t1, event_ts_ms: t0, lat: Number(r.lat), lon: Number(r.lon),
      magnitude_value: r.magnitude_value == null ? null : Number(r.magnitude_value), magnitude_unit: r.magnitude_unit,
      severity: r.severity == null ? 0 : Number(r.severity), title: r.title || "", url: r.url, meta: {}, merged: [], area: null,
    };
  });
  return { events };
}

export async function loadPlaces(db) {
  // One row per place even if the source table ever holds several copies (keeps the dropdown free of repeats).
  const rows = await db.rows(`SELECT geonameid, any_value(name) AS name, any_value(ascii_name) AS ascii_name, any_value(admin1) AS admin1, any_value(cc) AS cc, any_value(country) AS country, any_value(lat) AS lat, any_value(lon) AS lon, max(population) AS population FROM places GROUP BY geonameid ORDER BY population DESC LIMIT 100000`);
  return rows.map((r) => ({
    id: String(r.geonameid), name: r.name, ascii: r.ascii_name, admin1: r.admin1 || "", cc: r.cc, country: r.country || r.cc,
    lat: Number(r.lat), lon: Number(r.lon), pop: Number(r.population) || 0,
  }));
}

export async function loadSourcesExtra(db) {
  const now = Date.now();
  const [cov, hs, pl] = await Promise.all([
    db.rows(`SELECT hazard, source, count(*) AS n, min(t0_ms) AS mn, max(t0_ms) AS mx FROM hist WHERE t0_ms <= ${now} GROUP BY hazard, source ORDER BY n DESC LIMIT 50`),
    db.rows(`SELECT count(*) AS n, sum(CASE WHEN status = 'slice' THEN 1 ELSE 0 END) AS ok, sum(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS err FROM hstat`),
    db.rows(`SELECT count(DISTINCT geonameid) AS n, count(DISTINCT cc) AS c FROM places`),
  ]);
  return {
    coverage: cov.map((r) => ({ hazard: r.hazard, source: r.source, n: Number(r.n), mn: Number(r.mn), mx: Number(r.mx) })),
    slices: hs[0] ? { n: Number(hs[0].n), ok: Number(hs[0].ok), err: Number(hs[0].err) } : null,
    places: pl[0] ? { n: Number(pl[0].n), c: Number(pl[0].c) } : null,
  };
}

// Sources page: live feed health + current counts, built from the live tables declared in app.yaml (`live`, `lsrc`).
export async function loadAll(db) {
  const live = await loadLive(db);
  const newest = {};
  for (const e of live.events) if (e.event_ts_ms != null && (newest[e.source] == null || e.event_ts_ms > newest[e.source])) newest[e.source] = e.event_ts_ms;
  const sources = live.sources.map((s) => ({
    ...s,
    n_events: s.n_live_events,
    event_ts_ms: newest[s.source] ?? null,
    description: (SRC[s.source] || {}).name || s.source,
    source_url: (SRC[s.source] || {}).url || null,
    secondary_url: (SRC[s.source] || {}).docs || null,
  }));
  return { events: live.events, sources, dedup: null, resources: RESOURCES, fetchedMs: live.fetchedMs };
}

// ---------- geometry & text --------------------------------------------------
export function distKm(la1, lo1, la2, lo2) {
  const R = Math.PI / 180, dLa = (la2 - la1) * R, dLo = (lo2 - lo1) * R;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * R) * Math.cos(la2 * R) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ---------- formatting -------------------------------------------------------
const utcFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });
const localFmt = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
export const fmtUTC = (ms) => (ms == null ? "—" : utcFmt.format(new Date(ms)).replace(",", "") + " UTC");
export const fmtDay = (ms) => (ms == null ? "—" : dayFmt.format(new Date(ms)));
export const fmtMonth = (ms) => (ms == null ? "—" : monthFmt.format(new Date(ms)));
export const fmtLocal = (ms) => (ms == null ? "—" : localFmt.format(new Date(ms)));
export function rel(ms, now = Date.now()) {
  if (ms == null) return "—";
  const d = now - ms, a = Math.abs(d), s = d >= 0 ? "ago" : "from now";
  if (a < 60e3) return "just now";
  if (a < 3600e3) return `${Math.round(a / 60e3)} min ${s}`;
  if (a < 86400e3) return `${Math.round(a / 3600e3)} h ${s}`;
  if (a < 60 * 86400e3) return `${Math.round(a / 86400e3)} d ${s}`;
  if (a < 730 * 86400e3) return `${Math.round(a / (30 * 86400e3))} mo ${s}`;
  return `${Math.round(a / (365.25 * 86400e3))} yr ${s}`;
}
export const timeTag = (ms) => `<time data-ms="${ms ?? ""}" datetime="${ms ? new Date(ms).toISOString() : ""}" title="${esc(fmtUTC(ms))}">${esc(rel(ms))}</time>`;
export function fmtCoord(lat, lon) {
  return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? "E" : "W"}`;
}
export const fmtNum = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
export function compass(deg) {
  if (deg == null || isNaN(deg)) return "—";
  return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16] + ` (${Math.round(deg)}°)`;
}
export function magText(e) {
  if (e.magnitude_value == null) return "";
  const v = e.magnitude_value, u = e.magnitude_unit || "";
  if (u.startsWith("M")) return `${u.length > 1 ? "M" + v.toFixed(1) + " " + u.slice(1) : "M" + v.toFixed(1)}`;
  if (u === "acres") return `${fmtNum(v)} acres`;
  if (u === "kts" || u === "kt") return `${fmtNum(v)} kt (${fmtNum(v * 1.15078)} mph)`;
  return `${fmtNum(v, 1)} ${u}`.trim();
}
export const safeUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : null);
export const link = (u, text, cls = "") => {
  const s = safeUrl(u);
  return s ? `<a class="ext ${cls}" href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(text)}<span class="sr-only"> (opens in a new tab)</span></a>` : "";
};
export const trunc = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
export const sevLabel = (n) => (SEVS[n] || SEVS[0]).label;
