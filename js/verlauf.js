// Verlauf: Kurven und Liste aller Übungen. Dazu die Zeile für den Startbildschirm (Serie, Aufgabe für morgen).
import { h, fuelle, kopf, geheZu, datumText, mb, klapp } from './ui.js?v=2101';
import { fmtZeit } from './store.js?v=2101';
import { alleUebungen, speicherStand, uebungLoeschen } from './db.js?v=2101';
import { noteZahl, serie, aufgabeFuerMorgen } from './auswertung.js?v=2101';
import { sicherungBauen, sicherungPruefen, sicherungEinlesen, dateiAbgeben } from './sicherung.js?v=2101';
import { entwirren } from './auto.js?v=2101';

const MODUS = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit', einwand: 'Einwand' };
const komma = (x) => String(x).replace('.', ',');
const tag = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
const kurz = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// Eine Kurve je Messgröße: eine Linie, eine Achse. Antippen eines Punkts zeigt Wert und Datum.
function kurve(titel, punkte, opt = {}) {
  const name = h('span', {}, titel), wert = h('span', { class: 'wert' }, punkte.length ? punkte[punkte.length - 1].text : '–');
  if (punkte.length < 2) return klapp(titel, 'gruppe', [name, wert], h('div', { class: 'hinweis' }, punkte.length ? 'Erst ein Wert (' + punkte[0].text + '). Die Kurve beginnt ab zwei Übungen.' : 'Noch keine Werte.'));
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
  return klapp(titel, 'gruppe', [name, wert], bild, opt.skala ? h('div', { class: 'skala' }, h('span', {}, opt.skala[0]), h('span', {}, opt.skala[1])) : null, zeile);
}

// Sicherung: Verlauf als Datei abgeben und wieder einlesen (ohne Aufnahmen)
function sicherungTeil(anzahl, neuLaden) {
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
  return klapp('Sicherung', 'gruppe', h('span', {}, 'Sicherung'),
    h('p', { class: 'grau' }, 'Die Sicherung enthält alle Übungen mit Messwerten, Transkript, Note und Feedback, dazu Einstellungen und eigene Listen. Nicht enthalten: Videos, Einzelbilder und der Schlüssel der automatischen Auswertung.'),
    h('button', { class: 'breit', disabled: !anzahl, onclick: () => {
      if (!bereit) { sag('Die Sicherung wird noch vorbereitet. Bitte gleich noch einmal antippen.'); return; }
      dateiAbgeben(bereit.name, bereit.text, 'application/json').then((wie) => { if (wie !== 'abgebrochen') sag('Sicherung mit ' + bereit.anzahl + (bereit.anzahl === 1 ? ' Übung' : ' Übungen') + (wie === 'geladen' ? ' geladen: ' : ' übergeben: ') + bereit.name); })
        .catch((e) => sag('Die Sicherung hat nicht geklappt (' + (e.name || e.message) + ').', true));
    } }, 'Verlauf exportieren'),
    h('button', { class: 'breit', onclick: () => wahl.click() }, 'Verlauf einlesen'),
    wahl, info);
}

