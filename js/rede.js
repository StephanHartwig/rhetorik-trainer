// Ablauf einer Übung mit Aufnahme (Stegreifrede, Schlagfertigkeit, Einwand):
// Einrichten → Aufgabe (+ Vorbereitung) → Aufnahme mit Timer → Ergebnis
import { h, fuelle, kopf, chips, gruppe, geheZu, REDEZEITEN, mb } from './ui.js?v=2001';
import { fmtZeit, signalFuer, tagSchluessel } from './store.js?v=2001';
import { ziehe } from './begriffe.js?v=2001';
import { zieheImpuls, zieheEinwand } from './impulse.js?v=2001';
import { uebungSpeichern, uebungLoeschen, speicherStand } from './db.js?v=2001';
import * as G from './geraet.js?v=2001';

const STILLE_SEK = 6;       // so lange Schweigen, dann Nachfrage (nur Ganzkörper)
const FRAGE_SEK = 5;        // so lange läuft die Nachfrage
const UEBERZUG_MAX = 600;   // spätestens 10 Minuten nach dem Soll endet die Aufnahme von selbst

const ART = {
  rede: { titel: 'Stegreifrede', knopf: 'Begriff zeigen', satz: 'Der Begriff erscheint sofort. Kein Tauschen, kein Überspringen.' },
  schlag: { titel: 'Schlagfertigkeit', knopf: 'Aussage zeigen', satz: 'Jemand sagt etwas Kritisches, Komisches oder Dummes zu dir. Die Aussage erscheint sofort, die Aufnahme läuft ohne Vorbereitung los. Reagiere direkt.' },
  einwand: { titel: 'Einwand', knopf: 'Einwand zeigen', satz: 'Der Einwand erscheint sofort, die Aufnahme läuft ohne Vorbereitung los. Antworte mit einem bildhaften Vergleich.' },
};

