// Tagesprogramm „Heute üben“: jeden Tag zwei Aufgaben (Stegreifrede und Schlagfertigkeit) in zufälliger Reihenfolge.
// Was aufgedeckt wurde, steht für den Tag fest. Ein neuer Tag beginnt um 4:00 Uhr.
import { h, fuelle, kopf, geheZu } from './ui.js?v=2104';
import { tagSchluessel } from './store.js?v=2104';
import { ziehe, zieheAus } from './begriffe.js?v=2104';
import { zieheImpuls } from './impulse.js?v=2104';
import { redeAblauf } from './rede.js?v=2104';

const K = 'rt.heute';
const NAME = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit' };
const REDENAME = { begriff: 'Stegreifrede', these: 'Überzeugungsrede', geschichte: 'Geschichte' };
// Die Rede des Tages wechselt: meist ein Begriff, sonst eine Überzeugungsrede oder eine Geschichte in 60 Sekunden.
const wuerfleRedeArt = () => { const z = Math.random(); return z < 0.4 ? 'begriff' : z < 0.7 ? 'these' : 'geschichte'; };

function laden() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  if (!s || s.tag !== tagSchluessel() || !Array.isArray(s.folge)) {
    s = { tag: tagSchluessel(), folge: Math.random() < 0.5 ? ['rede', 'schlag'] : ['schlag', 'rede'], redeArt: wuerfleRedeArt(), aufgaben: {}, erledigt: {} };
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
  const redeArt = REDENAME[s.redeArt] ? s.redeArt : 'begriff';      // ältere Stände kennen nur den Begriff
  const name = (m) => (m === 'rede' ? REDENAME[redeArt] : NAME[m]);
  const offen = s.folge.find((m) => !s.erledigt[m]);
  if (!offen) {
    fuelle(app,
      kopf('Heute üben'),
      h('div', { class: 'begriffTitel' }, 'Für heute erledigt ✓'),
      h('p', {}, 'Beide Aufgaben sind aufgenommen. Jetzt kannst du sie nacheinander messen und auswerten lassen.'),
      s.folge.map((m, i) => h('button', { class: 'breit blau', onclick: () => geheZu('#/uebung/' + s.erledigt[m]) }, 'Aufgabe ' + (i + 1) + ' öffnen: ' + name(m))),
      h('p', { class: 'grau' }, 'Weitere Übungen laufen über „Freies Üben“ auf dem Startbildschirm.'),
      h('button', { class: 'breit', onclick: () => geheZu('#/') }, 'Zum Start'));
    return null;
  }
  return redeAblauf(app, E, merke, {
    modus: offen,
    redeArt,
    heute: {
      nr: s.folge.indexOf(offen) + 1,
      aufgabe() {
        const jetzt = laden();
        if (!jetzt.aufgaben[offen]) { jetzt.aufgaben[offen] = offen !== 'rede' ? zieheImpuls() : redeArt === 'begriff' ? ziehe(E.fachAnteil) : zieheAus(redeArt); speichern(jetzt); }
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
