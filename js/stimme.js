// Stimme aufwärmen: geführte Abfolge ohne Aufnahme und ohne Auswertung.
// Jeder Schritt nennt die Zahl der Wiederholungen und hat einen Timer, der Dauer oder Rhythmus vorgibt.
import { h, fuelle, kopf, geheZu } from './ui.js?v=2002';
import { wachAn, wachAus, tonAn, signal } from './geraet.js?v=2002';

// Bausteine für den Timer: eine Folge von Abschnitten { text, sek, teil, runde }.
// teil = welcher Eintrag der Lautzeile gerade dran ist (wird hervorgehoben), -1 = Pause.
const PAUSE = 'Pause';
// Jeden Laut einzeln halten, dazwischen Pause.
function halten(laute, sek, pause, runden = 1) {
  const f = [];
  for (let r = 1; r <= runden; r++) laute.forEach((l, i) => {
    f.push({ text: l, sek, teil: i, runde: r });
    if (!(r === runden && i === laute.length - 1)) f.push({ text: PAUSE, sek: pause, teil: -1, runde: r });
  });
  return f;
}
// Im Takt: jeder Eintrag bekommt gleich viel Zeit, ohne Pause dazwischen.
function takt(laute, sek, runden = 1) {
  const f = [];
  for (let r = 1; r <= runden; r++) laute.forEach((l, i) => f.push({ text: l, sek, teil: i, runde: r }));
  return f;
}

const VOKALE = ['I', 'E', 'A', 'O', 'U'];
const SCHRITTE = [
  { titel: 'Ankommen', mal: 'Dreimal', runden: 3,
    text: 'Stell dich aufrecht hin, Füße hüftbreit. Atme ruhig durch die Nase ein und durch den Mund aus.',
    laute: ['Einatmen', 'Ausatmen'], folge: (l) => takt(l, 5, 3) },
  { titel: 'Vokale einzeln', mal: 'Jeden Vokal einmal', runden: 1,
    text: 'Jeden Vokal einzeln auf einem Atemzug halten. Mittlere Lautstärke, Mund weit öffnen.',
    laute: VOKALE, folge: (l) => halten(l, 8, 4) },
  { titel: 'Vokale in einem Atemzug', mal: 'Dreimal', runden: 3,
    text: 'Alle fünf Vokale ohne Absetzen ineinander gleiten lassen. Der Timer gibt den Wechsel vor.',
    laute: VOKALE, folge: (l) => { const f = []; for (let r = 1; r <= 3; r++) { f.push(...takt(l, 2).map((x) => ({ ...x, runde: r }))); if (r < 3) f.push({ text: PAUSE, sek: 4, teil: -1, runde: r }); } return f; } },
  { titel: 'M leise', mal: 'Zweimal', runden: 2,
    text: 'Lippen locker schließen und leise summen, bis die Lippen kribbeln.',
    laute: ['Mmmm'], folge: (l) => halten(l, 8, 4, 2) },
  { titel: 'M mittel', mal: 'Zweimal', runden: 2,
    text: 'Das gleiche Summen in Zimmerlautstärke.',
    laute: ['Mmmm'], folge: (l) => halten(l, 8, 4, 2) },
  { titel: 'M kräftig', mal: 'Zweimal', runden: 2,
    text: 'Jetzt kräftig summen, ohne zu pressen. Der Hals bleibt locker.',
    laute: ['Mmmm'], folge: (l) => halten(l, 8, 4, 2) },
  { titel: 'Zungen-R', mal: 'Fünfmal kurz, dann einmal lang', runden: 1,
    text: 'Die Zungenspitze flattert hinter den oberen Zähnen.',
    laute: ['Rr', 'Rr', 'Rr', 'Rr', 'Rr', 'Rrrrrrr'], folge: (l) => l.map((x, i) => ({ text: x, sek: i < 5 ? 2 : 6, teil: i, runde: 1 })) },
  { titel: 'Silben: R am Ende', mal: 'Zweimal', runden: 2,
    text: 'Jede Silbe deutlich sprechen und das R rollen. Eine Silbe je Ton.',
    laute: ['IR', 'ER', 'AR', 'OR', 'UR'], folge: (l) => takt(l, 2, 2) },
  { titel: 'Silben: R am Anfang', mal: 'Zweimal', runden: 2,
    text: 'Jede Silbe mit kräftig gerolltem R beginnen. Eine Silbe je Ton.',
    laute: ['RI', 'RE', 'RA', 'RO', 'RU'], folge: (l) => takt(l, 2, 2) },
  { titel: 'Wörter: R am Anfang', mal: 'Einmal', runden: 1,
    text: 'Langsam und überdeutlich sprechen, das R rollen. Ein Wort je Ton.',
    laute: ['Rose', 'Regen', 'Rad', 'Ruhe', 'Riese'], folge: (l) => takt(l, 3) },
  { titel: 'Wörter: R in der Mitte', mal: 'Einmal', runden: 1,
    text: 'Langsam und überdeutlich sprechen. Ein Wort je Ton.',
    laute: ['Ware', 'Ehre', 'Karte', 'Garten', 'Murmel'], folge: (l) => takt(l, 3) },
  { titel: 'Wörter: R am Ende', mal: 'Einmal', runden: 1,
    text: 'Das R am Schluss hörbar ausklingen lassen. Ein Wort je Ton.',
    laute: ['Tor', 'Meer', 'klar', 'Uhr', 'Tier'], folge: (l) => takt(l, 3) },
];

