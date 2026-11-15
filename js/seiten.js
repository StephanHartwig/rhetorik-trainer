// Ergebnis einer Übung, Verlaufsliste, eigene Begriffe
import { h, fuelle, kopf, geheZu, datumText, mb } from './ui.js?v=6';
import { fmtZeit } from './store.js?v=6';
import { uebungLaden, alleUebungen, uebungLoeschen, aufnahmeDatei, speicherStand } from './db.js?v=6';
import { eigeneBegriffe, eigenenHinzufuegen, eigenenLoeschen } from './begriffe.js?v=6';

const MODUS = { rede: 'Stegreifrede', schlag: 'Schlagfertigkeit', einwand: 'Einwand' };
const ENDE = { tippen: 'Fertig getippt', handzeichen: 'Handzeichen', schweigen: 'Schweigen', automatisch: 'automatisch nach 10 Minuten Überziehung' };

export function abweichung(u) {
  const d = Math.round(u.ist - u.soll), p = Math.round((u.ist - u.soll) / u.soll * 100);
  const vz = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x);
  return vz(d) + ' s (' + vz(p) + ' %)';
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
    const zeile = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
    fuelle(app, 
      kopf('Ergebnis'),
      h('div', { class: 'begriffTitel', lang: 'de' }, u.aufgabe),
      h('p', { class: 'grau' }, [MODUS[u.modus] || u.modus, u.ausschnitt === 'ganz' ? 'Ganzkörper' : 'Nah', 'Aufbau ' + u.aufbau, datumText(u.datum)].join(' · ')),
      u.status !== 'fertig' ? h('p', { class: 'warn' }, 'Diese Aufnahme wurde nicht sauber beendet. Die Zeiten fehlen deshalb.') : null,
      h('div', { class: 'gruppe' }, h('div', { class: 'titel' }, 'Zeit'),
        h('table', { class: 'werte' },
          zeile('Soll', fmtZeit(u.soll)),
          zeile('Ist', u.status === 'fertig' ? fmtZeit(u.ist) : '–'),
          zeile('Abweichung', u.status === 'fertig' ? abweichung(u) : '–'),
          u.beendetDurch ? zeile('Beendet durch', ENDE[u.beendetDurch] || u.beendetDurch) : null)),
      u.fehler ? h('p', { class: 'hinweis fehler' }, 'Beim Speichern der Aufnahme gab es einen Fehler: ' + u.fehler) : null,
      spieler, sichern,
      h('p', { class: 'grau' }, u.typ === 'ton' ? 'Im Teilen-Menü „In Dateien sichern“ wählen.' : 'Im Teilen-Menü „Video sichern“ wählen. Das Video liegt dann in der Fotos-App.'),
      info,
      h('p', { class: 'grau' }, 'Messwerte und „Auswerten lassen“ kommen mit den nächsten Blöcken.'),
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

// ---------- Verlauf (Liste; Noten und Kurven kommen mit Block 6) ----------
export function verlaufSeite(app) {
  let aktiv = true;
  fuelle(app, kopf('Verlauf'), h('p', { class: 'grau' }, 'Lade …'));
  (async () => {
    const [liste, st] = await Promise.all([alleUebungen(), speicherStand()]);
    if (!aktiv) return;
    const summe = liste.reduce((s, u) => s + (u.groesse || 0), 0);
    fuelle(app, 
      kopf('Verlauf'),
      h('p', { class: 'grau' }, 'Aufnahmen belegen ' + mb(summe) + (st ? ' · frei: ' + mb(st.frei) : '')),
      liste.length ? liste.map((u) => h('button', { class: 'eintrag', onclick: () => geheZu('#/uebung/' + u.id) },
        h('div', { class: 'e1', lang: 'de' }, u.aufgabe),
        h('div', { class: 'e2' }, [datumText(u.datum), MODUS[u.modus] || u.modus].join(' · ')),
        h('div', { class: 'e2' }, u.status === 'fertig' ? 'Soll ' + fmtZeit(u.soll) + ' · Ist ' + fmtZeit(u.ist) + ' · ' + mb(u.groesse || 0) : 'nicht sauber beendet')))
        : h('div', { class: 'mitte' }, h('div', { class: 'grau' }, 'Noch keine Übungen.')),
      liste.length ? h('p', { class: 'grau' }, 'Antippen öffnet die Übung. Dort kannst du sie ansehen, sichern oder löschen. Noten und Kurven kommen mit Block 6.') : null);
  })();
  return () => { aktiv = false; };
}

// ---------- Eigene Begriffe ----------
export function eigeneSeite(app) {
  const feld = h('input', { type: 'text', class: 'text', placeholder: 'Neuer Begriff', maxlength: 80, enterkeyhint: 'done' });
  const meldung = h('div', { class: 'hinweis' });
  const liste = h('div', {});
  const dazu = () => {
    if (!feld.value.trim()) return;
    meldung.textContent = eigenenHinzufuegen(feld.value) ? '' : 'Diesen Begriff gibt es schon.';
    feld.value = ''; zeichne();
  };
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') dazu(); });
  function zeichne() {
    const l = eigeneBegriffe();
    fuelle(liste, (l.length ? l.map((t) => h('div', { class: 'zeile eigen' },
      h('span', { lang: 'de' }, t),
      h('button', { class: 'rund', 'aria-label': 'löschen', onclick: () => { if (confirm('„' + t + '“ löschen?')) { eigenenLoeschen(t); zeichne(); } } }, '×')))
      : [h('p', { class: 'grau' }, 'Noch keine eigenen Begriffe.')]));
  }
  zeichne();
  fuelle(app, 
    kopf('Eigene Begriffe', { ziel: '#/einstellungen' }),
    h('p', { class: 'grau' }, 'Eigene Begriffe werden unter die eingebauten gemischt. Nur diese Liste ist einsehbar.'),
    h('div', { class: 'zeile' }, feld, h('button', { class: 'rund', 'aria-label': 'hinzufügen', onclick: dazu }, '+')),
    meldung, liste);
  return null;
}
