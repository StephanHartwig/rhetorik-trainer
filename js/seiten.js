// Ergebnis einer Übung, Verlaufsliste, eigene Begriffe
import { h, fuelle, kopf, geheZu, datumText, mb, klappe, menue } from './ui.js?v=2107';
import { fmtZeit, laden } from './store.js?v=2107';
import { uebungLaden, alleUebungen, uebungLoeschen, aufnahmeDatei, speicherStand, uebungSpeichern, bilderLaden, stueckeLaden, pcmLaden } from './db.js?v=2107';
import { koerperMessen } from './koerper.js?v=2107';
import { coachTeil } from './coach.js?v=2107';
import { eigeneBegriffe, eigenenHinzufuegen, eigenenLoeschen } from './begriffe.js?v=2107';
import { klaraDatei, dateiAbgeben } from './sicherung.js?v=2107';
import { artName, aufbauName } from './auswertung.js?v=2107';
import * as I from './impulse.js?v=2107';
import { messen, MODELLE, luftHolen } from './messung.js?v=2107';
import { wachAn, wachAus, wachOk, erkennungSchliessen } from './geraet.js?v=2107';
import { lauf, laufend, koerperModus, setzeKoerperModus, absturzPruefen } from './messlauf.js?v=2107';

const MODUS = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit', einwand: 'Einwand' };
const ENDE = { speicherfehler: 'Fehler beim Speichern', abbruch: 'Aufnahme wurde unterbrochen', tippen: 'Fertig getippt', handzeichen: 'Handzeichen', schweigen: 'Schweigen', automatisch: 'automatisch nach 10 Minuten Überziehung' };

export function abweichung(u) {
  const d = Math.round(u.ist - u.soll), p = Math.round((u.ist - u.soll) / u.soll * 100);
  const vz = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x);
  return vz(d) + ' s (' + vz(p) + ' %)';
}

