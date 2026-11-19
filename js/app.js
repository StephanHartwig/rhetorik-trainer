// Rhetorik-Trainer · Startbildschirm, Einstellungen, Seitenwechsel
import { laden, speichern, STANDARD, GRENZEN, fmtZeit, signalFuer } from './store.js?v=2201';
import { h, fuelle, kopf, chips, regler, klappe, geheZu, REDEZEITEN, klappenVergessen, merkeHerkunft } from './ui.js?v=2201';
import { redeAblauf } from './rede.js?v=2201';
import { uebungSeite, eigeneSeite } from './seiten.js?v=2201';
import { verlaufSeite, startInfo } from './verlauf.js?v=2201';
import { autoSeite } from './auto-seite.js?v=2201';
import { lauf, laufend } from './messlauf.js?v=2201';
import { autoStand } from './auto.js?v=2201';
import { eigeneBegriffe } from './begriffe.js?v=2201';
import { eigene } from './impulse.js?v=2201';
import { heuteSeite, heuteStand } from './heute.js?v=2201';
import { stimmeSeite } from './stimme.js?v=2201';
import { merkSeite } from './merk.js?v=2201';

const VERSION = 2201;
// Ab 20.1 steckt die Unterstufe in der Zahl: 2001 wird als „20.1“ angezeigt.
const fassungText = (n) => (n >= 1000 ? Math.floor(n / 100) + '.' + (n % 100) : String(n));
const app = document.getElementById('app');
const E = laden();
// E bleibt dasselbe Objekt: Die laufende Seite (zum Beispiel die Einrichtung einer Rede) sieht so jede weitere Änderung.
const merke = (k, v) => { E[k] = v; Object.assign(E, speichern(E)); };

// ---------- neue Fassung online? ----------
let neueFassung = null;
fetch('index.html?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()).then((t) => {
  const m = t.match(/app\.js\?v=(\d+)/);
  if (m && Number(m[1]) !== VERSION) { neueFassung = m[1]; if (!/^#\/(rede|schlag|einwand|heute|stimme|ruhe)/.test(location.hash)) zeigen(); }
}).catch(() => {});
function updateKnopf() {
  if (!neueFassung) return null;
  return h('button', { class: 'breit rot', onclick: () => location.replace('./?v=' + Date.now()) }, 'Neue Fassung laden (' + fassungText(Number(neueFassung)) + ')');
}

// ---------- Startbildschirm ----------
function start() {
  const info = h('div', { class: 'startInfo' });
  startInfo(info);
  const n = heuteStand().erledigt;
  return [
    kopf('Rhetorik-Trainer', { zurueck: false, rechts: h('button', { class: 'rad', 'aria-label': 'Einstellungen', onclick: () => geheZu('#/einstellungen') }, '⚙︎') }),
    updateKnopf(),
    h('button', { class: 'gross' + (n === 2 ? ' erledigt' : ''), onclick: () => geheZu('#/heute') }, n === 2 ? 'Heute geübt ✓' : 'Heute üben',
      h('small', {}, n === 2 ? 'Beide Aufgaben erledigt · antippen zum Auswerten' : n === 1 ? 'Aufgabe 1 erledigt · weiter mit Aufgabe 2 von 2' : '2 Aufgaben · Art und Reihenfolge überraschen dich')),
    info,
    h('h2', {}, 'Freies Üben'),
    h('div', { class: 'raster' },
      h('button', { class: 'kachel', onclick: () => geheZu('#/rede') }, 'Stegreifrede'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/schlag') }, 'Schlagfertigkeit'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/einwand') }, 'Einwand'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/stimme') }, 'Stimme aufwärmen'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/ruhe') }, 'Aufregung dämpfen'),
      h('button', { class: 'kachel', onclick: () => geheZu('#/merk') }, 'Merkzettel')),
    h('button', { class: 'breit', onclick: () => geheZu('#/verlauf') }, 'Verlauf'),
    h('div', { class: 'fuss warn' }, 'Vor dem Üben: Stromsparmodus aus (Batterie-Symbol nicht gelb).'),
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
  const wert = (t) => h('span', { class: 'wert' }, t);
  const signalText = () => (E.signal ? E.signal + ' s' : 'aus'), transText = () => (E.transkript === 'gross' ? 'genau' : 'schnell');
  const signalWert = wert(signalText()), aufbauWert = wert(E.aufbau), transWert = wert(transText());
  const signalChips = chips([[0, 'aus'], [10, '10 s'], [30, '30 s'], [60, '60 s']], E.signal, (v) => { merke('signal', v); signalWert.textContent = signalText(); hinweise(); });
  const aufbauChips = chips([['klassisch', 'klassisch'], ['frei', 'frei']], E.aufbau, (v) => { merke('aufbau', v); aufbauWert.textContent = E.aufbau; });
  const transChips = chips([['mittel', 'schnell'], ['gross', 'genau']], E.transkript, (v) => { merke('transkript', v); transWert.textContent = transText(); });
  hinweise();

  // Jede Einstellung ist eine Zeile mit ihrem Wert. Antippen klappt die Bedienung auf.
  const weiter = (text, wert, ziel) => h('button', { class: 'reihe', onclick: () => geheZu(ziel) }, h('span', {}, text), h('span', { class: 'wert' }, wert), h('span', { class: 'pfeil' }, '›'));
  return [
    kopf('Einstellungen'),
    updateKnopf(),
    h('h2', {}, 'Zeiten'),
    h('div', { class: 'stapel' },
      klappe('e.rede', 'Redezeit', redeWert,
        h('div', { class: 'hinweis' }, 'Minuten'), redeChips.el,
        h('div', { class: 'hinweis' }, 'Oder frei eingeben'), frei, fehler, redeHinweis),
      klappe('e.vorb', 'Vorbereitung', vorb.anzeige, vorb.zeile),
      klappe('e.schlag', 'Antwort Schlagfertigkeit', schlag.anzeige, schlag.zeile),
      klappe('e.einw', 'Antwort Einwand', einw.anzeige, einw.zeile),
      klappe('e.signal', 'Signalton vor Schluss', signalWert, signalChips.el, signalHinweis)),
    h('h2', {}, 'Rede und Messung'),
    h('div', { class: 'stapel' },
      klappe('e.aufbau', 'Aufbau der Rede', aufbauWert, aufbauChips.el,
        h('div', { class: 'hinweis' }, 'Gilt für die Rede über einen Begriff. Klassisch: Einstieg, drei Argumente, Wiederholung, Aufforderung, Schluss. Frei: eigener Aufbau, der Coach wertet das nicht ab.')),
      klappe('e.fach', 'Anteil Fachbegriffe', fach.anzeige, fach.zeile),
      klappe('e.trans', 'Transkript', transWert, transChips.el,
        h('div', { class: 'hinweis' }, 'Schnell: eine 5-Minuten-Rede braucht etwa 3 Minuten. Genau: versteht Fachwörter besser, braucht etwa 5 Minuten und lädt einmalig rund 250 MB.')),
      weiter('Automatische Auswertung', autoStand().bereit ? 'eingerichtet' : 'fehlt', '#/auto')),
    h('h2', {}, 'Eigene Texte'),
    h('div', { class: 'stapel' },
      weiter('Begriffe', String(eigeneBegriffe().length), '#/eigene'),
      weiter('Aussagen für Schlagfertigkeit', String(eigene('angriff').length), '#/eigene/angriff'),
      weiter('Einwände', String(eigene('einwand').length), '#/eigene/einwand')),
    h('button', { class: 'breit leise', onclick: () => {
      if (confirm('Alle Einstellungen auf Standard zurücksetzen?')) { Object.assign(E, speichern({ ...STANDARD })); zeigen(); }
    } }, 'Auf Standard zurücksetzen'),
    h('div', { class: 'fuss grau' }, 'Fassung ' + fassungText(VERSION)),
  ];
}

