// Timeline: ruler/seek, activity sparkline, draggable zoom segments.
import { newId } from './motion.js';

export class Timeline {
  constructor(root, { onSeek, onChange, onSelect }) {
    this.root = root; this.onSeek = onSeek; this.onChange = onChange; this.onSelect = onSelect;
    this.duration = 1; this.segments = []; this.samples = []; this.selected = null;
    root.innerHTML = `<div class="tl-ruler"></div><div class="tl-track"><canvas class="tl-spark"></canvas><div class="tl-segs"></div></div><div class="tl-head"></div>`;
    this.ruler = root.querySelector('.tl-ruler'); this.track = root.querySelector('.tl-track');
    this.segsEl = root.querySelector('.tl-segs'); this.head = root.querySelector('.tl-head');
    this.spark = root.querySelector('.tl-spark');
    this.#bindSeek(); this.#bindTrack();
    new ResizeObserver(() => this.render()).observe(root);
  }
  set({ duration, segments, samples }) {
    if (duration) this.duration = duration;
    if (segments) this.segments = segments;
    if (samples) this.samples = samples;
    this.render();
  }
  tAt(clientX) { const r = this.track.getBoundingClientRect(); return Math.max(0, Math.min(this.duration, (clientX - r.left) / r.width * this.duration)); }
  pct(t) { return (t / this.duration * 100) + '%'; }
  setTime(t) { this.head.style.left = this.pct(t); }
  select(id) { this.selected = id; this.render(); this.onSelect?.(this.segments.find(s => s.id === id) || null); }

  render() {
    // ruler ticks
    const step = [1, 2, 5, 10, 15, 30, 60, 120, 300].find(s => this.duration / s <= 12) || 600;
    let h = ''; for (let t = 0; t <= this.duration; t += step) h += `<span style="left:${this.pct(t)}">${fmt(t)}</span>`;
    this.ruler.innerHTML = h;
    // sparkline
    const c = this.spark, w = c.clientWidth, hh = c.clientHeight;
    if (w && hh) {
      c.width = w * devicePixelRatio; c.height = hh * devicePixelRatio;
      const x = c.getContext('2d'); x.scale(devicePixelRatio, devicePixelRatio);
      x.fillStyle = 'rgba(120,140,255,0.35)';
      for (const s of this.samples) { const v = Math.min(1, Math.sqrt(s.e) * 4); x.fillRect(s.t / this.duration * w, hh - v * hh, Math.max(1, w / this.duration * 0.2), v * hh); }
    }
    this.segsEl.innerHTML = '';
    for (const s of this.segments) {
      const el = document.createElement('div');
      el.className = 'tl-seg' + (s.id === this.selected ? ' sel' : ''); el.dataset.id = s.id;
      el.style.left = this.pct(s.start); el.style.width = this.pct(s.end - s.start);
      el.innerHTML = `<i class="h l"></i><b>${s.zoom.toFixed(1)}×</b><i class="h r"></i>`;
      this.segsEl.appendChild(el);
    }
  }
  #bindSeek() {
    const go = e => this.onSeek(this.tAt(e.clientX));
    this.ruler.addEventListener('pointerdown', e => {
      this.ruler.setPointerCapture(e.pointerId); go(e);
      const mv = ev => go(ev), up = () => { this.ruler.removeEventListener('pointermove', mv); this.ruler.removeEventListener('pointerup', up); };
      this.ruler.addEventListener('pointermove', mv); this.ruler.addEventListener('pointerup', up);
    });
  }
  #bindTrack() {
    this.track.addEventListener('dblclick', e => {
      if (e.target.closest('.tl-seg')) return;
      const t = this.tAt(e.clientX); this.add(t);
    });
    this.track.addEventListener('pointerdown', e => {
      const el = e.target.closest('.tl-seg');
      if (!el) { this.select(null); this.onSeek(this.tAt(e.clientX)); return; }
      const s = this.segments.find(x => x.id === el.dataset.id); if (!s) return;
      this.select(s.id);
      const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
      const t0 = this.tAt(e.clientX), o = { start: s.start, end: s.end };
      const others = this.segments.filter(x => x !== s);
      const mv = ev => {
        const d = this.tAt(ev.clientX) - t0, len = o.end - o.start;
        if (mode === 'm') { s.start = Math.max(0, Math.min(this.duration - len, o.start + d)); s.end = s.start + len; }
        if (mode === 'l') s.start = Math.max(0, Math.min(s.end - 0.3, o.start + d));
        if (mode === 'r') s.end = Math.min(this.duration, Math.max(s.start + 0.3, o.end + d));
        // don't overlap neighbours
        for (const x of others) {
          if (s.start < x.end && s.end > x.start) {
            if (mode === 'm') { if (o.start >= x.end - 1e-6) { s.start = x.end; s.end = s.start + len; } else { s.end = x.start; s.start = s.end - len; } }
            else if (mode === 'l') s.start = x.end; else s.end = x.start;
          }
        }
        this.render(); this.onChange(this.segments, false);
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); this.onChange(this.segments, true); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
  }
  add(t, x = .5, y = .5, zoom = 1.8) {
    let start = Math.max(0, t - 0.2), end = Math.min(this.duration, start + 2.5);
    for (const s of this.segments) { if (start >= s.start && start < s.end) return null; if (s.start > start && s.start < end) end = s.start; }
    if (end - start < 0.3) return null;
    const seg = { id: newId(), start, end, zoom, x, y };
    this.segments.push(seg); this.segments.sort((a, b) => a.start - b.start);
    this.onChange(this.segments, true); this.select(seg.id); return seg;
  }
  remove(id) {
    this.segments = this.segments.filter(s => s.id !== id);
    this.onChange(this.segments, true); this.select(null);
  }
}

export function fmt(t) { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }
