// Ergebnis einer Übung, Verlaufsliste, eigene Begriffe
import { h, fuelle, kopf, geheZu, datumText, mb } from './ui.js?v=19';
import { fmtZeit, laden } from './store.js?v=19';
import { uebungLaden, alleUebungen, uebungLoeschen, aufnahmeDatei, speicherStand, uebungSpeichern, bilderLaden } from './db.js?v=19';
import { koerperMessen } from './koerper.js?v=19';
import { coachTeil } from './coach.js?v=19';
import { eigeneBegriffe, eigenenHinzufuegen, eigenenLoeschen } from './begriffe.js?v=19';
import * as I from './impulse.js?v=19';
import { messen, MODELLE, luftHolen } from './messung.js?v=19';
import { wachAn, wachAus, wachOk, erkennungSchliessen } from './geraet.js?v=19';
import { lauf, koerperModus, setzeKoerperModus, absturzPruefen } from './messlauf.js?v=19';

const MODUS = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit', einwand: 'Einwand' };
const ENDE = { tippen: 'Fertig getippt', handzeichen: 'Handzeichen', schweigen: 'Schweigen', automatisch: 'automatisch nach 10 Minuten Überziehung' };

export function abweichung(u) {
  const d = Math.round(u.ist - u.soll), p = Math.round((u.ist - u.soll) / u.soll * 100);
  const vz = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x);
  return vz(d) + ' s (' + vz(p) + ' %)';
}

// ---------- Körper und Einzelbilder ----------
function koerperTeil(u) {
  const k = u.koerper;
  const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
  const titel = h('div', { class: 'titel' }, 'Körper', h('span', { class: 'grau' }, 'Schätzung'));
  if (u.typ !== 'video') return h('div', { class: 'gruppe' }, titel, h('div', { class: 'hinweis' }, 'Bei reinen Tonaufnahmen gibt es keine Körpermessung.'));
  if (!k && koerperModus() === 'aus') {
    const an = h('button', { class: 'breit', onclick: () => { setzeKoerperModus('cpu'); location.reload(); } }, 'Körpermessung wieder einschalten');
    return h('div', { class: 'gruppe' }, titel, h('div', { class: 'hinweis' }, 'Die Körpermessung ist ausgeschaltet, weil sie auf diesem iPhone zweimal unterbrochen wurde.'), an);
  }
  if (!k) return h('div', { class: 'gruppe' }, titel, h('div', { class: 'hinweis' }, 'Noch nicht gemessen. „Körper nachmessen“ holt das nach.'));
  if (k.fehler) return h('div', { class: 'gruppe' }, titel, h('div', { class: 'hinweis fehler' }, 'Die Körpermessung hat nicht geklappt: ' + k.fehler));
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
  return h('div', { class: 'gruppe' }, titel,
    reihen.length ? h('table', { class: 'werte' }, reihen) : null,
    (k.hinweise || []).map((t) => h('div', { class: 'hinweis' }, t)),
    k.modus === 'ganz'
      ? h('div', { class: 'hinweis' }, 'Handbewegung: 100 entspricht einer Schulterbreite je Sekunde. Der Blick wird aus der Entfernung über die Kopfhaltung geschätzt. Geprüft wurde alle ' + String(k.schritt).replace('.', ',') + ' Sekunden ein Bild' + (k.sparsam ? ' (sparsame Betriebsart).' : '.'))
      : h('div', { class: 'hinweis' }, 'Bewegung im Gesicht ist eine Kennzahl ohne Einheit: höher bedeutet mehr Wechsel in Stirn, Wangen und Mund. Geprüft wurde alle ' + String(k.schritt).replace('.', ',') + ' Sekunden ein Bild.'),
    k.diag ? h('div', { class: 'hinweis' }, 'Prüfwert für die Feinabstimmung: Kopfhaltung ' + k.diag.yaw + '° / ' + k.diag.pitch + '°, erkannt in ' + k.erkannt + ' % der Bilder' + (k.diag.laecheln90 != null ? '. Blick weg wegen Kopf ' + k.diag.wegKopf + ' %, Seite ' + k.diag.wegSeite + ' %, oben ' + k.diag.wegHoch + ' %, unten ' + k.diag.wegRunter + ' %. Lächel-Wert Mitte ' + k.diag.laecheln50 + ', oberes Zehntel ' + k.diag.laecheln90 : '') + '.') : null,
    u.bilder && u.bilder.length ? h('div', { class: 'hinweis' }, 'Einzelbilder für die Auswertung (' + u.bilder.length + '):') : null,
    leiste);
}

