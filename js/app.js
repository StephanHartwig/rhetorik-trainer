// Rhetorik-Trainer · Grundgerüst: Startbildschirm, Einstellungen, Seitenwechsel
import { laden, speichern, STANDARD, GRENZEN, fmtZeit, signalFuer } from './store.js?v=5';

const VERSION = 5;
const app = document.getElementById('app');
let E = laden();

// ---------- kleine Bau-Helfer ----------
function h(tag, attrs, ...kinder) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kind of kinder.flat()) if (kind != null && kind !== false) el.append(kind);
  return el;
}
const geheZu = (ziel) => { location.hash = ziel; };
function kopf(titel, { zurueck = true, rechts = null } = {}) {
  return h('div', { class: 'kopf' },
    zurueck ? h('button', { class: 'zurueck', onclick: () => geheZu('#/') }, '‹ Zurück') : h('h1', {}, titel),
    zurueck ? h('h1', {}, titel) : null,
    rechts || h('div', { class: 'platz' }));
}

// ---------- neue Fassung online? ----------
let neueFassung = null;
fetch('index.html?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()).then((t) => {
  const m = t.match(/app\.js\?v=(\d+)/);
  if (m && Number(m[1]) !== VERSION) { neueFassung = m[1]; zeigen(); }
}).catch(() => {});
function updateKnopf() {
  if (!neueFassung) return null;
  return h('button', { class: 'breit rot', onclick: () => location.replace('./?v=' + Date.now()) }, 'Neue Fassung laden (' + neueFassung + ')');
}

// ---------- Startbildschirm ----------
function start() {
  return [
    kopf('Rhetorik-Trainer', { zurueck: false, rechts: h('button', { class: 'rad', 'aria-label': 'Einstellungen', onclick: () => geheZu('#/einstellungen') }, '⚙︎') }),
    updateKnopf(),
    h('button', { class: 'gross', onclick: () => geheZu('#/bald/heute') }, 'Heute üben', h('small', {}, '2 Aufgaben · die Reihenfolge überrascht dich')),
    h('h2', {}, 'Freies Üben'),
    h('div', { class: 'raster' },
      h('button', { class: 'kachel', onclick: () => geheZu('#/bald/rede') }, 'Stegreifrede'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/bald/schlag') }, 'Schlagfertigkeit'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/bald/einwand') }, 'Einwand'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/bald/stimme') }, 'Stimme aufwärmen')),
    h('button', { class: 'breit', onclick: () => geheZu('#/bald/verlauf') }, 'Verlauf'),
    h('div', { class: 'fuss warn' }, 'Vor dem Üben: Stromsparmodus aus (Batterie-Symbol nicht gelb).'),
  ];
}

// ---------- ehrlicher Platzhalter für noch nicht gebaute Teile ----------
const BALD = {
  heute: ['Heute üben', 'Das Tagesprogramm kommt mit Block 3 und Block 7.'],
  rede: ['Stegreifrede', 'Kommt mit Block 3.'],
  schlag: ['Schlagfertigkeit', 'Kommt mit Block 7.'],
  einwand: ['Einwand', 'Kommt mit Block 7.'],
  stimme: ['Stimme aufwärmen', 'Kommt mit Block 7.'],
  verlauf: ['Verlauf', 'Kommt mit Block 6.'],
};
function bald(was) {
  const [titel, text] = BALD[was] || ['Unbekannt', ''];
  return [
    kopf(titel),
    h('div', { class: 'mitte' }, h('div', { class: 'dick' }, 'Noch nicht gebaut'), h('div', { class: 'grau' }, text)),
  ];
}

// ---------- Bausteine für die Einstellungen ----------
function chips(optionen, aktuell, beiWahl) {
  const knoepfe = optionen.map(([wert, text]) => h('button', {
    'aria-pressed': String(wert === aktuell),
    onclick: () => { setze(wert); beiWahl(wert); },
  }, text));
  function setze(wert) { knoepfe.forEach((k, i) => k.setAttribute('aria-pressed', String(optionen[i][0] === wert))); }
  return { el: h('div', { class: 'chips' }, knoepfe), setze };
}
function regler({ min, max, schritt, knopf, wert, text, beiWechsel }) {
  const anzeige = h('span', { class: 'wert' }, text(wert));
  const r = h('input', { type: 'range', min, max, step: schritt, value: wert });
  const setze = (v) => { v = Math.min(max, Math.max(min, v)); r.value = v; anzeige.textContent = text(v); beiWechsel(v); };
  r.addEventListener('input', () => setze(Number(r.value)));
  const zeile = h('div', { class: 'zeile' },
    h('button', { class: 'rund', 'aria-label': 'weniger', onclick: () => setze(Number(r.value) - knopf) }, '−'),
    r,
    h('button', { class: 'rund', 'aria-label': 'mehr', onclick: () => setze(Number(r.value) + knopf) }, '+'));
  return { anzeige, zeile };
}
function gruppe(titel, anzeige, ...inhalt) {
  return h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, h('span', {}, titel), anzeige), inhalt);
}

