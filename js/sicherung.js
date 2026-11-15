// Export für Klara (eine Übung als Markdown-Datei) und Sicherung des Verlaufs (alles außer den Aufnahmen als Datei).
import { paketText } from './auswertung.js?v=2100';
import { alleUebungen, uebungLaden, uebungSpeichern } from './db.js?v=2100';
import { entwirren } from './auto.js?v=2100';

// Datei über das Teilen-Menü abgeben (AirDrop, Dateien). Geht das nicht, als Download.
// Muss direkt im Antippen laufen, die Datei also vorher fertig sein.
export function dateiAbgeben(name, text, art) {
  for (const typ of [art, 'text/plain']) {
    const datei = new File([text], name, { type: typ });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [datei] })) {
      return navigator.share({ files: [datei] }).then(() => 'geteilt', (e) => { if (e.name === 'AbortError') return 'abgebrochen'; throw e; });
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: art }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return Promise.resolve('geladen');
}

// ---------- Export für Klara ----------
const sauber = (t) => String(t || '').normalize('NFC').replace(/[\/\\:*?"<>|„“”‚‘’.,!]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'Uebung';
export function klaraDatei(u) {
  const d = new Date(u.datum);
  const tag = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const z = ['# Rhetorik-Übung vom ' + d.toLocaleDateString('de-DE') + ': ' + u.aufgabe, ''];
  if (u.ergebnis) {
    z.push('**Note:** ' + u.ergebnis.note);
    if (u.ergebnis.aufgabe) z.push('**Aufgabe für morgen:** ' + entwirren(u.ergebnis.aufgabe));
    z.push('');
  }
  z.push('## Auswertungspaket', '', '```', paketText(u, { ohneWunsch: true }), '```', '');
  z.push('## Feedback des Coachs', '', u.feedback ? entwirren(u.feedback).replace(/^\s*`?RT1\|[^\n]*$/gm, '').trim() : '_Noch kein Feedback gespeichert._', '');
  return { name: tag + '_' + sauber(u.aufgabe) + '.md', text: z.join('\n') };
}

// ---------- Sicherung des Verlaufs ----------
// Diese Einträge aus dem Speicher des Browsers wandern mit. Der Schlüssel der Anthropic-Schnittstelle bleibt bewusst draußen.
const MIT = ['rt.einstellungen', 'rt.begriffe.eigene', 'rt.impulse.eigene', 'rt.einwand.eigene', 'rt.begriffe.verbraucht', 'rt.impulse.verbraucht', 'rt.api.coach', 'rt.api.modell'];
const LISTEN = ['rt.begriffe.eigene', 'rt.impulse.eigene', 'rt.einwand.eigene'];

export async function sicherungBauen() {
  const uebungen = (await alleUebungen()).filter((u) => u.status === 'fertig');
  const speicher = {};
  for (const k of MIT) { const v = localStorage.getItem(k); if (v != null) speicher[k] = v; }
  const d = new Date();
  const tag = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return { name: 'Rhetorik-Trainer_Sicherung_' + tag + '.json', anzahl: uebungen.length,
    text: JSON.stringify({ art: 'rhetorik-trainer-sicherung', fassung: 1, datum: d.toISOString(), uebungen, speicher }) };
}

// Prüft die Datei. Liefert { datum, anzahl, daten } oder wirft einen Fehler mit verständlichem Text.
export function sicherungPruefen(text) {
  let daten;
  try { daten = JSON.parse(text); } catch (e) { throw new Error('Das ist keine Sicherung des Rhetorik-Trainers.'); }
  if (!daten || daten.art !== 'rhetorik-trainer-sicherung' || !Array.isArray(daten.uebungen)) throw new Error('Das ist keine Sicherung des Rhetorik-Trainers.');
  return { datum: daten.datum, anzahl: daten.uebungen.length, daten };
}

// Liest ein: Übungen, die es schon gibt, bleiben unangetastet. Eigene Listen werden zusammengeführt.
export async function sicherungEinlesen(daten, mitEinstellungen) {
  let neu = 0, schon = 0;
  for (const u of daten.uebungen) {
    if (!u || typeof u.id !== 'string' || !u.datum || !u.aufgabe) continue;
    if (await uebungLaden(u.id)) { schon++; continue; }
    // Aufnahme und Einzelbilder stecken nicht in der Sicherung
    await uebungSpeichern({ ...u, groesse: 0, stuecke: 0, bilder: [], tonspur: false, ohneAufnahme: true });
    neu++;
  }
  const sp = daten.speicher || {};
  for (const k of LISTEN) {
    if (typeof sp[k] !== 'string') continue;
    try {
      const alt = JSON.parse(localStorage.getItem(k) || '[]'), dazu = JSON.parse(sp[k]);
      if (!Array.isArray(dazu)) continue;
      for (const t of dazu) if (typeof t === 'string' && !alt.some((x) => x.toLowerCase() === t.toLowerCase())) alt.push(t);
      localStorage.setItem(k, JSON.stringify(alt));
    } catch (e) {}
  }
  if (mitEinstellungen) for (const k of MIT) if (!LISTEN.includes(k) && typeof sp[k] === 'string') { try { localStorage.setItem(k, sp[k]); } catch (e) {} }
  return { neu, schon };
}