export function stimmeSeite(app) {
  let i = 0, takter = null;
  const halt = () => { clearInterval(takter); takter = null; };

  function zeichne() {
    halt();
    if (i >= SCHRITTE.length) {
      wachAus();
      fuelle(app, kopf('Stimme aufwärmen'),
        h('div', { class: 'mitte' }, h('div', { class: 'dick' }, 'Fertig ✓'), h('div', { class: 'grau' }, 'Die Stimme ist aufgewärmt.')),
        h('button', { class: 'gross', onclick: () => geheZu('#/') }, 'Zum Start'),
        h('button', { class: 'breit', onclick: () => { i = 0; zeichne(); } }, 'Noch einmal von vorn'));
      return;
    }
    const s = SCHRITTE[i], folge = s.folge(s.laute);
    const gesamt = Math.round(folge.reduce((a, x) => a + x.sek, 0));
    const teile = s.laute.map((l) => h('span', {}, l));
    const laut = h('div', { class: 'laut' }, teile.flatMap((t, k) => (k ? [' · ', t] : [t])));
    const uhr = h('div', { class: 'stimmUhr', hidden: true });
    const stand = h('div', { class: 'hinweis' }, 'Der Timer gibt Dauer und Rhythmus vor (' + gesamt + ' Sekunden). Du kannst auch ohne Timer üben.');
    const knopf = h('button', { class: 'breit blau', onclick: () => (takter ? stopp('') : start()) }, 'Timer starten');
    const markiere = (k) => teile.forEach((t, n) => t.classList.toggle('dran', n === k));

    function stopp(text) {
      halt(); markiere(-1); uhr.hidden = true;
      knopf.textContent = 'Timer noch einmal starten';
      stand.textContent = text;
    }
    function start() {
      tonAn(); wachAn();                       // muss direkt im Antippen starten
      let n = -1, ende = 0;
      const weiter = () => {
        n++;
        if (n >= folge.length) { signal(2, 660); stopp('Geschafft. Weiter mit dem nächsten Schritt.'); return; }
        const a = folge[n];
        ende = performance.now() + a.sek * 1000;
        markiere(a.teil);
        if (a.text !== PAUSE) signal(1, 880);
        uhr.dataset.text = a.text;
        stand.textContent = s.runden > 1 ? 'Durchgang ' + a.runde + ' von ' + s.runden : '';
      };
      knopf.textContent = 'Timer stoppen'; uhr.hidden = false;
      weiter();
      const zeige = () => { if (takter) fuelle(uhr, h('span', { class: 'was' }, uhr.dataset.text), h('span', { class: 'sek' }, String(Math.max(1, Math.ceil((ende - performance.now()) / 1000))))); };
      takter = setInterval(() => { if (performance.now() >= ende) weiter(); zeige(); }, 100);
      zeige();
    }

    fuelle(app, kopf('Stimme aufwärmen'),
      h('p', { class: 'grau' }, 'Schritt ' + (i + 1) + ' von ' + SCHRITTE.length),
      h('div', { class: 'begriffTitel' }, s.titel),
      laut,
      h('div', { class: 'mal' }, s.mal),
      h('p', { class: 'schritt' }, s.text),
      uhr, knopf, stand,
      h('div', { class: 'fest' }, h('button', { class: 'gross', onclick: () => { wachAn(); i++; zeichne(); window.scrollTo(0, 0); } }, i === SCHRITTE.length - 1 ? 'Fertig' : 'Weiter')),
      i > 0 ? h('button', { class: 'breit leise', onclick: () => { i--; zeichne(); } }, 'Einen Schritt zurück') : null);
  }
  zeichne();
  return () => { halt(); wachAus(); };
}
