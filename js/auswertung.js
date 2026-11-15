// Auswertungspaket für den Coach bauen, Ergebniscode (RT1|…) lesen, Serie der Übungstage zählen.
import { fmtZeit, tagSchluessel } from './store.js?v=14';

const MODUS = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit', einwand: 'Einwand' };
const komma = (x) => String(x).replace('.', ',');
const vz = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x);

// ---------- Auswertungspaket (Format: COACH_Projektanweisung, Abschnitt 2) ----------
export function paketText(u) {
  const z = [];
  const d = Math.round(u.ist - u.soll), p = Math.round((u.ist - u.soll) / u.soll * 100);
  z.push('RHETORIK-TRAINER · AUSWERTUNGSPAKET');
  z.push('Modus: ' + (MODUS[u.modus] || u.modus) + (u.art ? ' (' + u.art + ')' : ''));
  z.push('Aufgabe: ' + u.aufgabe);
  if (u.modus === 'rede') z.push('Aufbau: ' + u.aufbau);
  z.push('Bildausschnitt: ' + (u.typ === 'ton' ? 'nur Ton' : u.ausschnitt === 'ganz' ? 'Ganzkörper' : 'nah'));
  z.push('Zeit: Soll ' + fmtZeit(u.soll) + ' · Ist ' + fmtZeit(u.ist) + ' · Abweichung ' + vz(d) + ' s (' + vz(p) + ' %)');

  const m = u.messung;
  if (u.transkript && u.transkript.length) {
    z.push('', 'TRANSKRIPT (automatisch erstellt, Hörfehler möglich)');
    for (const t of u.transkript) z.push('[' + fmtZeit(t.t) + '] ' + t.text);
  }
  if (m) {
    const s = m.stimme, sp = m.sprache;
    z.push('', 'STIMME (Schätzungen des Geräts)');
    z.push('Tempo: ' + sp.tempo + ' Wörter je Minute (' + sp.woerter + ' Wörter)');
    const satz = [];
    if (sp.satzlaenge != null && !sp.satzUnsicher) satz.push('Satzlänge im Schnitt ' + komma(sp.satzlaenge) + ' Wörter');
    if (sp.woerterJeAbschnitt != null && !s.unsicher) satz.push(komma(sp.woerterJeAbschnitt) + ' Wörter je Sprechabschnitt (zwischen zwei Atempausen)');
    if (satz.length) z.push(satz.join(' · '));
    const fuell = Object.entries(sp.fuellEinzeln).sort((a, b) => b[1] - a[1]).map(([w, n]) => w + ' ' + n).join(', ');
    z.push('Füllwörter: ' + sp.fuellGesamt + ' (' + komma(sp.fuellJeMinute) + ' je Minute)' + (fuell ? ': ' + fuell : '') + '. „äh“ und „ähm“ fehlen im Transkript oft, der Wert ist eher zu niedrig.');
    if (s.keineStimme) z.push('Pausen und Stimme: keine Stimme erkannt.');
    else if (s.unsicher) z.push('Pausen und Lautstärke: unsicher, die Stimme hob sich kaum vom Raumgeräusch ab.');
    else {
      z.push('Pausen ab 0,7 s: ' + s.pausen + ' (davon ab 2 s: ' + s.pausenLang + ') · im Schnitt ' + komma(s.pausenMittel) + ' s · längste ' + komma(s.laengstePause) + ' s' + (s.laengstePause ? ' bei ' + fmtZeit(s.laengstePauseBei) : ''));
      if (s.pausenListe && s.pausenListe.length) z.push('Pausen im Einzelnen: ' + s.pausenListe.slice(0, 40).map((x) => fmtZeit(x.von) + ' (' + komma(x.laenge) + ' s)').join(', '));
      z.push('Sprechanteil ' + s.sprechAnteil + ' % · erste Worte nach ' + komma(s.ersteWorteNach) + ' s');
      if (s.lautSchwankung != null) z.push('Schwankung der Lautstärke: ' + komma(s.lautSchwankung) + ' dB');
    }
    if (!s.keineStimme && s.tonhoehe != null) z.push('Tonhöhe: Mitte ' + s.tonhoehe + ' Hz · Schwankung ' + komma(s.tonSchwankung) + ' Halbtöne');
  }
  const k = u.koerper;
  if (k && !k.fehler) {
    z.push('', 'KÖRPER (Schätzungen des Geräts, etwa alle ' + komma(k.schritt) + ' s ein Bild)');
    if (k.modus === 'ganz') {
      if (!k.standUnsicher) {
        if (k.schwankenSchulter != null) z.push('Stand: Schwanken Schultern ' + k.schwankenSchulter + ' %, Hüfte ' + k.schwankenHuefte + ' % der Schulterbreite · Standortwechsel ' + k.standortwechsel);
        else z.push('Stand: Standortwechsel ' + k.standortwechsel);
        z.push('Hände: beide sichtbar in ' + k.haendeSichtbar + ' % der Zeit' + (k.handBewegung != null ? ' · Handbewegung ' + k.handBewegung + ' (100 = eine Schulterbreite je Sekunde)' : ''));
      }
      if (k.blick != null) z.push('Kopf zur Kamera: ' + k.blick + ' % der Zeit (aus der Kopfhaltung geschätzt)');
    } else {
      if (k.blick != null) z.push('Blick zur Kamera: ' + k.blick + ' % der Zeit');
      if (!k.mimikUnsicher) z.push('Mimik: ' + k.mimikWechsel + ' Wechsel im Gesichtsausdruck (' + komma(k.mimikWechselJeMinute) + ' je Minute) · Lächeln ' + k.laecheln + ' % der Zeit');
    }
    for (const h of k.hinweise || []) z.push('Hinweis: ' + h);
  }
  if (u.bilder && u.bilder.length) {
    z.push('', 'BILDER: ' + u.bilder.length + ' Einzelbilder in dieser Reihenfolge');
    u.bilder.forEach((b, i) => z.push((i + 1) + ' · ' + fmtZeit(b.t) + ' · ' + b.grund));
  }
  return z.join('\n');
}

