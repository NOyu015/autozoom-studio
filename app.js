// Glue: UI state, preview loop, recording, editing, export.
import { CHECKOUT_URL, PRO_PRICE } from './config.js';
import { t, applyI18n, setLang, getLang } from './i18n.js';
import * as lic from './license.js';
import { startRecording } from './recorder.js';
import { analyzeVideo, autoZoom } from './motion.js';
import { buildCamera, viewport } from './camera.js';
import { compose, PRESETS, cssGradient } from './render.js';
import { Timeline, fmt } from './timeline.js';
import { exportVideo, canMp4 } from './exporter.js';

const $ = id => document.getElementById(id);
const S = {
  src: null, blob: null, duration: 0, samples: [], segments: [], selected: null,
  camera: buildCamera([], 1), rect: null, exporting: null, recording: null,
  settings: { bg: 'violet', solid: '#1e1e2e', customImg: null, padding: 0.07, radius: 16, shadow: 40 },
};
const video = document.createElement('video'); video.playsInline = true; video.preload = 'auto';
const canvas = $('preview'), ctx = canvas.getContext('2d');

// ---------- i18n / license / landing ----------
$('getProBtn').href = CHECKOUT_URL; $('proPrice').textContent = PRO_PRICE;
$('langBtn').onclick = () => { setLang(getLang() === 'en' ? 'zh' : 'en'); syncLangBtn(); refreshSeg(); };
const syncLangBtn = () => ($('langBtn').textContent = getLang() === 'en' ? '中文' : 'EN');
applyI18n(); syncLangBtn();

function syncPro() {
  const pro = lic.isPro();
  $('proBadge').hidden = !pro; $('licOut').hidden = !pro;
  if (!pro && +$('resSel').value > 720) $('resSel').value = '720';
  if (!pro && S.settings.bg === 'custom') { S.settings.bg = 'violet'; buildSwatches(); }
}
function openLicense(msg = '') { $('licMsg').textContent = msg; $('licIn').value = lic.getStored()?.key || ''; $('licDlg').showModal(); }
$('haveKeyBtn').onclick = () => openLicense();
$('proBadge').onclick = () => openLicense(t('lic_ok'));
$('licAct').onclick = async () => {
  const r = await lic.activate($('licIn').value);
  $('licMsg').textContent = r.valid ? t('lic_ok') : t('lic_bad'); syncPro();
};
$('licOut').onclick = () => { lic.deactivate(); $('licMsg').textContent = ''; syncPro(); };
lic.recheck().then(syncPro);

// ---------- styling controls ----------
function buildSwatches() {
  const box = $('swatches'); box.innerHTML = '';
  for (const id of Object.keys(PRESETS)) {
    const b = document.createElement('button'); b.style.background = cssGradient(id); b.title = id;
    b.className = S.settings.bg === id ? 'sel' : ''; b.onclick = () => { S.settings.bg = id; buildSwatches(); };
    box.appendChild(b);
  }
}
buildSwatches();
$('solidIn').oninput = e => { S.settings.solid = e.target.value; S.settings.bg = 'solid'; buildSwatches(); };
$('solidIn').onclick = () => { S.settings.bg = 'solid'; buildSwatches(); };
$('customLbl').addEventListener('click', e => { if (!lic.isPro()) { e.preventDefault(); openLicense(t('pro_only')); } });
$('customIn').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image(); img.src = URL.createObjectURL(f); await img.decode();
  S.settings.customImg = img; S.settings.bg = 'custom'; buildSwatches();
};
for (const [id, k] of [['padIn', 'padding'], ['radIn', 'radius'], ['shIn', 'shadow']]) {
  $(id).value = S.settings[k]; $(id).oninput = e => (S.settings[k] = +e.target.value);
}
$('resSel').onchange = e => { if (+e.target.value > 720 && !lic.isPro()) { e.target.value = '720'; openLicense(t('pro_only')); } };
if (!canMp4()) { $('fmtSel').value = 'webm'; $('fmtSel').querySelector('[value=mp4]').disabled = true; }

// ---------- timeline / segments ----------
const tl = new Timeline($('timeline'), {
  onSeek: time => { video.currentTime = time; tl.setTime(time); },
  onChange: (segs, done) => { S.segments = segs; rebuildCamera(); refreshSeg(); },
  onSelect: seg => { S.selected = seg?.id || null; refreshSeg(); },
});
function rebuildCamera() { S.camera = buildCamera(S.segments, S.duration || 1); }
const selSeg = () => S.segments.find(s => s.id === S.selected);
function refreshSeg() {
  const s = selSeg();
  $('segNone').hidden = !!s; $('segEdit').hidden = !s;
  if (s) { $('zoomIn').value = s.zoom; $('zoomOut').textContent = s.zoom.toFixed(1) + '×'; $('segTimes').textContent = `${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s`; }
}
$('zoomIn').oninput = e => { const s = selSeg(); if (!s) return; s.zoom = +e.target.value; rebuildCamera(); tl.render(); refreshSeg(); };
$('delBtn').onclick = () => S.selected && tl.remove(S.selected);
$('addBtn').onclick = () => tl.add(video.currentTime);
$('clearBtn').onclick = () => { S.segments = []; tl.set({ segments: S.segments }); tl.select(null); rebuildCamera(); };
$('autoBtn').onclick = async () => {
  if (!S.samples.length) {
    $('autoBtn').disabled = true; setStatus(t('analyzing'));
    try { S.samples = await analyzeVideo(S.src, f => setStatus(`${t('analyzing')} ${Math.round(f * 100)}%`)); }
    catch (e) { setStatus(e.message); }
    $('autoBtn').disabled = false;
  }
  S.segments = autoZoom(S.samples, S.duration);
  tl.set({ segments: S.segments, samples: S.samples }); tl.select(null); rebuildCamera();
  setStatus(`${S.segments.length} zoom${S.segments.length === 1 ? '' : 's'}`);
};
// click on preview: set focus of selected segment, or add one focused on the click
canvas.addEventListener('click', e => {
  if (!S.src || !S.rect) return;
  const b = canvas.getBoundingClientRect(), px = (e.clientX - b.left) / b.width * canvas.width, py = (e.clientY - b.top) / b.height * canvas.height;
  const r = S.rect, u = (px - r.x) / r.w, w = (py - r.y) / r.h;
  if (u < 0 || u > 1 || w < 0 || w > 1) return;
  const vp = viewport(S.camera.at(video.currentTime));
  const x = vp.x + u * vp.w, y = vp.y + w * vp.h;
  const s = selSeg();
  if (s) { s.x = x; s.y = y; rebuildCamera(); }
  else tl.add(video.currentTime, x, y);
});
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || !S.src) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { if (S.selected) { tl.remove(S.selected); e.preventDefault(); } }
  if (e.code === 'Space' && document.activeElement === document.body) { togglePlay(); e.preventDefault(); }
});

