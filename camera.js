// Spring-smoothed camera track (SPEC §5), precomputed at 60 Hz.
const HZ = 60, LEAD = 0.25, W0 = 7;

export function buildCamera(segments, duration) {
  const n = Math.max(2, Math.ceil(duration * HZ) + 2);
  const tab = new Float32Array(n * 3);
  const segs = [...segments].sort((a, b) => a.start - b.start);
  let lz = 0, x = .5, y = .5, vlz = 0, vx = 0, vy = 0;
  const dt = 1 / HZ;
  for (let i = 0; i < n; i++) {
    const t = i * dt + LEAD;
    const s = segs.find(s => t >= s.start && t < s.end);
    const tz = s ? Math.log(s.zoom) : 0, tx = s ? s.x : .5, ty = s ? s.y : .5;
    // critically damped spring: a = w^2 (target - p) - 2w v
    for (let k = 0; k < 4; k++) { // substeps for stability
      const h = dt / 4;
      vlz += (W0 * W0 * (tz - lz) - 2 * W0 * vlz) * h; lz += vlz * h;
      vx += (W0 * W0 * (tx - x) - 2 * W0 * vx) * h; x += vx * h;
      vy += (W0 * W0 * (ty - y) - 2 * W0 * vy) * h; y += vy * h;
    }
    tab[i * 3] = Math.exp(lz); tab[i * 3 + 1] = x; tab[i * 3 + 2] = y;
  }
  return {
    at(t) {
      const f = Math.max(0, Math.min(n - 1.001, t * HZ)), i = f | 0, a = f - i;
      const g = k => tab[i * 3 + k] * (1 - a) + tab[(i + 1) * 3 + k] * a;
      return { zoom: Math.max(1, g(0)), x: g(1), y: g(2) };
    }
  };
}

/** Viewport in normalized source coords for a camera state. */
export function viewport(cam) {
  const w = 1 / cam.zoom, h = 1 / cam.zoom;
  const x = Math.max(0, Math.min(1 - w, cam.x - w / 2)), y = Math.max(0, Math.min(1 - h, cam.y - h / 2));
  return { x, y, w, h };
}
