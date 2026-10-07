import { shapeSvg } from './globe.js';
import {
  HAZARDS, AVAIL, NA_WHY, COVER, SEV_BASIS, esc, fmtUTC, fmtLocal, fmtDay, rel, fmtCoord, fmtNum, compass, magText, link,
  coordBasis, officialFor, sevLabel, trunc, norm, timeTag,
} from './model.js';

// Attribute-safe escape for values placed inside single-quoted HTML attributes.
export const ea = (s) => esc(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
export const hz = (k) => HAZARDS[k] || HAZARDS.other;
export const sevPill = (n) => `<span class='sev sev${n}'>${esc(sevLabel(n))}</span>`;
export const ico = (k) => `<span class='ev-ico' style='--c:${hz(k).color}'>${shapeSvg(k)}</span>`;

// ---------------------------------------------------------------- hazard chips
export function chipsHtml(keys, tab) {
  const why = NA_WHY[tab] || {};
  return keys.map((k) => {
    const h = hz(k);
    if (!AVAIL[tab].has(k)) {
      return `<button type='button' class='chip na' disabled aria-disabled='true' title='${ea(why[k] || 'No verified source')}' style='--c:${h.color}'>${shapeSvg(k)}<span class='lab'>${esc(h.label)}<small>no verified source</small></span><span class='cnt'>—</span></button>`;
    }
    return `<button type='button' class='chip' data-h='${k}' style='--c:${h.color}' aria-pressed='true'>${shapeSvg(k)}<span class='lab'>${esc(h.label)}</span><span class='cnt'>0</span></button>`;
  }).join('');
}

export function naNote(tab, keys) {
  const why = NA_WHY[tab] || {};
  const items = keys.filter((k) => !AVAIL[tab].has(k) && why[k]);
  if (!items.length) return '';
  return `<details class='note-det'><summary>Why are some hazards greyed out?</summary><ul>${items.map((k) => `<li><strong>${esc(hz(k).label)}:</strong> ${esc(why[k])}</li>`).join('')}</ul></details>`;
}

// ---------------------------------------------------------------- feed row
export function feedItemHtml(e, { history = false, near = false } = {}) {
  const where = e.area || e.description || '';
  const dist = near && e._d != null ? ` · ${fmtNum(e._d)} km away` : '';
  const when = history ? `<span>${esc(fmtDay(e.t0))}</span>` : timeTag(e.event_ts_ms);
  return `<li><button type='button' class='ev' data-id='${ea(e.event_id)}' style='--c:${hz(e.hazard).color}'>${ico(e.hazard)}
    <span><span class='ev-t'>${esc(trunc(e.title, 90))}</span><span class='ev-s'>${esc(e.source_name || e.source)}${where ? ' · ' + esc(trunc(where, 60)) : ''}${esc(dist)}</span></span>
    <span class='ev-m'>${sevPill(e.severity)}${when}</span></button></li>`;
}

// ---------------------------------------------------------------- detail panel
function kv(pairs) {
  const rows = pairs.filter((p) => p[1] != null && p[1] !== '' && p[1] !== '—');
  return rows.length ? `<dl class='kv'>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>` : '';
}

export function detailHtml(e, { history = false, placeName = null } = {}) {
  const m = e.meta || {};
  const t = (ms) => (ms ? `${esc(fmtUTC(ms))}<br><span class='muted'>${esc(fmtLocal(ms))} your time · ${esc(rel(ms))}</span>` : null);
  const p = [];
  if (history) {
    p.push(['Magnitude / size', esc(magText(e)) || 'Not published by the source']);
    p.push(['Started', t(e.t0)]);
    if (e.t1 - e.t0 > 60e3) p.push(['Ended / last update', t(e.t1)]);
    p.push(['Location', esc(fmtCoord(e.lat, e.lon))]);
    p.push(['Source', esc(e.source_name)]);
    if (COVER[e.hazard]) p.push(['About this record set', esc(COVER[e.hazard])]);
  } else {
    p.push(['Magnitude / size', esc(magText(e))]);
    p.push([e.source === 'NWS' ? 'Alert issued' : e.source === 'NHC' ? 'Latest fix / advisory' : e.source === 'USGS' ? 'Origin time' : e.source === 'GVP' ? 'Weekly report published' : e.source === 'HANS' ? 'Notice sent' : 'Latest source timestamp', t(e.event_ts_ms)]);
    if (e.started_ts_ms && Math.abs(e.started_ts_ms - (e.event_ts_ms || 0)) > 60e3) p.push(['First reported', t(e.started_ts_ms)]);
    if (e.updated_ts_ms && e.updated_ts_ms !== e.event_ts_ms && e.source !== 'EONET') p.push(['Source updated', t(e.updated_ts_ms)]);
    if (e.expires_ts_ms) p.push(['Expires', t(e.expires_ts_ms)]);
    if (e.live_until_ms) p.push(['Shown as live until', `${esc(fmtUTC(e.live_until_ms))}<br><span class='muted'>Planet Pulse's per-hazard live window</span>`]);
    p.push(['Location', `${esc(fmtCoord(e.lat, e.lon))}<br><span class='muted'>${esc(coordBasis(e.coord_basis))}</span>`]);
    if (e.source === 'NWS') p.push(['Area', esc(trunc(e.area, 220))], ['Issued by', esc(m.issuer)], ['Urgency · certainty', esc([m.urgency, m.certainty].filter(Boolean).join(' · '))], ['Recommended response', esc(m.response)]);
    if (e.source === 'USGS') p.push(['Depth', m.depth_km != null ? `${fmtNum(m.depth_km, 1)} km` : null], ['USGS PAGER alert', m.pager_alert ? esc(m.pager_alert) : null], ['Felt reports', m.felt_reports != null ? fmtNum(m.felt_reports) : null], ['Tsunami flag', m.tsunami_flag ? 'Set by USGS — check tsunami.gov and local authorities' : null], ['Review status', esc(m.review_status)], ['Network', esc(m.network)]);
    if (e.source === 'NHC') p.push(['Classification', esc(m.classification)], ['Min. pressure', m.min_pressure_mb != null ? `${fmtNum(m.min_pressure_mb)} mb` : null], ['Movement', m.movement_speed_mph != null ? `${compass(m.movement_dir_deg)} at ${fmtNum(m.movement_speed_mph)} mph` : null], ['Advisory', esc(m.advisory_number)]);
    if (e.source === 'EONET') p.push(['Reported by', esc((m.origin_agencies || []).join('; '))], ['Position updates', m.geometry_updates > 1 ? fmtNum(m.geometry_updates) : null]);
    if (e.source === 'HANS') p.push(['Alert level', esc(m.alert_level)], ['Aviation colour code', esc(m.color_code)], ['Observatory', esc(m.observatory)]);
    if (e.source === 'GVP') p.push(['Report', esc(m.report_kind)], ['Report week', esc(m.report_week)], ['Country', esc(m.country)], ['Summary', esc(trunc(e.description, 420))]);
  }
  if (e._d != null && placeName) p.push(['Distance', `${fmtNum(e._d)} km from ${esc(placeName)}`]);

  const L = [];
  if (history) L.push(link(e.url, e.source === 'USGS' ? 'USGS event page — maps, DYFI, ShakeMap' : 'Originating source page', 'primary'));
  else if (e.source === 'USGS') L.push(link(e.source_url, 'USGS event page — maps, DYFI, ShakeMap', 'primary'));
  else if (e.source === 'NHC') { L.push(link(e.source_url, 'NHC public advisory (official)', 'primary')); L.push(link(e.secondary_url, 'NHC forecast cone & graphics')); L.push(link(m.discussion_url, 'NHC forecast discussion')); }
  else if (e.source === 'NWS') { L.push(link(m.office_url, 'Issuing NWS forecast office', 'primary')); L.push(link(e.secondary_url, 'NWS point forecast for this location')); L.push(link(e.source_url, 'Raw alert record (api.weather.gov, machine-readable)')); }
  else if (e.source === 'HANS') { L.push(link(e.source_url, 'USGS volcano alert notice (official)', 'primary')); L.push(link(e.secondary_url, 'Raw notice data (machine-readable)')); }
  else if (e.source === 'GVP') { L.push(link(e.source_url, 'Smithsonian volcano profile', 'primary')); L.push(link(e.secondary_url, 'Smithsonian / USGS weekly report page')); }
  else { const first = (m.origin_links || [])[0] || e.source_url; L.push(link(first, `Originating agency page${(m.origin_agencies || [])[0] ? ' — ' + (m.origin_agencies[0].split(' — ')[0]) : ''}`, 'primary')); (m.origin_links || []).slice(1, 3).forEach((u) => L.push(link(u, 'Additional source link'))); L.push(link(e.secondary_url, 'NASA EONET event record (JSON)')); }
  const links = L.filter(Boolean).map((x) => `<li>${x}</li>`).join('');

  let sevText;
  if (history) {
    if (e.hazard === 'cyclone' && e.magnitude_value == null) sevText = 'Wind speed is not published for this record, so it is shown as unrated.';
    else if (SEV_BASIS[e.hazard]) sevText = `${sevLabel(e.severity)} — ${SEV_BASIS[e.hazard]}. This is Planet Pulse's display scale, derived from the source's data; it is not an official rating.`;
    else sevText = 'The source publishes no rating for this hazard, so it is shown as unrated.';
  } else {
    sevText = `${e.severity_label} — ${(e.severity_basis || '').trim().replace(/[.]+$/, '')}. This is Planet Pulse's display scale, derived from the source's data; it is not an official rating.`;
  }
  const off = officialFor(e.hazard);
  const text = !history && e.source === 'NWS' && (m.instruction || m.details)
    ? `<details class='more-txt d-box'><summary>Alert text from NWS</summary>${m.details ? `<pre>${esc(m.details)}</pre>` : ''}${m.instruction ? `<h3 style='margin-top:8px'>Instructions</h3><pre>${esc(m.instruction)}</pre>` : ''}</details>` : '';
  return `<div class='detail' style='--c:${hz(e.hazard).color}'>
    <button type='button' class='link-btn back' data-act='back'>← All events</button>
    <div class='d-head'><span class='d-ico'>${shapeSvg(e.hazard)}</span><div>
      <h2 tabindex='-1' id='dtitle'>${esc(e.title)}</h2>
      <div class='d-tags'>${sevPill(e.severity)}<span class='tag'>${esc(hz(e.hazard).label)}</span><span class='tag'>${esc(e.source_name || e.source)}</span></div></div></div>
    ${!history && e.description && e.description !== e.title && e.source !== 'GVP' ? `<p class='d-desc'>${esc(trunc(e.description, 400))}</p>` : ''}
    <div class='d-box'><h3>Facts</h3>${kv(p)}</div>
    <div class='d-box'><h3>How severity is shown</h3><p class='note'>${esc(sevText)}</p></div>
    ${text}
    <div class='d-box'><h3>Authoritative sources</h3><ul class='links'>${links}</ul></div>
    <div class='d-box'><h3>Official guidance</h3><ul class='res'>${off.map((r) => `<li>${link(r.source_url, r.title)}<span>${esc(r.description)}</span></li>`).join('')}</ul></div>
  </div>`;
}

// ---------------------------------------------------------------- place search
export function placeSearch(host, { signal, onPick, onClear, onRadius }) {
  const RADII = [25, 50, 100, 250, 500, 1000], DEFAULT_KM = 100;
  host.innerHTML = `<div class='ps'>
    <div class='ps-find'>
      <div class='ps-box'><span class='ps-ico' aria-hidden='true'>⌕</span>
        <input type='search' role='combobox' aria-label='Search for a city' aria-expanded='false' aria-controls='ps-list' aria-autocomplete='list' placeholder='Loading places…' autocomplete='off' disabled>
        <button type='button' class='ps-x' hidden aria-label='Clear search text'>×</button></div>
      <ul class='ps-list' id='ps-list' role='listbox' aria-label='Matching cities' hidden></ul>
    </div>
    <div class='ps-chip' hidden><span class='ps-pin' aria-hidden='true'>◉</span><strong class='ps-name'></strong>
      <label class='ps-rad'>Radius <select aria-label='Radius around the place'>${RADII.map((r) => `<option value='${r}'${r === DEFAULT_KM ? ' selected' : ''}>${r} km</option>`).join('')}</select></label>
      <button type='button' class='btn ps-clear'>Clear place</button></div>
  </div>`;
  const $ = (s) => host.querySelector(s);
  const input = $('input'), list = $('.ps-list'), xbtn = $('.ps-x'), chip = $('.ps-chip'), nameEl = $('.ps-name'), sel = $('select');
  let places = null, hits = [], act = -1, timer = 0;
  const label = (p) => [p.name, p.admin1 && p.admin1 !== p.name ? p.admin1 : '', p.country].filter(Boolean).join(', ');
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal });
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); act = -1; };

  function search(text) {
    if (!places) return [];
    const parts = text.split(',').map((s) => norm(s).trim()).filter(Boolean);
    if (!parts.length) return [];
    const a = parts[0], rest = parts.slice(1).join(' '), r0 = [], r1 = [];
    for (const p of places) {
      let r;
      if (p._a.startsWith(a) || p._b.startsWith(a)) r = 0;
      else if (p._a.includes(' ' + a) || p._b.includes(' ' + a)) r = 1;
      else continue;
      if (rest && !p._c.includes(rest)) continue;
      (r === 0 ? r0 : r1).push(p);
      if (r0.length >= 8) break;
    }
    return r0.concat(r1).slice(0, 8);
  }
  function open(text) {
    if (!text.trim()) { hits = []; close(); return; }
    hits = search(text);
    if (!hits.length) list.innerHTML = `<li class='none' role='presentation'>No city matches “${esc(text.trim())}”. Only cities of 15,000 people or more can be searched.</li>`;
    else list.innerHTML = hits.map((p, i) => `<li role='presentation'><button type='button' role='option' id='ps-o${i}' data-i='${i}' aria-selected='false'><span>${esc(label(p))}</span><span class='m'>${p.pop >= 1e6 ? (p.pop / 1e6).toFixed(1) + ' M' : fmtNum(p.pop)}</span></button></li>`).join('');
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); act = -1;
  }
  function mark(i) {
    act = i;
    list.querySelectorAll('[role=option]').forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    const b = list.querySelector('#ps-o' + i);
    if (b) { input.setAttribute('aria-activedescendant', 'ps-o' + i); b.scrollIntoView({ block: 'nearest' }); }
  }
  function pick(i) {
    const p = hits[i]; if (!p) return;
    close(); input.value = ''; xbtn.hidden = true;
    api.setPlace(p, null);
    onPick(p, Number(sel.value));
  }
  on(input, 'input', () => { xbtn.hidden = !input.value; clearTimeout(timer); timer = setTimeout(() => open(input.value), 100); });
  on(input, 'keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (list.hidden) open(input.value);
      if (!hits.length) return;
      ev.preventDefault();
      mark(ev.key === 'ArrowDown' ? Math.min(hits.length - 1, act + 1) : Math.max(0, act - 1));
    } else if (ev.key === 'Enter') {
      ev.preventDefault(); clearTimeout(timer);
      if (act < 0) open(input.value);
      if (hits.length) pick(act < 0 ? 0 : act);
    } else if (ev.key === 'Escape') {
      if (!list.hidden) close(); else { input.value = ''; xbtn.hidden = true; }
    }
  });
  on(list, 'pointerdown', (ev) => ev.preventDefault());
  on(list, 'click', (ev) => { const b = ev.target.closest('[data-i]'); if (b) pick(Number(b.dataset.i)); });
  on(xbtn, 'click', () => { input.value = ''; xbtn.hidden = true; close(); input.focus(); });
  on($('.ps-clear'), 'click', () => { sel.value = String(DEFAULT_KM); api.setPlace(null); onClear(); input.focus(); });
  on(sel, 'change', () => onRadius(Number(sel.value)));
  document.addEventListener('pointerdown', (ev) => { if (!host.contains(ev.target)) close(); }, { signal });

  const api = {
    setPlaces(list2) { places = list2; input.disabled = false; input.placeholder = 'Search a city, e.g. Austin or Delhi'; },
    fail() { input.placeholder = 'Place search is unavailable right now'; },
    setPlace(p, km) {
      chip.hidden = !p;
      if (p) { nameEl.textContent = label(p); if (km) sel.value = String(km); }
    },
  };
  return api;
}