// ---------- Körper und Einzelbilder ----------
function koerperTeil(u) {
  const k = u.koerper;
  const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
  const kasten = (...inhalt) => klappe('koerper', 'Körper', u.typ !== 'video' ? '' : k && k.fehler ? 'nicht geklappt' : !k ? (koerperModus() === 'aus' ? 'ausgeschaltet' : 'noch nicht gemessen') : k.blick != null ? 'Blick ' + k.blick + ' %' : '', inhalt);
  if (u.typ !== 'video') return kasten( h('div', { class: 'hinweis' }, 'Bei reinen Tonaufnahmen gibt es keine Körpermessung.'));
  if (!k && koerperModus() === 'aus') {
    const an = h('button', { class: 'breit', onclick: () => { setzeKoerperModus('cpu'); location.reload(); } }, 'Körpermessung wieder einschalten');
    return kasten( h('div', { class: 'hinweis' }, 'Die Körpermessung ist ausgeschaltet, weil sie auf diesem iPhone zweimal unterbrochen wurde.'), an);
  }
  if (!k) return kasten( h('div', { class: 'hinweis' }, 'Noch nicht gemessen. „Körper nachmessen“ holt das nach.'));
  if (k.fehler) return kasten( h('div', { class: 'hinweis fehler' }, 'Die Körpermessung hat nicht geklappt: ' + k.fehler));
  const nm = (x, einheit) => (x == null ? 'nicht messbar' : x + einheit);
  const reihen = [];
  if (k.modus === 'ganz') {
    if (!k.standUnsicher) reihen.push(
      zeile('Schwanken der Schultern', nm(k.schwankenSchulter, ' % der Schulterbreite')),
      zeile('Schwanken der Hüfte', nm(k.schwankenHuefte, ' % der Schulterbreite')),
      zeile('Standortwechsel', String(k.standortwechsel)),
      zeile('Beide Hände sichtbar', k.haendeSichtbar + ' % der Zeit'),
      zeile('Handbewegung', nm(k.handBewegung, '')));
    reihen.push(zeile('Kopf zur Kamera', nm(k.blick, ' % der Zeit')));
  } else {
    reihen.push(zeile('Blick zur Kamera', nm(k.blick, ' % der Zeit')));
    if (!k.mimikUnsicher) reihen.push(
      zeile('Wechsel im Gesichtsausdruck', k.mimikWechsel + ' (' + String(k.mimikWechselJeMinute).replace('.', ',') + ' je Minute)'),
      zeile('Lächeln', k.laecheln + ' % der Zeit'),
      zeile('Bewegung im Gesicht', nm(k.mimikBewegung, '')));
  }
  const leiste = h('div', { class: 'bilder' });
  if (u.bilder && u.bilder.length) bilderLaden(u.id).then((blobs) => {
    blobs.forEach((b, i) => { if (!u.bilder[i]) return; const url = URL.createObjectURL(b);
      leiste.append(h('figure', {}, h('img', { src: url, alt: 'Einzelbild', onload: () => URL.revokeObjectURL(url) }), h('figcaption', {}, fmtZeit(u.bilder[i].t) + ' · ' + u.bilder[i].grund))); });
  });
  return kasten(
    reihen.length ? h('table', { class: 'werte' }, reihen) : null,
    (k.hinweise || []).map((t) => h('div', { class: 'hinweis' }, t)),
    k.modus === 'ganz'
      ? h('div', { class: 'hinweis' }, 'Handbewegung: 100 entspricht einer Schulterbreite je Sekunde. Der Blick wird aus der Entfernung über die Kopfhaltung geschätzt. Geprüft wurde alle ' + String(k.schritt).replace('.', ',') + ' Sekunden ein Bild' + (k.sparsam ? ' (sparsame Betriebsart).' : '.'))
      : h('div', { class: 'hinweis' }, 'Bewegung im Gesicht ist eine Kennzahl ohne Einheit: höher bedeutet mehr Wechsel in Stirn, Wangen und Mund. Geprüft wurde alle ' + String(k.schritt).replace('.', ',') + ' Sekunden ein Bild.'),
    k.diag ? h('div', { class: 'hinweis' }, 'Prüfwert für die Feinabstimmung: Kopfhaltung ' + k.diag.yaw + '° / ' + k.diag.pitch + '°, erkannt in ' + k.erkannt + ' % der Bilder' + (k.diag.laecheln90 != null ? '. Blick weg wegen Kopf ' + k.diag.wegKopf + ' %, Seite ' + k.diag.wegSeite + ' %, oben ' + k.diag.wegHoch + ' %, unten ' + k.diag.wegRunter + ' %. Lächel-Wert Mitte ' + k.diag.laecheln50 + ', oberes Zehntel ' + k.diag.laecheln90 : '') + '.') : null,
    u.bilder && u.bilder.length ? h('div', { class: 'hinweis' }, 'Einzelbilder für die Auswertung (' + u.bilder.length + '):') : null,
    leiste);
}

// Zeile „Zeit“ im Kasten der Messwerte
function zeitKlappe(u) {
  const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
  const fertig = u.status === 'fertig';
  return klappe('zeit', 'Zeit', fertig ? fmtZeit(u.ist) + ' von ' + fmtZeit(u.soll) : '',
    h('table', { class: 'werte' },
      zeile('Soll', fmtZeit(u.soll)),
      zeile('Ist', fertig ? fmtZeit(u.ist) : '–'),
      zeile('Abweichung', fertig ? abweichung(u) : '–'),
      u.beendetDurch ? zeile('Beendet durch', ENDE[u.beendetDurch] || u.beendetDurch) : null));
}

