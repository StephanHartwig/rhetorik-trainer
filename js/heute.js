// Tagesprogramm „Heute üben“: jeden Tag zwei Aufgaben (Stegreifrede und Schlagfertigkeit) in zufälliger Reihenfolge.
// Was aufgedeckt wurde, steht für den Tag fest. Ein neuer Tag beginnt um 4:00 Uhr.
import { h, fuelle, kopf, geheZu } from './ui.js?v=2001';
import { tagSchluessel } from './store.js?v=2001';
import { ziehe } from './begriffe.js?v=2001';
import { zieheImpuls } from './impulse.js?v=2001';
import { redeAblauf } from './rede.js?v=2001';

const K = 'rt.heute';
const NAME = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit' };

function laden() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  if (!s || s.tag !== tagSchluessel() || !Array.isArray(s.folge)) {
    s = { tag: tagSchluessel(), folge: Math.random() < 0.5 ? ['rede', 'schlag'] : ['schlag', 'rede'], aufgaben: {}, erledigt: {} };
    speichern(s);
  }
  return s;
}
function speichern(s) { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} }

// Für den Startbildschirm: 0, 1 oder 2 Aufgaben erledigt
export function heuteStand() {
  const s = laden();
  return { erledigt: s.folge.filter((m) => s.erledigt[m]).length };
}

export function heuteSeite(app, E, merke, neuZeichnen) {
  const s = laden();
  const offen = s.folge.find((m) => !s.erledigt[m]);
  if (!offen) {
    fuelle(app,
      kopf('Heute üben'),
      h('div', { class: 'begriffTitel' }, 'Für heute erledigt ✓'),
      h('p', {}, 'Beide Aufgaben sind aufgenommen. Jetzt kannst du sie nacheinander messen und auswerten lassen.'),
      s.folge.map((m, i) => h('button', { class: 'breit blau', onclick: () => geheZu('#/uebung/' + s.erledigt[m]) }, 'Aufgabe ' + (i + 1) + ' öffnen: ' + NAME[m])),
      h('p', { class: 'grau' }, 'Weitere Übungen laufen über „Freies Üben“ auf dem Startbildschirm.'),
      h('button', { class: 'breit', onclick: () => geheZu('#/') }, 'Zum Start'));
    return null;
  }
  return redeAblauf(app, E, merke, {
    modus: offen,
    heute: {
      nr: s.folge.indexOf(offen) + 1,
      aufgabe() {
        const jetzt = laden();
        if (!jetzt.aufgaben[offen]) { jetzt.aufgaben[offen] = offen === 'rede' ? ziehe(E.fachAnteil) : zieheImpuls(); speichern(jetzt); }
        return jetzt.aufgaben[offen];
      },
      fertig(meta) {
        const jetzt = laden();
        jetzt.erledigt[offen] = meta.id; speichern(jetzt);
        neuZeichnen();
      },
    },
  });
}
