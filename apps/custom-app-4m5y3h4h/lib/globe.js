import { LAND } from "./land.js";
import { HAZARDS, SEVS, esc } from "./model.js";

// One glyph per hazard on a 24x24 grid: shape as well as colour tells hazards apart.
export const SHAPE_D = {
  wildfire: "M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 1 2 2 3 1-2 1-5 1-8z",
  earthquake: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  cyclone: "M12 1.5l10.5 10.5-10.5 10.5L1.5 12z",
  flood: "M12 2c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12z",
  weather: "M13.5 1.5L4 14h6l-1.2 8.5L19 9.5h-6.2z",
  volcano: "M12 3l10 18H2z",
  drought: "M12 1.5l3 7 7.5 1-5.6 5 1.7 7.5L12 18.2 5.4 22l1.7-7.5-5.6-5 7.5-1z",
  ice: "M9.5 2h5v7.5H22v5h-7.5V22h-5v-7.5H2v-5h7.5z",
  landslide: "M2 20L9 6l4 7 3-4 6 11z",
  other: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-18z",
};
export const shapeSvg = (hz) => `<svg class="shape" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="${SHAPE_D[hz] || SHAPE_D.other}"/></svg>`;

const PATHS = {};
const pathFor = (hz) => PATHS[hz] || (PATHS[hz] = new Path2D(SHAPE_D[hz] || SHAPE_D.other));
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const SEV_R = [5, 5.5, 7.5, 9.5, 12];

function stars(n) {
  let s = 12345; const out = [];
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) % 4294967296; const x = s / 4294967296; s = (s * 1664525 + 1013904223) % 4294967296; const y = s / 4294967296; s = (s * 1664525 + 1013904223) % 4294967296; out.push([x, y, 0.4 + (s / 4294967296) * 1.1, 0.25 + (s % 7) / 12]); }
  return out;
}
const STARS = stars(110);

// Orient every land ring counter-clockwise (interior on the left) once, so horizon clipping can close shapes the right way round.
const LANDG = LAND.map((ring) => {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
  const r = a < 0 ? ring.slice().reverse() : ring.slice();
  const f = r[0], l = r[r.length - 1];
  if (r.length > 1 && f[0] === l[0] && f[1] === l[1]) r.pop();
  return r;
});

/**
 * A dependency-free canvas globe / flat map.
 * opts: { onSelect(id), tipHtml(event) }
 */
