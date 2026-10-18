// Screen (+ optional mic) recording with live motion sampling.
import { MotionAnalyzer } from './motion.js';

function pickMime() {
  for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'])
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

export async function startRecording({ mic = false, systemAudio = true, onStop } = {}) {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('getDisplayMedia not supported in this browser');
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30, cursor: 'always' }, audio: systemAudio,
  });
  const streams = [display];
  let audioTracks = display.getAudioTracks(), actx = null;
  if (mic) {
    try {
      const m = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streams.push(m);
      if (audioTracks.length) { // mix system + mic into one track
        actx = new AudioContext(); const dest = actx.createMediaStreamDestination();
        actx.createMediaStreamSource(display).connect(dest); actx.createMediaStreamSource(m).connect(dest);
        audioTracks = dest.stream.getAudioTracks();
      } else audioTracks = m.getAudioTracks();
    } catch (e) { console.warn('mic unavailable', e); }
  }
  const out = new MediaStream([...display.getVideoTracks(), ...audioTracks]);
  const mime = pickMime();
  const rec = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined);
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);

  // live analysis on a hidden <video> fed by the stream
  const v = document.createElement('video'); v.muted = true; v.srcObject = display; v.play().catch(() => {});
  const ma = new MotionAnalyzer();
  const t0 = performance.now();
  const timer = setInterval(() => { if (v.readyState >= 2) ma.sample(v, (performance.now() - t0) / 1000); }, 200);

  let resolveStop; const stopped = new Promise(r => (resolveStop = r));
  rec.onstop = () => {
    clearInterval(timer);
    streams.forEach(s => s.getTracks().forEach(t => t.stop())); actx?.close();
    const duration = (performance.now() - t0) / 1000;
    const res = { blob: new Blob(chunks, { type: rec.mimeType || 'video/webm' }), duration, samples: ma.samples };
    resolveStop(res); onStop?.(res);
  };
  display.getVideoTracks()[0].addEventListener('ended', () => rec.state !== 'inactive' && rec.stop());
  rec.start(1000);
  return {
    stop() { if (rec.state !== 'inactive') rec.stop(); return stopped; },
    elapsed: () => (performance.now() - t0) / 1000,
    stopped,
  };
}
