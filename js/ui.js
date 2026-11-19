// Kleine Bau-Helfer für die Oberfläche

export function h(tag, attrs, ...kinder) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kind of kinder.flat(Infinity)) if (kind != null && kind !== false) el.append(kind);
  return el;
}

// Ersetzt den Inhalt eines Elements; leere Einträge und verschachtelte Listen sind erlaubt.
export function fuelle(el, ...kinder) {
  el.replaceChildren(...kinder.flat(Infinity).filter((k) => k != null && k !== false));
}

export const geheZu = (ziel) => { location.hash = ziel; };

// „Zurück“ auf der Ergebnisseite führt dorthin, woher man kam: in den Verlauf oder zum Start.
let herkunft = '#/';
export function merkeHerkunft(hash) { herkunft = hash === '#/verlauf' ? '#/verlauf' : '#/'; }
export const zurueckZiel = () => herkunft;

export function kopf(titel, { zurueck = true, ziel = '#/', rechts = null } = {}) {
  return h('div', { class: 'kopf' },
    zurueck ? h('button', { class: 'zurueck', onclick: () => geheZu(ziel) }, '‹ Zurück') : h('h1', {}, titel),
    zurueck ? h('h1', {}, titel) : null,
    rechts || h('div', { class: 'platz' }));
}

// Menü „···“ oben rechts für selten gebrauchte Aktionen. eintraege() liefert [{ text, tun, rot }], leere Einträge sind erlaubt.
export function menue(eintraege) {
  const liste = h('div', { class: 'menueListe', hidden: true });
  const zu = () => { liste.hidden = true; document.removeEventListener('pointerdown', aussen, true); };
  const aussen = (e) => { if (!huelle.contains(e.target)) zu(); };
  const knopf = h('button', { class: 'rad', 'aria-label': 'Weitere Aktionen', onclick: () => {
    if (!liste.hidden) { zu(); return; }
    fuelle(liste, eintraege().filter(Boolean).map((e) => h('button', { class: e.rot ? 'rot' : '', onclick: () => { zu(); e.tun(); } }, e.text)));
    liste.hidden = false; document.addEventListener('pointerdown', aussen, true);
  } }, '···');
  const huelle = h('div', { class: 'menue' }, knopf, liste);
  return huelle;
}

// Auswahlknöpfe, von denen genau einer gedrückt ist
export function chips(optionen, aktuell, beiWahl) {
  const knoepfe = optionen.map(([wert, text]) => h('button', {
    'aria-pressed': String(wert === aktuell),
    onclick: () => { setze(wert); beiWahl(wert); },
  }, text));
  function setze(wert) { knoepfe.forEach((k, i) => k.setAttribute('aria-pressed', String(optionen[i][0] === wert))); }
  return { el: h('div', { class: 'chips' }, knoepfe), setze };
}

// Schieberegler mit Minus und Plus
export function regler({ min, max, schritt, knopf, wert, text, beiWechsel }) {
  const anzeige = h('span', { class: 'wert' }, text(wert));
  const r = h('input', { type: 'range', min, max, step: schritt, value: wert });
  const setze = (v) => { v = Math.min(max, Math.max(min, v)); r.value = v; anzeige.textContent = text(v); beiWechsel(v); };
  r.addEventListener('input', () => setze(Number(r.value)));
  const zeile = h('div', { class: 'zeile' },
    h('button', { class: 'rund', 'aria-label': 'weniger', onclick: () => setze(Number(r.value) - knopf) }, '−'),
    r,
    h('button', { class: 'rund', 'aria-label': 'mehr', onclick: () => setze(Number(r.value) + knopf) }, '+'));
  return { anzeige, zeile };
}

// Aufklappbare Zeilen: Beim Öffnen einer Seite sind alle zu. Was von Hand aufgeklappt wurde, bleibt offen,
// solange man zwischen den Seiten wechselt. Der Startbildschirm und ein Neustart der App schließen alles wieder.
// Gemerkt wird je Seite (Adresse) und Name, nur im Arbeitsspeicher.
const offen = new Set();
try { localStorage.removeItem('rt.klapp.offen'); } catch (e) {}      // Rest aus älteren Fassungen
const schluessel = (name) => location.hash + '|' + name;
export const istOffen = (name) => offen.has(schluessel(name));
export function merkeOffen(name, an) { if (an) offen.add(schluessel(name)); else offen.delete(schluessel(name)); }
export function klappenVergessen() { offen.clear(); }
// klasse: 'gruppe' (Kasten) oder 'frei' (ohne Rahmen). kopfInhalt: was in der Kopfzeile steht.
export function klapp(name, klasse, kopfInhalt, ...inhalt) {
  const d = h('details', { class: 'klapp ' + klasse }, h('summary', {}, kopfInhalt), inhalt);
  const k = schluessel(name);
  if (offen.has(k)) d.open = true;
  d.addEventListener('toggle', () => { if (d.open) offen.add(k); else offen.delete(k); });
  return d;
}
// wert: kurzer Text oder ein fertiges Element, das rechts in der Zeile steht
export const klappe = (name, titel, wert, ...inhalt) => klapp(name, 'gruppe', [h('span', {}, titel), !wert ? null : typeof wert === 'string' ? h('span', { class: 'wert' }, wert) : wert], ...inhalt);

export function gruppe(titel, anzeige, ...inhalt) {
  return h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, h('span', {}, titel), anzeige), inhalt);
}

export const REDEZEITEN = [[30, '0:30'], [60, '1'], [120, '2'], [180, '3'], [300, '5'], [600, '10'], [1200, '20'], [3600, '60']];

export function datumText(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
export const mb = (bytes) => bytes >= 1e9 ? (bytes / 1e9).toFixed(1).replace('.', ',') + ' GB' : (bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0).replace('.', ',') + ' MB';
