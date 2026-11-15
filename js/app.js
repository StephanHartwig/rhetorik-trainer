// Rhetorik-Trainer · Startbildschirm, Einstellungen, Seitenwechsel
import { laden, speichern, STANDARD, GRENZEN, fmtZeit, signalFuer } from './store.js?v=12';
import { h, fuelle, kopf, chips, regler, gruppe, geheZu, REDEZEITEN } from './ui.js?v=12';
import { redeAblauf } from './rede.js?v=12';
import { uebungSeite, verlaufSeite, eigeneSeite } from './seiten.js?v=12';
import { eigeneBegriffe } from './begriffe.js?v=12';

const VERSION = 12;
const app = document.getElementById('app');
let E = laden();
const merke = (k, v) => { E[k] = v; E = speichern(E); };

// ---------- neue Fassung online? ----------
let neueFassung = null;
fetch('index.html?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()).then((t) => {
  const m = t.match(/app\.js\?v=(\d+)/);
  if (m && Number(m[1]) !== VERSION) { neueFassung = m[1]; if (!location.hash.startsWith('#/rede')) zeigen(); }
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
      h('button', { class: 'kachel', onclick: () => geheZu('#/rede') }, 'Stegreifrede'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/bald/schlag') }, 'Schlagfertigkeit'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/bald/einwand') }, 'Einwand'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/bald/stimme') }, 'Stimme aufwärmen')),
    h('button', { class: 'breit', onclick: () => geheZu('#/verlauf') }, 'Verlauf'),
    h('div', { class: 'fuss warn' }, 'Vor dem Üben: Stromsparmodus aus (Batterie-Symbol nicht gelb).'),
  ];
}

// ---------- ehrlicher Platzhalter für noch nicht gebaute Teile ----------
const BALD = {
  heute: ['Heute üben', 'Das Tagesprogramm kommt mit Block 7, sobald auch die Schlagfertigkeit gebaut ist.'],
  schlag: ['Schlagfertigkeit', 'Kommt mit Block 7.'],
  einwand: ['Einwand', 'Kommt mit Block 7.'],
  stimme: ['Stimme aufwärmen', 'Kommt mit Block 7.'],
};
function bald(was) {
  const [titel, text] = BALD[was] || ['Unbekannt', ''];
  return [
    kopf(titel),
    h('div', { class: 'mitte' }, h('div', { class: 'dick' }, 'Noch nicht gebaut'), h('div', { class: 'grau' }, text)),
  ];
}

// ---------- Einstellungen ----------
function einstellungen() {
  const sek = (v) => v + ' s';
  const redeWert = h('span', { class: 'wert' }, fmtZeit(E.redezeit));
  const redeHinweis = h('div', { class: 'hinweis' });
  const signalHinweis = h('div', { class: 'hinweis' });
  const fehler = h('div', { class: 'hinweis fehler' });
  const hinweise = () => {
    redeHinweis.textContent = E.redezeit > 1200 ? 'Über 20 Minuten wird nur der Ton aufgenommen, kein Video.' : '';
    const s = signalFuer(E, E.redezeit);
    signalHinweis.textContent = E.signal && s !== E.signal ? 'Bei einer Redezeit unter 2 Minuten kommt der Signalton 10 Sekunden vor Schluss.' : '';
  };
  const redeChips = chips(REDEZEITEN, E.redezeit, (v) => setzeRede(v));
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

  const vorb = regler({ min: 0, max: 60, schritt: 1, knopf: 5, wert: E.vorbereitung, text: sek, beiWechsel: (v) => merke('vorbereitung', v) });
  const schlag = regler({ min: 10, max: 300, schritt: 5, knopf: 5, wert: E.antwortSchlag, text: fmtZeit, beiWechsel: (v) => merke('antwortSchlag', v) });
  const einw = regler({ min: 10, max: 300, schritt: 5, knopf: 5, wert: E.antwortEinwand, text: fmtZeit, beiWechsel: (v) => merke('antwortEinwand', v) });
  const fach = regler({ min: 0, max: 100, schritt: 1, knopf: 1, wert: E.fachAnteil, text: (v) => v + ' %', beiWechsel: (v) => merke('fachAnteil', v) });
  const signalChips = chips([[0, 'aus'], [10, '10 s'], [30, '30 s'], [60, '60 s']], E.signal, (v) => { merke('signal', v); hinweise(); });
  const aufbauChips = chips([['klassisch', 'klassisch'], ['frei', 'frei']], E.aufbau, (v) => merke('aufbau', v));
  const transChips = chips([['mittel', 'schnell'], ['gross', 'genau']], E.transkript, (v) => merke('transkript', v));
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
    gruppe('Transkript', null, transChips.el,
      h('div', { class: 'hinweis' }, 'Schnell: eine 5-Minuten-Rede braucht etwa 3 Minuten. Genau: versteht Fachwörter besser, braucht etwa 5 Minuten und lädt einmalig rund 250 MB.')),
    h('button', { class: 'breit', onclick: () => geheZu('#/eigene') }, 'Eigene Begriffe (' + eigeneBegriffe().length + ')'),
    h('button', { class: 'breit', onclick: () => {
      if (confirm('Alle Einstellungen auf Standard zurücksetzen?')) { E = speichern({ ...STANDARD }); zeigen(); }
    } }, 'Auf Standard zurücksetzen'),
    h('div', { class: 'fuss grau' }, 'Fassung ' + VERSION + ' · ', h('a', { href: 'probe.html' }, 'Technik-Probe öffnen')),
  ];
}

// ---------- Seitenwechsel ----------
let aufraeumen = null;
function zeigen() {
  if (aufraeumen) { try { aufraeumen(); } catch (e) {} aufraeumen = null; }
  const pfad = location.hash.replace(/^#\/?/, '');
  window.scrollTo(0, 0);
  if (pfad === 'rede') { aufraeumen = redeAblauf(app, E, merke); return; }
  if (pfad.startsWith('uebung/')) { aufraeumen = uebungSeite(app, pfad.slice(7)); return; }
  if (pfad === 'verlauf') { aufraeumen = verlaufSeite(app); return; }
  if (pfad === 'eigene') { aufraeumen = eigeneSeite(app); return; }
  let seite;
  if (pfad === 'einstellungen') seite = einstellungen();
  else if (pfad.startsWith('bald/')) seite = bald(pfad.slice(5));
  else seite = start();
  fuelle(app, seite);
}
window.addEventListener('hashchange', zeigen);
zeigen();

// Den Browser bitten, die Daten dauerhaft zu behalten.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
