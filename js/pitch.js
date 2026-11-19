// Pitch: die Kurzvorstellung des eigenen Angebots in 30 bis 60 Sekunden.
// Jeder pitcht sein eigenes Unternehmen: Angebot und Thema gibt der Nutzer selbst ein, sie bleiben auf dem Gerät.
// Die App zieht auf Wunsch einen Kniff, mit dem der Pitch auffällt. Die eingebaute Liste wird nirgends angezeigt.
import { PITCH } from './pitch-daten.js?v=2300';

const K = 'rt.pitch', K_WEG = 'rt.pitch.verbraucht';
export const PITCHZEITEN = [[30, '30 s'], [45, '45 s'], [60, '60 s']];
const TONARTEN = ['ernst', 'humorvoll', 'provokant'];
const LAENGE = { angebot: 300, thema: 120, wunsch: 160 };

let vorrat;
function liste() {
  if (!vorrat) {
    const roh = Uint8Array.from(atob(PITCH), (c) => c.charCodeAt(0));
    const key = new TextEncoder().encode('rt-vorrat-2026');
    for (let i = 0; i < roh.length; i++) roh[i] ^= key[i % key.length] ^ (i * 7 & 255);
    vorrat = JSON.parse(new TextDecoder().decode(roh));
  }
  return vorrat;
}
export function pitchOk() { try { return liste().kniff.length > 0; } catch (e) { return false; } }
const lies = (k, leer) => { try { return JSON.parse(localStorage.getItem(k)) || leer; } catch (e) { return leer; } };
const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// { angebot, thema, wunsch }: was ich anbiete, worüber ich diesmal spreche, wen oder was ich suche
export function pitchAngaben() {
  const a = lies(K, {});
  return { angebot: String(a.angebot || ''), thema: String(a.thema || ''), wunsch: String(a.wunsch || '') };
}
export function merkePitch(feld, text) {
  if (!LAENGE[feld]) return;
  const a = pitchAngaben();
  a[feld] = String(text || '').trim().replace(/\s+/g, ' ').slice(0, LAENGE[feld]);
  schreib(K, a);
}

// Zieht einen Kniff ohne Wiederholung, bis die Liste durch ist, und würfelt dazu die Tonart.
export function zieheKniff() {
  const alle = liste().kniff;
  let weg = lies(K_WEG, []).filter((t) => alle.includes(t));
  if (weg.length >= alle.length) weg = [];
  const frei = alle.filter((t) => !weg.includes(t));
  const text = frei[Math.floor(Math.random() * frei.length)];
  weg.push(text); schreib(K_WEG, weg);
  return { text, tonart: TONARTEN[Math.floor(Math.random() * TONARTEN.length)] };
}