// ---------- Ergebniscode ----------
// Beispiel: RT1|Note=2-|Einstieg=1|Argumente=0.5|Aufforderung=0|Schluss=1|Bild=0.5|Aufgabe=Vor jedem Argument zwei Sekunden Pause
export function codeLesen(text) {
  const treffer = String(text || '').match(/RT1\|[^\n\r]*/g);
  if (!treffer) return null;
  const zeile = treffer[treffer.length - 1].replace(/[`*]+$/, '').trim();
  const teile = zeile.split('|').slice(1);
  const erg = { punkte: {}, code: zeile };
  for (const t of teile) {
    const i = t.indexOf('=');
    if (i < 0) continue;
    const name = t.slice(0, i).trim(), wert = t.slice(i + 1).trim();
    if (name === 'Note') erg.note = wert.replace(/\s+/g, '').replace('–', '-').replace('−', '-');
    else if (name === 'Aufgabe') erg.aufgabe = wert;
    else if (/^(0|0[.,]5|1)$/.test(wert)) erg.punkte[name] = Number(wert.replace(',', '.'));
  }
  if (!erg.note || noteZahl(erg.note) == null) return null;
  return erg;
}
// "2-" → 2.3, "2+" → 1.7, "2-3" → 2.5, "3" → 3
export function noteZahl(note) {
  const m = String(note || '').match(/^([1-6])(?:([+-])|-([1-6]))?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[3]) return (n + Number(m[3])) / 2;
  return m[2] === '+' ? n - 0.3 : m[2] === '-' ? n + 0.3 : n;
}

// ---------- Tage in Folge und Aufgabe für morgen ----------
export function serie(uebungen, heute = new Date()) {
  const tage = new Set(uebungen.filter((u) => u.status === 'fertig').map((u) => u.tag || tagSchluessel(new Date(u.datum))));
  let d = new Date(heute.getTime()), n = 0;
  if (!tage.has(tagSchluessel(d))) d = new Date(d.getTime() - 86400000);     // heute noch offen: die Serie läuft bis gestern
  while (tage.has(tagSchluessel(d))) { n++; d = new Date(d.getTime() - 86400000); }
  return { tage: n, heute: tage.has(tagSchluessel(heute)) };
}
export function aufgabeFuerMorgen(uebungen) {
  const mit = uebungen.filter((u) => u.ergebnis && u.ergebnis.aufgabe).sort((a, b) => (a.ergebnis.datum < b.ergebnis.datum ? 1 : -1));
  return mit.length ? mit[0].ergebnis.aufgabe : '';
}
