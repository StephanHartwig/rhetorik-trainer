// Automatische Auswertung: Die App schickt das Auswertungspaket selbst an Claude (Anthropic-Schnittstelle).
// Schlüssel, Coach-Anweisung und Modellwahl liegen nur auf diesem Gerät. Nichts davon steht im öffentlichen Code.
import { paketText } from './auswertung.js?v=2002';

const K_KEY = 'rt.api.schluessel', K_MODELL = 'rt.api.modell', K_COACH = 'rt.api.coach';
const SDK = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm';

// Preise in US-Dollar je Million Token (Stand 03.11.2026), nur für die Kostenschätzung
export const AUTO_MODELLE = [
  { id: 'claude-opus-5-5', name: 'Opus 5.5', ein: 4, aus: 20, etwa: 'etwa 10 Cent je Auswertung' },
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', ein: 2, aus: 10, etwa: 'etwa 5 Cent je Auswertung' },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', ein: 0.1, aus: 0.5, etwa: 'unter 1 Cent je Auswertung' },
  { id: 'claude-fable-5-2', name: 'Fable 5.2', ein: 8, aus: 40, etwa: 'etwa 20 Cent je Auswertung' },
];
const lies = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const schreib = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };

// Repariert Zeichensalat („erf√ºllt“ statt „erfüllt“): Er entsteht, wenn ein Text beim Kopieren mit der
// falschen Zeichentabelle gelesen wurde. Gesunder Text bleibt unverändert.
let macTabelle;
export function entwirren(text) {
  text = String(text || '');
  if (!/√[^\s]|‚Ä|¬[^\s]/.test(text)) return text;
  try {
    if (!macTabelle) {
      macTabelle = new Map();
      const dec = new TextDecoder('macintosh');
      for (let b = 128; b < 256; b++) macTabelle.set(dec.decode(new Uint8Array([b])), b);
    }
    const bytes = [], enc = new TextEncoder();
    for (const z of text) {
      const c = z.codePointAt(0);
      if (c < 128) bytes.push(c);
      else if (macTabelle.has(z)) bytes.push(macTabelle.get(z));
      else bytes.push(...enc.encode(z));
    }
    const neu = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    // nur übernehmen, wenn es dadurch besser wurde
    return (neu.match(/\uFFFD/g) || []).length <= 2 ? neu : text;
  } catch (e) { return text; }
}

export const autoModell = () => AUTO_MODELLE.find((m) => m.id === lies(K_MODELL)) || AUTO_MODELLE[0];
export const setzeAutoModell = (id) => schreib(K_MODELL, id);
export const setzeSchluessel = (s) => schreib(K_KEY, String(s || '').trim());
export const setzeCoach = (t) => schreib(K_COACH, entwirren(t).trim());
export const coachText = () => entwirren(lies(K_COACH));
export function autoStand() {
  const s = lies(K_KEY), c = coachText();
  return { schluessel: !!s, ende: s ? s.slice(-4) : '', coach: c.length, bereit: !!s && c.length > 200 };
}

let sdkP;
async function klient() {
  const m = await (sdkP || (sdkP = import(SDK).catch((e) => { sdkP = null; throw e; })));
  const Anthropic = m.default || m.Anthropic;
  // Der Schlüssel gehört dem Nutzer und liegt nur auf seinem Gerät; deshalb darf die App direkt aus dem Browser anfragen.
  return { Anthropic, c: new Anthropic({ apiKey: lies(K_KEY), dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 240000 }) };
}
function fehlerText(e, A) {
  if (A && e instanceof A.AuthenticationError) return 'Der Schlüssel wird nicht angenommen. Bitte in den Einstellungen prüfen.';
  if (A && e instanceof A.PermissionDeniedError) return 'Der Schlüssel darf dieses Modell nicht benutzen (' + (e.message || '') + ').';
  if (A && e instanceof A.RateLimitError) return 'Zu viele Anfragen in kurzer Zeit. Bitte in einer Minute noch einmal versuchen.';
  if (A && e instanceof A.BadRequestError) return /credit|balance|billing/i.test(e.message || '') ? 'Das Guthaben bei Anthropic ist aufgebraucht. Bitte dort nachladen.' : 'Die Anfrage wurde abgelehnt: ' + (e.message || '');
  if (A && e instanceof A.APIConnectionError) return 'Keine Verbindung zu Anthropic. Bitte die Internetverbindung prüfen.';
  if (A && e instanceof A.APIError) return 'Fehler bei Anthropic (' + e.status + '). Bitte später noch einmal versuchen.';
  return (e && e.message) || String(e);
}
const b64 = (blob) => new Promise((ja, nein) => {
  const r = new FileReader();
  r.onload = () => ja(String(r.result).split(',')[1]);
  r.onerror = () => nein(r.error);
  r.readAsDataURL(blob);
});

// Prüft den Schlüssel, ohne dass eine Auswertung berechnet wird (kostet nichts).
export async function verbindungTesten() {
  let A;
  try {
    const k = await klient(); A = k.Anthropic;
    const m = await k.c.models.retrieve(autoModell().id);
    return 'Verbindung steht. Modell: ' + (m.display_name || m.id) + '.';
  } catch (e) { throw new Error(fehlerText(e, A)); }
}

// Schickt Paket und Einzelbilder an Claude. Ergebnis: { text, kosten, modell }
export async function autoAuswerten(u, bilder) {
  const modell = autoModell();
  let A;
  try {
    const k = await klient(); A = k.Anthropic;
    const inhalt = [];
    for (const blob of bilder || []) inhalt.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await b64(blob) } });
    inhalt.push({ type: 'text', text: paketText(u) });
    const anfrage = {
      model: modell.id, max_tokens: 16000,
      system: coachText(),
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: inhalt }],
    };
    // Lehnt ein Modell aus Sicherheitsgründen ab, übernimmt bei Anthropic ein anderes (Haiku kennt das nicht).
    let antwort;
    if (modell.id === 'claude-haiku-5-5') antwort = await k.c.messages.create(anfrage);
    else {
      try { antwort = await k.c.beta.messages.create({ ...anfrage, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }); }
      catch (e) {
        // Nimmt die Schnittstelle die Ausweich-Angabe nicht an, dieselbe Anfrage ohne sie stellen
        if (!(e instanceof A.BadRequestError) || /credit|balance|billing/i.test(e.message || '')) throw e;
        antwort = await k.c.messages.create(anfrage);
      }
    }
    if (antwort.stop_reason === 'refusal') throw new Error('Claude hat die Auswertung abgelehnt. Bitte den Weg über die Claude-App nehmen.');
    const text = antwort.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) throw new Error('Die Antwort war leer. Bitte noch einmal versuchen.');
    const n = antwort.usage || {};
    const ein = (n.input_tokens || 0) + (n.cache_creation_input_tokens || 0) + (n.cache_read_input_tokens || 0);
    return { text, kosten: (ein * modell.ein + (n.output_tokens || 0) * modell.aus) / 1e6, modell: modell.name, abgeschnitten: antwort.stop_reason === 'max_tokens' };
  } catch (e) { throw new Error(fehlerText(e, A)); }
}