// ---------- Messwerte (Schätzungen des Geräts) ----------
function messTeil(u, ruhe, nachMessung) {
  const box = h('div', {});
  // Nach dem Körper-Schritt hat sich die Seite neu geladen: jetzt geht es mit dem Transkript weiter.
  const rest = lauf.lies();
  const weiter = !!(rest && rest.phase === 'weiter');
  if (weiter) lauf.weg();
  const fremd = !!(rest && rest.id !== u.id && rest.phase !== 'koerper' && Date.now() - (rest.zeit || 0) < 864e5);     // gehört zu einer anderen Übung: dort auswerten
  const absturz = weiter || fremd ? null : absturzPruefen();
  let fehlerText = '', autoStart = weiter && rest.id === u.id;
  // Stürzt die App beim Transkript ab, lädt das iPhone die Seite neu. Dann geht es hier von selbst weiter:
  // Beim genauen Modell gleich mit dem schnellen (ein zweiter Absturz in Folge bringt die Fehlerseite von iOS).
  // Beim schnellen Modell ein zweiter und dritter Versuch mit demselben Modell.
  let tonVersuch = 1, tonErsatz = false, autoText = '';
  if (absturz && absturz.id === u.id && absturz.phase === 'ton' && absturz.alter < 240000 && absturz.versuch < 3) {
    tonVersuch = absturz.versuch + 1;
    tonErsatz = absturz.modell === 'gross' || absturz.ersatz;
    autoStart = true;
    autoText = tonErsatz && !absturz.ersatz ? 'Das genaue Transkript wurde unterbrochen, vermutlich war zu wenig Arbeitsspeicher frei. Die App macht von selbst mit dem schnellen Transkript weiter.'
      : 'Die App wurde beim Transkript unterbrochen und macht von selbst weiter (Versuch ' + tonVersuch + ' von 3).';
  }
  const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
  const zahl = (x, einheit = '') => (x == null ? 'nicht messbar' : String(x).replace('.', ',') + einheit);
  // neu = true: alles neu messen. Sonst nur, was noch fehlt.
  function starte(knopf, stand, neu) {
    if (laufend.id) return;                 // es läuft schon eine Messung
    laufend.id = u.id;
    knopf.disabled = true; stand.className = 'hinweis'; wachAn();
    // Ohne Antippen (nach dem Neuladen) hält das iPhone den Bildschirm nicht immer an: dann um einen Tipp bitten.
    setTimeout(() => {
      if (wachOk() || !knopf.isConnected) return;
      const bitte = h('p', { class: 'warn' }, 'Bitte einmal irgendwo auf den Bildschirm tippen, damit er an bleibt.');
      stand.before(bitte);
      document.addEventListener('pointerdown', () => { wachAn(); bitte.remove(); }, { once: true });
    }, 1500);
    const modus = koerperModus(), wahl = laden().transkript;
    const mitKoerper = neu !== 'ton' && u.typ === 'video' && modus !== 'aus' && (neu || !u.koerper || u.koerper.fehler);
    const mitTon = !!neu || !u.messung;
    const zwei = (mitKoerper && mitTon) || (neu === 'ton' && weiter);
    const melde = (schritt) => (t) => { stand.textContent = (zwei ? 'Schritt ' + schritt + ' von 2 · ' : '') + t; };
    (async () => {
      try {
        if (ruhe) ruhe.vor();
        if (mitKoerper) {
          // Der Körper zuerst: Er braucht den Grafikchip, das Transkript danach viel Arbeitsspeicher.
          const marke = { id: u.id, phase: 'koerper', modus };
          lauf.setze(marke);
          try { await koerperMessen(u, melde(1), { cpu: modus === 'cpu', beiBild: (bild, von) => lauf.setze({ ...marke, bild, von }) }); }
          catch (e) { u.koerper = { fehler: e.message }; u.bilder = []; await uebungSpeichern(u); }
          lauf.weg(); erkennungSchliessen();
          if (mitTon) {
            // Beide Schritte zusammen sprengen den Arbeitsspeicher des iPhones. Deshalb lädt sich die Seite
            // hier einmal neu und macht danach von selbst mit dem Transkript weiter.
            lauf.setze({ id: u.id, phase: 'weiter' });
            melde(1)('Körper fertig. Die Seite lädt kurz neu, um Arbeitsspeicher frei zu machen …');
            await new Promise((r) => setTimeout(r, 700));
            location.reload();             // laufend.id bleibt bis dahin gesetzt
            return;
          }
        }
        if (mitTon) {
          const marke = { id: u.id, phase: 'ton', modell: wahl, ersatz: tonErsatz, versuch: tonVersuch };
          lauf.setze(marke);
          const sag = melde(2);
          if (weiter || tonVersuch > 1) { sag('Gebe Arbeitsspeicher frei …'); await luftHolen(1500); }
          await messen(u, (t) => { lauf.setze(marke); sag(t); }, tonErsatz ? 'mittel' : wahl, { ersatz: tonErsatz });
          lauf.weg(); autoText = ''; tonVersuch = 1; tonErsatz = false;
        }
        laufend.id = null;
        if (ruhe) ruhe.nach();
        zeichne();
      } catch (e) {
        laufend.id = null;
        lauf.weg(); if (ruhe) ruhe.nach();
        // Was schon gemessen ist, zeigen; die Fehlermeldung bleibt darüber stehen
        autoText = ''; fehlerText = 'Die Messung hat nicht geklappt: ' + e.message; zeichne();
        box.scrollIntoView({ block: 'start' });       // die Meldung steht oben im Messteil
      }
      wachAus();
    })();
  }
  function zeichne() {
    if (nachMessung) nachMessung();
    const m = u.messung, stand = h('div', { class: 'hinweis' });
    const warnung = [autoText ? h('p', { class: 'warn' }, autoText) : absturz && absturz.id === u.id ? h('p', { class: 'warn' }, absturz.text) : null, fehlerText ? h('p', { class: 'hinweis fehler' }, fehlerText) : null];
    fehlerText = '';
    box.wiederholen = null;
    if (!m && u.ohneAufnahme) { fuelle(box, warnung, h('div', { class: 'stapel' }, zeitKlappe(u), u.koerper ? koerperTeil(u) : null)); return; }
    if (!m) {
      const mo = MODELLE[laden().transkript] || MODELLE.mittel;
      const min = Math.max(1, Math.ceil((u.ist || 60) / 60 * (mo.minJeMin + (u.typ === 'video' ? 0.35 : 0)) + 0.3));
      const knopf = h('button', { class: 'breit blau', onclick: () => starte(knopf, stand, false) }, 'Messwerte berechnen');
      fuelle(box, warnung, knopf,
        h('p', { class: 'grau' }, 'Dauert etwa ' + min + (min === 1 ? ' Minute' : ' Minuten') + ' (Transkript: ' + mo.name + '). Die App dabei offen lassen. Beim ersten Mal lädt sie einmalig rund ' + mo.mb + ' MB, am besten im WLAN.'),
        stand,
        h('div', { class: 'stapel' }, zeitKlappe(u), u.koerper ? koerperTeil(u) : null));
      if (autoStart) { autoStart = false; starte(knopf, stand, 'ton'); }
      return;
    }
    const s = m.stimme, p = m.sprache;
    const unsicher = (wert) => (s.unsicher ? 'unsicher' : wert);
    const fuell = Object.entries(p.fuellEinzeln).sort((a, b) => b[1] - a[1]).map(([w, n]) => w + ' ' + n).join(', ');
    // „Messung wiederholen“ steht im Menü oben rechts; der Knopf selbst bleibt unsichtbar auf der Seite.
    const nochmal = u.ohneAufnahme ? null : h('button', { class: 'breit leise', hidden: true, onclick: () => starte(nochmal, stand, true) }, 'Messung wiederholen');
    if (nochmal) box.wiederholen = () => {
      if (laufend.id) { alert('Es läuft schon eine Messung.'); return; }
      if (!confirm('Die Messung neu berechnen? Das dauert wieder einige Minuten.')) return;
      nochmal.click(); stand.scrollIntoView({ block: 'center' });
    };
    const nurKoerper = !u.ohneAufnahme && u.typ === 'video' && koerperModus() !== 'aus' && (!u.koerper || u.koerper.fehler)
      ? h('button', { class: 'breit blau', onclick: () => starte(nurKoerper, stand, false) }, 'Körper nachmessen') : null;
    const nurTon = m.ersatz && !u.ohneAufnahme ? h('button', { class: 'breit', onclick: () => starte(nurTon, stand, 'ton') }, 'Transkript noch einmal genau versuchen') : null;
    fuelle(box, warnung,
      m.ersatz ? h('p', { class: 'warn' }, 'Für das genaue Transkript war zu wenig Arbeitsspeicher frei. Dieses Transkript ist mit „schnell“ erstellt. Tipp: App ganz schließen, neu öffnen und unten „Transkript noch einmal genau versuchen“ antippen.') : null,
      h('h2', {}, 'Messwerte'),
      h('div', { class: 'stapel' },
      klappe('sprache', 'Sprache', p.tempo + ' Wörter/Min.',
        h('table', { class: 'werte' },
          zeile('Wörter', String(p.woerter)),
          zeile('Tempo', p.tempo + ' Wörter/Min.'),
          zeile('Satzlänge im Schnitt', p.satzUnsicher || p.satzlaenge == null ? 'unsicher' : zahl(p.satzlaenge, ' Wörter')),
          zeile('Wörter je Sprechabschnitt', s.unsicher ? 'unsicher' : zahl(p.woerterJeAbschnitt)),
          zeile('Füllwörter', p.fuellGesamt + ' (' + zahl(p.fuellJeMinute) + ' je Minute)')),
        fuell ? h('div', { class: 'hinweis' }, fuell) : null,
        h('div', { class: 'hinweis' }, 'Ein Sprechabschnitt ist das Stück zwischen zwei Atempausen. Die Satzlänge hängt an den Satzzeichen des Transkripts und ist deshalb oft unsicher.'),
        h('div', { class: 'hinweis' }, '„äh“ und „ähm“ verschluckt das Transkript oft. Der Wert für Füllwörter ist deshalb eher zu niedrig.')),
      klappe('pausen', 'Pausen', s.keineStimme || s.unsicher ? '' : String(s.pausen),
        s.keineStimme ? h('div', { class: 'hinweis' }, 'Es wurde keine Stimme erkannt.') : h('table', { class: 'werte' },
          zeile('Pausen ab 0,7 Sekunden', unsicher(String(s.pausen))),
          zeile('davon ab 2 Sekunden', unsicher(String(s.pausenLang))),
          zeile('Länge im Schnitt', unsicher(zahl(s.pausenMittel, ' s'))),
          zeile('Längste Pause', unsicher(zahl(s.laengstePause, ' s') + (s.laengstePause ? ' bei ' + fmtZeit(s.laengstePauseBei) : ''))),
          zeile('Sprechanteil', unsicher(s.sprechAnteil + ' %')),
          zeile('Erste Worte nach', unsicher(zahl(s.ersteWorteNach, ' s')))),
        s.unsicher ? h('div', { class: 'hinweis' }, 'Die Stimme hebt sich kaum vom Raumgeräusch ab. Pausen und Lautstärke lassen sich deshalb nicht verlässlich messen.') : null),
      klappe('stimme', 'Stimme', s.keineStimme || s.tonhoehe == null ? '' : s.tonhoehe + ' Hz',
        s.keineStimme ? h('div', { class: 'hinweis' }, 'Es wurde keine Stimme erkannt.') : h('table', { class: 'werte' },
          zeile('Schwankung der Lautstärke', unsicher(zahl(s.lautSchwankung, ' dB'))),
          zeile('Tonhöhe (Mitte)', zahl(s.tonhoehe, ' Hz')),
          zeile('Schwankung der Tonhöhe', zahl(s.tonSchwankung, ' Halbtöne'))),
        h('div', { class: 'hinweis' }, 'Größere Schwankung bedeutet mehr Wechsel in der Stimme. Vergleiche die Werte mit deinen eigenen früheren Reden.')),
      koerperTeil(u),
      klappe('transkript', 'Transkript', '',
        u.transkript && u.transkript.length ? u.transkript.map((t) => h('p', { class: 'tzeile' }, h('span', { class: 'grau' }, fmtZeit(t.t) + ' '), t.text)) : h('p', { class: 'grau' }, 'Kein Text erkannt.'),
        h('div', { class: 'hinweis' }, 'Automatisch erstellt' + (m.modell ? ' (Transkript: ' + m.modell.replace('onnx-community/whisper-base', 'schnell') + ')' : '') + '. Hörfehler sind möglich, vor allem bei Fachwörtern.')),
      zeitKlappe(u)),
      h('p', { class: 'grau' }, 'Schätzungen des Geräts. Antippen klappt eine Zeile auf.'),
      nurKoerper, nurTon, nochmal, stand);
    if (autoStart) { autoStart = false; if (nochmal) { starte(nochmal, stand, 'ton'); setTimeout(() => stand.scrollIntoView({ block: 'center' }), 300); } }
  }
  zeichne();
  return box;
}

