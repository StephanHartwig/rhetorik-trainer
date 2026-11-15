// Verlauf: Kurven und Liste aller Übungen. Dazu die Zeile für den Startbildschirm (Serie, Aufgabe für morgen).
import { h, fuelle, kopf, geheZu, datumText, mb } from './ui.js?v=19';
import { fmtZeit } from './store.js?v=19';
import { alleUebungen, speicherStand } from './db.js?v=19';
import { noteZahl, serie, aufgabeFuerMorgen } from './auswertung.js?v=19';
import { entwirren } from './auto.js?v=19';

const MODUS = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit', einwand: 'Einwand' };
const komma = (x) => String(x).replace('.', ',');
const kurz = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// Aufklappbarer Bereich, der sich merkt, ob er offen war
const K_OFFEN = 'rt.verlauf.offen';
function offene() { try { return JSON.parse(localStorage.getItem(K_OFFEN)) || []; } catch (e) { return []; } }
function klapp(name, klasse, kopfInhalt, ...inhalt) {
  const d = h('details', { class: 'klapp ' + klasse }, h('summary', {}, kopfInhalt), inhalt);
  if (offene().includes(name)) d.open = true;
  d.addEventListener('toggle', () => {
    const l = offene().filter((x) => x !== name);
    if (d.open) l.push(name);
    try { localStorage.setItem(K_OFFEN, JSON.stringify(l)); } catch (e) {}
  });
  return d;
}

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

export function verlaufSeite(app) {
  let aktiv = true;
  fuelle(app, kopf('Verlauf'), h('p', { class: 'grau' }, 'Lade …'));
  (async () => {
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
      liste.length ? klapp('Übungen', 'frei', [h('span', {}, 'Übungen'), h('span', { class: 'wert' }, String(liste.length))], liste.map((u) => h('button', { class: 'eintrag', onclick: () => geheZu('#/uebung/' + u.id) },
        h('div', { class: 'e1', lang: 'de' }, h('span', {}, u.aufgabe), u.ergebnis ? h('span', { class: 'note' }, u.ergebnis.note) : null),
        h('div', { class: 'e2' }, [datumText(u.datum), MODUS[u.modus] || u.modus].join(' · ')),
        h('div', { class: 'e2' }, u.status === 'fertig' ? 'Soll ' + fmtZeit(u.soll) + ' · Ist ' + fmtZeit(u.ist) + ' · ' + mb(u.groesse || 0) + (u.ergebnis ? '' : u.messung ? ' · noch nicht ausgewertet' : ' · noch nicht gemessen') : 'nicht sauber beendet'))))
        : h('div', { class: 'mitte' }, h('div', { class: 'grau' }, 'Noch keine Übungen.')),
      liste.length ? h('p', { class: 'grau' }, 'Aufnahmen belegen ' + mb(summe) + (st ? ' · frei: ' + mb(st.frei) : '') + '. Antippen öffnet eine Übung; dort kannst du sie ansehen, sichern oder löschen.') : null);
  })();
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
