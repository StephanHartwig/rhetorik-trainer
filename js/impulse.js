// Impulse für die Schlagfertigkeit und Einwände ziehen: zufällig, ohne Wiederholung, bis ein Vorrat durch ist.
// Die eingebauten Listen werden nirgends angezeigt. Nur eigene Einträge sind einsehbar.
import { IMPULSE } from './impulse-daten.js?v=2105';

const K_VERBRAUCHT = 'rt.impulse.verbraucht';
const K_EIGENE = { angriff: 'rt.impulse.eigene', einwand: 'rt.einwand.eigene' };

let vorrat;
function liste() {
  if (!vorrat) {
    const roh = Uint8Array.from(atob(IMPULSE), (c) => c.charCodeAt(0));
    const key = new TextEncoder().encode('rt-vorrat-2026');
    for (let i = 0; i < roh.length; i++) roh[i] ^= key[i % key.length] ^ (i * 7 & 255);
    vorrat = JSON.parse(new TextDecoder().decode(roh));
  }
  return vorrat;
}
const lies = (k, leer) => { try { return JSON.parse(localStorage.getItem(k)) || leer; } catch (e) { return leer; } };
const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// sorte: 'angriff' (eigene Angriffe für die Schlagfertigkeit) oder 'einwand'
export const eigene = (sorte) => lies(K_EIGENE[sorte], []);
export function eigenenHinzufuegen(sorte, text) {
  text = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!text) return false;
  const l = eigene(sorte);
  if (l.some((x) => x.toLowerCase() === text.toLowerCase())) return false;
  l.push(text); schreib(K_EIGENE[sorte], l); return true;
}
export function eigenenLoeschen(sorte, text) { schreib(K_EIGENE[sorte], eigene(sorte).filter((x) => x !== text)); }

// Zieht aus einem Topf, ohne Wiederholung, bis er leer ist. Danach beginnt er von vorn.
function ausTopf(name, alle) {
  const verbraucht = lies(K_VERBRAUCHT, {});
  let weg = (Array.isArray(verbraucht[name]) ? verbraucht[name] : []).filter((t) => alle.includes(t));
  if (weg.length >= alle.length) weg = [];
  const frei = alle.filter((t) => !weg.includes(t));
  const text = frei[Math.floor(Math.random() * frei.length)];
  weg.push(text); verbraucht[name] = weg; schreib(K_VERBRAUCHT, verbraucht);
  return text;
}

// Schlagfertigkeit: immer eine Aussage, auf die man reagiert (eingebaute und eigene), nie ein einzelner Begriff.
export function zieheImpuls() {
  return { text: ausTopf('schlag', liste().angriff.concat(eigene('angriff'))), art: 'Aussage' };
}
export function zieheEinwand() {
  return { text: ausTopf('einwand', liste().einwand.concat(eigene('einwand'))) };
}
