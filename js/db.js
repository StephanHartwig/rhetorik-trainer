// Speicher auf dem Gerät (IndexedDB): Übungen und die Stücke der Aufnahmen.
// Aufnahmen werden in kleinen Stücken abgelegt, damit auch lange Videos den Arbeitsspeicher nicht füllen.

let dbp;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('rt', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('uebungen')) d.createObjectStore('uebungen', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('stuecke')) d.createObjectStore('stuecke');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
function tx(speicher, modus, arbeit) {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(speicher, modus);
    let anfrage;
    try { anfrage = arbeit(t.objectStore(speicher)); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(anfrage ? anfrage.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Speichern abgebrochen'));
  }));
}
const bereich = (id) => IDBKeyRange.bound(id + ':', id + ':￿');

export const uebungSpeichern = (u) => tx('uebungen', 'readwrite', (s) => s.put(u));
export const uebungLaden = (id) => tx('uebungen', 'readonly', (s) => s.get(id));
export const alleUebungen = () => tx('uebungen', 'readonly', (s) => s.getAll()).then((l) => (l || []).sort((a, b) => (a.id < b.id ? 1 : -1)));
export const stueckSpeichern = (id, n, blob) => tx('stuecke', 'readwrite', (s) => s.put(blob, id + ':' + String(n).padStart(5, '0')));
export const stueckeLaden = (id) => tx('stuecke', 'readonly', (s) => s.getAll(bereich(id))).then((l) => l || []);
export async function uebungLoeschen(id) {
  await tx('stuecke', 'readwrite', (s) => s.delete(bereich(id)));
  await tx('uebungen', 'readwrite', (s) => s.delete(id));
}

// Die Aufnahme einer Übung als eine Datei (aus den Stücken zusammengesetzt)
export async function aufnahmeDatei(u) {
  const teile = await stueckeLaden(u.id);
  if (!teile.length) return null;
  const typ = (u.mime || (u.typ === 'ton' ? 'audio/mp4' : 'video/mp4')).split(';')[0];
  const endung = typ.includes('webm') ? 'webm' : (u.typ === 'ton' ? 'm4a' : 'mp4');
  const name = u.datum.slice(0, 10) + '_' + String(u.aufgabe || 'rede').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') + '.' + endung;
  return new File(teile, name, { type: typ });
}

export async function speicherStand() {
  try {
    const e = await navigator.storage.estimate();
    return { belegt: e.usage || 0, frei: Math.max(0, (e.quota || 0) - (e.usage || 0)) };
  } catch (e) { return null; }
}
