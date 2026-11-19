// Ergebnisseite, Teil „Auswertung“: automatisch über die Anthropic-Schnittstelle oder von Hand über die Claude-App.
import { h, fuelle, geheZu, klappe, istOffen, merkeOffen } from './ui.js?v=2202';
import { fmtZeit } from './store.js?v=2202';
import { paketText, codeLesen } from './auswertung.js?v=2202';
import { bilderLaden, uebungSpeichern } from './db.js?v=2202';
import { md } from './md.js?v=2202';
import { autoStand, autoModell, autoAuswerten, entwirren, coachText } from './auto.js?v=2202';
import { wachAn, wachAus } from './geraet.js?v=2202';

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
    // Das Teilen-Menü legt in der Claude-App ein neues Gespräch außerhalb des Projekts an. Damit der Coach trotzdem
    // nach seinen Regeln bewertet, schickt die App die Coach-Anweisung gleich mit (wenn sie auf dem Gerät hinterlegt ist).
    const mitCoach = coachText().length > 200;
    const handText = () => (mitCoach ? 'Du bist mein Rhetorik-Coach. Halte dich bei der Bewertung genau an die folgende Anweisung. Danach folgt das Auswertungspaket meiner Rede.\n\n===== ANWEISUNG =====\n\n' + coachText() + '\n\n===== ENDE DER ANWEISUNG =====\n\n' : '') + paketText(u);
    const kopiere = () => navigator.clipboard.writeText(handText()).then(() => sag(mitCoach ? 'Der Text ist kopiert. Öffne die Claude-App, drücke unten lange in das Nachrichtenfeld, tippe auf „Einsetzen“ und schicke ab.' : 'Der Text ist kopiert. Öffne in der Claude-App das Projekt „Rhetorik-Coach“, drücke unten lange in das Nachrichtenfeld, tippe auf „Einsetzen“ und schicke ab.'))
      .catch(() => sag('Kopieren hat nicht geklappt.', true));
    const teilen = h('button', { class: 'breit' + (auto.bereit ? '' : ' blau'), disabled: !bereit, onclick: () => {
      const daten = { text: handText() };
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
    // Hilfe zur Übergabe von Hand: öffnet sich beim Antippen des ℹ︎-Felds
    const hilfe = h('div', { class: 'hilfeText', hidden: !istOffen('hilfe.vonhand') },
      h('ol', { class: 'merk' }, [
        'Tippe auf „An die Claude-App teilen“.',
        'Es öffnet sich das Teilen-Menü. Tippe dort auf „Claude“.',
        mitCoach ? 'Die Claude-App öffnet sich mit einer neuen Nachricht. Text und Bilder stehen schon darin. Du musst nichts kopieren und kein Projekt wählen: Tippe nur auf den Pfeil zum Abschicken.'
          : 'Die Claude-App öffnet sich mit einer neuen Nachricht. Text und Bilder stehen schon darin. Tippe auf den Pfeil zum Abschicken.',
        'Warte, bis der Coach fertig geantwortet hat.',
        'Drücke lange auf die Antwort und tippe auf „Kopieren“.',
        'Wechsle zurück in den Rhetorik-Trainer.',
        'Tippe auf „Ergebnis einfügen“. Fragt das iPhone „Einsetzen erlauben“, tippe auf „Erlauben“.',
        'Die App fragt, ob sie auch das ganze Feedback speichern soll. Tippe auf „OK“. Note und Feedback stehen danach hier auf der Seite.',
      ].map((t) => h('li', {}, t))),
      mitCoach ? h('p', { class: 'grau' }, 'Die Anweisung für den Coach schickt die App jedes Mal mit. Deshalb ist es egal, in welchem Gespräch die Nachricht landet.')
        : h('p', { class: 'warn' }, 'Wichtig: Der Coach bewertet nur richtig, wenn er seine Anweisung kennt. Hinterlege sie einmal in dieser App: Zahnrad auf dem Startbildschirm, „Automatische Auswertung“, „2 · Coach-Anweisung“. Danach schickt die App sie jedes Mal mit.'),
      h('p', { class: 'grau' }, 'Fehlt „Claude“ im Teilen-Menü? Dann tippe auf „Text kopieren“, öffne die Claude-App selbst, drücke unten lange in das Nachrichtenfeld und tippe auf „Einsetzen“. Die Bilder schickst du mit „Nur Bilder teilen“ hinterher.'));
    const hilfeKnopf = h('button', { class: 'infoFeld', 'aria-expanded': String(!hilfe.hidden), onclick: () => {
      hilfe.hidden = !hilfe.hidden; merkeOffen('hilfe.vonhand', !hilfe.hidden); hilfeKnopf.setAttribute('aria-expanded', String(!hilfe.hidden));
    } }, h('span', { class: 'infoI' }, 'ℹ︎'), h('span', {}, 'So geht die Übergabe von Hand'));
    const vonHand = [
      hilfeKnopf, hilfe,
      teilen,
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