// ---------- Seitenwechsel ----------
let aufraeumen = null, letzterPfad = '';
function zeigen() {
  // Während einer Messung bleibt die Ergebnisseite stehen. Verlassen geht nur nach Rückfrage und bricht die Messung sauber ab.
  if (laufend.id) {
    const zuhause = '#/uebung/' + laufend.id;
    if (location.hash === zuhause) return;
    if (!confirm('Die Messung läuft noch. Abbrechen und die Seite verlassen?')) { location.hash = zuhause; return; }
    lauf.weg(); location.reload(); return;
  }
  if (aufraeumen) { try { aufraeumen(); } catch (e) {} aufraeumen = null; }
  const pfad = location.hash.replace(/^#\/?/, '');
  // Woher kommt man? Danach richtet sich „Zurück“ auf der Ergebnisseite. Der Startbildschirm schließt alle Aufklappzeilen.
  if (pfad.startsWith('uebung/') && !letzterPfad.startsWith('uebung/')) merkeHerkunft('#/' + letzterPfad);
  if (pfad === '') klappenVergessen();
  letzterPfad = pfad;
  window.scrollTo(0, 0);
  if (pfad === 'rede') { aufraeumen = redeAblauf(app, E, merke); return; }
  if (pfad.startsWith('uebung/')) { aufraeumen = uebungSeite(app, pfad.slice(7)); return; }
  if (pfad === 'verlauf') { aufraeumen = verlaufSeite(app); return; }
  if (pfad === 'schlag' || pfad === 'einwand') { aufraeumen = redeAblauf(app, E, merke, { modus: pfad }); return; }
  if (pfad === 'heute') { aufraeumen = heuteSeite(app, E, merke, zeigen); return; }
  if (pfad === 'stimme' || pfad === 'ruhe') { aufraeumen = stimmeSeite(app, pfad); return; }
  if (pfad === 'merk') { aufraeumen = merkSeite(app); return; }
  if (pfad === 'eigene') { aufraeumen = eigeneSeite(app); return; }
  if (pfad === 'eigene/angriff' || pfad === 'eigene/einwand') { aufraeumen = eigeneSeite(app, pfad.slice(7)); return; }
  if (pfad === 'auto') { aufraeumen = autoSeite(app); return; }
  let seite;
  if (pfad === 'einstellungen') seite = einstellungen();
  else seite = start();
  fuelle(app, seite);
}
window.addEventListener('hashchange', zeigen);
zeigen();

// Den Browser bitten, die Daten dauerhaft zu behalten.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
