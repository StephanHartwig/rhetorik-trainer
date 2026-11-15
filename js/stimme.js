// Stimme aufwärmen: geführte Abfolge ohne Aufnahme und ohne Auswertung.
import { h, fuelle, kopf, geheZu } from './ui.js?v=19';
import { wachAn, wachAus } from './geraet.js?v=19';

const SCHRITTE = [
  ['Ankommen', '', 'Stell dich aufrecht hin, Füße hüftbreit. Atme dreimal ruhig durch die Nase ein und durch den Mund aus.'],
  ['Vokale einzeln', 'I · E · A · O · U', 'Jeden Vokal einzeln auf einem Atemzug halten, so lange es bequem geht. Mittlere Lautstärke, Mund weit öffnen.'],
  ['Vokale in einem Atemzug', 'I–E–A–O–U', 'Alle fünf Vokale ohne Absetzen ineinander gleiten lassen. Dreimal.'],
  ['M leise', 'Mmmm', 'Lippen locker schließen und leise summen, bis die Lippen kribbeln. Zweimal.'],
  ['M mittel', 'Mmmm', 'Das gleiche Summen in Zimmerlautstärke. Zweimal.'],
  ['M kräftig', 'Mmmm', 'Jetzt kräftig summen, ohne zu pressen. Der Hals bleibt locker. Zweimal.'],
  ['Zungen-R', 'Rrrrr', 'Die Zungenspitze flattert hinter den oberen Zähnen. Fünfmal kurz, dann einmal lang.'],
  ['Silben: R am Ende', 'IR · ER · AR · OR · UR', 'Jede Silbe deutlich sprechen und das R rollen. Zwei Durchgänge.'],
  ['Silben: R am Anfang', 'RI · RE · RA · RO · RU', 'Jede Silbe mit kräftig gerolltem R beginnen. Zwei Durchgänge.'],
  ['Wörter: R am Anfang', 'Rose · Regen · Rad · Ruhe · Riese', 'Langsam und überdeutlich sprechen, das R rollen.'],
  ['Wörter: R in der Mitte', 'Ware · Ehre · Karte · Garten · Murmel', 'Langsam und überdeutlich sprechen.'],
  ['Wörter: R am Ende', 'Tor · Meer · klar · Uhr · Tier', 'Das R am Schluss hörbar ausklingen lassen.'],
];

export function stimmeSeite(app) {
  let i = 0;
  function zeichne() {
    if (i >= SCHRITTE.length) {
      wachAus();
      fuelle(app, kopf('Stimme aufwärmen'),
        h('div', { class: 'mitte' }, h('div', { class: 'dick' }, 'Fertig ✓'), h('div', { class: 'grau' }, 'Die Stimme ist aufgewärmt.')),
        h('button', { class: 'gross', onclick: () => geheZu('#/') }, 'Zum Start'),
        h('button', { class: 'breit', onclick: () => { i = 0; zeichne(); } }, 'Noch einmal von vorn'));
      return;
    }
    const [titel, laut, text] = SCHRITTE[i];
    fuelle(app, kopf('Stimme aufwärmen'),
      h('p', { class: 'grau' }, 'Schritt ' + (i + 1) + ' von ' + SCHRITTE.length),
      h('div', { class: 'begriffTitel' }, titel),
      laut ? h('div', { class: 'laut' }, laut) : null,
      h('p', { class: 'schritt' }, text),
      h('div', { class: 'fest' }, h('button', { class: 'gross', onclick: () => { wachAn(); i++; zeichne(); window.scrollTo(0, 0); } }, i === SCHRITTE.length - 1 ? 'Fertig' : 'Weiter')),
      i > 0 ? h('button', { class: 'breit leise', onclick: () => { i--; zeichne(); } }, 'Einen Schritt zurück') : null);
  }
  zeichne();
  return () => wachAus();
}
