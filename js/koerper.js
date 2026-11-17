// Körpermessung am gespeicherten Video: Bild für Bild Körper und Gesicht erkennen, auswerten, Einzelbilder ablegen.
import { poseLaden, gesichtLaden } from './geraet.js?v=2104';
import { aufnahmeDatei, uebungSpeichern, bildSpeichern, bilderLoeschen } from './db.js?v=2104';
import { koerperAuswerten, bildZeiten } from './koerper-rechnen.js?v=2104';

const pause = () => new Promise((r) => setTimeout(r, 0));

function springe(v, t) {
  return new Promise((res) => {
    let fertig = false;
    const ende = (ok) => { if (fertig) return; fertig = true; v.removeEventListener('seeked', bei); res(ok); };
    const bei = () => ende(true);
    v.addEventListener('seeked', bei);
    setTimeout(() => ende(false), 4000);
    try { v.currentTime = t; } catch (e) { ende(false); }
  });
}

// Liest aus dem Ergebnis der Gesichtserkennung Kopfhaltung und die wichtigsten Gesichtsbewegungen.
function gesichtWerte(f) {
  if (!f.faceLandmarks || !f.faceLandmarks.length) return null;
  const bs = {};
  if (f.faceBlendshapes && f.faceBlendshapes[0]) for (const c of f.faceBlendshapes[0].categories) bs[c.categoryName] = c.score;
  const b = (n) => bs[n] || 0, m2 = (a, c) => (b(a) + b(c)) / 2;
  let yaw = 0, pitch = 0;
  const m = f.facialTransformationMatrixes && f.facialTransformationMatrixes[0] && f.facialTransformationMatrixes[0].data;
  if (m) { yaw = Math.atan2(m[8], m[10]) * 180 / Math.PI; pitch = Math.atan2(m[9], m[10]) * 180 / Math.PI; }
  return {
    yaw, pitch,
    blinzeln: m2('eyeBlinkLeft', 'eyeBlinkRight'),
    hor: Math.max(m2('eyeLookOutLeft', 'eyeLookInRight'), m2('eyeLookInLeft', 'eyeLookOutRight')),
    hoch: m2('eyeLookUpLeft', 'eyeLookUpRight'), runter: m2('eyeLookDownLeft', 'eyeLookDownRight'),
    laecheln: m2('mouthSmileLeft', 'mouthSmileRight'),
    brauenHoch: (b('browInnerUp') + m2('browOuterUpLeft', 'browOuterUpRight')) / 2,
    brauenRunter: m2('browDownLeft', 'browDownRight'),
    wange: m2('cheekSquintLeft', 'cheekSquintRight'), augeWeit: m2('eyeWideLeft', 'eyeWideRight'),
  };
}