// opt.modus: 'rede' | 'schlag' | 'einwand'
// opt.heute: { nr, aufgabe(), fertig(meta) } für das Tagesprogramm – dort bleibt verdeckt, welche Übung kommt.
export function redeAblauf(app, E, merke, opt = {}) {
  const modus = opt.modus || 'rede', art = ART[modus], heute = opt.heute || null;
  const sollZeit = () => (modus === 'rede' ? E.redezeit : modus === 'schlag' ? E.antwortSchlag : E.antwortEinwand);
  const vorZeit = modus === 'rede' ? E.vorbereitung : 0;
  let aktiv = true, takt = null, aufnahme = null, messer = null, strom = null, pose = null, meta = null, ton = null;
  const video = h('video', { class: 'vorschau', playsinline: true, autoplay: true });
  video.muted = true;

  function aufraeumen() {
    aktiv = false; clearInterval(takt);
    if (aufnahme) aufnahme.stopp();
    if (ton) { ton.stopp(); ton = null; }
    if (messer) messer.stopp();
    G.kameraAus(); G.wachAus(); G.erkennungSchliessen();
    document.body.classList.remove('buehne');
  }

  // ---------- Schritt 1 und 2: Ausschnitt, Redezeit, Kamerabild ----------
  function einrichten() {
    const meldung = h('div', { class: 'hinweis fehler' });
    const platz = h('div', { class: 'hinweis' });
    const zeit = h('span', { class: 'wert' }, fmtZeit(sollZeit()));
    const zeitHinweis = h('div', { class: 'hinweis' });
    const ausHinweis = h('div', { class: 'hinweis' });
    const knopf = h('button', { class: 'gross', disabled: true, onclick: begriffZeigen }, heute ? 'Aufgabe ' + heute.nr + ' zeigen' : art.knopf);
    let kameraBereit = false, platzReicht = true;
    const knopfStand = () => { knopf.disabled = !(kameraBereit && platzReicht); };

    async function hinweise() {
      const soll = sollZeit();
      zeit.textContent = fmtZeit(soll);
      const teile = [];
      if (soll > 1200) teile.push('Über 20 Minuten wird nur der Ton aufgenommen, kein Video.');
      const s = signalFuer(E, soll);
      teile.push(s && s < soll ? 'Signalton ' + s + ' Sekunden vor Schluss.' : 'Kein Signalton.');
      if (modus !== 'rede') teile.push('Die Antwortzeit änderst du im Zahnrad.');
      zeitHinweis.textContent = teile.join(' ');
      ausHinweis.textContent = E.ausschnitt === 'ganz'
        ? '2 bis 3 Meter Abstand, ganzer Körper im Bild. Beenden aus der Entfernung: beide Hände über den Kopf heben oder ' + STILLE_SEK + ' Sekunden schweigen.'
        : 'Gesicht und Schultern im Bild. Beenden mit „Fertig“.';
      const st = await speicherStand();
      if (!st) return;
      const laengste = heute ? Math.max(E.redezeit, E.antwortSchlag) : soll;
      const bedarf = laengste * (laengste > 1200 ? 12000 : 200000) * 1.5;
      platzReicht = st.frei > bedarf;
      platz.className = 'hinweis' + (platzReicht ? '' : ' fehler');
      platz.textContent = !platzReicht ? 'Zu wenig Speicher für diese Aufnahme (frei: ' + mb(st.frei) + '). Bitte im Verlauf alte Aufnahmen löschen.'
        : st.frei < Math.max(bedarf * 3, 5e8) ? 'Der Speicher wird knapp (frei: ' + mb(st.frei) + '). Bitte bald alte Aufnahmen im Verlauf löschen.' : '';
      knopfStand();
    }
    const ausChips = chips([['nah', 'Nah (Gesicht)'], ['ganz', 'Ganzkörper']], E.ausschnitt, (v) => { merke('ausschnitt', v); hinweise(); });
    const zeitChips = chips(REDEZEITEN, E.redezeit, (v) => { merke('redezeit', v); hinweise(); });

    fuelle(app, 
      kopf(heute ? 'Heute üben' : art.titel),
      heute ? h('div', { class: 'begriffTitel' }, 'Aufgabe ' + heute.nr + ' von 2') : null,
      heute && heute.nr === 2 ? h('p', {}, 'Aufgabe 1 ist geschafft. Die Auswertung machst du nach beiden Aufgaben.') : null,
      video, meldung,
      gruppe('Bildausschnitt', null, ausChips.el, ausHinweis),
      heute ? null : modus === 'rede'
        ? gruppe('Redezeit', zeit, h('div', { class: 'hinweis' }, 'Minuten'), zeitChips.el, zeitHinweis)
        : gruppe('Antwortzeit', zeit, zeitHinweis),
      platz,
      h('p', { class: 'warn' }, 'Stromsparmodus aus? Das Batterie-Symbol darf nicht gelb sein.'),
      h('p', { class: 'grau' }, heute ? 'Was kommt, siehst du erst nach dem Antippen. Kein Tauschen, kein Überspringen.' : art.satz),
      h('div', { class: 'fest' }, knopf));
    hinweise();
    G.kameraAn().then((s) => {
      if (!aktiv) { G.kameraAus(); return; }
      strom = s; video.srcObject = s; video.play().catch(() => {});
      kameraBereit = true; knopfStand();
    }).catch((e) => { meldung.textContent = G.kameraFehlerText(e); });
  }

  // ---------- Bühne: Vorbereitung und Aufnahme ----------
  function begriffZeigen() {
    G.tonAn(); G.wachAn();                       // beides muss direkt im Antippen starten
    const ganz = E.ausschnitt === 'ganz';
    const soll = sollZeit(), nurTon = soll > 1200;
    const b = heute ? heute.aufgabe() : modus === 'rede' ? ziehe(E.fachAnteil) : modus === 'schlag' ? zieheImpuls() : zieheEinwand();
    if (ganz) G.poseLaden().then((p) => { pose = p; }).catch(() => { handInfo.textContent = 'Handzeichen nicht verfügbar. Beenden durch Schweigen oder Antippen.'; });
    try { messer = G.pegelMesser(strom); } catch (e) { messer = null; }
    G.pcmVorbereiten().catch(() => {});       // Mitschnitt der Tonspur schon jetzt laden

    const status = h('div', { class: 'status' }, vorZeit ? 'Vorbereitung' : '');
    const uhr = h('div', { class: 'uhr' });
    const begriff = h('div', { class: 'begriff', lang: 'de' });
    const frageBox = h('div', { class: 'frage', hidden: true });
    const handInfo = h('div', { class: 'grau' }, ganz ? 'Beenden: beide Hände über den Kopf oder ' + STILLE_SEK + ' Sekunden schweigen' : '');
    const fertigKnopf = h('button', { class: 'gross fertig', hidden: true, onclick: () => beenden('tippen') }, 'Fertig');
    const abbruch = h('button', { class: 'breit leise', onclick: abbrechen }, 'Abbrechen');
    const leinwand = document.createElement('canvas');
    video.classList.add('versteckt');
    document.body.classList.add('buehne');
    fuelle(app, h('div', { class: 'buehne-innen' + (ganz ? ' ganz' : '') }, status, uhr, begriff, frageBox, h('div', { class: 'unten' }, handInfo, fertigKnopf, abbruch)), video);

    const passe = (max) => {
      const laenge = Math.min(14, Math.max(...b.text.split(/[\s-]+/).map((w) => w.length)));
      // Ganze Sätze (Angriffe, Einwände) brauchen mehr Zeilen: Schrift so wählen, dass der Text auf die Bühne passt.
      const flaeche = 0.8 * Math.sqrt(100 * (ganz ? 80 : 70) / (0.6 * b.text.length));
      begriff.style.fontSize = Math.min(max, 125 / laenge, flaeche) + 'vw';
      begriff.textContent = b.text;
    };
    const zeigeUhr = (text) => { uhr.textContent = text; uhr.dataset.laenge = String(text.length); };

    // Vorbereitung: Zeit läuft rückwärts, dabei wird die Raumlautstärke eingemessen
    passe(20);
    const proben = [];
    let t0 = performance.now(), phase = 'vor', gesignalt = false, beendet = false;
    let eingemessen = false, schwelle = 0.008, boden = null, pegelMax = 0, letzteStimme = 0, frage = null, hand = 0, handStart = 0, handTick = 0;

    async function starte() {
      phase = 'rede';
      if (proben.length >= 5) { proben.sort((a, c) => a - c); boden = proben[Math.floor(proben.length * 0.2)]; schwelle = Math.min(0.02, Math.max(0.004, boden * 3)); eingemessen = true; }
      proben.length = 0;
      const jetzt = new Date();
      meta = { id: String(jetzt.getTime()), datum: jetzt.toISOString(), tag: tagSchluessel(jetzt), modus, aufgabe: b.text, kategorie: b.kategorie || '', art: b.art || '',
               aufbau: modus === 'rede' ? E.aufbau : '', heute: heute ? heute.nr : 0, ausschnitt: E.ausschnitt, soll, ist: 0, typ: nurTon ? 'ton' : 'video', status: 'läuft', groesse: 0 };
      uebungSpeichern(meta).catch(() => {});
      try { aufnahme = G.aufnahmeStarten(strom, meta.id, nurTon); }
      catch (e) { status.textContent = 'Die Aufnahme lässt sich nicht starten.'; clearInterval(takt); return; }
      G.signal(1, 660);
      t0 = performance.now();
      G.pcmStarten(strom, meta.id).then((p) => { if (beendet) p.stopp(); else { ton = p; meta.tonVersatz = Math.round((p.beginn - t0) / 100) / 10; } }).catch(() => {});
      status.textContent = nurTon ? '● Tonaufnahme' : '● Aufnahme';
      status.classList.add('laeuft');
      passe(ganz ? 13 : 9);
      begriff.classList.add('klein');
      fertigKnopf.hidden = false;
    }

    async function beenden(art, istZeit) {
      if (beendet || phase !== 'rede') return;
      beendet = true; clearInterval(takt);
      const el = (performance.now() - t0) / 1000;
      if (art !== 'tippen') G.signal(3, 660);
      status.textContent = 'Speichere …'; fertigKnopf.hidden = true; abbruch.hidden = true; frageBox.hidden = true;
      const r = await aufnahme.stopp();
      aufnahme = null;
      if (ton) { await ton.stopp(); ton = null; meta.tonspur = true; }
      Object.assign(meta, {
        ist: Math.round(Math.max(1, istZeit == null ? el : istZeit) * 10) / 10, dauerAufnahme: Math.round(el), status: 'fertig', beendetDurch: art,
        mime: r.mime, groesse: r.groesse, stuecke: r.stuecke, fehler: r.fehler ? String(r.fehler.message || r.fehler) : '',
        diag: { boden, schwelle, pegelMax: Math.round(pegelMax * 1e4) / 1e4 },
      });
      try { await uebungSpeichern(meta); } catch (e) {}
      if (heute) heute.fertig(meta); else geheZu('#/uebung/' + meta.id);
    }

    async function abbrechen() {
      if (phase === 'rede' && !confirm('Übung abbrechen? Die Aufnahme wird gelöscht.')) return;
      beendet = true; clearInterval(takt);
      if (aufnahme) { await aufnahme.stopp(); aufnahme = null; }
      if (ton) { await ton.stopp(); ton = null; }
      if (meta) { try { await uebungLoeschen(meta.id); } catch (e) {} }
      geheZu('#/');
    }

    takt = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      const p = messer ? messer.lies() : null;
      if (phase === 'vor') {
        if (p != null) proben.push(p);
        const rest = vorZeit - el;
        zeigeUhr(String(Math.max(0, Math.ceil(rest))));
        if (rest <= 0) starte();
        return;
      }
      // Uhr
      const rest = soll - el;
      zeigeUhr(rest >= 0 ? fmtZeit(Math.ceil(rest)) : '+' + fmtZeit(-rest));
      uhr.classList.toggle('ueber', rest < 0);
      const sig = signalFuer(E, soll);
      if (sig && sig < soll && !gesignalt && rest <= sig) { gesignalt = true; G.signal(2); }
      if (el >= soll + UEBERZUG_MAX) { beenden('automatisch'); return; }
      if (aufnahme && aufnahme.fehler) status.textContent = 'Achtung: Fehler beim Speichern der Aufnahme';
      // Stimme
      if (p != null) {
        pegelMax = Math.max(pegelMax, p);
        // Ohne Vorbereitungszeit misst sich die Schwelle während des Sprechens ein: Die leisesten Augenblicke sind der Raum.
        if (!eingemessen && proben.length < 3000) {
          proben.push(p);
          if (proben.length >= 30 && proben.length % 10 === 0) {
            const sortiert = proben.slice().sort((a, c) => a - c);
            boden = sortiert[Math.floor(sortiert.length * 0.1)]; schwelle = Math.min(0.02, Math.max(0.004, boden * 3));
          }
        }
        if (p > schwelle) letzteStimme = el;
      }
      if (!ganz) return;
      // Schweigen mit Nachfrage
      if (!frage && el > 8 && el - letzteStimme >= STILLE_SEK) { frage = el; G.signal(1, 520); frageBox.hidden = false; }
      if (frage) {
        if (letzteStimme > frage) { frage = null; frageBox.hidden = true; }
        else {
          const c = FRAGE_SEK - (el - frage);
          frageBox.textContent = 'Fertig? ' + Math.max(0, Math.ceil(c));
          if (c <= 0) { beenden('schweigen', letzteStimme); return; }
        }
      }
      // Handzeichen, etwa viermal je Sekunde
      if (pose && ++handTick % 3 === 0) {
        let oben = null;
        try { oben = G.haendeOben(pose, video, leinwand); } catch (e) {}
        if (oben) { if (++hand === 1) handStart = el; } else hand = 0;
        handInfo.textContent = hand >= 2 ? '✋ Handzeichen erkannt …' : 'Beenden: beide Hände über den Kopf oder ' + STILLE_SEK + ' Sekunden schweigen';
        if (hand >= 5) beenden('handzeichen', handStart);
      }
    }, 100);
  }

  einrichten();
  return aufraeumen;
}
