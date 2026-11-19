// Ablauf einer Übung mit Aufnahme (Stegreifrede, Schlagfertigkeit, Einwand, Pitch):
// Einrichten → Aufgabe (+ Vorbereitung) → Aufnahme mit Timer → Ergebnis
import { h, fuelle, kopf, chips, klappe, geheZu, REDEZEITEN, mb } from './ui.js?v=2300';
import { fmtZeit, signalFuer, tagSchluessel } from './store.js?v=2300';
import { ziehe, zieheAus } from './begriffe.js?v=2300';
import { zieheImpuls, zieheEinwand } from './impulse.js?v=2300';
import { uebungSpeichern, uebungLoeschen, speicherStand } from './db.js?v=2300';
import * as G from './geraet.js?v=2300';
import { PITCHZEITEN, pitchAngaben, merkePitch, zieheKniff } from './pitch.js?v=2300';

const STILLE_SEK = 6;       // so lange Schweigen, dann Nachfrage (nur Ganzkörper)
const FRAGE_SEK = 5;        // so lange läuft die Nachfrage
const UEBERZUG_MAX = 600;   // spätestens 10 Minuten nach dem Soll endet die Aufnahme von selbst

const ART = {
  rede: { titel: 'Stegreifrede', tun: 'Halte eine Rede über diesen Begriff.', knopf: 'Begriff zeigen', satz: 'Der Begriff erscheint sofort. Kein Tauschen, kein Überspringen.' },
  schlag: { titel: 'Schlagfertigkeit', tun: 'Reagiere sofort auf diese Aussage.', knopf: 'Aussage zeigen', satz: 'Jemand sagt etwas Kritisches, Komisches oder Dummes zu dir. Die Aussage erscheint sofort, die Aufnahme läuft ohne Vorbereitung los. Reagiere direkt.' },
  einwand: { titel: 'Einwand', tun: 'Antworte mit einem bildhaften Vergleich.', knopf: 'Einwand zeigen', satz: 'Der Einwand erscheint sofort, die Aufnahme läuft ohne Vorbereitung los. Antworte mit einem bildhaften Vergleich.' },
  pitch: { titel: 'Pitch', tun: 'Stell dein Angebot vor. Schließe mit einer klaren Aufforderung.', knopf: 'Pitch starten',
    satz: 'Dein Pitch in genau der gewählten Zeit: auffallen, sagen, was du für wen tust, und mit einer klaren Aufforderung schließen. Am Ende der Zeit ertönen drei Töne, die Uhr wird rot.' },
};

// Die Stegreifrede gibt es in drei Arten: über einen Begriff, als Überzeugungsrede zu einer These, als Geschichte.
const REDEART = {
  begriff: ART.rede,
  these: { titel: 'Überzeugungsrede', tun: 'Überzeuge deine Zuhörer von dieser These.', knopf: 'These zeigen', satz: 'Du bekommst eine These und eine Art des Einstiegs. Aufbau: Einstieg, drei Argumente, was passiert, wenn niemand handelt, Wiederholung, Aufforderung, Schlusspunkt.' },
  geschichte: { titel: 'Geschichte', tun: 'Erzähle dazu ein eigenes Erlebnis.', knopf: 'Thema zeigen', satz: 'Du bekommst einen Anlass und erzählst ein eigenes Erlebnis: mitten in der Szene beginnen, ein Wendepunkt, ein Schlusssatz. Bewährt ist eine Minute; die Zeit wählst du selbst.' },
};

