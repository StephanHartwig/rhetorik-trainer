// Stellt die Antwort des Coachs lesbar dar: Überschriften, Fettdruck, Listen und Tabellen statt roher Zeichen.
// Baut nur Textknoten und feste Elemente, führt also nichts aus dem eingefügten Text aus.
import { h } from './ui.js?v=2204';

function zeile(text) {
  const teile = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/);
  return teile.filter((t) => t !== '').map((t) => {
    if (t.length > 4 && t.startsWith('**') && t.endsWith('**')) return h('strong', {}, t.slice(2, -2));
    if (t.length > 2 && t.startsWith('`') && t.endsWith('`')) return h('code', {}, t.slice(1, -1));
    if (t.length > 2 && t.startsWith('*') && t.endsWith('*')) return h('em', {}, t.slice(1, -1));
    return t;
  });
}
const zellen = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((z) => z.trim());
const istTrenner = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || '');
const istPunkt = (l) => /^\s*[-*•]\s+/.test(l);
const istNummer = (l) => /^\s*\d+[.)]\s+/.test(l);
const istKopf = (l) => /^\s{0,3}#{1,6}\s+/.test(l);
const istTabelle = (l) => /^\s*\|.*\|\s*$/.test(l);

export function md(text) {
  const L = String(text || '').replace(/\r/g, '').split('\n');
  const aus = [];
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (/^\s*`{0,3}RT1\|/.test(l)) { i++; continue; }                 // der Ergebniscode ist schon ausgewertet
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { aus.push(h('hr', {})); i++; continue; }
    if (istKopf(l)) { aus.push(h('div', { class: 'mdkopf' }, zeile(l.replace(/^\s*#{1,6}\s+/, '').replace(/\s+#+\s*$/, '')))); i++; continue; }
    if (istTabelle(l) && istTrenner(L[i + 1])) {
      const kopf = zellen(l), reihen = [];
      i += 2;
      while (i < L.length && istTabelle(L[i])) { reihen.push(zellen(L[i])); i++; }
      aus.push(h('div', { class: 'mdtab' }, h('table', {},
        h('thead', {}, h('tr', {}, kopf.map((z) => h('th', {}, zeile(z))))),
        h('tbody', {}, reihen.map((r) => h('tr', {}, r.map((z) => h('td', {}, zeile(z)))))))));
      continue;
    }
    if (istPunkt(l) || istNummer(l)) {
      const nummer = istNummer(l), punkte = [];
      const passt = (x) => (nummer ? istNummer(x) : istPunkt(x));
      while (i < L.length && L[i].trim() && (passt(L[i]) || /^\s{2,}\S/.test(L[i]))) {
        if (passt(L[i])) punkte.push(L[i].replace(nummer ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/, ''));
        else punkte[punkte.length - 1] += ' ' + L[i].trim();
        i++;
      }
      aus.push(h(nummer ? 'ol' : 'ul', {}, punkte.map((p) => h('li', {}, zeile(p)))));
      continue;
    }
    const absatz = [];
    while (i < L.length && L[i].trim() && !istKopf(L[i]) && !istPunkt(L[i]) && !istNummer(L[i]) && !(istTabelle(L[i]) && istTrenner(L[i + 1])) && !/^\s*`{0,3}RT1\|/.test(L[i])) { absatz.push(L[i].trim()); i++; }
    if (absatz.length) aus.push(h('p', {}, absatz.flatMap((a, k) => (k ? [h('br', {}), ...zeile(a)] : zeile(a)))));
    else i++;
  }
  return aus;
}
