// Gerätefunktionen: Kamera, Ton (Signal, Pegel), Bildschirm an, Aufnahme
import { stueckSpeichern } from './db.js?v=6';

// ---------- Kamera und Mikrofon ----------
let stream;
export async function kameraAn() {
  if (stream && stream.active) return stream;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  });
  return stream;
}
export function kameraAus() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}
export function kameraFehlerText(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError') return 'Kamera oder Mikrofon sind nicht erlaubt. Öffne am iPhone Einstellungen, dann Apps, dann Safari, und erlaube dort Kamera und Mikrofon. Danach die App neu öffnen.';
  if (n === 'NotFoundError') return 'Keine Kamera oder kein Mikrofon gefunden.';
  if (n === 'NotReadableError') return 'Kamera oder Mikrofon werden gerade von einer anderen App benutzt.';
  return 'Kamera und Mikrofon lassen sich nicht starten (' + (n || 'Fehler') + ').';
}

// ---------- Ton ----------
let ctx;
export function tonAn() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state !== 'running') ctx.resume();
  return ctx;
}
let stummBis = 0;                       // so lange zählt der Pegel nicht (eigener Signalton)
export function signal(anzahl = 2, hoehe = 880) {
  if (!ctx) return;
  try {
    for (let i = 0; i < anzahl; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = hoehe; g.gain.value = 0.6;
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.35); o.stop(ctx.currentTime + i * 0.35 + 0.25);
    }
    stummBis = performance.now() + anzahl * 350 + 400;
  } catch (e) {}
}
// Lautstärke des Mikrofons (0 bis etwa 0,3). Liefert null, solange der eigene Signalton läuft.
export function pegelMesser(s) {
  const quelle = ctx.createMediaStreamSource(s), an = ctx.createAnalyser(), stumm = ctx.createGain();
  an.fftSize = 1024; stumm.gain.value = 0;
  quelle.connect(an); an.connect(stumm); stumm.connect(ctx.destination);
  const puffer = new Float32Array(an.fftSize);
  return {
    lies() {
      if (performance.now() < stummBis) return null;
      an.getFloatTimeDomainData(puffer);
      let sum = 0; for (let i = 0; i < puffer.length; i++) sum += puffer[i] * puffer[i];
      return Math.sqrt(sum / puffer.length);
    },
    stopp() { try { quelle.disconnect(); an.disconnect(); stumm.disconnect(); } catch (e) {} },
  };
}

// ---------- Bildschirm an ----------
// Zwei Wege: die Bildschirmsperre des Browsers und als Ersatz ein stummes Video in Dauerschleife.
// Im Stromsparmodus des iPhones hilft beides nicht.
let sperre, wachVideo, wachSoll = false;
const sperreOk = () => !!(sperre && !sperre.released);
async function sperreHolen() {
  if (!('wakeLock' in navigator) || sperreOk()) return;
  try { sperre = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function videoStarten() {
  if (!wachVideo) {
    wachVideo = document.createElement('video');
    wachVideo.setAttribute('playsinline', ''); wachVideo.setAttribute('title', 'Bildschirm an');
    wachVideo.preload = 'auto'; wachVideo.src = 'wach.mp4';
    wachVideo.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none';
    wachVideo.addEventListener('loadedmetadata', () => {
      if (wachVideo.duration <= 1) wachVideo.loop = true;
      else wachVideo.addEventListener('timeupdate', () => { if (wachVideo.currentTime > 0.5) wachVideo.currentTime = Math.random(); });
    });
    document.body.appendChild(wachVideo);
  }
  if (wachVideo.paused) { const p = wachVideo.play(); if (p) p.catch(() => {}); }
}
// Muss direkt in einem Antippen aufgerufen werden (wegen des Ersatz-Videos).
export function wachAn() {
  wachSoll = true;
  if (!sperreOk()) videoStarten();
  sperreHolen().then(() => { if (sperreOk() && wachVideo && !wachVideo.paused) wachVideo.pause(); });
}
export function wachAus() {
  wachSoll = false;
  try { if (sperre) sperre.release(); } catch (e) {}
  sperre = null;
  if (wachVideo && !wachVideo.paused) wachVideo.pause();
}
document.addEventListener('visibilitychange', () => {
  if (wachSoll && document.visibilityState === 'visible') { sperreHolen(); if (!sperreOk() && wachVideo) videoStarten(); }
});
setInterval(() => { if (wachSoll && document.visibilityState === 'visible' && !sperreOk()) { sperreHolen(); if (wachVideo) videoStarten(); } }, 15000);

// ---------- Aufnahme ----------
const waehle = (liste) => liste.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
export function aufnahmeStarten(s, id, nurTon) {
  const quelle = nurTon ? new MediaStream(s.getAudioTracks()) : s;
  const mime = nurTon ? waehle(['audio/mp4', 'audio/webm']) : waehle(['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']);
  const opt = { audioBitsPerSecond: 96000 };
  if (mime) opt.mimeType = mime;
  if (!nurTon) opt.videoBitsPerSecond = 1500000;
  const rec = new MediaRecorder(quelle, opt);
  let n = 0, groesse = 0, fehler = null, kette = Promise.resolve();
  rec.ondataavailable = (ev) => {
    if (!ev.data || !ev.data.size) return;
    const i = n++; groesse += ev.data.size;
    kette = kette.then(() => stueckSpeichern(id, i, ev.data)).catch((e) => { fehler = fehler || e; });
  };
  rec.onerror = (ev) => { fehler = fehler || ev.error || new Error('Aufnahmefehler'); };
  const fertig = new Promise((res) => { rec.onstop = () => kette.then(() => res({ mime: rec.mimeType || mime, groesse, stuecke: n, fehler })); });
  rec.start(5000);
  return {
    stopp() { if (rec.state !== 'inactive') rec.stop(); return fertig; },
    get fehler() { return fehler; },
  };
}

// ---------- Handzeichen (nur Ganzkörper): beide Hände über dem Kopf ----------
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32';
const POSE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
let poseP;
export function poseLaden() {
  return poseP || (poseP = (async () => {
    const m = await import(MP + '/vision_bundle.mjs');
    const fs = await m.FilesetResolver.forVisionTasks(MP + '/wasm');
    const mk = (delegate) => m.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: POSE, delegate }, runningMode: 'IMAGE', numPoses: 1 });
    try { return await mk('GPU'); } catch (e) { return await mk('CPU'); }
  })().catch((e) => { poseP = null; throw e; }));
}
// Prüft ein Kamerabild. Ergebnis: true = beide Hände über dem Kopf, false = nicht, null = niemand erkannt.
export function haendeOben(pose, video, leinwand) {
  if (!video.videoWidth) return null;
  const w = 256, hh = Math.round(256 * video.videoHeight / video.videoWidth);
  if (leinwand.width !== w) { leinwand.width = w; leinwand.height = hh; }
  leinwand.getContext('2d').drawImage(video, 0, 0, w, hh);
  const L = pose.detect(leinwand).landmarks[0];
  if (!L) return null;
  const sichtbar = (i) => L[i].visibility === undefined || L[i].visibility > 0.5;
  return sichtbar(15) && sichtbar(16) && L[15].y < L[0].y - 0.05 && L[16].y < L[0].y - 0.05;
}
