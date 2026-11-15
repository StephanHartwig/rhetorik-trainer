// Begriffe ziehen: zufällig, ohne Wiederholung, bis ein Vorrat durch ist.
// Die eingebaute Liste wird nirgends angezeigt. Nur eigene Begriffe sind einsehbar.
import { BEGRIFFE } from './begriffe-daten.js?v=2100';

const K_VERBRAUCHT = 'rt.begriffe.verbraucht';
const K_EIGENE = 'rt.begriffe.eigene';
export const KATEGORIEN = { fach: 'Fach', alltag: 'Alltag', abstrakt: 'Abstrakt', skurril: 'Skurril', unmoeglich: 'Unmöglich', eigen: 'Eigen' };

let vorrat;
function liste() {
  if (!vorrat) {
    const roh = Uint8Array.from(atob(BEGRIFFE), (c) => c.charCodeAt(0));
    const key = new TextEncoder().encode('rt-vorrat-2026');
    for (let i = 0; i < roh.length; i++) roh[i] ^= key[i % key.length] ^ (i * 7 & 255);
    vorrat = JSON.parse(new TextDecoder().decode(roh));
  }
  return vorrat;
}
const lies = (k, leer) => { try { return JSON.parse(localStorage.getItem(k)) || leer; } catch (e) { return leer; } };
const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export const eigeneBegriffe = () => lies(K_EIGENE, []);
export function eigenenHinzufuegen(text) {
  text = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!text) return false;
  const l = eigeneBegriffe();
  if (l.some((x) => x.toLowerCase() === text.toLowerCase())) return false;
  l.push(text); schreib(K_EIGENE, l); return true;
}
export function eigenenLoeschen(text) { schreib(K_EIGENE, eigeneBegriffe().filter((x) => x !== text)); }

export function ziehe(fachAnteil) {
  const v = liste(), eigene = eigeneBegriffe();
  const verbraucht = lies(K_VERBRAUCHT, {});
  // Kategorie wählen: Fachanteil laut Einstellung, der Rest gleichmäßig verteilt.
  // Eigene Begriffe zählen wie eine weitere Rest-Kategorie, gewichtet nach ihrer Anzahl.
  let kat;
  if (Math.random() * 100 < fachAnteil) kat = 'fach';
  else {
    const rest = [['alltag', 1], ['abstrakt', 1], ['skurril', 1], ['unmoeglich', 1]];
    if (eigene.length) rest.push(['eigen', Math.min(1, eigene.length / 100)]);
    let z = Math.random() * rest.reduce((s, r) => s + r[1], 0);
    kat = rest[rest.length - 1][0];
    for (const [name, gewicht] of rest) { if (z < gewicht) { kat = name; break; } z -= gewicht; }
  }
  const alle = kat === 'eigen' ? eigene : v[kat];
  let weg = (verbraucht[kat] || []).filter((t) => alle.includes(t));
  if (weg.length >= alle.length) weg = [];           // Vorrat durch: von vorn
  const frei = alle.filter((t) => !weg.includes(t));
  const text = frei[Math.floor(Math.random() * frei.length)];
  weg.push(text); verbraucht[kat] = weg; schreib(K_VERBRAUCHT, verbraucht);
  return { text, kategorie: KATEGORIEN[kat] };
}
