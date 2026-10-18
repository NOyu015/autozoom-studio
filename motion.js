// Frame-difference activity detection + auto-zoom segment generation.
const AW = 192, AH = 108, TH = 24;

export class MotionAnalyzer {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = AW; this.c.height = AH;
    this.ctx = this.c.getContext('2d', { willReadFrequently: true });
    this.prev = null; this.samples = [];
  }
  /** Draw `source` (video/canvas) and append a sample for time t (seconds). */
  sample(source, t) {
    try { this.ctx.drawImage(source, 0, 0, AW, AH); } catch { return null; }
    const d = this.ctx.getImageData(0, 0, AW, AH).data;
    const g = new Uint8Array(AW * AH);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    let s = { t, e: 0, cx: .5, cy: .5, x0: 0, y0: 0, x1: 0, y1: 0 };
    if (this.prev) {
      let n = 0, sx = 0, sy = 0, x0 = AW, y0 = AH, x1 = -1, y1 = -1;
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const k = y * AW + x;
        if (Math.abs(g[k] - this.prev[k]) > TH) {
          n++; sx += x; sy += y;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (n > 0) s = { t, e: n / g.length, cx: sx / n / AW, cy: sy / n / AH, x0: x0 / AW, y0: y0 / AH, x1: (x1 + 1) / AW, y1: (y1 + 1) / AH };
    }
    this.prev = g; this.samples.push(s); return s;
  }
}

/** Analyze a video element by fast muted playback (for opened files). */
export function analyzeVideo(src, onProgress) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.src = src;
    const ma = new MotionAnalyzer(); let last = -1, raf;
    const tick = () => {
      if (v.currentTime - last >= 0.18) { last = v.currentTime; ma.sample(v, v.currentTime); onProgress?.(v.currentTime / (v.duration || 1)); }
      if (!v.ended) raf = requestAnimationFrame(tick);
    };
    v.onended = () => { cancelAnimationFrame(raf); ma.sample(v, v.currentTime); v.removeAttribute('src'); v.load(); resolve(ma.samples); };
    v.onerror = () => reject(new Error('video decode failed'));
    v.onloadedmetadata = () => { v.playbackRate = 4; v.play().then(tick, reject); };
  });
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let _id = 1; export const newId = () => 's' + (_id++);

/** Samples -> zoom segments (SPEC §4). */
export function autoZoom(samples, duration) {
  const act = samples.filter(s => s.e > 0.0006 && s.e < 0.25 && (s.x1 - s.x0) * (s.y1 - s.y0) < 0.4);
  const clusters = [];
  for (const s of act) {
    const c = clusters[clusters.length - 1];
    if (c && s.t - c.t1 <= 1.2 && Math.hypot(s.cx - c.cx, s.cy - c.cy) <= 0.3) {
      c.t1 = s.t; c.w += s.e; c.sx += s.cx * s.e; c.sy += s.cy * s.e;
      c.cx = c.sx / c.w; c.cy = c.sy / c.w;
      c.x0 = Math.min(c.x0, s.x0); c.y0 = Math.min(c.y0, s.y0); c.x1 = Math.max(c.x1, s.x1); c.y1 = Math.max(c.y1, s.y1);
    } else clusters.push({ t0: s.t, t1: s.t, w: s.e, sx: s.cx * s.e, sy: s.cy * s.e, cx: s.cx, cy: s.cy, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 });
  }
  let segs = clusters.map(c => {
    const start = Math.max(0, c.t0 - 0.4);
    let end = Math.min(duration, c.t1 + 1.2);
    if (end - start < 1.8) end = Math.min(duration, start + 1.8);
    const ext = Math.max(c.x1 - c.x0, c.y1 - c.y0);
    return { id: newId(), start, end, zoom: Math.round(clamp(1 / (ext + 0.2), 1.4, 2.4) * 10) / 10, x: c.cx, y: c.cy };
  }).filter(s => s.end - s.start > 0.5);
  const out = [];
  for (const s of segs) {
    const p = out[out.length - 1];
    if (p && s.start < p.end) {
      if (Math.hypot(s.x - p.x, s.y - p.y) <= 0.15) { p.end = Math.max(p.end, s.end); p.zoom = Math.max(p.zoom, s.zoom); continue; }
      p.end = s.start;
    }
    out.push(s);
  }
  return out.filter(s => s.end - s.start > 0.5);
}