// opt.cpu: sparsame Betriebsart (kleinere Bilder, weniger Proben, ohne Grafikchip). opt.beiBild(i, n): Fortschritt.
export async function koerperMessen(u, melde, opt = {}) {
  const MAX_PROBEN = opt.cpu ? 240 : 600;
  if (u.typ !== 'video') return u;
  melde('Körper: lade das Video …');
  const datei = await aufnahmeDatei(u);
  if (!datei) throw new Error('Zu dieser Übung ist kein Video gespeichert.');
  const ganz = u.ausschnitt === 'ganz';
  const url = URL.createObjectURL(datei);
  const v = document.createElement('video');
  v.muted = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
  v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none';
  document.body.appendChild(v);
  try {
    v.src = url;
    await new Promise((r) => { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 8000); v.load(); });
    try { await v.play(); v.pause(); } catch (e) {}
    if (!v.videoWidth) throw new Error('Das Video lässt sich nicht öffnen.');
    melde('Körper: lade die Erkennung …');
    const gesicht = await gesichtLaden(!!opt.cpu);
    const pose = ganz ? await poseLaden(!!opt.cpu) : null;

    const dauer = Math.max(1, Math.min(isFinite(v.duration) && v.duration > 0 ? v.duration : (u.dauerAufnahme || u.ist), u.ist || 1e9));
    const schritt = Math.max(0.5, dauer / MAX_PROBEN), anzahl = Math.max(2, Math.floor(dauer / schritt));
    const w = opt.cpu ? 320 : 480, hh = Math.round(w * v.videoHeight / v.videoWidth);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
    const ctx = cv.getContext('2d', { willReadFrequently: false });
    const kopf = document.createElement('canvas'); kopf.width = 256; kopf.height = 256;
    const kctx = kopf.getContext('2d');
    const fx = v.videoWidth / w;                      // Umrechnung Leinwand → Videobild

    const proben = [];
    let fehlSpruenge = 0, poseNah = null, poseFehlt = false, ausschnitte = 0;
    // Zeichnet den Bereich um den Kopf vergrößert in die kleine Leinwand (sw = Schulterbreite in Leinwand-Punkten)
    const kopfBild = (L, sw) => {
      const seite = Math.max(1.3 * sw, 48) * fx, cx = L[0].x * v.videoWidth, cy = L[0].y * v.videoHeight;
      kctx.clearRect(0, 0, 256, 256);
      kctx.drawImage(v, cx - seite / 2, cy - seite / 2, seite, seite, 0, 0, 256, 256);
    };
    for (let i = 0; i < anzahl; i++) {
      const t = (i + 0.5) * schritt;
      if (!(await springe(v, t))) {
        if (++fehlSpruenge >= 5 && proben.length === 0) throw new Error('Das Video lässt sich nicht Bild für Bild auslesen.');
        continue;
      }
      ctx.drawImage(v, 0, 0, w, hh);
      const probe = { t: Math.round(t * 100) / 100, pose: null, gesicht: null };
      if (ganz) {
        const L = pose.detect(cv).landmarks[0];
        const da = (k) => L[k].visibility === undefined || L[k].visibility > 0.5;
        if (L && da(11) && da(12) && da(23) && da(24)) {
          const X = (k) => L[k].x * w, Y = (k) => L[k].y * hh;
          const sw = Math.hypot(X(11) - X(12), Y(11) - Y(12));
          probe.pose = {
            sx: (X(11) + X(12)) / 2, hx: (X(23) + X(24)) / 2, sw,
            fuss: da(27) && da(28) && L[27].y < 1 && L[28].y < 1,
            haende: [15, 16].map((k) => ({ x: X(k), y: Y(k), v: L[k].visibility === undefined ? 1 : (L[k].x < 0 || L[k].x > 1 || L[k].y < 0 || L[k].y > 1 ? 0 : L[k].visibility) })),
          };
          // Das Gesicht ist aus der Entfernung klein: Ausschnitt um den Kopf vergrößert prüfen
          kopfBild(L, sw);
          probe.gesicht = gesichtWerte(gesicht.detect(kopf));
        }
      } else {
        probe.gesicht = gesichtWerte(gesicht.detect(cv));
        if (!probe.gesicht && !poseFehlt) {
          // Gesicht klein, dunkel oder angeschnitten: den Kopf über die Körpererkennung suchen und vergrößert prüfen
          if (!poseNah) { try { poseNah = await poseLaden(!!opt.cpu); } catch (e) { poseFehlt = true; } }
          const L = poseNah ? poseNah.detect(cv).landmarks[0] : null;
          if (L) {
            const breit = Math.hypot((L[11].x - L[12].x) * w, (L[11].y - L[12].y) * hh), ohren = Math.hypot((L[7].x - L[8].x) * w, (L[7].y - L[8].y) * hh);
            kopfBild(L, Math.max(breit, ohren * 2.2));
            probe.gesicht = gesichtWerte(gesicht.detect(kopf));
            if (probe.gesicht) ausschnitte++;
          }
        }
      }
      proben.push(probe);
      if (i % 5 === 0) { melde('Körper: Bild ' + (i + 1) + ' von ' + anzahl); if (opt.beiBild) opt.beiBild(i + 1, anzahl); await pause(); }
    }
    if (proben.length < 2) throw new Error('Aus dem Video ließen sich keine Bilder lesen.');

    const { werte, hinweise, bewegung } = koerperAuswerten(proben, ganz ? 'ganz' : 'nah', dauer);
    // Einzelbilder ablegen
    melde('Körper: sichere Einzelbilder …');
    await bilderLoeschen(u.id);
    const zeiten = bildZeiten(proben, bewegung, dauer, ganz ? 'ganz' : 'nah');
    const bw = 480, bh = Math.round(480 * v.videoHeight / v.videoWidth);
    const bc = document.createElement('canvas'); bc.width = bw; bc.height = bh;
    const bilder = [];
    for (const z of zeiten) {
      if (!(await springe(v, z.t))) continue;
      bc.getContext('2d').drawImage(v, 0, 0, bw, bh);
      const blob = await new Promise((r) => bc.toBlob(r, 'image/jpeg', 0.6));
      if (!blob) continue;
      await bildSpeichern(u.id, bilder.length, blob);
      bilder.push({ t: z.t, grund: z.grund });
    }
    u.koerper = { ...werte, hinweise, fehlSpruenge, ausschnitte, sparsam: !!opt.cpu, schritt: Math.round(schritt * 100) / 100, datum: new Date().toISOString() };
    u.bilder = bilder;
    await uebungSpeichern(u);
    return u;
  } finally {
    v.removeAttribute('src'); try { v.load(); } catch (e) {}
    v.remove(); URL.revokeObjectURL(url);
  }
}
