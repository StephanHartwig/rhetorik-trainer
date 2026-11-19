// Gerätefunktionen: Kamera, Ton (Signal, Pegel), Bildschirm an, Aufnahme
import { stueckSpeichern, pcmSpeichern } from './db.js?v=2204';

// ---------- Kamera und Mikrofon ----------
let stream;
// Liefert die Kamera noch Bild und Ton? Nach einem Wechsel in eine andere App oder einem Anruf beendet das iPhone die Spuren.
export function stromLebt(s) {
  if (!s || !s.active) return false;
  const spuren = s.getTracks();
  return spuren.some((t) => t.kind === 'video') && spuren.some((t) => t.kind === 'audio') && spuren.every((t) => t.readyState === 'live');
}
// Das iPhone schaltet das Kamerabild stumm, wenn die App im Hintergrund war: Dann käme nur Schwarz.
export const bildFehlt = (s) => !!s && s.getVideoTracks().some((t) => t.muted);
export async function kameraAn() {
  if (stromLebt(stream)) return stream;
  kameraAus();
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
export const wachOk = () => sperreOk() || !!(wachVideo && !wachVideo.paused);
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
    // Meldet sich die Aufnahme nach dem Stoppen nicht mehr (zum Beispiel weil die Kamera ausgefallen ist), geht es nach 15 Sekunden trotzdem weiter.
    stopp() {
      try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { fehler = fehler || e; }
      const ersatz = new Promise((res) => setTimeout(() => kette.then(() => res({ mime: rec.mimeType || mime, groesse, stuecke: n, fehler: fehler || new Error('Die Aufnahme wurde nicht sauber abgeschlossen') })), 15000));
      return Promise.race([fertig, ersatz]);
    },
    get fehler() { return fehler; },
  };
}

// ---------- Tonspur mitschneiden (für Messung und Transkript) ----------
let wlModul;
export function pcmVorbereiten() {
  if (!ctx || !ctx.audioWorklet) return Promise.reject(new Error('kein AudioWorklet'));
  return wlModul || (wlModul = ctx.audioWorklet.addModule('js/pcm-worklet.js?v=2204').catch((e) => { wlModul = null; throw e; }));
}
export async function pcmStarten(s, id) {
  await pcmVorbereiten();
  const quelle = ctx.createMediaStreamSource(s), knoten = new AudioWorkletNode(ctx, 'pcm16k'), stumm = ctx.createGain();
  stumm.gain.value = 0;
  quelle.connect(knoten); knoten.connect(stumm); stumm.connect(ctx.destination);
  const beginn = performance.now();
  let teile = [], n = 0, kette = Promise.resolve(), endeDa;
  const fertig = new Promise((r) => { endeDa = r; });
  const leeren = () => {
    if (!teile.length) return;
    const b = new Blob(teile); teile = []; const i = n++;
    kette = kette.then(() => pcmSpeichern(id, i, b)).catch(() => {});
  };
  knoten.port.onmessage = (ev) => {
    if (ev.data === 'ende') { endeDa(); return; }
    teile.push(ev.data); if (teile.length >= 10) leeren();
  };
  return {
    beginn,
    async stopp() {
      knoten.port.postMessage('stopp');
      await Promise.race([fertig, new Promise((r) => setTimeout(r, 500))]);
      try { quelle.disconnect(); knoten.disconnect(); stumm.disconnect(); } catch (e) {}
      leeren(); await kette;
    },
  };
}

// ---------- Handzeichen (nur Ganzkörper): beide Hände über dem Kopf ----------
// Erkennung (MediaPipe tasks-vision 0.10.32) und ihre Modelle liegen im eigenen Projekt, nichts kommt von fremden Servern.
const MP = new URL('../lib/mediapipe', import.meta.url).href;
const POSE = MP + '/pose_landmarker_lite.task';
let poseP, poseArt, gesichtP, gesichtArt;
async function baue(Klasse, optionen, cpu) {
  const m = await import(MP + '/vision_bundle.mjs');
  const fs = await m.FilesetResolver.forVisionTasks(MP + '/wasm');
  const mk = (delegate) => m[Klasse].createFromOptions(fs, { baseOptions: { modelAssetPath: optionen.modell, delegate }, runningMode: 'IMAGE', ...optionen.rest });
  if (cpu) return mk('CPU');
  try { return await mk('GPU'); } catch (e) { return await mk('CPU'); }
}
// cpu = true: sparsame Betriebsart ohne Grafikchip (langsamer, braucht weniger Speicher)
export function poseLaden(cpu = false) {
  if (poseP && poseArt !== cpu) poseSchliessen();
  poseArt = cpu;
  return poseP || (poseP = baue('PoseLandmarker', { modell: POSE, rest: { numPoses: 1 } }, cpu).catch((e) => { poseP = null; throw e; }));
}
const GESICHT = MP + '/face_landmarker.task';
export function gesichtLaden(cpu = false) {
  if (gesichtP && gesichtArt !== cpu) gesichtSchliessen();
  gesichtArt = cpu;
  return gesichtP || (gesichtP = baue('FaceLandmarker', { modell: GESICHT, rest: { numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true } }, cpu).catch((e) => { gesichtP = null; throw e; }));
}
function poseSchliessen() { const p = poseP; poseP = null; if (p) p.then((x) => x.close()).catch(() => {}); }
function gesichtSchliessen() { const p = gesichtP; gesichtP = null; if (p) p.then((x) => x.close()).catch(() => {}); }
// Gibt den Speicher der Erkennung wieder frei.
export function erkennungSchliessen() { poseSchliessen(); gesichtSchliessen(); }
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