export function verlaufSeite(app) {
  let aktiv = true;
  fuelle(app, kopf('Verlauf'), h('p', { class: 'grau' }, 'Lade …'));
  let auswahl = null;                 // null = normale Liste, sonst die Menge der angekreuzten Übungen
  async function lade() {
    const [liste, st] = await Promise.all([alleUebungen(), speicherStand()]);
    if (!aktiv) return;
    const fertig = liste.filter((u) => u.status === 'fertig').reverse();          // älteste zuerst
    const reihe = (wert, text) => fertig.map((u) => { const y = wert(u); return y == null || !isFinite(y) ? null : { y, text: text(u, y), datum: u.datum, aufgabe: u.aufgabe }; }).filter(Boolean);
    const s = serie(liste);
    const summe = liste.reduce((a, u) => a + (u.groesse || 0), 0);
    fuelle(app,
      kopf('Verlauf'),
      liste.length ? h('p', {}, s.tage ? s.tage + (s.tage === 1 ? ' Tag' : ' Tage') + ' in Folge geübt' + (s.heute ? '' : ' (heute noch offen)') : 'Heute noch nicht geübt') : null,
      liste.length ? [
        h('h2', {}, 'Kurven'),
        kurve('Note', reihe((u) => (u.ergebnis ? noteZahl(u.ergebnis.note) : null), (u) => u.ergebnis.note), { obenKlein: true, spanne: 1, skala: ['oben: bessere Note', 'unten: schlechtere Note'] }),
        kurve('Füllwörter je Minute', reihe((u) => (u.messung ? u.messung.sprache.fuellJeMinute : null), (u, y) => komma(y))),
        kurve('Tempo', reihe((u) => (u.messung ? u.messung.sprache.tempo : null), (u, y) => y + ' Wörter/Min.')),
        kurve('Zeitabweichung', reihe((u) => Math.round((u.ist - u.soll) / u.soll * 100), (u, y) => (y > 0 ? '+' : '') + y + ' %')),
        kurve('Blick zur Kamera', reihe((u) => (u.koerper && u.koerper.blick != null ? u.koerper.blick : null), (u, y) => y + ' %'), { min: 0, max: 100 }),
      ] : null,
      liste.length ? klapp('Übungen', 'frei', [h('span', {}, 'Übungen'), h('span', { class: 'wert' }, String(liste.length))], uebungsListe(liste))
        : h('div', { class: 'mitte' }, h('div', { class: 'grau' }, 'Noch keine Übungen.')),
      liste.length ? h('p', { class: 'grau' }, 'Aufnahmen belegen ' + mb(summe) + (st ? ' · frei: ' + mb(st.frei) : '') + '. Antippen öffnet eine Übung. Der Papierkorb löscht eine einzelne Übung, „Mehrere auswählen“ löscht mehrere auf einmal.') : null);

    app.append(sicherungTeil(liste.length));

    // Liste der Übungen: einzeln löschen per Papierkorb oder mehrere ankreuzen und zusammen löschen
    function uebungsListe(liste) {
      const loesche = async (ids, frage) => {
        if (!confirm(frage)) return;
        for (const id of ids) { try { await uebungLoeschen(id); } catch (e) {} }
        auswahl = null;
        if (aktiv) lade();
      };
      const leiste = h('div', { class: 'wahlLeiste' });
      const zeilen = h('div', {});
      function zeichne() {
        const n = auswahl ? auswahl.size : 0;
        fuelle(leiste, !auswahl
          ? h('button', { class: 'breit', onclick: () => { auswahl = new Set(); zeichne(); } }, 'Mehrere auswählen')
          : [
            h('div', { class: 'hinweis' }, 'Tippe die Übungen an, die du löschen willst.'),
            h('div', { class: 'zwei' },
              h('button', { class: 'breit', onclick: () => { auswahl = n === liste.length ? new Set() : new Set(liste.map((u) => u.id)); zeichne(); } }, n === liste.length ? 'Keine auswählen' : 'Alle auswählen'),
              h('button', { class: 'breit', onclick: () => { auswahl = null; zeichne(); } }, 'Abbrechen')),
            h('button', { class: 'breit rot', disabled: !n, onclick: () => loesche([...auswahl], n === 1 ? 'Diese Übung mit Aufnahme endgültig löschen?' : n + ' Übungen mit Aufnahmen endgültig löschen?') }, n ? '🗑 ' + n + (n === 1 ? ' Übung löschen' : ' Übungen löschen') : '🗑 Löschen'),
          ]);
        fuelle(zeilen, liste.map((u) => {
          const an = auswahl && auswahl.has(u.id);
          const inhalt = [
            h('div', { class: 'e1', lang: 'de' }, h('span', {}, u.aufgabe), u.ergebnis ? h('span', { class: 'note' }, u.ergebnis.note) : null),
            // Nur das Nötigste: Datum, Dauer, Art. Alles Weitere steht in der geöffneten Übung.
            h('div', { class: 'e2' }, [tag(u.datum), u.status === 'fertig' ? fmtZeit(u.ist) : 'nicht sauber beendet', MODUS[u.modus] || u.modus].join(' · ')),
          ];
          if (auswahl) return h('button', { class: 'eintrag wahl' + (an ? ' an' : ''), 'aria-pressed': String(!!an), onclick: () => { if (an) auswahl.delete(u.id); else auswahl.add(u.id); zeichne(); } },
            h('span', { class: 'haken' }, an ? '✓' : ''), h('div', { class: 'eInhalt' }, inhalt));
          return h('div', { class: 'eZeile' },
            h('button', { class: 'eintrag', onclick: () => geheZu('#/uebung/' + u.id) }, inhalt),
            h('button', { class: 'muell', 'aria-label': 'Übung löschen', onclick: () => loesche([u.id], '„' + u.aufgabe + '“ vom ' + datumText(u.datum) + ' mit Aufnahme endgültig löschen?') }, '🗑'));
        }));
      }
      zeichne();
      return [leiste, zeilen];
    }
  }
  lade().catch((e) => { if (aktiv) fuelle(app, kopf('Verlauf'), h('p', { class: 'hinweis fehler' }, 'Der Verlauf lässt sich nicht anzeigen: ' + e.message), sicherungTeil(0)); });
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
