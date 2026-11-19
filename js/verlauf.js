// Verlauf: Kurven und Liste aller Übungen. Dazu die Zeile für den Startbildschirm (Serie, Aufgabe für morgen).
import { h, fuelle, kopf, geheZu, datumText, mb, chips, menue, istOffen, merkeOffen } from './ui.js?v=2204';
import { fmtZeit } from './store.js?v=2204';
import { alleUebungen, speicherStand, uebungLoeschen } from './db.js?v=2204';
import { noteZahl, serie, aufgabeFuerMorgen, artName } from './auswertung.js?v=2204';
import { sicherungBauen, sicherungPruefen, sicherungEinlesen, dateiAbgeben } from './sicherung.js?v=2204';
import { entwirren } from './auto.js?v=2204';

const MODUS = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit', einwand: 'Einwand' };
const komma = (x) => String(x).replace('.', ',');
const tag = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
const kurz = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// Eine Kurve je Messgröße: eine Linie, eine Achse. Antippen eines Punkts zeigt Wert und Datum.
function kurve(titel, punkte, opt = {}) {
  const kasten = (...x) => h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, h('span', {}, titel), h('span', { class: 'wert' }, punkte.length ? punkte[punkte.length - 1].text : '–')), x);
  if (punkte.length < 2) return kasten(h('div', { class: 'hinweis' }, punkte.length ? 'Erst ein Wert (' + punkte[0].text + '). Die Kurve beginnt ab zwei Übungen.' : 'Noch keine Werte.'));
  punkte = punkte.slice(-30);
  const ys = punkte.map((p) => p.y), n = punkte.length;
  let lo = opt.min != null ? opt.min : Math.min(...ys), hi = opt.max != null ? opt.max : Math.max(...ys);
  const mindest = opt.spanne || 1e-9;
  if (hi - lo < mindest) { const mitte = (hi + lo) / 2, halb = Math.max(mindest, 2) / 2; hi = mitte + halb; lo = mitte - halb; }
  if (opt.min == null) { const r = (hi - lo) * 0.12; lo -= r; hi += r; }
  const W = 320, H = 120, L = 8, R = 8, T = 12, B = 12;
  const X = (i) => L + (W - L - R) * (i / (n - 1));
  const Y = (y) => { const f = (y - lo) / (hi - lo); return T + (H - T - B) * (opt.obenKlein ? f : 1 - f); };
  const linie = punkte.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
  const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + titel + '">' +
    [0, 0.5, 1].map((f) => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + (H - T - B) * f) + '" y2="' + (T + (H - T - B) * f) + '" class="gitter"/>').join('') +
    '<path d="' + linie + '" class="linie"/>' +
    punkte.map((p, i) => '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="4.5" class="punkt' + (i === n - 1 ? ' letzter' : '') + '"/>').join('') +
    punkte.map((p, i) => '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="16" class="tipp" data-i="' + i + '"/>').join('') +
    '</svg>';
  const bild = h('div', { class: 'kurve' });
  bild.innerHTML = svg;
  const letzter = punkte[n - 1];
  const zeile = h('div', { class: 'hinweis' }, 'Zuletzt am ' + kurz(letzter.datum) + ': ' + letzter.text + ' · ' + n + ' Übungen · Punkt antippen zeigt den Wert');
  bild.addEventListener('click', (ev) => {
    const i = ev.target && ev.target.dataset ? ev.target.dataset.i : undefined;
    if (i === undefined) return;
    const p = punkte[Number(i)];
    bild.querySelectorAll('.punkt').forEach((c, k) => c.classList.toggle('gewaehlt', k === Number(i)));
    zeile.textContent = datumText(p.datum) + ': ' + p.text + (p.aufgabe ? ' · ' + p.aufgabe : '');
  });
  return kasten(bild, opt.skala ? h('div', { class: 'skala' }, h('span', {}, opt.skala[0]), h('span', {}, opt.skala[1])) : null, zeile);
}

