// Ergebnisseite, Teil „Auswertung“: automatisch über die Anthropic-Schnittstelle oder von Hand über die Claude-App.
import { h, fuelle, geheZu, klappe } from './ui.js?v=2200';
import { fmtZeit } from './store.js?v=2200';
import { paketText, codeLesen } from './auswertung.js?v=2200';
import { bilderLaden, uebungSpeichern } from './db.js?v=2200';
import { md } from './md.js?v=2200';
import { autoStand, autoModell, autoAuswerten, entwirren } from './auto.js?v=2200';
import { wachAn, wachAus } from './geraet.js?v=2200';

const PUNKT = { 1: 'erfüllt', 0.5: 'teilweise', 0: 'fehlt' };
const dollar = (x) => (x < 0.01 ? 'unter 0,01' : x.toFixed(2).replace('.', ',')) + ' US-Dollar';

// beiNeu: wird nach jedem Zeichnen gerufen (die Ergebnisseite zeigt damit den Stand der drei Schritte).
export function coachTeil(u, beiNeu) {
  const box = h('div', {});
  let blobs = [], dateien = [], nochmal = false;      // nochmal: „Noch einmal auswerten“ wurde im Menü gewählt
  // Die Bilder müssen schon bereitliegen, wenn getippt wird: Das Teilen-Menü öffnet sich nur direkt im Antippen.
  if (u.bilder && u.bilder.length) bilderLaden(u.id).then((l) => {
    blobs = l.slice(0, u.bilder.length);
    dateien = blobs.map((b, i) => new File([b], 'bild' + (i + 1) + '_' + fmtZeit(u.bilder[i].t).replace(':', '-') + '.jpg', { type: 'image/jpeg' }));
  }).catch(() => {});

  function zeichne() {
    const info = h('div', { class: 'hinweis' });
    const sag = (t, fehler) => { info.className = 'hinweis' + (fehler ? ' fehler' : ''); info.textContent = t; };
    const bereit = !!u.messung, auto = autoStand();

    // ---------- automatisch ----------
    const autoKnopf = h('button', { class: 'breit blau', disabled: !bereit, onclick: async () => {
      autoKnopf.disabled = true; wachAn();
      sag('Claude wertet aus. Das dauert meist unter einer Minute. Bitte die App offen lassen …');
      try {
        const r = await autoAuswerten(u, blobs);
        r.text = entwirren(r.text);
        const e = codeLesen(r.text);
        u.ergebnis = e ? { note: e.note, punkte: e.punkte, aufgabe: e.aufgabe || '', datum: new Date().toISOString() } : null;
        u.feedback = r.text.slice(0, 30000);
        u.auswertung = { modell: r.modell, kosten: r.kosten, ohneCode: !e, abgeschnitten: !!r.abgeschnitten };
        await uebungSpeichern(u);
        nochmal = false; zeichne();
      } catch (err) { sag('Die automatische Auswertung hat nicht geklappt: ' + err.message, true); autoKnopf.disabled = false; }
      wachAus();
    } }, u.feedback ? 'Noch einmal automatisch auswerten' : 'Automatisch auswerten');

    // ---------- von Hand über die Claude-App ----------
    const kopiere = () => navigator.clipboard.writeText(paketText(u)).then(() => sag('Der Text ist kopiert. Füge ihn in der Claude-App im Projekt „Rhetorik-Coach“ ein.'))
      .catch(() => sag('Kopieren hat nicht geklappt.', true));
    const teilen = h('button', { class: 'breit' + (auto.bereit ? '' : ' blau'), disabled: !bereit, onclick: () => {
      const daten = { text: paketText(u) };
      if (dateien.length) daten.files = dateien;
      if (!navigator.share) { kopiere(); return; }
      if (daten.files && !(navigator.canShare && navigator.canShare(daten))) {
        delete daten.files;
        sag('Text und Bilder lassen sich hier nicht zusammen teilen. Geteilt wird der Text; die Bilder gehen über „Nur Bilder teilen“.');
      }
      navigator.share(daten).catch((e) => { if (e.name !== 'AbortError') sag('Teilen hat nicht geklappt (' + e.name + '). Nimm „Text kopieren“.', true); });
    } }, 'An die Claude-App teilen');
    const nurBilder = h('button', { class: 'breit', disabled: !bereit || !(u.bilder && u.bilder.length), onclick: () => {
      const daten = { files: dateien };
      if (!dateien.length || !navigator.share || !(navigator.canShare && navigator.canShare(daten))) { sag('Bilder lassen sich hier nicht teilen.', true); return; }
      navigator.share(daten).catch((e) => { if (e.name !== 'AbortError') sag('Teilen hat nicht geklappt (' + e.name + ').', true); });
    } }, 'Nur Bilder teilen');
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
      u.auswertung = null;
      await uebungSpeichern(u);
      nochmal = false; zeichne();
      return true;
    }
    function zeigeFeld() {
      const feld = h('textarea', { class: 'einfuegen', placeholder: 'Hier lange drücken und „Einsetzen“ wählen', rows: 4 });
      fuelle(feldBox, feld, h('button', { class: 'breit', onclick: () => uebernimm(feld.value) }, 'Übernehmen'));
    }
    const einfuegen = h('button', { class: 'breit', onclick: async () => {
      let text = null;
      try { text = await navigator.clipboard.readText(); } catch (e) {}
      if (text == null) { sag('Die Zwischenablage ließ sich nicht lesen. Füge die Antwort des Coachs von Hand in das Feld ein.'); zeigeFeld(); return; }
      if (!(await uebernimm(text))) zeigeFeld();
    } }, u.ergebnis ? 'Ergebnis ersetzen' : 'Ergebnis einfügen');
    const vonHand = [
      teilen,
      h('div', { class: 'hinweis' }, '1. Im Teilen-Menü „Claude“ wählen, dort das Projekt „Rhetorik-Coach“, und abschicken. 2. Die Antwort des Coachs lange drücken und kopieren. 3. Hierher zurück und „Ergebnis einfügen“ antippen.'),
      einfuegen, feldBox,
      h('div', { class: 'zwei' }, h('button', { class: 'breit', disabled: !bereit, onclick: kopiere }, 'Text kopieren'), nurBilder),
    ];

    // ---------- Anzeige ----------
    const e = u.ergebnis, a = u.auswertung, bewertet = !!(e || u.feedback);
    // Vor der Messung gibt es hier nichts zu tun.
    if (!bereit && !bewertet) { fuelle(box, h('p', { class: 'grau' }, 'Folgt nach der Messung.')); if (beiNeu) beiNeu(); return; }
    const zeile = (x, y) => h('tr', {}, h('td', {}, x), h('td', {}, y));
    const punkte = e ? Object.entries(e.punkte) : [];
    const erfuellt = punkte.filter(([, w]) => w === 1).length;
    // Auswerten: ein Hauptknopf; alles Weitere liegt in einer Aufklappzeile.
    const auswerten = auto.bereit ? [
      autoKnopf, info,
      h('div', { class: 'stapel' }, klappe('vonhand', 'Stattdessen von Hand über die Claude-App', '', vonHand,
        h('div', { class: 'hinweis' }, 'Automatisch: Modell ' + autoModell().name + ', ' + autoModell().etwa + '. Die App schickt Transkript, Messwerte und Einzelbilder an Anthropic.'))),
    ] : [
      vonHand, info,
      h('button', { class: 'breit leise', onclick: () => geheZu('#/auto') }, 'Automatische Auswertung einrichten'),
    ];
    const nochmalBox = bewertet ? h('div', { class: 'gruppe nochmalBox', hidden: !nochmal }, h('div', { class: 'titel' }, 'Noch einmal auswerten'), auswerten) : null;
    fuelle(box,
      bewertet ? [
        e ? h('div', { class: 'gruppe' },
          h('div', { class: 'noteGross' }, h('span', {}, 'Note'), e.note),
          e.aufgabe ? h('div', { class: 'aufgabe' }, h('div', { class: 'grau' }, 'Aufgabe für morgen'), entwirren(e.aufgabe)) : null) : null,
        a && a.ohneCode ? h('div', { class: 'hinweis' }, 'Die Antwort enthielt keinen Ergebniscode. Note und Aufgabe für morgen fehlen deshalb im Verlauf.') : null,
        h('div', { class: 'stapel' },
          u.feedback ? klappe('feedback', 'Feedback des Coachs', '',
            h('div', { class: 'feedback md', lang: 'de' }, md(entwirren(u.feedback))),
            a && a.abgeschnitten ? h('div', { class: 'hinweis' }, 'Die Antwort wurde wegen ihrer Länge abgeschnitten.') : null,
            a ? h('div', { class: 'hinweis' }, 'Automatisch ausgewertet mit ' + a.modell + '. Kosten dieser Auswertung: etwa ' + dollar(a.kosten) + '.') : null) : null,
          punkte.length ? klappe('punkte', 'Kriterien', erfuellt + ' von ' + punkte.length + ' erfüllt',
            h('table', { class: 'werte' }, punkte.map(([n, w]) => zeile(n, PUNKT[w] || String(w))))) : null),
        nochmalBox,
      ] : auswerten);
    if (beiNeu) beiNeu();
  }
  zeichne();
  box.neu = zeichne;
  // Aus dem Menü der Ergebnisseite: den Bereich „Noch einmal auswerten“ zeigen
  box.nochmal = () => { nochmal = true; zeichne(); const k = box.querySelector('.nochmalBox'); if (k) k.scrollIntoView({ block: 'center' }); };
  box.zu = () => { nochmal = false; };
  return box;
}
