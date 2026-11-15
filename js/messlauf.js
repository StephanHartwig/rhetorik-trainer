// Merkt sich, welcher Schritt der Messung gerade läuft. Stürzt die App dabei ab, weiß sie es beim
// nächsten Öffnen und wählt für die Körpermessung eine sparsamere Betriebsart.
const K_LAUF = 'rt.messlauf', K_MODUS = 'rt.koerperModus';

export const lauf = {
  lies() { try { return JSON.parse(localStorage.getItem(K_LAUF)); } catch (e) { return null; } },
  setze(o) { try { localStorage.setItem(K_LAUF, JSON.stringify(o)); } catch (e) {} },
  weg() { try { localStorage.removeItem(K_LAUF); } catch (e) {} },
};
// 'gpu' = normal, 'cpu' = sparsam, 'aus' = Körpermessung abgeschaltet
export function koerperModus() { const m = localStorage.getItem(K_MODUS); return m === 'cpu' || m === 'aus' ? m : 'gpu'; }
export function setzeKoerperModus(m) { try { localStorage.setItem(K_MODUS, m); } catch (e) {} }

// Nach einem Absturz aufrufen (ein Rest-Eintrag ist noch da). Liefert { id, text } oder null.
export function absturzPruefen() {
  const r = lauf.lies();
  if (!r) return null;
  lauf.weg();
  if (r.phase === 'koerper') {
    const wo = r.von ? ' (bei Bild ' + r.bild + ' von ' + r.von + ')' : ' (beim Laden der Erkennung)';
    if (r.modus === 'gpu') {
      setzeKoerperModus('cpu');
      return { id: r.id, text: 'Der letzte Versuch wurde während der Körpermessung unterbrochen' + wo + ', vermutlich ist die App abgestürzt. Der nächste Versuch läuft in einer sparsameren Betriebsart. Bitte noch einmal antippen.' };
    }
    setzeKoerperModus('aus');
    return { id: r.id, text: 'Die Körpermessung wurde auch in der sparsamen Betriebsart unterbrochen' + wo + '. Sie ist jetzt ausgeschaltet. Ton und Transkript werden weiter gemessen. Bitte noch einmal antippen.' };
  }
  return { id: r.id, text: 'Der letzte Versuch wurde während des Transkripts unterbrochen' + (r.modell === 'gross' ? '. Wenn das wieder passiert, stelle in den Einstellungen das Transkript auf „schnell“.' : '.') + ' Bitte noch einmal antippen.' };
}
