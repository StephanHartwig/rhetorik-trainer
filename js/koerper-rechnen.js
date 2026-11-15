// Körpermessung: reine Rechenfunktionen aus den erkannten Punkten. Alle Ergebnisse sind Schätzungen.
// Eine Probe: { t, pose: { sx, hx, sw, fuss, haende: [{x,y,v},{x,y,v}] } | null,
//               gesicht: { yaw, pitch, blinzeln, hor, hoch, runter, laecheln, brauenHoch, brauenRunter, wange, augeWeit } | null }
// Längen der Pose sind Bildpunkte; sw = Schulterbreite.

const BLICK_GRAD = 20;          // so weit darf der Kopf von der Kamera weggedreht sein
const runde = (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n;
const median = (w) => { const s = [...w].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function streuung(w) {
  if (w.length < 2) return 0;
  const m = w.reduce((a, b) => a + b, 0) / w.length;
  return Math.sqrt(w.reduce((a, b) => a + (b - m) * (b - m), 0) / (w.length - 1));
}
const anteil = (teil, ganz) => (ganz ? Math.round(100 * teil / ganz) : 0);

function blickGanz(g) { return Math.abs(g.yaw) <= BLICK_GRAD && Math.abs(g.pitch) <= BLICK_GRAD; }
function blickNah(g) { return blickGanz(g) && g.hor <= 0.45 && g.hoch <= 0.35 && g.runter <= 0.55; }

export function koerperAuswerten(proben, modus, dauer) {
  const hinweise = [], werte = { modus, bilder: proben.length };
  const bewegung = new Array(proben.length).fill(0);
  const gesichter = proben.filter((p) => p.gesicht && p.gesicht.blinzeln < 0.6);

  if (modus === 'ganz') {
    const mit = proben.filter((p) => p.pose);
    werte.erkannt = anteil(mit.length, proben.length);
    if (mit.length < 10 || werte.erkannt < 60) {
      hinweise.push('Die Person war nur in ' + werte.erkannt + ' % der Bilder zu erkennen. Stand und Hände lassen sich deshalb nicht verlässlich messen.');
      werte.standUnsicher = true;
    } else {
      const sw = median(mit.map((p) => p.pose.sw)) || 1;
      const entzerrt = (schluessel) => mit.map((p, i) => {
        const nah = mit.filter((q) => Math.abs(q.t - p.t) <= 2.5).map((q) => q.pose[schluessel] / sw);
        return p.pose[schluessel] / sw - median(nah);
      });
      werte.schwankenSchulter = runde(100 * streuung(entzerrt('sx')));
      werte.schwankenHuefte = runde(100 * streuung(entzerrt('hx')));
      // Standortwechsel: Hüfte verschiebt sich binnen 2 Sekunden deutlich, oder die Person kommt näher / geht zurück
      let wechsel = 0, letzter = -9;
      for (let i = 0; i < mit.length; i++) {
        const p = mit[i]; let j = i;
        while (j > 0 && p.t - mit[j].t < 2) j--;
        if (j === i || p.t - mit[j].t > 4) continue;
        const q = mit[j], seit = Math.abs(p.pose.hx - q.pose.hx) / sw, zoom = p.pose.sw / q.pose.sw;
        if ((seit > 0.6 || zoom > 1.2 || zoom < 0.83) && p.t - letzter >= 2) { wechsel++; letzter = p.t; }
      }
      werte.standortwechsel = wechsel;
      werte.fuesseSichtbar = anteil(mit.filter((p) => p.pose.fuss).length, mit.length);
      if (werte.fuesseSichtbar < 50) hinweise.push('Die Füße waren meist nicht im Bild. Schritte lassen sich deshalb nur am Oberkörper schätzen.');
      const beide = mit.filter((p) => p.pose.haende[0].v > 0.5 && p.pose.haende[1].v > 0.5).length;
      werte.haendeSichtbar = anteil(beide, mit.length);
      const tempo = [];
      for (let i = 1; i < mit.length; i++) {
        const a = mit[i - 1], b = mit[i], dt = b.t - a.t;
        if (dt <= 0 || dt > 2) continue;
        let s = 0, c = 0;
        for (let k = 0; k < 2; k++) {
          const x = a.pose.haende[k], y = b.pose.haende[k];
          if (x.v > 0.5 && y.v > 0.5) { s += Math.hypot(y.x - x.x, y.y - x.y) / sw / dt; c++; }
        }
        if (c) { tempo.push(s / c); bewegung[proben.indexOf(b)] = s / c; }
      }
      werte.handBewegung = tempo.length >= 5 ? runde(100 * tempo.reduce((a, b) => a + b, 0) / tempo.length) : null;
    }
    if (gesichter.length < Math.max(5, proben.length * 0.3)) { werte.blick = null; hinweise.push('Das Gesicht war zu selten zu erkennen. Der Blick zur Kamera ist deshalb nicht messbar.'); }
    else werte.blick = anteil(gesichter.filter((p) => blickGanz(p.gesicht)).length, gesichter.length);
    werte.blickAusKopfhaltung = true;
  } else {
    werte.erkannt = anteil(proben.filter((p) => p.gesicht).length, proben.length);
    if (gesichter.length < Math.max(5, proben.length * 0.5)) {
      hinweise.push('Das Gesicht war nur in ' + werte.erkannt + ' % der Bilder zu erkennen. Blick und Mimik sind deshalb nicht messbar.');
      werte.blick = null; werte.mimikUnsicher = true;
    } else {
      werte.blick = anteil(gesichter.filter((p) => blickNah(p.gesicht)).length, gesichter.length);
      // Mimik: Zustand je Bild, Wechsel zählen (ein Zustand muss zwei Bilder lang halten)
      const zustand = (g) => (g.laecheln > 0.35 ? 'L' : g.brauenHoch > 0.4 ? 'H' : g.brauenRunter > 0.4 ? 'R' : 'N');
      const mit = proben.filter((p) => p.gesicht);
      let aktuell = null, kandidat = null, wechsel = 0;
      const delta = [];
      for (let i = 0; i < mit.length; i++) {
        const g = mit[i].gesicht, z = zustand(g);
        if (aktuell === null) aktuell = z;
        else if (z !== aktuell) { if (kandidat === z) { aktuell = z; wechsel++; kandidat = null; } else kandidat = z; }
        else kandidat = null;
        if (i > 0) {
          const v = mit[i - 1].gesicht, dt = mit[i].t - mit[i - 1].t;
          if (dt > 0 && dt <= 2) {
            const d = (Math.abs(g.laecheln - v.laecheln) + Math.abs(g.brauenHoch - v.brauenHoch) + Math.abs(g.brauenRunter - v.brauenRunter) + Math.abs(g.wange - v.wange) + Math.abs(g.augeWeit - v.augeWeit)) / dt;
            delta.push(d); bewegung[proben.indexOf(mit[i])] = d;
          }
        }
      }
      werte.mimikWechsel = wechsel;
      werte.mimikWechselJeMinute = runde(wechsel / Math.max(dauer, 1) * 60, 1);
      werte.laecheln = anteil(mit.filter((p) => p.gesicht.laecheln > 0.35).length, mit.length);
      werte.mimikBewegung = delta.length >= 5 ? runde(100 * delta.reduce((a, b) => a + b, 0) / delta.length) : null;
    }
  }
  // Kopfhaltung in der Mitte, zum Nachjustieren der Schwellen
  if (gesichter.length) werte.diag = { yaw: runde(median(gesichter.map((p) => p.gesicht.yaw))), pitch: runde(median(gesichter.map((p) => p.gesicht.pitch))), gesichter: gesichter.length };
  return { werte, hinweise, bewegung };
}

// Bis zu acht Zeitpunkte für Einzelbilder: Beginn, Schluss, Stellen mit viel und mit kaum Bewegung.
export function bildZeiten(proben, bewegung, dauer, modus) {
  const gut = (p) => (modus === 'ganz' ? !!p.pose : !!p.gesicht);
  const idx = proben.map((p, i) => i).filter((i) => gut(proben[i]));
  if (!idx.length) return proben.length ? [{ t: proben[0].t, grund: 'Beginn' }, { t: proben[proben.length - 1].t, grund: 'Schluss' }].slice(0, proben.length > 1 ? 2 : 1) : [];
  const abstand = Math.max(4, dauer * 0.08);
  const wahl = [{ t: proben[idx[0]].t, grund: 'Beginn' }];
  if (idx.length > 1) wahl.push({ t: proben[idx[idx.length - 1]].t, grund: 'Schluss' });
  const frei = (t) => wahl.every((w) => Math.abs(w.t - t) >= abstand);
  // viel Bewegung: höchste Werte
  const hoch = [...idx].sort((a, b) => bewegung[b] - bewegung[a]);
  let n = 0;
  for (const i of hoch) { if (n >= 3 || bewegung[i] <= 0) break; if (frei(proben[i].t)) { wahl.push({ t: proben[i].t, grund: 'viel Bewegung' }); n++; } }
  // kaum Bewegung: Mitte der längsten ruhigen Strecken
  const werte = idx.map((i) => bewegung[i]).sort((a, b) => a - b);
  const ruhig = werte[Math.floor(werte.length * 0.3)] || 0;
  const strecken = [];
  let a = -1;
  for (let k = 0; k <= idx.length; k++) {
    const still = k < idx.length && bewegung[idx[k]] <= ruhig;
    if (still && a < 0) a = k;
    if (!still && a >= 0) { strecken.push([a, k - 1]); a = -1; }
  }
  strecken.sort((x, y) => (proben[idx[y[1]]].t - proben[idx[y[0]]].t) - (proben[idx[x[1]]].t - proben[idx[x[0]]].t));
  n = 0;
  for (const [x, y] of strecken) {
    if (n >= 3 || proben[idx[y]].t - proben[idx[x]].t < 3) break;
    const t = proben[idx[Math.floor((x + y) / 2)]].t;
    if (frei(t)) { wahl.push({ t, grund: 'kaum Bewegung' }); n++; }
  }
  return wahl.sort((x, y) => x.t - y.t).slice(0, 8);
}
