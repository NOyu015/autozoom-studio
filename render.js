// Compositor shared by preview and export (SPEC §6).
import { viewport } from './camera.js';
import { WATERMARK_TEXT } from './config.js';

export const PRESETS = {
  dusk:   [135, ['#ff7e5f', '#feb47b']],
  ocean:  [135, ['#2193b0', '#6dd5ed']],
  violet: [135, ['#654ea3', '#eaafc8']],
  mint:   [135, ['#11998e', '#38ef7d']],
  night:  [135, ['#0f2027', '#203a43', '#2c5364']],
  candy:  [120, ['#f857a6', '#ff5858']],
  slate:  [160, ['#232526', '#414345']],
  sky:    [180, ['#e0eafc', '#cfdef3']],
};

export function cssGradient(id) {
  const [a, stops] = PRESETS[id]; return `linear-gradient(${a}deg, ${stops.join(', ')})`;
}

function drawBg(ctx, W, H, st) {
  if (st.bg === 'solid') { ctx.fillStyle = st.solid; ctx.fillRect(0, 0, W, H); return; }
  if (st.bg === 'custom' && st.customImg) {
    const im = st.customImg, s = Math.max(W / im.width, H / im.height);
    ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s); return;
  }
  const [ang, stops] = PRESETS[st.bg] || PRESETS.dusk;
  const r = (ang - 90) * Math.PI / 180, cx = W / 2, cy = H / 2;
  const L = Math.abs(W * Math.cos(r)) / 2 + Math.abs(H * Math.sin(r)) / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(r) * L, cy - Math.sin(r) * L, cx + Math.cos(r) * L, cy + Math.sin(r) * L);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/** Content rect (where the video sits) for output size W×H. */
export function contentRect(W, H, vw, vh, st) {
  const p = st.padding * W, aw = W - 2 * p, ah = H - 2 * p;
  const s = Math.min(aw / vw, ah / vh), w = vw * s, h = vh * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

export function compose(ctx, W, H, video, cam, st, watermark) {
  const k = W / 1280;
  drawBg(ctx, W, H, st);
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  const r = contentRect(W, H, vw, vh, st), rad = Math.min(st.radius * k, r.h / 2);
  if (st.shadow > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = st.shadow * k; ctx.shadowOffsetY = st.shadow * k * 0.35;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.restore();
  }
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.clip();
  ctx.fillStyle = '#111'; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (video.readyState >= 2) {
    const v = viewport(cam);
    ctx.drawImage(video, v.x * vw, v.y * vh, v.w * vw, v.h * vh, r.x, r.y, r.w, r.h);
  }
  ctx.restore();
  if (watermark) {
    const fs = Math.round(14 * k);
    ctx.font = `600 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(WATERMARK_TEXT, W - 12 * k + 1, H - 10 * k + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(WATERMARK_TEXT, W - 12 * k, H - 10 * k);
  }
  return r;
}
