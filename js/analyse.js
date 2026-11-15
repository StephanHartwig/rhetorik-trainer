// Messung aus Ton und Transkript. Reine Rechenfunktionen, ohne Zugriff auf Gerät oder Speicher.
// Alle Ergebnisse sind Schätzungen.

const RATE = 16000, RAHMEN = 320;          // 20 Millisekunden je Rahmen
const PAUSE_AB = 0.7;                       // ab dieser Länge zählt Stille als Pause (Sekunden)

function perzentil(werte, p) {
  const s = Float32Array.from(werte).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0;
}
const runde = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
function streuung(w) {
  if (w.length < 2) return 0;
  const m = w.reduce((a, b) => a + b, 0) / w.length;
  return Math.sqrt(w.reduce((a, b) => a + (b - m) * (b - m), 0) / (w.length - 1));
}

// ---------- Stimme: Pausen, Lautstärke, Tonhöhe ----------
export function stimmAnalyse(pcm, dauer) {
  const n = Math.min(Math.floor(pcm.length / RAHMEN), Math.floor(dauer * RATE / RAHMEN));
  const sek = (i) => i * RAHMEN / RATE;
  const db = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * RAHMEN, e = j + RAHMEN; j < e; j++) s += pcm[j] * pcm[j];
    db[i] = 20 * Math.log10(Math.sqrt(s / RAHMEN) + 1e-7);
  }
  const boden = perzentil(db, 0.1), oben = perzentil(db, 0.95), spanne = oben - boden;
  const schwelle = boden + Math.max(6, 0.35 * spanne);
  const spricht = new Uint8Array(n);
  for (let i = 0; i < n; i++) spricht[i] = db[i] > schwelle ? 1 : 0;
  // Glätten: sehr kurze Lücken gehören zum Sprechen, sehr kurze Ausschläge zur Stille
  const laeufe = (wert) => { const l = []; let a = -1; for (let i = 0; i <= n; i++) { const w = i < n && spricht[i] === wert; if (w && a < 0) a = i; if (!w && a >= 0) { l.push([a, i]); a = -1; } } return l; };
  for (const [a, e] of laeufe(0)) if (sek(e - a) < 0.15 && a > 0 && e < n) spricht.fill(1, a, e);
  for (const [a, e] of laeufe(1)) if (sek(e - a) < 0.06) spricht.fill(0, a, e);

  let erster = -1, letzter = -1, sprechRahmen = 0;
  for (let i = 0; i < n; i++) if (spricht[i]) { if (erster < 0) erster = i; letzter = i; sprechRahmen++; }
  const werte = { dauer: runde(sek(n)), unsicher: spanne < 12, spanneDb: runde(spanne) };
  const stille = laeufe(0);
  if (erster < 0) {
    Object.assign(werte, { keineStimme: true, pausen: 0, pausenListe: [] });
  } else {
    const pausen = stille.filter(([a, e]) => a > erster && e <= letzter && sek(e - a) >= PAUSE_AB).map(([a, e]) => ({ von: runde(sek(a)), laenge: runde(sek(e - a)) }));
    const laengste = pausen.reduce((m, p) => (p.laenge > m.laenge ? p : m), { laenge: 0, von: 0 });
    Object.assign(werte, {
      ersteWorteNach: runde(sek(erster)),
      sprechAnteil: Math.round(100 * sprechRahmen / Math.max(1, letzter - erster + 1)),
      pausen: pausen.length,
      pausenMittel: pausen.length ? runde(pausen.reduce((s, p) => s + p.laenge, 0) / pausen.length) : 0,
      pausenLang: pausen.filter((p) => p.laenge >= 2).length,
      laengstePause: laengste.laenge, laengstePauseBei: laengste.von,
      pausenListe: pausen.slice(0, 200),
      // Sprechabschnitte: Stücke zwischen Atempausen ab 0,4 Sekunden
      abschnitte: 1 + stille.filter(([a, e]) => a > erster && e <= letzter && sek(e - a) >= 0.4).length,
    });
    // Lautstärke: Schwankung der mittleren Lautstärke je Sekunde (nur Sprechzeit)
    const jeSek = [];
    for (let i = 0; i + 50 <= n; i += 50) {
      let s = 0, c = 0;
      for (let j = i; j < i + 50; j++) if (spricht[j]) { s += db[j]; c++; }
      if (c >= 15) jeSek.push(s / c);
    }
    werte.lautSchwankung = jeSek.length >= 5 ? runde(streuung(jeSek)) : null;
    // Tonhöhe: alle 100 Millisekunden, nur wo gesprochen wird
    const f0 = [];
    const W = 640, MINL = Math.floor(RATE / 350), MAXL = Math.ceil(RATE / 70);
    const puffer = new Float32Array(W + MAXL);
    for (let i = 2; i < n - 4; i += 5) {
      if (!spricht[i]) continue;
      const start = i * RAHMEN;
      if (start + W + MAXL > pcm.length) break;
      let m = 0;
      for (let j = 0; j < W + MAXL; j++) m += pcm[start + j];
      m /= (W + MAXL);
      for (let j = 0; j < W + MAXL; j++) puffer[j] = pcm[start + j] - m;
      let e0 = 0;
      for (let j = 0; j < W; j++) e0 += puffer[j] * puffer[j];
      if (e0 < 1e-6) continue;
      let best = 0, bestL = 0;
      const r = new Float32Array(MAXL + 1);
      for (let l = MINL; l <= MAXL; l++) {
        let s = 0, e1 = 0;
        for (let j = 0; j < W; j++) { s += puffer[j] * puffer[j + l]; e1 += puffer[j + l] * puffer[j + l]; }
        r[l] = s / Math.sqrt(e0 * e1 + 1e-12);
        if (r[l] > best) { best = r[l]; bestL = l; }
      }
      if (best < 0.55) continue;
      // Oktavfehler vermeiden: die kürzeste Periode nehmen, die fast so gut passt
      for (let l = MINL; l < bestL; l++) if (r[l] >= 0.9 * best && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { bestL = l; break; }
      f0.push(RATE / bestL);
    }
    if (f0.length >= 30) {
      const med = perzentil(f0, 0.5);
      const halb = f0.map((f) => 12 * Math.log2(f / med)).filter((h) => Math.abs(h) <= 12);
      werte.tonhoehe = Math.round(med);
      werte.tonSchwankung = runde(streuung(halb));
    } else { werte.tonhoehe = null; werte.tonSchwankung = null; }
  }

  // Fenster für das Transkript: höchstens 29 Sekunden, geschnitten möglichst mitten in einer Stille
  const fenster = [];
  let pos = 0;
  const ende = sek(n);
  while (pos < ende - 0.2) {
    let bis = ende;
    if (ende - pos > 29) {
      const a = Math.floor((pos + 15) * RATE / RAHMEN), e = Math.floor((pos + 29) * RATE / RAHMEN);
      let bestA = -1, bestLen = 0, la = -1;
      for (let i = a; i <= e; i++) {
        const still = i < e && !spricht[i];
        if (still && la < 0) la = i;
        if (!still && la >= 0) { if (i - la > bestLen) { bestLen = i - la; bestA = la; } la = -1; }
      }
      let schnitt;
      if (bestLen >= 5) schnitt = bestA + Math.floor(bestLen / 2);
      else { schnitt = a; for (let i = a; i < e; i++) if (db[i] < db[schnitt]) schnitt = i; }
      bis = sek(schnitt);
    }
    let c = 0;
    const fa = Math.floor(pos * RATE / RAHMEN), fe = Math.min(n, Math.floor(bis * RATE / RAHMEN));
    for (let i = fa; i < fe; i++) c += spricht[i];
    fenster.push({ von: pos, bis, sprache: c / Math.max(1, fe - fa) });
    pos = bis;
  }
  return { werte, fenster };
}