// ---------- Ergebnis ----------
export function uebungSeite(app, id) {
  let url = null, aktiv = true;
  fuelle(app, kopf('Ergebnis'), h('p', { class: 'grau' }, 'Lade …'));
  (async () => {
    const u = await uebungLaden(id);
    if (!aktiv) return;
    if (!u) { fuelle(app, kopf('Ergebnis'), h('p', {}, 'Diese Übung gibt es nicht mehr.')); return; }
    const spieler = h(u.typ === 'ton' ? 'audio' : 'video', { class: 'spieler', controls: true, playsinline: true, preload: 'metadata' });
    const sichern = h('button', { class: 'reihe', disabled: true }, h('span', {}, u.typ === 'ton' ? 'Ton sichern' : 'In Fotos sichern'), h('span', { class: 'pfeil' }, '›'));
    const info = h('div', { class: 'hinweis' });
    // Während der Messung gibt der Abspieler das Video frei, das spart Arbeitsspeicher.
    const ruhe = {
      vor() { try { spieler.pause(); spieler.removeAttribute('src'); spieler.load(); } catch (e) {} },
      nach() { if (url) spieler.src = url; },
    };
    // Drei Schritte zeigen, wo die Übung steht: Aufnahme, Messung, Coach.
    const schritte = h('div', { class: 'schritte' });
    const zeigeSchritte = () => {
      const stand = [true, !!u.messung, !!(u.feedback || u.ergebnis)], dran = stand.indexOf(false);
      fuelle(schritte, ['Aufnahme', 'Messung', 'Coach'].map((name, i) => [
        i ? h('span', { class: 'strich' + (stand[i] ? ' ok' : '') }) : null,
        h('span', { class: 'schrittP' + (stand[i] ? ' ok' : i === dran ? ' dran' : '') }, h('b', {}, stand[i] ? '✓' : String(i + 1)), name)]));
    };
    // Das Wichtigste zuerst: Sobald gemessen ist, steht die Bewertung des Coachs oben, die Messwerte darunter.
    const bereich = h('div', { class: 'ergebnis' });
    let coach = null, mess = null;
    if (u.status === 'fertig') {
      const ordne = () => { bereich.classList.toggle('gemessen', !!u.messung); if (coach && coach.neu) coach.neu(); zeigeSchritte(); };
      mess = messTeil(u, ruhe, ordne);
      coach = coachTeil(u, zeigeSchritte); coach.classList.add('coachBox');
      bereich.append(mess, coach); ordne();
    }
    // Nicht sauber beendete Aufnahme: Was gespeichert ist, lässt sich trotzdem als Übung abschließen und messen.
    const rettenInfo = h('div', { class: 'hinweis' });
    const rettenKnopf = h('button', { class: 'breit blau', onclick: async () => {
      rettenKnopf.disabled = true;
      try {
        const [teile, ton] = await Promise.all([stueckeLaden(u.id), pcmLaden(u.id)]);
        if (!teile.length && !ton) { rettenInfo.textContent = 'Zu dieser Übung ist nichts gespeichert. Du kannst sie nur löschen.'; return; }
        const sek = ton && ton.length > 8000 ? ton.length / 16000 : teile.length * 5;
        Object.assign(u, { status: 'fertig', beendetDurch: 'abbruch', ist: Math.max(1, Math.round(sek * 10) / 10), dauerAufnahme: Math.round(sek),
          groesse: teile.reduce((a, b) => a + (b.size || 0), 0), stuecke: teile.length, mime: (teile[0] && teile[0].type) || u.mime || '', tonspur: !!ton });
        await uebungSpeichern(u);
        location.reload();
      } catch (e) { rettenInfo.textContent = 'Das hat nicht geklappt: ' + e.message; rettenKnopf.disabled = false; }
    } }, 'Gespeicherten Teil retten');
    const loeschen = async () => {
      if (laufend.id === u.id) { alert('Die Messung läuft noch. Bitte warte, bis sie fertig ist.'); return; }
      if (!confirm('Diese Übung mit Aufnahme endgültig löschen?')) return;
      await uebungLoeschen(u.id); geheZu('#/verlauf');
    };
    // Export für Klara: Markdown-Datei mit Paket und Feedback über das Teilen-Menü
    const klaraInfo = h('div', { class: 'hinweis' });
    const klaraExport = () => {
      if (!u.messung) { klaraInfo.textContent = 'Erst „Messwerte berechnen“. Ohne Messwerte gibt es nichts zu exportieren.'; return; }
      const d = klaraDatei(u);
      dateiAbgeben(d.name, d.text, 'text/markdown').then((wie) => {
        klaraInfo.textContent = wie === 'abgebrochen' ? '' : 'Datei ' + d.name + (wie === 'geladen' ? ' wurde geladen.' : ' wurde übergeben.') + (u.feedback ? '' : ' Sie enthält noch kein Feedback des Coachs.');
      }).catch((e) => { klaraInfo.textContent = 'Der Export hat nicht geklappt (' + (e.name || e.message) + ').'; });
    };
    const aufnahmeBox = h('div', {},
      h('h2', {}, 'Aufnahme'),
      h('div', { class: 'stapel' },
        klappe('aufnahme', u.typ === 'ton' ? 'Anhören' : 'Ansehen', '', spieler),
        sichern),
      h('p', { class: 'grau' }, u.typ === 'ton' ? 'Sichern: im Teilen-Menü „In Dateien sichern“ wählen.' : 'Sichern: im Teilen-Menü „Video sichern“ wählen. Das Video liegt dann in der Fotos-App.'),
      info);
    fuelle(app, 
      kopf('Ergebnis', { rechts: menue(() => [
        u.status === 'fertig' ? { text: 'Für Klara exportieren', tun: klaraExport } : null,
        coach && (u.feedback || u.ergebnis) ? { text: 'Noch einmal auswerten', tun: () => coach.nochmal() } : null,
        mess && mess.wiederholen ? { text: 'Messung wiederholen', tun: mess.wiederholen } : null,
        { text: 'Übung löschen', rot: true, tun: loeschen }]) }),
      h('div', { class: 'begriffTitel', lang: 'de' }, u.aufgabe),
      h('p', { class: 'grau' }, [artName(u) + (u.art ? ' (' + u.art + ')' : ''), u.ausschnitt === 'ganz' ? 'Ganzkörper' : 'Nah', u.aufbau === 'klassisch' || u.aufbau === 'frei' ? 'Aufbau ' + aufbauName(u) : null, u.einstieg ? 'Einstieg: ' + u.einstieg : null, datumText(u.datum)].filter(Boolean).join(' · ')),
      u.status === 'fertig' ? schritte : null,
      klaraInfo,
      u.status !== 'fertig' ? [h('p', { class: 'warn' }, 'Diese Aufnahme wurde nicht sauber beendet, zum Beispiel weil die App geschlossen wurde oder der Bildschirm ausging.'), rettenKnopf, rettenInfo] : null,
      u.ohneAufnahme ? h('p', { class: 'grau' }, 'Diese Übung stammt aus einer Sicherung. Video und Einzelbilder sind nicht dabei, neu messen geht deshalb nicht.') : null,
      u.fehler ? h('p', { class: 'hinweis fehler' }, 'Beim Speichern der Aufnahme gab es einen Fehler' + (u.beendetDurch === 'speicherfehler' ? ', deshalb wurde sie sofort beendet. Vermutlich ist der Speicher voll: Bitte im Verlauf alte Aufnahmen löschen.' : '.') + ' (' + u.fehler + ')') : null,
      bereich,
      u.status !== 'fertig' ? h('div', { class: 'stapel' }, zeitKlappe(u)) : null,
      u.ohneAufnahme ? null : aufnahmeBox);
    const datei = await aufnahmeDatei(u);
    if (!aktiv) return;
    if (!datei) { fuelle(aufnahmeBox, h('h2', {}, 'Aufnahme'), h('p', { class: 'grau' }, 'Zu dieser Übung ist keine Aufnahme gespeichert.')); return; }
    url = URL.createObjectURL(datei); spieler.src = url;
    info.textContent = 'Größe der Aufnahme: ' + mb(datei.size);
    sichern.disabled = false;
    sichern.onclick = () => {
      const daten = { files: [datei] };
      if (navigator.canShare && navigator.canShare(daten)) {
        navigator.share(daten).catch((e) => { if (e.name !== 'AbortError') info.textContent = 'Teilen hat nicht geklappt (' + e.name + ').'; });
      } else {
        const a = h('a', { href: url, download: datei.name }); document.body.append(a); a.click(); a.remove();
      }
    };
  })();
  return () => { aktiv = false; if (url) URL.revokeObjectURL(url); };
}