// opt.modus: 'rede' | 'schlag' | 'einwand' | 'pitch'
// opt.redeArt: legt die Art der Rede fest (Tagesprogramm); sonst gilt die Einstellung.
// opt.heute: { nr, aufgabe(), fertig(meta) } für das Tagesprogramm – dort bleibt verdeckt, welche Übung kommt.
export function redeAblauf(app, E, merke, opt = {}) {
  const modus = opt.modus || 'rede', heute = opt.heute || null;
  const redeArt = () => (modus !== 'rede' ? '' : REDEART[opt.redeArt] ? opt.redeArt : E.redeArt);
  const art = () => (modus === 'rede' ? REDEART[redeArt()] : ART[modus]);
  const sollZeit = () => (modus === 'pitch' ? E.pitchzeit : modus !== 'rede' ? (modus === 'schlag' ? E.antwortSchlag : E.antwortEinwand) : E.redezeit);
  const vorZeit = modus === 'rede' || modus === 'pitch' ? E.vorbereitung : 0;
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
    document.removeEventListener('visibilitychange', sichtbar);
    window.removeEventListener('pageshow', sichtbar);
  }

  // ---------- Vor der Aufnahme: Kamerabild und die wenigen Angaben, die es braucht ----------
  let gestartet = false, kameraNeu = null, beiSichtbar = null;
  function einrichten(hinweisText) {
    gestartet = false;
    const meldung = h('div', { class: 'hinweis fehler' }, hinweisText || '');
    const kameraStand = h('div', { class: 'hinweis' });
    const neuKnopf = h('button', { class: 'breit', hidden: true, onclick: () => kameraStart(true) }, 'Kamera neu starten');
    const platz = h('div', { class: 'hinweis' });
    const zeitHinweis = h('div', { class: 'hinweis' });
    const ausHinweis = h('div', { class: 'hinweis' });
    const knopf = h('button', { class: 'gross', disabled: true, onclick: begriffZeigen }, heute ? 'Aufgabe ' + heute.nr + ' zeigen' : art().knopf);
    let kameraBereit = false, platzReicht = true, kameraLauf = 0, waechter = null, selbstNeu = 0;
    const knopfStand = () => { knopf.disabled = !(kameraBereit && platzReicht); };

    // Kamera starten. Fällt sie aus (andere App, Anruf, Bildschirmsperre), startet sie von selbst neu, höchstens dreimal.
    async function kameraStart(neu, text) {
      const lauf = ++kameraLauf;
      kameraBereit = false; knopfStand();
      neuKnopf.hidden = true; kameraStand.textContent = 'Kamera startet …';
      if (text !== undefined) meldung.textContent = text;
      clearTimeout(waechter);
      waechter = setTimeout(() => { if (aktiv && lauf === kameraLauf && !kameraBereit) { kameraStand.textContent = 'Die Kamera antwortet nicht.'; neuKnopf.hidden = false; } }, 8000);
      try {
        if (neu) G.kameraAus();
        const s = await G.kameraAn();
        if (!aktiv) { G.kameraAus(); return; }
        if (lauf !== kameraLauf) return;
        strom = s; video.srcObject = s; video.play().catch(() => {});
        s.getTracks().forEach((t) => t.addEventListener('ended', () => {
          if (!aktiv || strom !== s || gestartet) return;            // auf der Bühne kümmert sich der Takt darum
          if (++selbstNeu <= 3) kameraStart(true, 'Die Kamera war unterbrochen und wurde neu gestartet.');
          else { kameraBereit = false; knopfStand(); meldung.textContent = 'Die Kamera fällt immer wieder aus.'; neuKnopf.hidden = false; }
        }));
        kameraBereit = true; kameraStand.textContent = ''; clearTimeout(waechter);
      } catch (e) {
        if (!aktiv || lauf !== kameraLauf) return;
        clearTimeout(waechter);
        kameraStand.textContent = ''; meldung.textContent = G.kameraFehlerText(e); neuKnopf.hidden = false;
      }
      knopfStand();
    }
    kameraNeu = (text) => kameraStart(true, text);
    // Zurück aus einer anderen App: prüfen, ob die Kamera noch Bild und Ton liefert.
    beiSichtbar = () => {
      if (!aktiv || gestartet || document.visibilityState !== 'visible') return;
      if (kameraBereit && !G.stromLebt(strom)) { kameraStart(true, ''); return; }
      if (!kameraBereit) return;
      video.play().catch(() => {});
      // Bleibt das Bild nach der Rückkehr schwarz, die Kamera neu starten.
      const s = strom;
      setTimeout(() => { if (aktiv && !gestartet && strom === s && G.bildFehlt(s)) kameraStart(true, ''); }, 1500);
    };

    async function hinweise() {
      const soll = sollZeit();
      zeitHinweis.textContent = soll > 1200 ? 'Über 20 Minuten wird nur der Ton aufgenommen, kein Video.' : '';
      ausHinweis.textContent = E.ausschnitt === 'ganz'
        ? '2 bis 3 Meter Abstand, ganzer Körper im Bild. Beenden aus der Entfernung: beide Hände über den Kopf heben oder ' + STILLE_SEK + ' Sekunden schweigen.' : '';
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
    // Redezeit als Auswahlliste. Eine eigene Zeit aus den Einstellungen steht mit in der Liste.
    const zeitName = (v) => (v < 60 ? v + ' Sekunden' : v % 60 ? fmtZeit(v) + ' Minuten' : v / 60 + (v === 60 ? ' Minute' : ' Minuten'));
    const zeiten = REDEZEITEN.map(([v]) => v);
    if (!zeiten.includes(E.redezeit)) { zeiten.push(E.redezeit); zeiten.sort((x, y) => x - y); }
    const zeitWahl = h('select', { class: 'auswahl', 'aria-label': 'Redezeit', onchange: () => { merke('redezeit', Number(zeitWahl.value)); hinweise(); } },
      zeiten.map((v) => h('option', { value: String(v) }, zeitName(v))));
    zeitWahl.value = String(E.redezeit);
    // Art der Rede: wechselt Knopf und Erklärung
    const satz = h('p', { class: 'grau' });
    const artStand = () => {
      if (heute) { satz.textContent = 'Was kommt, siehst du erst nach dem Antippen. Kein Tauschen, kein Überspringen.'; return; }
      knopf.textContent = modus === 'pitch' && E.pitchVorgabe === 'kniff' ? 'Kniff zeigen' : art().knopf; satz.textContent = art().satz;
    };
    const artChips = chips([['begriff', 'Begriff'], ['these', 'Überzeugung'], ['geschichte', 'Geschichte']], E.redeArt, (v) => { merke('redeArt', v); artStand(); hinweise(); });
    const wahl = (name, ...inhalt) => h('div', { class: 'wahlReihe' }, h('span', { class: 'name' }, name), inhalt);
    // Pitch: Dauer, Vorgabe und die eigenen Angaben. Jeder pitcht sein eigenes Angebot; der Coach bekommt die Angaben mit.
    let pitchTeil = null;
    if (modus === 'pitch') {
      const P = pitchAngaben();
      const vorgabeHinweis = h('div', { class: 'hinweis' });
      const vorgabeStand = () => { vorgabeHinweis.textContent = E.pitchVorgabe === 'kniff' ? 'Du bekommst einen Kniff und eine Tonart, mit denen dein Pitch auffällt.' : 'Du pitchst ohne Vorgabe, so wie du es vorbereitet hast.'; };
      const dauer = chips(PITCHZEITEN, E.pitchzeit, (v) => { merke('pitchzeit', v); hinweise(); });
      const vorgabe = chips([['kniff', 'Kniff ziehen'], ['frei', 'Ohne Vorgabe']], E.pitchVorgabe, (v) => { merke('pitchVorgabe', v); vorgabeStand(); artStand(); });
      const stand = h('span', { class: 'wert' });
      const standText = () => { const a = pitchAngaben(); stand.textContent = a.angebot ? 'eingetragen ✓' : 'fehlt'; };
      const feld = (name, schluessel, platz, zeilen) => {
        const el = h(zeilen ? 'textarea' : 'input', { class: zeilen ? 'einfuegen' : 'text', placeholder: platz, maxlength: schluessel === 'angebot' ? 300 : 160, 'aria-label': name, ...(zeilen ? { rows: zeilen } : { type: 'text', enterkeyhint: 'done' }) });
        el.value = P[schluessel];
        el.addEventListener('input', () => { merkePitch(schluessel, el.value); standText(); });
        return [h('div', { class: 'hinweis' }, name), el];
      };
      vorgabeStand(); standText();
      pitchTeil = [
        wahl('Dauer', dauer.el),
        wahl('Vorgabe', vorgabe.el, vorgabeHinweis),
        klappe('pitch.ich', 'Mein Angebot', stand,
          feld('Was bietest du an, und für wen?', 'angebot', 'in einem Satz', 3),
          feld('Worüber sprichst du diesmal? (wenn du magst)', 'thema', 'das Thema dieser Woche'),
          feld('Wen oder was suchst du? (wenn du magst)', 'wunsch', 'die Empfehlung, die du dir wünschst'),
          h('div', { class: 'hinweis' }, 'Die Angaben bleiben auf diesem Gerät. Dein Coach bekommt sie mit dem Paket und bewertet deinen Pitch danach.'))];
    }

    fuelle(app,
      kopf(heute ? 'Heute üben' : ART[modus].titel),
      heute ? h('div', { class: 'begriffTitel' }, 'Aufgabe ' + heute.nr + ' von 2') : null,
      heute && heute.nr === 2 ? h('p', {}, 'Aufgabe 1 ist geschafft. Die Auswertung machst du nach beiden Aufgaben.') : null,
      video, kameraStand, meldung, neuKnopf,
      h('div', { class: 'stapel' },
        heute || modus !== 'rede' ? null : wahl('Art der Rede', artChips.el),
        pitchTeil,
        heute || modus === 'pitch' ? null : modus === 'rede' ? wahl('Redezeit', zeitWahl, zeitHinweis)
          : wahl('Antwortzeit', h('div', { class: 'festWert' }, fmtZeit(sollZeit()), h('span', { class: 'grau' }, ' · ändern im Zahnrad auf dem Startbildschirm'))),
        wahl('Bildausschnitt', ausChips.el, ausHinweis)),
      platz,
      satz,
      h('p', { class: 'warn' }, 'Stromsparmodus aus? Das Batterie-Symbol darf nicht gelb sein.'),
      h('div', { class: 'fest' }, knopf));
    artStand(); hinweise();
    kameraStart(false);
  }
  const sichtbar = () => { if (beiSichtbar) beiSichtbar(); };
  document.addEventListener('visibilitychange', sichtbar);
  window.addEventListener('pageshow', sichtbar);

  // ---------- Bühne: Vorbereitung und Aufnahme ----------
  function begriffZeigen() {
    if (gestartet) return;                       // doppeltes Antippen
    // Liefert die Kamera nichts mehr, gäbe es eine Aufnahme ohne Bild und eine stehende Uhr: erst neu starten.
    if (!G.stromLebt(strom) || G.bildFehlt(strom)) { if (kameraNeu) kameraNeu('Die Kamera war unterbrochen und startet neu. Danach bitte noch einmal antippen.'); return; }
    gestartet = true;
    G.tonAn(); G.wachAn();                       // beides muss direkt im Antippen starten
    const ganz = E.ausschnitt === 'ganz';
    const soll = sollZeit(), nurTon = soll > 1200;
    const pitch = modus === 'pitch' ? pitchAngaben() : null;
    const kniff = pitch && E.pitchVorgabe === 'kniff' ? zieheKniff() : null;
    const b = pitch ? { text: kniff ? kniff.text : pitch.thema || 'Dein Pitch', zusatz: kniff ? 'Tonart: ' + kniff.tonart : '' } : heute ? heute.aufgabe() : modus === 'rede' ? (redeArt() === 'begriff' ? ziehe(E.fachAnteil) : zieheAus(redeArt())) : modus === 'schlag' ? zieheImpuls() : zieheEinwand();
    if (ganz) G.poseLaden().then((p) => { pose = p; }).catch(() => { handInfo.textContent = 'Handzeichen nicht verfügbar. Beenden durch Schweigen oder Antippen.'; });
    try { messer = G.pegelMesser(strom); } catch (e) { messer = null; }
    G.pcmVorbereiten().catch(() => {});       // Mitschnitt der Tonspur schon jetzt laden

    const status = h('div', { class: 'status' }, vorZeit ? 'Vorbereitung' : '');
    // Was ist das für eine Übung, und was ist zu tun? Wichtig vor allem im Tagesprogramm, wo es vorher verdeckt ist.
    const artZeile = h('div', { class: 'artZeile' }, h('b', {}, art().titel), art().tun, b.einstieg ? h('span', { class: 'einstieg' }, 'Beginne mit: ' + b.einstieg) : null, b.zusatz ? h('span', { class: 'einstieg' }, b.zusatz) : null);
    const uhr = h('div', { class: 'uhr' });
    const begriff = h('div', { class: 'begriff', lang: 'de' });
    const frageBox = h('div', { class: 'frage', hidden: true });
    const handInfo = h('div', { class: 'grau' }, ganz ? 'Beenden: beide Hände über den Kopf oder ' + STILLE_SEK + ' Sekunden schweigen' : '');
    const fertigKnopf = h('button', { class: 'gross fertig', hidden: true, onclick: () => beenden('tippen') }, 'Fertig');
    const abbruch = h('button', { class: 'breit leise', onclick: abbrechen }, 'Abbrechen');
    const leinwand = document.createElement('canvas');
    video.classList.add('versteckt');
    document.body.classList.add('buehne');
    fuelle(app, h('div', { class: 'buehne-innen' + (ganz ? ' ganz' : '') }, status, artZeile, uhr, begriff, frageBox, h('div', { class: 'unten' }, handInfo, fertigKnopf, abbruch)), video);

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
    let t0 = performance.now(), phase = 'vor', gesignalt = false, zeitUm = false, beendet = false;
    let eingemessen = false, schwelle = 0.008, boden = null, pegelMax = 0, letzteStimme = 0, frage = null, hand = 0, handStart = 0, handTick = 0;

    // Geht vor oder beim Start der Aufnahme etwas schief, zurück zur Seite davor – mit Erklärung statt stehender Uhr.
    async function zurueck(text) {
      beendet = true; clearInterval(takt);
      if (aufnahme) { try { await aufnahme.stopp(); } catch (e) {} aufnahme = null; }
      if (ton) { try { await ton.stopp(); } catch (e) {} ton = null; }
      if (messer) { messer.stopp(); messer = null; }
      if (meta) { try { await uebungLoeschen(meta.id); } catch (e) {} meta = null; }
      if (!aktiv) return;
      G.wachAus();
      document.body.classList.remove('buehne'); video.classList.remove('versteckt');
      einrichten(text);
    }

    async function starte() {
      phase = 'rede';
      if (proben.length >= 5) { proben.sort((a, c) => a - c); boden = proben[Math.floor(proben.length * 0.2)]; schwelle = Math.min(0.02, Math.max(0.004, boden * 3)); eingemessen = true; }
      proben.length = 0;
      const jetzt = new Date();
      meta = { id: String(jetzt.getTime()), datum: jetzt.toISOString(), tag: tagSchluessel(jetzt), modus, aufgabe: pitch ? (pitch.thema || pitch.angebot || 'Pitch').slice(0, 80) : b.text, kategorie: b.kategorie || '', art: b.art || '',
               aufbau: modus === 'rede' ? (redeArt() === 'begriff' ? E.aufbau : redeArt()) : '', einstieg: b.einstieg || '', ...(pitch ? { angebot: pitch.angebot, thema: pitch.thema, wunsch: pitch.wunsch, kniff: kniff ? kniff.text : '', tonart: kniff ? kniff.tonart : '' } : {}), heute: heute ? heute.nr : 0, ausschnitt: E.ausschnitt, soll, ist: 0, typ: nurTon ? 'ton' : 'video', status: 'läuft', groesse: 0 };
      uebungSpeichern(meta).catch(() => {});
      try { aufnahme = G.aufnahmeStarten(strom, meta.id, nurTon); }
      catch (e) { zurueck('Die Aufnahme ließ sich nicht starten (' + (e.name || e.message || 'Fehler') + '). Bitte noch einmal versuchen.'); return; }
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
      let r = { mime: '', groesse: 0, stuecke: 0, fehler: null };
      try { r = await aufnahme.stopp(); } catch (e) { r.fehler = e; }
      aufnahme = null;
      if (ton) { try { await ton.stopp(); meta.tonspur = true; } catch (e) {} ton = null; }
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
      if (aufnahme) { try { await aufnahme.stopp(); } catch (e) {} aufnahme = null; }
      if (ton) { try { await ton.stopp(); } catch (e) {} ton = null; }
      if (meta) { try { await uebungLoeschen(meta.id); } catch (e) {} }
      geheZu('#/');
    }

    function tick() {
      if (beendet) return;
      const el = (performance.now() - t0) / 1000;
      // Fällt die Kamera aus (Anruf, andere App, Bildschirmsperre): vor der Aufnahme zurück, in der Aufnahme sichern, was da ist.
      if (!G.stromLebt(strom)) {
        if (phase === 'vor') zurueck('Die Kamera wurde unterbrochen. Sie startet neu, dann bitte noch einmal antippen.');
        else if (aufnahme) beenden('abbruch');
        return;
      }
      let p = null;
      try { p = messer ? messer.lies() : null; } catch (e) {}
      if (phase === 'vor') {
        if (p != null) proben.push(p);
        const rest = vorZeit - el;
        zeigeUhr(String(Math.max(0, Math.ceil(rest))));
        if (rest <= 0) starte().catch((e) => zurueck('Die Aufnahme ließ sich nicht starten (' + (e.name || e.message || 'Fehler') + ').'));
        return;
      }
      // Uhr
      const rest = soll - el;
      zeigeUhr(rest >= 0 ? fmtZeit(Math.ceil(rest)) : '+' + fmtZeit(-rest));
      uhr.classList.toggle('ueber', rest < 0);
      const sig = signalFuer(E, soll);
      if (sig && sig < soll && !gesignalt && rest <= sig) { gesignalt = true; G.signal(2); }
      // Beim Pitch zählt die Zeit am meisten: Ist sie um, ertönen drei Töne. Die Aufnahme läuft weiter, die Überziehung wird gemessen.
      if (modus === 'pitch' && !zeitUm && rest <= 0) { zeitUm = true; G.signal(3, 520); }
      if (el >= soll + UEBERZUG_MAX) { beenden('automatisch'); return; }
      // Lässt sich nichts mehr speichern (meist: Speicher voll), sofort beenden statt weiter ins Leere aufzunehmen
      if (aufnahme && aufnahme.fehler) { beenden('speicherfehler'); return; }
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
    }
    // Ein Fehler in einem Takt (zum Beispiel in der Handerkennung) darf die Uhr nicht anhalten.
    takt = setInterval(() => { try { tick(); } catch (e) {} }, 100);
    tick();
  }

  einrichten();
  return aufraeumen;
}