// ---------- loading media ----------
function setStatus(s) { $('status').textContent = s || ''; }
async function loadMedia(blob, { duration = 0, samples = [] } = {}) {
  if (S.src) URL.revokeObjectURL(S.src);
  S.blob = blob; S.src = URL.createObjectURL(blob); S.samples = samples; S.segments = []; S.selected = null;
  video.src = S.src;
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('Cannot decode this video')); });
  if (!isFinite(video.duration)) {
    video.currentTime = 1e9; await new Promise(r => (video.ondurationchange = r));
    video.currentTime = 0; await new Promise(r => (video.onseeked = r));
  }
  S.duration = isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
  $('empty').hidden = true;
  for (const id of ['autoBtn', 'addBtn', 'clearBtn', 'playBtn', 'exportBtn']) $(id).disabled = false;
  tl.set({ duration: S.duration, segments: S.segments, samples: S.samples }); tl.select(null);
  rebuildCamera();
  if (samples.length) $('autoBtn').click(); // recording: zooms ready immediately
  $('app').scrollIntoView({ behavior: 'smooth' });
}
$('fileIn').onchange = e => { const f = e.target.files[0]; if (f) loadMedia(f).catch(err => setStatus(err.message)); e.target.value = ''; };
window.__az = { loadMedia, S, tl }; // for automated tests / debugging

// ---------- recording ----------
$('recBtn').onclick = async () => {
  if (S.recording) { S.recording.stop(); return; }
  try {
    S.recording = await startRecording({ mic: $('micChk').checked, systemAudio: $('sysChk').checked });
  } catch (e) { setStatus(e.message); S.recording = null; return; }
  $('recBtn').classList.add('on'); $('recBtn').querySelector('[data-i18n]').dataset.i18n = 'stop'; applyI18n();
  $('recTime').hidden = false;
  const iv = setInterval(() => ($('recTime').textContent = fmt(S.recording?.elapsed() || 0)), 250);
  const res = await S.recording.stopped;
  clearInterval(iv); S.recording = null;
  $('recBtn').classList.remove('on'); $('recBtn').querySelector('[data-i18n]').dataset.i18n = 'rec'; applyI18n();
  $('recTime').hidden = true;
  await loadMedia(res.blob, res).catch(err => setStatus(err.message));
};

// ---------- playback / preview loop ----------
function togglePlay() { if (!S.src) return; video.paused ? video.play() : video.pause(); }
$('playBtn').onclick = togglePlay;
video.onplay = () => ($('playBtn').textContent = '❚❚'); video.onpause = () => ($('playBtn').textContent = '▶');
function loop() {
  if (S.src && !S.exporting) {
    S.rect = compose(ctx, canvas.width, canvas.height, video, S.camera.at(video.currentTime), S.settings, !lic.isPro());
    tl.setTime(video.currentTime);
    $('timeLbl').textContent = `${fmt(video.currentTime)} / ${fmt(S.duration)}`;
    const s = selSeg();
    if (s && S.rect) { // focus marker for selected segment (preview only)
      const vp = viewport(S.camera.at(video.currentTime)), r = S.rect;
      const mx = r.x + (s.x - vp.x) / vp.w * r.w, my = r.y + (s.y - vp.y) / vp.h * r.h;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(109,93,252,.9)'; ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- export ----------
$('exportBtn').onclick = async () => {
  const pro = lic.isPro(), height = +$('resSel').value, format = $('fmtSel').value;
  if (height > 720 && !pro) return openLicense(t('pro_only'));
  video.pause();
  const signal = { aborted: false }; S.exporting = signal;
  $('exportBtn').disabled = true; $('exportProg').hidden = false; $('dlLink').hidden = true; $('prog').value = 0;
  try {
    const blob = await exportVideo({
      src: S.src, blob: S.blob, camera: S.camera, settings: { ...S.settings }, height, format,
      watermark: !pro, signal, onProgress: f => ($('prog').value = f),
    });
    const a = $('dlLink'); if (a.href) URL.revokeObjectURL(a.href);
    a.href = URL.createObjectURL(blob); a.download = `autozoom-${Date.now()}.${format}`;
    a.textContent = `⬇ Download ${format.toUpperCase()} (${(blob.size / 1e6).toFixed(1)} MB)`; a.hidden = false; a.click();
    setStatus('');
  } catch (e) { if (e.message !== 'aborted') setStatus('Export failed: ' + e.message); console.error(e); }
  S.exporting = null; $('exportBtn').disabled = false; $('exportProg').hidden = true;
};
$('cancelBtn').onclick = () => S.exporting && (S.exporting.aborted = true);