// ---------- Messwerte (Schätzungen des Geräts) ----------
function messTeil(u, ruhe) {
  const box = h('div', {});
  // Nach dem Körper-Schritt hat sich die Seite neu geladen: jetzt geht es mit dem Transkript weiter.
  const rest = lauf.lies();
  const weiter = !!(rest && rest.phase === 'weiter');
  if (weiter) lauf.weg();
  const absturz = weiter ? null : absturzPruefen();
  let fehlerText = '', autoStart = weiter && rest.id === u.id;
  // Stürzt die App beim Transkript ab, lädt das iPhone die Seite neu. Dann geht es hier von selbst weiter:
  // zweiter Versuch mit demselben Modell (der Speicher ist jetzt frei), dritter mit dem schnellen.
  let tonVersuch = 1, tonErsatz = false, autoText = '';
  if (absturz && absturz.id === u.id && absturz.phase === 'ton' && absturz.alter < 240000 && absturz.versuch < 3) {
    tonVersuch = absturz.versuch + 1;
    tonErsatz = tonVersuch === 3 && absturz.modell === 'gross';
    autoStart = true;
    autoText = tonErsatz ? 'Das genaue Transkript wurde zweimal unterbrochen. Die App macht von selbst mit dem schnellen Transkript weiter.'
      : 'Die App wurde beim Transkript unterbrochen und macht von selbst weiter (Versuch ' + tonVersuch + ' von 3).';
  }
  const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
  const zahl = (x, einheit = '') => (x == null ? 'nicht messbar' : String(x).replace('.', ',') + einheit);
  // neu = true: alles neu messen. Sonst nur, was noch fehlt.
  function starte(knopf, stand, neu) {
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
            location.reload();
            return;
          }
        }
        if (mitTon) {
          const marke = { id: u.id, phase: 'ton', modell: wahl, versuch: tonVersuch };
          lauf.setze(marke);
          const sag = melde(2);
          if (weiter || tonVersuch > 1) { sag('Gebe Arbeitsspeicher frei …'); await luftHolen(1500); }
          await messen(u, (t) => { lauf.setze(marke); sag(t); }, tonErsatz ? 'mittel' : wahl, { ersatz: tonErsatz });
          lauf.weg(); autoText = ''; tonVersuch = 1; tonErsatz = false;
        }
        if (ruhe) ruhe.nach();
        zeichne();
      } catch (e) {
        lauf.weg(); if (ruhe) ruhe.nach();
        // Was schon gemessen ist, zeigen; die Fehlermeldung bleibt darüber stehen
        autoText = ''; fehlerText = 'Die Messung hat nicht geklappt: ' + e.message; zeichne();
      }
      wachAus();
    })();
  }
  function zeichne() {
    const m = u.messung, stand = h('div', { class: 'hinweis' });
    const warnung = [autoText ? h('p', { class: 'warn' }, autoText) : absturz && absturz.id === u.id ? h('p', { class: 'warn' }, absturz.text) : null, fehlerText ? h('p', { class: 'hinweis fehler' }, fehlerText) : null];
    fehlerText = '';
    if (!m) {
      const mo = MODELLE[laden().transkript] || MODELLE.mittel;
      const min = Math.max(1, Math.ceil((u.ist || 60) / 60 * (mo.minJeMin + (u.typ === 'video' ? 0.35 : 0)) + 0.3));
      const knopf = h('button', { class: 'breit blau', onclick: () => starte(knopf, stand, false) }, 'Messwerte berechnen');
      fuelle(box, warnung, knopf,
        h('p', { class: 'grau' }, 'Dauert etwa ' + min + (min === 1 ? ' Minute' : ' Minuten') + ' (Transkript: ' + mo.name + '). Die App dabei offen lassen. Beim ersten Mal lädt sie einmalig rund ' + mo.mb + ' MB, am besten im WLAN.'),
        stand,
        u.koerper ? koerperTeil(u) : null);
      if (autoStart) { autoStart = false; starte(knopf, stand, 'ton'); }
      return;
    }
    const s = m.stimme, p = m.sprache;
    const unsicher = (wert) => (s.unsicher ? 'unsicher' : wert);
    const fuell = Object.entries(p.fuellEinzeln).sort((a, b) => b[1] - a[1]).map(([w, n]) => w + ' ' + n).join(', ');
    const nochmal = h('button', { class: 'breit leise', onclick: () => starte(nochmal, stand, true) }, 'Messung wiederholen');
    const nurKoerper = u.typ === 'video' && koerperModus() !== 'aus' && (!u.koerper || u.koerper.fehler)
      ? h('button', { class: 'breit blau', onclick: () => starte(nurKoerper, stand, false) }, 'Körper nachmessen') : null;
    const nurTon = m.ersatz ? h('button', { class: 'breit', onclick: () => starte(nurTon, stand, 'ton') }, 'Transkript noch einmal genau versuchen') : null;
    fuelle(box, warnung,
      m.ersatz ? h('p', { class: 'warn' }, 'Für das genaue Transkript war zu wenig Arbeitsspeicher frei. Dieses Transkript ist mit „schnell“ erstellt. Tipp: App ganz schließen, neu öffnen und unten „Transkript noch einmal genau versuchen“ antippen.') : null,
      h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, 'Sprache', h('span', { class: 'grau' }, 'Schätzung')),
        h('table', { class: 'werte' },
          zeile('Wörter', String(p.woerter)),
          zeile('Tempo', p.tempo + ' Wörter/Min.'),
          zeile('Satzlänge im Schnitt', p.satzUnsicher || p.satzlaenge == null ? 'unsicher' : zahl(p.satzlaenge, ' Wörter')),
          zeile('Wörter je Sprechabschnitt', s.unsicher ? 'unsicher' : zahl(p.woerterJeAbschnitt)),
          zeile('Füllwörter', p.fuellGesamt + ' (' + zahl(p.fuellJeMinute) + ' je Minute)')),
        fuell ? h('div', { class: 'hinweis' }, fuell) : null,
        h('div', { class: 'hinweis' }, 'Ein Sprechabschnitt ist das Stück zwischen zwei Atempausen. Die Satzlänge hängt an den Satzzeichen des Transkripts und ist deshalb oft unsicher.'),
        h('div', { class: 'hinweis' }, '„äh“ und „ähm“ verschluckt das Transkript oft. Der Wert für Füllwörter ist deshalb eher zu niedrig.')),
      h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, 'Pausen', h('span', { class: 'grau' }, 'Schätzung')),
        s.keineStimme ? h('div', { class: 'hinweis' }, 'Es wurde keine Stimme erkannt.') : h('table', { class: 'werte' },
          zeile('Pausen ab 0,7 Sekunden', unsicher(String(s.pausen))),
          zeile('davon ab 2 Sekunden', unsicher(String(s.pausenLang))),
          zeile('Länge im Schnitt', unsicher(zahl(s.pausenMittel, ' s'))),
          zeile('Längste Pause', unsicher(zahl(s.laengstePause, ' s') + (s.laengstePause ? ' bei ' + fmtZeit(s.laengstePauseBei) : ''))),
          zeile('Sprechanteil', unsicher(s.sprechAnteil + ' %')),
          zeile('Erste Worte nach', unsicher(zahl(s.ersteWorteNach, ' s')))),
        s.unsicher ? h('div', { class: 'hinweis' }, 'Die Stimme hebt sich kaum vom Raumgeräusch ab. Pausen und Lautstärke lassen sich deshalb nicht verlässlich messen.') : null),
      h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, 'Stimme', h('span', { class: 'grau' }, 'Schätzung')),
        s.keineStimme ? h('div', { class: 'hinweis' }, 'Es wurde keine Stimme erkannt.') : h('table', { class: 'werte' },
          zeile('Schwankung der Lautstärke', unsicher(zahl(s.lautSchwankung, ' dB'))),
          zeile('Tonhöhe (Mitte)', zahl(s.tonhoehe, ' Hz')),
          zeile('Schwankung der Tonhöhe', zahl(s.tonSchwankung, ' Halbtöne'))),
        h('div', { class: 'hinweis' }, 'Größere Schwankung bedeutet mehr Wechsel in der Stimme. Vergleiche die Werte mit deinen eigenen früheren Reden.')),
      koerperTeil(u),
      h('details', { class: 'gruppe' }, h('summary', {}, 'Transkript anzeigen'),
        u.transkript && u.transkript.length ? u.transkript.map((t) => h('p', { class: 'tzeile' }, h('span', { class: 'grau' }, fmtZeit(t.t) + ' '), t.text)) : h('p', { class: 'grau' }, 'Kein Text erkannt.'),
        h('div', { class: 'hinweis' }, 'Automatisch erstellt' + (m.modell ? ' (Transkript: ' + m.modell.replace('onnx-community/whisper-base', 'schnell') + ')' : '') + '. Hörfehler sind möglich, vor allem bei Fachwörtern.')),
      nurKoerper, nurTon, nochmal, stand);
    if (autoStart) { autoStart = false; starte(nochmal, stand, 'ton'); }
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
    const sichern = h('button', { class: 'breit', disabled: true }, u.typ === 'ton' ? 'Ton sichern' : 'In Fotos sichern');
    const info = h('div', { class: 'hinweis' });
    // Während der Messung gibt der Abspieler das Video frei, das spart Arbeitsspeicher.
    const ruhe = {
      vor() { try { spieler.pause(); spieler.removeAttribute('src'); spieler.load(); } catch (e) {} },
      nach() { if (url) spieler.src = url; },
    };
    const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
    fuelle(app, 
      kopf('Ergebnis'),
      h('div', { class: 'begriffTitel', lang: 'de' }, u.aufgabe),
      h('p', { class: 'grau' }, [(MODUS[u.modus] || u.modus) + (u.art ? ' (' + u.art + ')' : ''), u.ausschnitt === 'ganz' ? 'Ganzkörper' : 'Nah', u.aufbau ? 'Aufbau ' + u.aufbau : null, datumText(u.datum)].filter(Boolean).join(' · ')),
      u.status !== 'fertig' ? h('p', { class: 'warn' }, 'Diese Aufnahme wurde nicht sauber beendet. Die Zeiten fehlen deshalb.') : null,
      h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, 'Zeit'),
        h('table', { class: 'werte' },
          zeile('Soll', fmtZeit(u.soll)),
          zeile('Ist', u.status === 'fertig' ? fmtZeit(u.ist) : '–'),
          zeile('Abweichung', u.status === 'fertig' ? abweichung(u) : '–'),
          u.beendetDurch ? zeile('Beendet durch', ENDE[u.beendetDurch] || u.beendetDurch) : null)),
      u.fehler ? h('p', { class: 'hinweis fehler' }, 'Beim Speichern der Aufnahme gab es einen Fehler: ' + u.fehler) : null,
      u.status === 'fertig' ? messTeil(u, ruhe) : null,
      spieler, sichern,
      h('p', { class: 'grau' }, u.typ === 'ton' ? 'Im Teilen-Menü „In Dateien sichern“ wählen.' : 'Im Teilen-Menü „Video sichern“ wählen. Das Video liegt dann in der Fotos-App.'),
      info,
      u.status === 'fertig' ? coachTeil(u) : null,
      h('button', { class: 'breit', onclick: () => geheZu('#/') }, 'Zum Start'),
      h('button', { class: 'breit leise', onclick: async () => {
        if (!confirm('Diese Übung mit Aufnahme endgültig löschen?')) return;
        await uebungLoeschen(u.id); geheZu('#/verlauf');
      } }, 'Übung und Aufnahme löschen'));
    const datei = await aufnahmeDatei(u);
    if (!aktiv) return;
    if (!datei) { spieler.remove(); sichern.remove(); info.textContent = 'Zu dieser Übung ist keine Aufnahme gespeichert.'; return; }
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
  angriff: { titel: 'Eigene Angriffe', neu: 'Neuer Angriff oder Vorwurf', schon: 'Diesen Angriff gibt es schon.', leer: 'Noch keine eigenen Angriffe.', max: 120,
    text: 'Eigene Angriffe werden bei der Schlagfertigkeit unter die eingebauten gemischt. Nur diese Liste ist einsehbar.',
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