// Sicherung: Verlauf als Datei abgeben und wieder einlesen (ohne Aufnahmen)
function sicherungTeil(anzahl) {
  const info = h('div', { class: 'hinweis' });
  const sag = (t, fehler) => { info.className = 'hinweis' + (fehler ? ' fehler' : ''); info.textContent = t; };
  // Die Datei muss fertig sein, bevor getippt wird: Das Teilen-Menü öffnet sich nur direkt im Antippen.
  let bereit = null;
  sicherungBauen().then((d) => { bereit = d; }).catch(() => {});
  const wahl = h('input', { type: 'file', accept: '.json,application/json,text/plain', hidden: true });
  wahl.addEventListener('change', async () => {
    const datei = wahl.files && wahl.files[0];
    wahl.value = '';
    if (!datei) return;
    try {
      const p = sicherungPruefen(await datei.text());
      const vom = p.datum ? new Date(p.datum).toLocaleDateString('de-DE') : 'unbekanntem Datum';
      if (!confirm('Sicherung vom ' + vom + ' mit ' + p.anzahl + (p.anzahl === 1 ? ' Übung' : ' Übungen') + ' einlesen? Vorhandene Übungen bleiben erhalten.')) return;
      const mitE = confirm('Auch die Einstellungen aus der Sicherung übernehmen? „Abbrechen“ behält die Einstellungen dieses Geräts.');
      const r = await sicherungEinlesen(p.daten, mitE);
      alert(r.neu + (r.neu === 1 ? ' Übung' : ' Übungen') + ' eingelesen' + (r.schon ? ', ' + r.schon + ' waren schon vorhanden' : '') + '.');
      location.reload();
    } catch (e) { sag(e.message, true); }
  });
  return {
    el: [wahl, info],
    exportieren() {
      if (!anzahl) { sag('Es gibt noch keine Übungen zum Sichern.'); return; }
      if (!bereit) { sag('Die Sicherung wird noch vorbereitet. Bitte gleich noch einmal antippen.'); return; }
      dateiAbgeben(bereit.name, bereit.text, 'application/json').then((wie) => { if (wie !== 'abgebrochen') sag('Sicherung mit ' + bereit.anzahl + (bereit.anzahl === 1 ? ' Übung' : ' Übungen') + (wie === 'geladen' ? ' geladen: ' : ' übergeben: ') + bereit.name + '. Nicht enthalten: Videos, Einzelbilder und der Schlüssel der automatischen Auswertung.'); })
        .catch((e) => sag('Die Sicherung hat nicht geklappt (' + (e.name || e.message) + ').', true));
    },
    einlesen() { wahl.click(); },
  };
}

const KURVEN = [['note', 'Note'], ['fuell', 'Füllwörter'], ['tempo', 'Tempo'], ['zeit', 'Zeit'], ['blick', 'Blick']];
let kurveWahl = 'note', rubrik = 'alle';      // gilt, solange die App offen ist
const RUBRIKEN = ['Stegreifrede', 'Überzeugungsrede', 'Geschichte', 'Schlagfertigkeit', 'Einwand'];

