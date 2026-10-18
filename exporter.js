// Real-time export to WebM (MediaRecorder) or MP4 (WebCodecs + mp4-muxer). SPEC §8.
import { compose } from './render.js';
import { MP4_MUXER_URLS } from './config.js';

async function loadMuxer() {
  for (const u of MP4_MUXER_URLS) { try { return await import(u); } catch (e) { console.warn('mp4-muxer load failed', u, e); } }
  throw new Error('Could not load mp4-muxer');
}

const even = n => Math.round(n / 2) * 2;

async function loadVideo(src) {
  const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('load failed')); });
  if (!isFinite(v.duration)) { // MediaRecorder WebM has no duration until we seek to the end
    v.currentTime = 1e9; await new Promise(r => (v.ondurationchange = r)); v.currentTime = 0;
    await new Promise(r => (v.onseeked = r));
  }
  return v;
}

async function pickAvc(width, height, fps) {
  for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0033', 'avc1.42e033', 'avc1.42001f']) {
    const cfg = { codec, width, height, bitrate: width * height * fps * 0.12, framerate: fps, avc: { format: 'avc' } };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch {}
  }
  return null;
}

export function canMp4() { return typeof VideoEncoder !== 'undefined'; }

/**
 * @param {{src:string, blob:Blob, camera, settings, height:number, format:'webm'|'mp4', watermark:boolean,
 *          onProgress?:(f:number)=>void, signal?:{aborted:boolean}}} o
 * @returns {Promise<Blob>}
 */
export async function exportVideo(o) {
  const H = even(o.height), W = even(H * 16 / 9), FPS = 30;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const v = await loadVideo(o.src);
  const dur = v.duration;
  const draw = () => compose(ctx, W, H, v, o.camera.at(v.currentTime), o.settings, o.watermark);
  draw();

  let finish;
  if (o.format === 'mp4') finish = await setupMp4(o, v, canvas, W, H, FPS);
  else finish = setupWebm(v, canvas, FPS);

  await v.play();
  await new Promise((resolve, reject) => {
    let last = -1;
    const step = () => {
      if (o.signal?.aborted) { v.pause(); return reject(new Error('aborted')); }
      if (v.currentTime !== last) { last = v.currentTime; draw(); finish.frame?.(v.currentTime); o.onProgress?.(v.currentTime / dur); }
      if (v.ended) return resolve();
      requestAnimationFrame(step);
    };
    v.onended = () => setTimeout(resolve, 50);
    requestAnimationFrame(step);
  });
  draw(); finish.frame?.(dur);
  const blob = await finish.end();
  v.removeAttribute('src'); v.load();
  return blob;
}

function setupWebm(v, canvas, FPS) {
  const stream = canvas.captureStream(FPS);
  try { // route source audio into the export (and not to speakers)
    const ac = new AudioContext(), src = ac.createMediaElementSource(v), dest = ac.createMediaStreamDestination();
    src.connect(dest); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  } catch (e) { console.warn('no audio in export', e); }
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: canvas.width * canvas.height * 6 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start(500);
  return {
    end: () => new Promise(r => { rec.onstop = () => r(new Blob(chunks, { type: 'video/webm' })); rec.stop(); }),
  };
}

async function setupMp4(o, v, canvas, W, H, FPS) {
  const cfg = await pickAvc(W, H, FPS);
  if (!cfg) throw new Error(`H.264 encoding at ${W}×${H} is not supported by this browser — try WebM`);
  const { Muxer, ArrayBufferTarget } = await loadMuxer();
  v.muted = true; // audio is encoded separately below

  // Audio: decode whole track, encode as Opus (best effort).
  let audioBuf = null;
  if (typeof AudioEncoder !== 'undefined') {
    try {
      const ac = new OfflineAudioContext(2, 48000, 48000);
      audioBuf = await ac.decodeAudioData(await o.blob.arrayBuffer());
      const ok = await AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: audioBuf.numberOfChannels, bitrate: 128000 });
      if (!ok.supported) audioBuf = null;
    } catch { audioBuf = null; }
  }
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: 'avc', width: W, height: H },
    ...(audioBuf ? { audio: { codec: 'opus', numberOfChannels: audioBuf.numberOfChannels, sampleRate: 48000 } } : {}),
  });
  let err = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => (err = e) });
  venc.configure(cfg);

  if (audioBuf) {
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => console.warn(e) });
    const ch = audioBuf.numberOfChannels;
    aenc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: ch, bitrate: 128000 });
    const N = 4800;
    for (let off = 0; off < audioBuf.length; off += N) {
      const len = Math.min(N, audioBuf.length - off), data = new Float32Array(len * ch);
      for (let c = 0; c < ch; c++) data.set(audioBuf.getChannelData(c).subarray(off, off + len), c * len);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: len, numberOfChannels: ch, timestamp: Math.round(off / 48000 * 1e6), data });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush(); aenc.close();
  }

  let lastTs = -1, lastEmit = -1, n = 0;
  return {
    frame(t) {
      if (err) throw err;
      if (t - lastEmit < 1 / FPS - 1e-3 && t < v.duration) return; // cap to FPS
      const ts = Math.round(t * 1e6); if (ts <= lastTs) return;
      lastTs = ts; lastEmit = t;
      const f = new VideoFrame(canvas, { timestamp: ts });
      venc.encode(f, { keyFrame: n++ % (FPS * 2) === 0 }); f.close();
    },
    async end() {
      await venc.flush(); venc.close(); if (err) throw err;
      muxer.finalize();
      return new Blob([target.buffer], { type: 'video/mp4' });
    },
  };
}
