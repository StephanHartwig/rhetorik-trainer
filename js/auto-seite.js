// Einstellungsseite „Automatische Auswertung“: Schlüssel, Coach-Anweisung, Modell, Verbindungstest.
import { h, fuelle, kopf, chips, klappe } from './ui.js?v=2204';
import { AUTO_MODELLE, autoModell, setzeAutoModell, setzeSchluessel, setzeCoach, coachText, autoStand, verbindungTesten } from './auto.js?v=2204';

export function autoSeite(app) {
  function zeichne(meldung, fehler) {
    const st = autoStand();
    // Schlüssel: Der Nutzer tippt ihn selbst ein. Er bleibt im Speicher des Browsers auf diesem Gerät.
    const feld = h('input', { type: 'password', class: 'text', placeholder: 'sk-ant-…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    const coachFeld = h('textarea', { class: 'einfuegen', rows: 5, placeholder: 'Hier lange drücken und „Einsetzen“ wählen' });
    const datei = h('input', { type: 'file', accept: '.md,.txt,text/plain,text/markdown', hidden: true });
    datei.addEventListener('change', async () => {
      const f = datei.files && datei.files[0];
      if (!f) return;
      setzeCoach(await f.text()); zeichne('Coach-Anweisung aus der Datei übernommen.');
    });
    const modellChips = chips(AUTO_MODELLE.map((m) => [m.id, m.name]), autoModell().id, (id) => { setzeAutoModell(id); zeichne(); });
    const test = h('button', { class: 'breit blau', disabled: !st.schluessel, onclick: async () => {
      test.disabled = true; test.textContent = 'Prüfe …';
      try { zeichne(await verbindungTesten()); } catch (e) { zeichne(e.message, true); }
    } }, 'Verbindung testen');
    const coachOk = /RHETORIK-COACH/.test(coachText().slice(0, 200));

    fuelle(app,
      kopf('Auswertung', { ziel: '#/einstellungen' }),
      h('p', { class: st.bereit ? 'bereit' : 'warn' }, st.bereit ? 'Eingerichtet. Auf der Ergebnisseite gibt es jetzt „Automatisch auswerten“.' : 'Noch nicht eingerichtet. Es fehlt: ' + [st.schluessel ? null : 'der Schlüssel', st.coach > 200 ? null : 'die Coach-Anweisung'].filter(Boolean).join(' und ') + '.'),
      meldung ? h('p', { class: fehler ? 'hinweis fehler' : 'bereit' }, meldung) : null,
      h('div', { class: 'stapel' },
      klappe('a.schluessel', '1 · Schlüssel', st.schluessel ? 'gespeichert' : 'fehlt',
        h('div', { class: 'hinweis' }, 'Den Schlüssel bekommst du im Konto bei Anthropic (console.anthropic.com). Er bleibt nur auf diesem iPhone.' + (st.schluessel ? ' Gespeichert ist ein Schlüssel mit der Endung …' + st.ende + '.' : '')),
        h('div', { class: 'zeile' }, feld),
        h('div', { class: 'zwei' },
          h('button', { class: 'breit', onclick: () => { if (!feld.value.trim()) return; setzeSchluessel(feld.value); zeichne('Schlüssel gespeichert.'); } }, 'Speichern'),
          h('button', { class: 'breit', disabled: !st.schluessel, onclick: () => { if (confirm('Den Schlüssel von diesem Gerät löschen?')) { setzeSchluessel(''); zeichne('Schlüssel gelöscht.'); } } }, 'Löschen'))),
      klappe('a.coach', '2 · Coach-Anweisung', st.coach ? (coachOk ? 'gespeichert' : 'bitte prüfen') : 'fehlt',
        st.coach ? h('div', { class: 'hinweis' }, 'Gespeichert sind ' + st.coach + ' Zeichen.') : null,
        h('div', { class: 'hinweis' }, 'Der Text aus der Datei COACH_Projektanweisung.md. Er sagt Claude, wie es bewerten soll, und bleibt nur auf diesem iPhone.'),
        st.coach && !coachOk ? h('div', { class: 'hinweis fehler' }, 'Der gespeicherte Text beginnt nicht mit „RHETORIK-COACH“. Bitte prüfen, ob der richtige Text eingefügt wurde.') : null,
        coachFeld,
        h('div', { class: 'zwei' },
          h('button', { class: 'breit', onclick: () => { if (!coachFeld.value.trim()) return; setzeCoach(coachFeld.value); zeichne('Coach-Anweisung gespeichert.'); } }, 'Speichern'),
          h('button', { class: 'breit', onclick: () => datei.click() }, 'Aus Datei laden')),
        datei),
      klappe('a.modell', '3 · Modell', autoModell().name, modellChips.el,
        h('div', { class: 'hinweis' }, autoModell().etwa + ' (Schätzung für eine 5-Minuten-Rede mit Einzelbildern). Abgerechnet wird über dein Guthaben bei Anthropic.'))),
      test,
      h('p', { class: 'grau' }, 'Der Test prüft nur den Schlüssel und kostet nichts.'));
  }
  zeichne();
  return null;
}