export function verlaufSeite(app) {
  let aktiv = true;
  fuelle(app, kopf('Verlauf'), h('p', { class: 'grau' }, 'Lade …'));
  async function lade() {
    const [gesamt, st] = await Promise.all([alleUebungen(), speicherStand()]);
    if (!aktiv) return;
    // Rubrik: Liste und Kurven zeigen auf Wunsch nur eine Art von Übung.
    const vorhanden = RUBRIKEN.filter((r) => gesamt.some((u) => artName(u) === r));
    if (!vorhanden.includes(rubrik)) rubrik = 'alle';
    const liste = rubrik === 'alle' ? gesamt : gesamt.filter((u) => artName(u) === rubrik);
    const wahl = h('select', { class: 'auswahl', 'aria-label': 'Rubrik', onchange: () => { rubrik = wahl.value; lade(); } },
      h('option', { value: 'alle' }, 'Alle Übungen (' + gesamt.length + ')'),
      vorhanden.map((r) => h('option', { value: r }, r + ' (' + gesamt.filter((u) => artName(u) === r).length + ')')));
    wahl.value = rubrik;
    const fertig = liste.filter((u) => u.status === 'fertig').reverse();          // älteste zuerst
    const reihe = (wert, text) => fertig.map((u) => { const y = wert(u); return y == null || !isFinite(y) ? null : { y, text: text(u, y), datum: u.datum, aufgabe: u.aufgabe }; }).filter(Boolean);
    const s = serie(gesamt);
    const summe = gesamt.reduce((a, u) => a + (u.groesse || 0), 0);
    const sich = sicherungTeil(gesamt.length);
    const kopfZeile = kopf('Verlauf', { rechts: menue(() => [
      { text: 'Verlauf exportieren', tun: sich.exportieren },
      { text: 'Verlauf einlesen', tun: sich.einlesen }]) });
    if (!gesamt.length) { fuelle(app, kopfZeile, sich.el, h('div', { class: 'mitte' }, h('div', { class: 'grau' }, 'Noch keine Übungen.'))); return; }
    const baueKurve = {
      note: () => kurve('Note', reihe((u) => (u.ergebnis ? noteZahl(u.ergebnis.note) : null), (u) => u.ergebnis.note), { obenKlein: true, spanne: 1, skala: ['oben: bessere Note', 'unten: schlechtere Note'] }),
      fuell: () => kurve('Füllwörter je Minute', reihe((u) => (u.messung ? u.messung.sprache.fuellJeMinute : null), (u, y) => komma(y))),
      tempo: () => kurve('Tempo', reihe((u) => (u.messung ? u.messung.sprache.tempo : null), (u, y) => y + ' Wörter/Min.')),
      zeit: () => kurve('Zeitabweichung', reihe((u) => Math.round((u.ist - u.soll) / u.soll * 100), (u, y) => (y > 0 ? '+' : '') + y + ' %')),
      blick: () => kurve('Blick zur Kamera', reihe((u) => (u.koerper && u.koerper.blick != null ? u.koerper.blick : null), (u, y) => y + ' %'), { min: 0, max: 100 }),
    };
    const kurvenBox = h('div', {});
    const zeigeKurve = () => fuelle(kurvenBox, (baueKurve[kurveWahl] || baueKurve.note)());
    zeigeKurve();
    fuelle(app,
      kopfZeile,
      h('div', { class: 'serieKarte' }, h('b', {}, s.tage ? s.tage + (s.tage === 1 ? ' Tag' : ' Tage') + ' in Folge geübt' : 'Heute noch nicht geübt'), s.tage ? h('span', {}, s.heute ? 'Heute schon erledigt' : 'Heute noch offen') : null),
      sich.el,
      h('label', { class: 'auswahlZeile' }, h('span', {}, 'Rubrik'), wahl),
      uebungsListe(liste),
      h('h2', {}, rubrik === 'alle' ? 'Entwicklung' : 'Entwicklung · ' + rubrik),
      (() => { const c = chips(KURVEN, kurveWahl, (w) => { kurveWahl = w; zeigeKurve(); }).el; c.classList.add('klein'); return c; })(),
      kurvenBox,
      h('p', { class: 'grau' }, 'Aufnahmen belegen ' + mb(summe) + (st ? ' · frei: ' + mb(st.frei) : '') + '.'));

    // Liste der Übungen: Antippen öffnet eine Übung. Wischen von links nach rechts löscht sie sofort, ohne Rückfrage.
    function uebungsListe(liste) {
      const titel = h('div', { class: 'listenKopf' });
      const zeilen = h('div', { class: 'stapel rollListe' });
      const tipp = h('p', { class: 'grau' }, 'Zum Löschen eine Übung nach rechts wischen. Sie wird sofort gelöscht.');
      function zeile(u) {
        const knopf = h('button', { class: 'reihe eintrag' },
          h('span', { class: 'eInhalt' },
            h('span', { class: 'e1', lang: 'de' }, u.aufgabe),
            // Nur das Nötigste: Datum, Dauer, Art. Alles Weitere steht in der geöffneten Übung.
            h('span', { class: 'e2' }, [tag(u.datum), u.status === 'fertig' ? fmtZeit(u.ist) : 'nicht sauber beendet', artName(u)].join(' · '))),
          u.ergebnis ? h('span', { class: 'note' }, u.ergebnis.note) : null,
          h('span', { class: 'pfeil' }, '›'));
        const grund = h('div', { class: 'wischLoesch' }, 'Löschen');
        const huelle = h('div', { class: 'wisch' }, grund, knopf);
        let x = 0, x0 = 0, y0 = 0, richtung = '', gewischt = false, weg = false;
        const setze = (v, weich) => { x = v; knopf.style.transition = weich ? 'transform .18s' : 'none'; knopf.style.transform = v ? 'translateX(' + v + 'px)' : ''; huelle.classList.toggle('offen', v !== 0); };
        // Gelöscht wird erst, wenn die Zeile fast zur Hälfte zur Seite geschoben ist: So löst ein kurzes Verwischen nichts aus.
        const schwelle = () => Math.max(110, huelle.offsetWidth * 0.45);
        knopf.addEventListener('touchstart', (ev) => {
          if (weg || ev.touches.length !== 1) return;
          x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; richtung = ''; gewischt = false;
        }, { passive: true });
        knopf.addEventListener('touchmove', (ev) => {
          if (weg) return;
          const dx = ev.touches[0].clientX - x0, dy = ev.touches[0].clientY - y0;
          if (!richtung) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; richtung = dx > 0 && Math.abs(dx) > Math.abs(dy) ? 'quer' : 'sonst'; }
          if (richtung !== 'quer') return;            // senkrecht rollt die Liste; nach links passiert nichts
          if (ev.cancelable) ev.preventDefault();
          gewischt = true;
          setze(Math.max(0, dx), false);
          huelle.classList.toggle('reif', x >= schwelle());
        }, { passive: false });
        const ende = async (abbruch) => {
          if (weg || richtung !== 'quer') return;
          richtung = '';
          if (abbruch || x < schwelle()) { huelle.classList.remove('reif'); setze(0, true); return; }
          weg = true;
          setze(huelle.offsetWidth, true);            // die Zeile fährt hinaus
          try { await uebungLoeschen(u.id); } catch (e) {}
          if (aktiv) lade();
        };
        knopf.addEventListener('touchend', () => ende(false));
        knopf.addEventListener('touchcancel', () => ende(true));
        knopf.addEventListener('click', (ev) => {
          if (weg || gewischt) { gewischt = false; ev.preventDefault(); return; }       // das Wischen selbst ist kein Antippen
          geheZu('#/uebung/' + u.id);
        });
        return huelle;
      }
      function zeichne() {
        const zu = !istOffen('verlauf.liste');
        zeilen.hidden = zu; tipp.hidden = zu || !liste.length;
        fuelle(titel, h('button', { class: 'klappKopf', 'aria-expanded': String(!zu), onclick: () => { merkeOffen('verlauf.liste', zu); zeichne(); } },
          h('h2', {}, 'Übungen (' + liste.length + ')'), h('span', { class: 'winkel' + (zu ? '' : ' auf') }, '›')));
        fuelle(zeilen, liste.map(zeile));
      }
      zeichne();
      return [titel, zeilen, tipp];
    }
  }
  lade().catch((e) => { if (!aktiv) return; const sich = sicherungTeil(0); fuelle(app, kopf('Verlauf', { rechts: menue(() => [{ text: 'Verlauf einlesen', tun: sich.einlesen }]) }), h('p', { class: 'hinweis fehler' }, 'Der Verlauf lässt sich nicht anzeigen: ' + e.message), sich.el); });
  return () => { aktiv = false; };
}

// Für den Startbildschirm: Serie und Aufgabe für morgen
export async function startInfo(el) {
  let liste;
  try { liste = await alleUebungen(); } catch (e) { return; }
  if (!liste.length) return;
  const s = serie(liste), aufgabe = entwirren(aufgabeFuerMorgen(liste));
  fuelle(el,
    h('div', { class: 'serie' }, s.tage ? s.tage + (s.tage === 1 ? ' Tag' : ' Tage') + ' in Folge geübt' + (s.heute ? '' : ' · heute noch offen') : 'Heute noch nicht geübt'),
    aufgabe ? h('div', { class: 'aufgabe' }, h('div', { class: 'grau' }, 'Aufgabe aus dem letzten Feedback'), aufgabe) : null);
}