// ---------- Eigene Begriffe, eigene Angriffe, eigene Einwände ----------
const EIGEN = {
  begriff: { titel: 'Eigene Begriffe', neu: 'Neuer Begriff', schon: 'Diesen Begriff gibt es schon.', leer: 'Noch keine eigenen Begriffe.', max: 80,
    text: 'Eigene Begriffe werden unter die eingebauten gemischt. Nur diese Liste ist einsehbar.',
    liste: eigeneBegriffe, dazu: eigenenHinzufuegen, weg: eigenenLoeschen },
  angriff: { titel: 'Eigene Aussagen', neu: 'Neue Aussage, auf die du reagieren willst', schon: 'Diese Aussage gibt es schon.', leer: 'Noch keine eigenen Aussagen.', max: 120,
    text: 'Hier trägst du Sätze ein, die dir jemand gesagt hat oder sagen könnte. Sie werden bei der Schlagfertigkeit unter die eingebauten gemischt. Nur diese Liste ist einsehbar.',
    liste: () => I.eigene('angriff'), dazu: (t) => I.eigenenHinzufuegen('angriff', t), weg: (t) => I.eigenenLoeschen('angriff', t) },
  einwand: { titel: 'Eigene Einwände', neu: 'Neuer Einwand', schon: 'Diesen Einwand gibt es schon.', leer: 'Noch keine eigenen Einwände.', max: 120,
    text: 'Eigene Einwände werden unter die eingebauten gemischt. Nur diese Liste ist einsehbar.',
    liste: () => I.eigene('einwand'), dazu: (t) => I.eigenenHinzufuegen('einwand', t), weg: (t) => I.eigenenLoeschen('einwand', t) },
};
export function eigeneSeite(app, sorte = 'begriff') {
  const S = EIGEN[sorte] || EIGEN.begriff;
  const feld = h('input', { type: 'text', class: 'text', placeholder: S.neu, maxlength: S.max, enterkeyhint: 'done' });
  const meldung = h('div', { class: 'hinweis' });
  const liste = h('div', {});
  const dazu = () => {
    if (!feld.value.trim()) return;
    meldung.textContent = S.dazu(feld.value) ? '' : S.schon;
    feld.value = ''; zeichne();
  };
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') dazu(); });
  function zeichne() {
    const l = S.liste();
    fuelle(liste, (l.length ? l.map((t) => h('div', { class: 'zeile eigen' },
      h('span', { lang: 'de' }, t),
      h('button', { class: 'rund', 'aria-label': 'löschen', onclick: () => { if (confirm('„' + t + '“ löschen?')) { S.weg(t); zeichne(); } } }, '×')))
      : [h('p', { class: 'grau' }, S.leer)]));
  }
  zeichne();
  fuelle(app, 
    kopf(S.titel, { ziel: '#/einstellungen' }),
    h('p', { class: 'grau' }, S.text),
    h('div', { class: 'zeile' }, feld, h('button', { class: 'rund', 'aria-label': 'hinzufügen', onclick: dazu }, '+')),
    meldung, liste);
  return null;
}
