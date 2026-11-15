// Messung einer Übung: Ton laden, im Arbeits-Thread messen und transkribieren, Ergebnis speichern.
import { pcmLaden, aufnahmeDatei, uebungSpeichern } from './db.js?v=17';
import { sprachAnalyse } from './analyse.js?v=17';

// Zwei Transkript-Modelle: schnell oder genau. minJeMin = geschätzte Rechenzeit je Redeminute (iPhone 16 Pro).
export const MODELLE = {
  mittel: { id: 'onnx-community/whisper-base', name: 'schnell', mb: 80, minJeMin: 0.6, stillMax: 90000 },
  gross: { id: 'onnx-community/whisper-small', name: 'genau', mb: 250, minJeMin: 1.0, stillMax: 180000 },
};

// Ton der Übung als 16.000 Werte je Sekunde. Bevorzugt die mitgeschnittene Tonspur, sonst aus der Aufnahme.
async function tonLaden(u) {
  const roh = await pcmLaden(u.id);
  if (roh && roh.length > 8000) {
    const f = new Float32Array(roh.length);
    for (let i = 0; i < roh.length; i++) f[i] = roh[i] / 32768;
    return { audio: f, versatz: u.tonVersatz || 0 };
  }
  const datei = await aufnahmeDatei(u);
  if (!datei) throw new Error('Zu dieser Übung ist kein Ton gespeichert.');
  if (datei.size > 150e6) throw new Error('Diese Aufnahme ist zu groß, um sie nachträglich zu messen.');
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  let dec;
  try { dec = await ac.decodeAudioData(await datei.arrayBuffer()); } finally { try { ac.close(); } catch (e) {} }
  const n = dec.length, k = dec.numberOfChannels, mono = new Float32Array(n);
  for (let c = 0; c < k; c++) { const d = dec.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / k; }
  const schritt = dec.sampleRate / 16000, m = Math.floor(n / schritt), f = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const a = Math.floor(i * schritt), e = Math.min(n, Math.floor((i + 1) * schritt));
    let s = 0; for (let j = a; j < e; j++) s += mono[j];
    f[i] = s / Math.max(1, e - a);
  }
  return { audio: f, versatz: 0 };
}

function einLauf(audio, dauer, melde, modell) {
  return new Promise((ja, nein) => {
    const w = new Worker('js/mess-worker.js?v=17', { type: 'module' });
    let wache, stimme = null, geladen = false;
    const ende = (fn, wert) => { clearTimeout(wache); w.terminate(); fn(wert); };
    const stelleWache = () => { clearTimeout(wache); wache = setTimeout(() => ende(nein, Object.assign(new Error('haengt'), { haengt: true, geladen })), modell.stillMax); };
    stelleWache();
    w.onerror = (e) => ende(nein, new Error(e.message || 'Die Messung konnte nicht starten.'));
    w.onmessage = (e) => {
      const d = e.data; stelleWache();
      if (d.typ === 'stimme') { stimme = d.stimme; melde('Stimme gemessen. Lade das Transkript-Modell …'); }
      else if (d.typ === 'laden') melde('Lade das Transkript-Modell: ' + Math.round(d.pct) + ' %');
      else if (d.typ === 'modell') { geladen = true; melde('Schreibe das Transkript …'); }
      else if (d.typ === 'fenster') melde('Schreibe das Transkript: Abschnitt ' + d.i + ' von ' + d.n);
      else if (d.typ === 'fertig') ende(ja, { stimme, segmente: d.segmente });
      else if (d.typ === 'fehler') ende(nein, new Error(d.text));
    };
    w.postMessage({ audio, dauer, modell: modell.id });
  });
}

const VOLL = /out of memory|no available backend|allocation fail|memory/i;
// Regt die Speicherbereinigung an und wartet kurz, damit freigegebener Speicher wirklich frei wird.
export async function luftHolen(ms) {
  try { for (let i = 0; i < 3; i++) new ArrayBuffer(48 * 1024 * 1024); } catch (e) {}
  await new Promise((r) => setTimeout(r, ms));
}
// Bis zu drei Versuche: bei Speichermangel oder wenn das Modell nicht reagiert.
async function mitGeduld(audio, dauer, melde, modell) {
  let letzter;
  for (let v = 0; v < 3; v++) {
    try { return await einLauf(audio, dauer, melde, modell); }
    catch (e) {
      letzter = e; e.voll = !e.haengt && VOLL.test(e.message || '');
      if (!e.voll && !e.haengt) throw e;
      if (v < 2) {
        melde(e.voll ? 'Zu wenig Arbeitsspeicher. Warte kurz und versuche es noch einmal (' + (v + 2) + ' von 3) …' : 'Das Modell reagiert nicht. Versuch ' + (v + 2) + ' von 3 …');
        await luftHolen(e.voll ? 5000 : 500);
      }
    }
  }
  throw letzter;
}

// Misst die Übung und speichert das Ergebnis in der Übung. melde(text) zeigt den Fortschritt.
// opt.ersatz: das schnelle Modell wird nur ersatzweise benutzt (wird im Ergebnis vermerkt)
export async function messen(u, melde, wahl, opt = {}) {
  const modell = MODELLE[wahl] || MODELLE.mittel;
  melde('Lade den Ton …');
  const { audio, versatz } = await tonLaden(u);
  const dauer = Math.min(audio.length / 16000, Math.max(1, (u.ist || audio.length / 16000) - versatz + 0.5));
  if (dauer < 2) throw new Error('Die Aufnahme ist zu kurz für eine Messung.');
  let erg, benutzt = modell, ersatz = !!opt.ersatz;
  try { erg = await mitGeduld(audio, dauer, melde, modell); }
  catch (e) {
    if (e.haengt) throw new Error('Das Transkript-Modell startet nicht. Bitte die App ganz schließen, neu öffnen und noch einmal messen.');
    if (!e.voll) throw e;
    if (modell === MODELLE.mittel) throw new Error('Zu wenig Arbeitsspeicher für das Transkript. Bitte die App ganz schließen, neu öffnen und noch einmal messen.');
    // Das genaue Modell passt gerade nicht in den Speicher: mit dem schnellen weitermachen und das dazusagen
    melde('Zu wenig Arbeitsspeicher für das genaue Transkript. Nehme das schnelle …');
    benutzt = MODELLE.mittel; ersatz = true;
    try { erg = await mitGeduld(audio, dauer, melde, benutzt); }
    catch (e2) { throw new Error(e2.voll || e2.haengt ? 'Zu wenig Arbeitsspeicher für das Transkript. Bitte die App ganz schließen, neu öffnen und noch einmal messen.' : e2.message); }
  }
  const segmente = erg.segmente.map((s) => ({ t: Math.round((s.t + versatz) * 10) / 10, text: s.text }));
  const stimme = erg.stimme;
  if (versatz && stimme.pausenListe) for (const p of stimme.pausenListe) p.von = Math.round((p.von + versatz) * 10) / 10;
  if (versatz && stimme.laengstePauseBei != null) stimme.laengstePauseBei = Math.round((stimme.laengstePauseBei + versatz) * 10) / 10;
  u.transkript = segmente;
  const sprache = sprachAnalyse(segmente, u.ist || dauer);
  sprache.woerterJeAbschnitt = stimme.abschnitte ? Math.round(sprache.woerter / stimme.abschnitte * 10) / 10 : null;
  u.messung = { stimme, sprache, modell: benutzt.name, ersatz, datum: new Date().toISOString() };
  await uebungSpeichern(u);
  return u;
}
