// Ergebnisseite, Teil „Auswertung“: Paket an die Claude-App teilen, Ergebniscode des Coachs einfügen.
import { h, fuelle } from './ui.js?v=15';
import { fmtZeit } from './store.js?v=15';
import { paketText, codeLesen } from './auswertung.js?v=15';
import { bilderLaden, uebungSpeichern } from './db.js?v=15';

const PUNKT = { 1: 'erfüllt', 0.5: 'teilweise', 0: 'fehlt' };

export function coachTeil(u) {
  const box = h('div', {});
  let dateien = [];
  // Die Bilder müssen schon bereitliegen, wenn getippt wird: Das Teilen-Menü öffnet sich nur direkt im Antippen.
  if (u.bilder && u.bilder.length) bilderLaden(u.id).then((blobs) => {
    dateien = blobs.slice(0, u.bilder.length).map((b, i) => new File([b], 'bild' + (i + 1) + '_' + fmtZeit(u.bilder[i].t).replace(':', '-') + '.jpg', { type: 'image/jpeg' }));
  }).catch(() => {});

  function zeichne() {
    const info = h('div', { class: 'hinweis' });
    const sag = (t, fehler) => { info.className = 'hinweis' + (fehler ? ' fehler' : ''); info.textContent = t; };
    const bereit = !!u.messung;
    const kopiere = () => navigator.clipboard.writeText(paketText(u)).then(() => sag('Der Text ist kopiert. Füge ihn in der Claude-App im Projekt „Rhetorik-Coach“ ein.'))
      .catch(() => sag('Kopieren hat nicht geklappt.', true));

    const teilen = h('button', { class: 'breit blau', disabled: !bereit, onclick: () => {
      const daten = { text: paketText(u) };
      if (dateien.length) daten.files = dateien;
      if (!navigator.share) { kopiere(); return; }
      if (daten.files && !(navigator.canShare && navigator.canShare(daten))) {
        delete daten.files;
        sag('Text und Bilder lassen sich hier nicht zusammen teilen. Geteilt wird der Text; die Bilder gehen über „Nur Bilder teilen“.');
      }
      navigator.share(daten).catch((e) => { if (e.name !== 'AbortError') sag('Teilen hat nicht geklappt (' + e.name + '). Nimm „Text kopieren“.', true); });
    } }, 'Auswerten lassen');
    const nurBilder = h('button', { class: 'breit', disabled: !bereit || !(u.bilder && u.bilder.length), onclick: () => {
      const daten = { files: dateien };
      if (!dateien.length || !navigator.share || !(navigator.canShare && navigator.canShare(daten))) { sag('Bilder lassen sich hier nicht teilen.', true); return; }
      navigator.share(daten).catch((e) => { if (e.name !== 'AbortError') sag('Teilen hat nicht geklappt (' + e.name + ').', true); });
    } }, 'Nur Bilder teilen');

    // Ergebnis des Coachs übernehmen
    const feldBox = h('div', {});
    async function uebernimm(text) {
      const e = codeLesen(text);
      if (!e) {
        sag('Darin steht kein Ergebniscode. Er ist die letzte Zeile der Coach-Antwort und beginnt mit RT1|. Kopiere in der Claude-App die ganze Antwort und versuche es noch einmal.', true);
        return false;
      }
      const roh = String(text).trim();
      const mitText = roh.length > e.code.length + 20 && confirm('Auch das ganze Feedback des Coachs speichern?');
      u.ergebnis = { note: e.note, punkte: e.punkte, aufgabe: e.aufgabe || '', datum: new Date().toISOString() };
      u.feedback = mitText ? roh.slice(0, 30000) : '';
      await uebungSpeichern(u);
      zeichne();
      return true;
    }
    function zeigeFeld() {
      const feld = h('textarea', { class: 'einfuegen', placeholder: 'Hier lange drücken und „Einsetzen“ wählen', rows: 4 });
      fuelle(feldBox, feld, h('button', { class: 'breit', onclick: () => uebernimm(feld.value) }, 'Übernehmen'));
    }
    const einfuegen = h('button', { class: 'breit' + (u.ergebnis ? '' : ' blau'), onclick: async () => {
      let text = null;
      try { text = await navigator.clipboard.readText(); } catch (e) {}
      if (text == null) { sag('Die Zwischenablage ließ sich nicht lesen. Füge die Antwort des Coachs von Hand in das Feld ein.'); zeigeFeld(); return; }
      if (!(await uebernimm(text))) zeigeFeld();
    } }, u.ergebnis ? 'Ergebnis ersetzen' : 'Ergebnis einfügen');

    const e = u.ergebnis;
    const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
    fuelle(box,
      e ? h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, 'Bewertung des Coachs', h('span', { class: 'wert' }, 'Note ' + e.note)),
        Object.keys(e.punkte).length ? h('table', { class: 'werte' }, Object.entries(e.punkte).map(([n, w]) => zeile(n, PUNKT[w] || String(w)))) : null,
        e.aufgabe ? h('div', { class: 'aufgabe' }, h('div', { class: 'grau' }, 'Aufgabe für morgen'), e.aufgabe) : null,
        u.feedback ? h('details', {}, h('summary', {}, 'Ganzes Feedback anzeigen'), h('div', { class: 'feedback' }, u.feedback)) : null) : null,
      h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, 'Auswertung'),
        bereit ? null : h('div', { class: 'hinweis' }, 'Erst „Messwerte berechnen“, dann auswerten lassen.'),
        teilen,
        h('div', { class: 'hinweis' }, '1. Im Teilen-Menü „Claude“ wählen, dort das Projekt „Rhetorik-Coach“, und abschicken. 2. Die Antwort des Coachs lange drücken und kopieren. 3. Hierher zurück und „Ergebnis einfügen“ antippen.'),
        h('div', { class: 'zwei' }, h('button', { class: 'breit', disabled: !bereit, onclick: kopiere }, 'Text kopieren'), nurBilder),
        einfuegen, feldBox, info));
  }
  zeichne();
  return box;
}