export function createGlobe(host, opts = {}) {
  const canvas = document.createElement("canvas");
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-roledescription", "interactive map");
  host.append(canvas);
  const tip = document.createElement("div");
  tip.className = "tip"; tip.hidden = true; tip.setAttribute("aria-hidden", "true");
  host.append(tip);
  const c = canvas.getContext("2d");
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, dpr = 1, R = 100, K = 1, cx = 0, cy = 0;
  const v = { lon: -30, lat: 18, zoom: 1 };
  let mode = "globe", events = [], selectedId = null, hoverId = null, drawn = [], place = null;
  let dirty = true, raf = 0, auto = false, anim = null, lastDraw = 0, lastT = 0, hasPulse = false, dead = false;

  const zoomRange = () => (mode === "globe" ? [0.8, 400] : [1, 400]);
  const clampView = () => {
    const [lo, hi] = zoomRange();
    v.zoom = Math.min(hi, Math.max(lo, v.zoom));
    v.lon = ((v.lon + 540) % 360) - 180;
    if (mode === "globe") v.lat = Math.max(-85, Math.min(85, v.lat));
    else {
      const k = (W / 360) * v.zoom, half = H / (2 * k);
      v.lat = half >= 90 ? 0 : Math.max(-(90 - half), Math.min(90 - half, v.lat));
    }
  };
  const layout = () => {
    cx = W / 2; cy = H / 2;
    R = (Math.min(W, H) / 2) * 0.86 * v.zoom;
    K = (W / 360) * v.zoom;
  };
  const proj = (lon, lat) => {
    if (mode === "globe") {
      const l = (lon - v.lon) * RAD, p = lat * RAD, p0 = v.lat * RAD;
      const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
      return [cx + R * Math.cos(p) * Math.sin(l), cy - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), cosc];
    }
    const dl = ((lon - v.lon + 540) % 360) - 180;
    return [cx + dl * K, cy - (lat - v.lat) * K, 1];
  };

  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(50, Math.round(r.width)); H = Math.max(50, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    clampView(); dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ---------------------------------------------------------- drawing
  function drawGraticule() {
    c.strokeStyle = "rgba(140,190,255,.13)"; c.lineWidth = 1;
    if (mode === "globe") {
      c.beginPath();
      for (let lon = -180; lon < 180; lon += 30) {
        let pen = false;
        for (let lat = -90; lat <= 90; lat += 6) {
          const [x, y, cc] = proj(lon, lat);
          if (cc > 0) { pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; } else pen = false;
        }
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        let pen = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const [x, y, cc] = proj(lon, lat);
          if (cc > 0) { pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; } else pen = false;
        }
      }
      c.stroke();
    } else {
      c.beginPath();
      for (let lon = -540; lon <= 540; lon += 30) { const x = cx + (lon - v.lon) * K; if (x >= -2 && x <= W + 2) { c.moveTo(x, 0); c.lineTo(x, H); } }
      for (let lat = -60; lat <= 60; lat += 30) { const y = cy - (lat - v.lat) * K; if (y >= 0 && y <= H) { c.moveTo(0, y); c.lineTo(W, y); } }
      c.stroke();
    }
  }

  // Flat map: plain polygon fill (no horizon to clip).
  function landPath() {
    c.beginPath();
    for (const off of [-360, 0, 360]) {
      const x0 = cx + (off - 180 - v.lon) * K, x1 = cx + (off + 180 - v.lon) * K;
      if (x1 < 0 || x0 > W) continue;
      for (const ring of LAND) {
        c.moveTo(cx + (ring[0][0] + off - v.lon) * K, cy - (ring[0][1] - v.lat) * K);
        for (let i = 1; i < ring.length; i++) c.lineTo(cx + (ring[i][0] + off - v.lon) * K, cy - (ring[i][1] - v.lat) * K);
        c.closePath();
      }
    }
    c.fillStyle = "#2c67ad"; c.fill();
    c.strokeStyle = "rgba(170,220,255,.65)"; c.lineWidth = 1; c.stroke();
  }

  // Globe: land is sampled per pixel from an equirectangular raster mask through the inverse
  // orthographic projection. No polygon clipping at the horizon, so nothing can flip or invert while rotating.
  const MW = 2048, MH = 1024;
  let MASK = null, lc = null, lctx = null, limg = null;
  function buildMask() {
    const oc = document.createElement("canvas"); oc.width = MW; oc.height = MH;
    const o = oc.getContext("2d", { willReadFrequently: true });
    o.fillStyle = "#000"; o.fillRect(0, 0, MW, MH);
    o.fillStyle = "#fff"; o.beginPath();
    for (const ring of LAND) {
      ring.forEach(([lon, lat], i) => { const x = ((lon + 180) / 360) * MW, y = ((90 - lat) / 180) * MH; i ? o.lineTo(x, y) : o.moveTo(x, y); });
      o.closePath();
    }
    o.fill();
    const d = o.getImageData(0, 0, MW, MH).data;
    MASK = new Uint8Array(MW * MH);
    for (let i = 0; i < MW * MH; i++) MASK[i] = d[i * 4];
  }
  function sampleMask(lon, lat) {
    const fx = ((lon + 180) / 360) * MW - 0.5, fy = ((90 - lat) / 180) * MH - 0.5;
    let xa = Math.floor(fx); const tx = fx - xa, ty = fy - Math.floor(fy), y0 = Math.floor(fy);
    xa = ((xa % MW) + MW) % MW; const xb = (xa + 1) % MW;
    const ya = Math.min(MH - 1, Math.max(0, y0)), yb = Math.min(MH - 1, Math.max(0, y0 + 1));
    const m00 = MASK[ya * MW + xa], m10 = MASK[ya * MW + xb], m01 = MASK[yb * MW + xa], m11 = MASK[yb * MW + xb];
    return (m00 * (1 - tx) + m10 * tx) * (1 - ty) + (m01 * (1 - tx) + m11 * tx) * ty;
  }
  function drawLandGlobe() {
    if (!MASK) buildMask();
    const S = 2;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H, Math.ceil(cy + R));
    const w = Math.ceil((x1 - x0) / S), h = Math.ceil((y1 - y0) / S);
    if (w <= 0 || h <= 0) return;
    if (!lc) { lc = document.createElement("canvas"); lctx = lc.getContext("2d"); }
    if (lc.width !== w || lc.height !== h) { lc.width = w; lc.height = h; limg = lctx.createImageData(w, h); }
    const px = limg.data; px.fill(0);
    const p0 = v.lat * RAD, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
    for (let j = 0; j < h; j++) {
      const y = (cy - (y0 + (j + 0.5) * S)) / R;
      for (let i = 0; i < w; i++) {
        const x = (x0 + (i + 0.5) * S - cx) / R, r2 = x * x + y * y;
        if (r2 >= 1) continue;
        const z = Math.sqrt(1 - r2);
        const lat = Math.asin(Math.max(-1, Math.min(1, z * sp0 + y * cp0))) / RAD;
        const lon = v.lon + Math.atan2(x, z * cp0 - y * sp0) / RAD;
        let cov = (sampleMask(lon, lat) - 96) / 64;
        if (cov <= 0.02) continue;
        if (cov > 1) cov = 1;
        const edge = 4 * cov * (1 - cov), shade = 0.55 + 0.45 * z, k = (j * w + i) * 4;
        px[k] = (62 * (1 - edge) + 170 * edge) * shade;
        px[k + 1] = (130 * (1 - edge) + 220 * edge) * shade;
        px[k + 2] = (214 * (1 - edge) + 255 * edge) * shade;
        px[k + 3] = cov * 238;
      }
    }
    lctx.putImageData(limg, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(lc, x0, y0, w * S, h * S);
  }


  function drawGlobe() {
    for (const [sx, sy, sr, sa] of STARS) { c.fillStyle = `rgba(200,225,255,${sa})`; c.beginPath(); c.arc(sx * W, sy * H, sr, 0, TAU); c.fill(); }
    let g = c.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.2);
    g.addColorStop(0, "rgba(61,220,255,.38)"); g.addColorStop(1, "rgba(61,220,255,0)");
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.2, 0, TAU); c.fill();
    g = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.08, cx, cy, R);
    g.addColorStop(0, "#1e6aa8"); g.addColorStop(0.55, "#0d2f5a"); g.addColorStop(1, "#050f22");
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
    drawLandGlobe(); drawGraticule();
    const sh = c.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.5, cx, cy, R * 1.02);
    sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(2,8,20,.4)");
    c.fillStyle = sh; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    c.restore();
    c.strokeStyle = "rgba(140,225,255,.55)"; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
  }

  function drawFlat() {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0f3a68"); g.addColorStop(1, "#071a35");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    drawGraticule(); landPath();
  }

  function drawTrack(e) {
    if (!e.track || e.track.length < 2) return;
    c.save(); c.setLineDash([5, 5]); c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.75)"; c.beginPath();
    let pen = false, prevX = 0;
    for (const [lon, lat] of e.track) {
      const [x, y, cc] = proj(lon, lat);
      if (cc <= 0 || (mode === "flat" && pen && Math.abs(x - prevX) > W / 2)) { pen = false; continue; }
      pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; prevX = x;
    }
    c.stroke(); c.restore();
  }

  function drawMarkers(t) {
    drawn = [];
    const zs = Math.min(1.5, 0.85 + 0.12 * v.zoom);
    for (const e of events) {
      const [x, y, cc] = proj(e.lon, e.lat);
      if (cc <= 0.03 || x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
      const r = (SEV_R[e.severity] || 5) * zs;
      drawn.push({ e, x, y, r });
    }
    const sel = drawn.find((d) => d.e.event_id === selectedId);
    if (sel) drawTrack(sel.e);
    for (const d of drawn) {
      const { e, x, y, r } = d, col = (HAZARDS[e.hazard] || HAZARDS.other).color, sv = SEVS[e.severity] || SEVS[0];
      const al = e._a == null ? 1 : e._a; c.globalAlpha = al;
      if (e.severity >= 2) { c.strokeStyle = sv.color; c.lineWidth = e.severity >= 3 ? 2.5 : 1.6; c.beginPath(); c.arc(x, y, r + 2.2, 0, TAU); c.stroke(); }
      c.save(); c.translate(x, y); const s = (r * 2) / 24; c.scale(s, s); c.translate(-12, -12);
      c.fillStyle = col; c.globalAlpha = 0.95 * al; c.fill(pathFor(e.hazard), "evenodd");
      c.lineWidth = 1.4 / s; c.strokeStyle = "rgba(3,10,22,.9)"; c.stroke(pathFor(e.hazard));
      c.restore(); c.globalAlpha = 1;
    }
    const mark = (id, w, alpha) => {
      const d = drawn.find((k) => k.e.event_id === id); if (!d) return null;
      c.strokeStyle = `rgba(255,255,255,${alpha})`; c.lineWidth = w; c.beginPath(); c.arc(d.x, d.y, d.r + 6, 0, TAU); c.stroke(); return d;
    };
    if (hoverId && hoverId !== selectedId) mark(hoverId, 1.5, 0.85);
    const sd = mark(selectedId, 2.5, 1);
    if (sd) {
      c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 1.5; c.beginPath(); c.arc(sd.x, sd.y, sd.r + 10, 0, TAU); c.stroke();
      const label = String(sd.e.title || "").slice(0, 44);
      c.font = "600 13px Inter, system-ui, sans-serif";
      const tw = c.measureText(label).width + 16, lx = Math.min(W - tw - 8, Math.max(8, sd.x - tw / 2)), ly = sd.y - sd.r - 38 < 46 ? sd.y + sd.r + 16 : sd.y - sd.r - 38;
      c.fillStyle = "rgba(4,12,26,.9)"; c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1;
      c.beginPath(); c.roundRect(lx, ly, tw, 24, 8); c.fill(); c.stroke();
      c.fillStyle = "#fff"; c.textBaseline = "middle"; c.fillText(label, lx + 8, ly + 12.5);
    }
  }

  // A chosen place: pin plus a geodesic circle of the chosen radius.
  function drawPlace() {
    if (!place) return;
    const { lat, lon, km } = place, th = km / 6371, p1 = lat * RAD, l1 = lon * RAD;
    c.save(); c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.9)"; c.setLineDash([7, 5]); c.beginPath();
    let pen = false, px = 0;
    for (let b = 0; b <= 360; b += 4) {
      const br = b * RAD;
      const p2 = Math.asin(Math.sin(p1) * Math.cos(th) + Math.cos(p1) * Math.sin(th) * Math.cos(br));
      const l2 = l1 + Math.atan2(Math.sin(br) * Math.sin(th) * Math.cos(p1), Math.cos(th) - Math.sin(p1) * Math.sin(p2));
      const [x, y, cc] = proj(l2 / RAD, p2 / RAD);
      if (cc <= 0 || (mode === "flat" && pen && Math.abs(x - px) > W / 2)) { pen = false; continue; }
      pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; px = x;
    }
    c.stroke(); c.setLineDash([]);
    const [x, y, cc] = proj(lon, lat);
    if (cc > 0) {
      c.fillStyle = "#fff"; c.strokeStyle = "rgba(3,10,22,.95)"; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); c.stroke();
      c.font = "650 13px Inter, system-ui, sans-serif"; c.textBaseline = "middle";
      const label = String(place.name || "").slice(0, 40), tw = c.measureText(label).width + 14;
      const lx = Math.min(W - tw - 6, Math.max(6, x + 12)), ly = Math.min(H - 30, Math.max(6, y - 28));
      c.fillStyle = "rgba(4,12,26,.88)"; c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1;
      c.beginPath(); c.roundRect(lx, ly, tw, 22, 8); c.fill(); c.stroke();
      c.fillStyle = "#fff"; c.fillText(label, lx + 7, ly + 11.5);
    }
    c.restore();
  }

  function draw(t) {
    layout();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (mode === "globe") drawGlobe(); else drawFlat();
    drawPlace();
    drawMarkers(t);
  }

  function frame(t) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = lastT ? Math.min(64, t - lastT) : 16; lastT = t;
    if (anim) {
      const p = Math.min(1, (t - anim.t0) / anim.dur), k = 1 - Math.pow(1 - p, 3);
      v.lon = anim.from.lon + anim.dlon * k; v.lat = anim.from.lat + (anim.to.lat - anim.from.lat) * k; v.zoom = anim.from.zoom + (anim.to.zoom - anim.from.zoom) * k;
      clampView(); dirty = true; if (p >= 1) anim = null;
    }
    if (auto && !reduced && !anim && !drag) { v.lon += dt * 0.008; clampView(); dirty = true; }
    if (dirty) { draw(t); dirty = false; lastDraw = t; }
  }
  raf = requestAnimationFrame(frame);

  // ---------------------------------------------------------- interaction
  const hit = (x, y) => {
    for (let i = drawn.length - 1; i >= 0; i--) { const d = drawn[i]; if ((d.x - x) ** 2 + (d.y - y) ** 2 <= (d.r + 5) ** 2) return d; }
    return null;
  };
  const ptrs = new Map(); let drag = null, pinch = null;
  const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const showTip = (d) => {
    if (!d || !opts.tipHtml) { tip.hidden = true; return; }
    tip.innerHTML = opts.tipHtml(d.e); tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(6, Math.min(W - tw - 6, d.x + 14)) + "px";
    tip.style.top = Math.max(6, Math.min(H - th - 6, d.y - th - 10 < 6 ? d.y + 16 : d.y - th - 10)) + "px";
  };
  const setHover = (id) => { if (hoverId !== id) { hoverId = id; dirty = true; } };

  canvas.addEventListener("pointerdown", (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    ptrs.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
    anim = null; tip.hidden = true;
    if (ptrs.size === 1) drag = { x: ev.offsetX, y: ev.offsetY, sx: ev.offsetX, sy: ev.offsetY, moved: false };
    else if (ptrs.size === 2) { pinch = { d: dist(), z: v.zoom }; drag = null; }
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
    if (pinch && ptrs.size >= 2) { v.zoom = pinch.z * (dist() / pinch.d); clampView(); dirty = true; return; }
    if (drag) {
      const dx = ev.offsetX - drag.x, dy = ev.offsetY - drag.y;
      if (!drag.moved && Math.hypot(ev.offsetX - drag.sx, ev.offsetY - drag.sy) < 5) return;
      drag.moved = true; drag.x = ev.offsetX; drag.y = ev.offsetY;
      if (mode === "globe") { v.lon -= dx / R / RAD; v.lat += dy / R / RAD; } else { v.lon -= dx / K; v.lat += dy / K; }
      clampView(); dirty = true; return;
    }
    const d = hit(ev.offsetX, ev.offsetY);
    canvas.classList.toggle("hovering", !!d);
    setHover(d ? d.e.event_id : null); showTip(d);
  });
  const up = (ev, cancelled) => {
    const wasDrag = drag; ptrs.delete(ev.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (wasDrag && !wasDrag.moved && !cancelled) { const d = hit(ev.offsetX, ev.offsetY); if (d && opts.onSelect) opts.onSelect(d.e.event_id); }
    if (ptrs.size === 0) drag = null;
  };
  canvas.addEventListener("pointerup", (ev) => up(ev, false));
  canvas.addEventListener("pointercancel", (ev) => up(ev, true));
  canvas.addEventListener("pointerleave", () => { if (!drag) { setHover(null); tip.hidden = true; canvas.classList.remove("hovering"); } });
  canvas.addEventListener("wheel", (ev) => { ev.preventDefault(); anim = null; v.zoom *= Math.exp(-ev.deltaY * 0.0014); clampView(); dirty = true; }, { passive: false });
  canvas.addEventListener("keydown", (ev) => {
    const step = 12 / v.zoom; let used = true;
    if (ev.key === "ArrowLeft") v.lon -= step; else if (ev.key === "ArrowRight") v.lon += step;
    else if (ev.key === "ArrowUp") v.lat += step; else if (ev.key === "ArrowDown") v.lat -= step;
    else if (ev.key === "+" || ev.key === "=") v.zoom *= 1.3; else if (ev.key === "-" || ev.key === "_") v.zoom /= 1.3;
    else if (ev.key === "0") { v.lon = -30; v.lat = 18; v.zoom = 1; } else used = false;
    if (used) { ev.preventDefault(); anim = null; clampView(); dirty = true; }
  });

  function flyTo(lat, lon, zoom, dur = 800) {
    const to = { lat, lon, zoom: zoom ?? v.zoom };
    if (reduced) { Object.assign(v, to); clampView(); dirty = true; return; }
    const from = { ...v }; const dlon = ((lon - from.lon + 540) % 360) - 180;
    anim = { t0: performance.now(), dur, from, to, dlon };
  }

  const label = () => canvas.setAttribute("aria-label", `Interactive ${mode === "globe" ? "globe" : "map"} showing ${events.length} hazard events. Drag to ${mode === "globe" ? "rotate" : "pan"}, scroll or use plus and minus to zoom, arrow keys to move. Use the event list to browse events with a keyboard.`);
  const api = {
    setEvents(list) {
      events = [...list].sort((a, b) => a.severity - b.severity);
      if (selectedId && !events.some((e) => e.event_id === selectedId)) selectedId = null;
      label();
      dirty = true;
    },
    setSelected(id, o = {}) {
      selectedId = id; dirty = true;
      const e = id && events.find((k) => k.event_id === id);
      if (e && o.fly) flyTo(e.lat, e.lon, mode === "globe" ? Math.max(v.zoom, 2.4) : Math.max(v.zoom, 4));
    },
    setHover(id) { setHover(id); },
    setPlace(p) { place = p; dirty = true; },
    flyTo(lat, lon, z) { flyTo(lat, lon, z); },
    fitRadius(lat, lon, km) {
      const th = Math.min(1.5, Math.max(km / 6371, 1e-5));
      const z = mode === "globe" ? 0.7 / Math.sin(th) : (0.3 * H) / ((W / 360) * (km / 111));
      const [lo, hi] = zoomRange();
      flyTo(lat, lon, Math.min(hi, Math.max(lo, z)));
    },
    setMode(m) { mode = m; anim = null; v.zoom = 1; if (m === "flat") v.lat = 0; clampView(); label(); dirty = true; },
    getMode: () => mode,
    zoomBy(f) { anim = null; v.zoom *= f; clampView(); dirty = true; },
    reset() { flyTo(mode === "globe" ? 18 : 0, -30, 1); },
    setAuto(b) { auto = !!b; },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); canvas.remove(); tip.remove(); },
  };
  resize();
  return api;
}