// ---------- Sprache: Tempo, Satzlänge, Füllwörter ----------
const FUELL = [
  ['äh', /\b(äh+|öh+)\b/gi], ['ähm', /\b(ähm+|ehm+|öhm+|hm+)\b/gi], ['halt', /\bhalt\b/gi], ['sozusagen', /\bsozusagen\b/gi],
  ['quasi', /\bquasi\b/gi], ['eigentlich', /\beigentlich\b/gi], ['irgendwie', /\birgendwie\b/gi], ['genau', /\bgenau\b/gi],
];
export function sprachAnalyse(segmente, redeSek) {
  const text = segmente.map((s) => s.text).join(' ');
  // \b kennt keine Umlaute: Wortgrenzen deshalb über Leerzeichen herstellen
  const glatt = ' ' + text.toLowerCase().replace(/[^a-zäöüß0-9]+/g, '  ') + ' ';
  const woerter = (text.match(/[A-Za-zÄÖÜäöüß0-9]+(?:-[A-Za-zÄÖÜäöüß0-9]+)*/g) || []).length;
  const saetze = text.split(/[.!?…]+/).map((s) => s.trim()).filter((s) => /[A-Za-zÄÖÜäöüß]/.test(s)).length;
  const einzeln = {};
  let gesamt = 0;
  for (const [name, muster] of FUELL) {
    const quelle = muster.source.replace(/\\b/g, ' ');
    const anzahl = (glatt.match(new RegExp(quelle, 'g')) || []).length;
    if (anzahl) { einzeln[name] = anzahl; gesamt += anzahl; }
  }
  const min = Math.max(redeSek, 1) / 60;
  return {
    woerter,
    tempo: Math.round(woerter / min),
    saetze,
    satzlaenge: saetze ? runde(woerter / saetze) : null,
    satzUnsicher: woerter > 40 && (saetze < 2 || woerter / saetze > 18),
    fuellGesamt: gesamt,
    fuellJeMinute: runde(gesamt / min),
    fuellEinzeln: einzeln,
  };
}