// ---------- Einstellungen ----------
function einstellungen() {
  const merke = (k, v) => { E[k] = v; E = speichern(E); };
  const sek = (v) => v + ' s';

  // Redezeit
  const redeWert = h('span', { class: 'wert' }, fmtZeit(E.redezeit));
  const redeHinweis = h('div', { class: 'hinweis' });
  const signalHinweis = h('div', { class: 'hinweis' });
  const fehler = h('div', { class: 'hinweis fehler' });
  const hinweise = () => {
    redeHinweis.textContent = E.redezeit > 1200 ? 'Über 20 Minuten wird nur der Ton aufgenommen, kein Video.' : '';
    const s = signalFuer(E, E.redezeit);
    signalHinweis.textContent = E.signal && s !== E.signal ? 'Bei einer Redezeit unter 2 Minuten kommt der Signalton 10 Sekunden vor Schluss.' : '';
  };
  const redeChips = chips([[30, '0:30'], [60, '1'], [120, '2'], [180, '3'], [300, '5'], [600, '10'], [1200, '20'], [3600, '60']], E.redezeit, (v) => setzeRede(v));
  const inMin = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 60, placeholder: '0', 'aria-label': 'Minuten' });
  const inSek = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 59, placeholder: '0', 'aria-label': 'Sekunden' });
  function setzeRede(v) {
    merke('redezeit', v); redeWert.textContent = fmtZeit(E.redezeit); redeChips.setze(E.redezeit);
    fehler.textContent = ''; hinweise();
  }
  const frei = h('div', { class: 'frei' },
    h('label', {}, 'Minuten', inMin), h('label', {}, 'Sekunden', inSek),
    h('button', { onclick: () => {
      const v = Math.round((Number(inMin.value) || 0) * 60 + (Number(inSek.value) || 0));
      if (v < GRENZEN.redezeit[0] || v > GRENZEN.redezeit[1]) { fehler.textContent = 'Bitte zwischen 0:30 und 60:00 wählen.'; return; }
      setzeRede(v); inMin.value = ''; inSek.value = ''; inMin.blur(); inSek.blur();
    } }, 'Übernehmen'));

  // Regler
  const vorb = regler({ min: 0, max: 60, schritt: 1, knopf: 5, wert: E.vorbereitung, text: sek, beiWechsel: (v) => merke('vorbereitung', v) });
  const schlag = regler({ min: 10, max: 300, schritt: 5, knopf: 5, wert: E.antwortSchlag, text: fmtZeit, beiWechsel: (v) => merke('antwortSchlag', v) });
  const einw = regler({ min: 10, max: 300, schritt: 5, knopf: 5, wert: E.antwortEinwand, text: fmtZeit, beiWechsel: (v) => merke('antwortEinwand', v) });
  const fach = regler({ min: 0, max: 100, schritt: 1, knopf: 1, wert: E.fachAnteil, text: (v) => v + ' %', beiWechsel: (v) => merke('fachAnteil', v) });

  const signalChips = chips([[0, 'aus'], [10, '10 s'], [30, '30 s'], [60, '60 s']], E.signal, (v) => { merke('signal', v); hinweise(); });
  const aufbauChips = chips([['klassisch', 'klassisch'], ['frei', 'frei']], E.aufbau, (v) => merke('aufbau', v));
  hinweise();

  return [
    kopf('Einstellungen'),
    updateKnopf(),
    gruppe('Redezeit Stegreifrede', redeWert,
      h('div', { class: 'hinweis' }, 'Schnellwahl in Minuten'), redeChips.el,
      h('div', { class: 'hinweis' }, 'Oder frei eingeben'), frei, fehler, redeHinweis),
    gruppe('Vorbereitungszeit', vorb.anzeige, vorb.zeile),
    gruppe('Antwortzeit Schlagfertigkeit', schlag.anzeige, schlag.zeile),
    gruppe('Antwortzeit Einwand', einw.anzeige, einw.zeile),
    gruppe('Signalton vor Schluss', null, signalChips.el, signalHinweis),
    gruppe('Aufbau der Rede', null, aufbauChips.el,
      h('div', { class: 'hinweis' }, 'Klassisch: Einstieg, drei Argumente, Wiederholung, Aufforderung, Schluss. Frei: eigener Aufbau, der Coach wertet das nicht ab.')),
    gruppe('Anteil Fachbegriffe', fach.anzeige, fach.zeile),
    h('button', { class: 'breit', onclick: () => {
      if (confirm('Alle Einstellungen auf Standard zurücksetzen?')) { E = speichern({ ...STANDARD }); zeigen(); }
    } }, 'Auf Standard zurücksetzen'),
    h('div', { class: 'fuss grau' }, 'Fassung ' + VERSION + ' · ', h('a', { href: 'probe.html' }, 'Technik-Probe öffnen')),
  ];
}

// ---------- Seitenwechsel ----------
function zeigen() {
  const pfad = location.hash.replace(/^#\/?/, '');
  let seite;
  if (pfad === 'einstellungen') seite = einstellungen();
  else if (pfad.startsWith('bald/')) seite = bald(pfad.slice(5));
  else seite = start();
  app.replaceChildren(...seite.filter(Boolean));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', zeigen);
zeigen();

// Den Browser bitten, die Daten dauerhaft zu behalten.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
