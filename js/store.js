// Einstellungen und kleine Helfer. Alles bleibt auf dem Gerät (Speicher des Browsers).

const SCHLUESSEL = 'rt.einstellungen';

export const STANDARD = {
  redezeit: 300,        // Sekunden, Stegreifrede
  vorbereitung: 10,     // Sekunden
  antwortSchlag: 30,    // Sekunden, Schlagfertigkeit
  antwortEinwand: 60,   // Sekunden, Einwand
  signal: 30,           // Sekunden vor Schluss, 0 = aus
  aufbau: 'klassisch',  // 'klassisch' oder 'frei'
  fachAnteil: 33,       // Prozent Fachbegriffe
  ausschnitt: 'nah',    // 'nah' oder 'ganz', letzte Wahl
};

export const GRENZEN = {
  redezeit: [30, 3600],
  vorbereitung: [0, 60],
  antwortSchlag: [10, 300],
  antwortEinwand: [10, 300],
  fachAnteil: [0, 100],
};

const ERLAUBT = { signal: [0, 10, 30, 60], aufbau: ['klassisch', 'frei'], ausschnitt: ['nah', 'ganz'] };

function pruefen(e) {
  const out = { ...STANDARD };
  for (const k of Object.keys(STANDARD)) {
    const v = e ? e[k] : undefined;
    if (GRENZEN[k]) {
      const n = Math.round(Number(v));
      if (Number.isFinite(n)) out[k] = Math.min(GRENZEN[k][1], Math.max(GRENZEN[k][0], n));
    } else if (ERLAUBT[k] && ERLAUBT[k].includes(v)) out[k] = v;
  }
  return out;
}

export function laden() {
  try { return pruefen(JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null')); }
  catch (e) { return { ...STANDARD }; }
}

export function speichern(e) {
  const sauber = pruefen(e);
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(sauber)); } catch (err) {}
  return sauber;
}

// 90 -> "1:30"
export function fmtZeit(sek) {
  sek = Math.max(0, Math.round(sek));
  return Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0');
}

// Signalton: bei Redezeit unter 2 Minuten automatisch 10 Sekunden vor Schluss.
export function signalFuer(einst, zeit) {
  if (!einst.signal) return 0;
  return zeit < 120 ? 10 : einst.signal;
}

// Ein neuer Übungstag beginnt um 4:00 Uhr morgens.
export function tagSchluessel(d = new Date()) {
  const x = new Date(d.getTime() - 4 * 3600 * 1000);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
