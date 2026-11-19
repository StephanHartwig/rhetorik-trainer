// Arbeits-Thread für die Messung: erst die Stimme, dann das Transkript mit Whisper.
// Läuft getrennt von der Oberfläche, damit die App bedienbar bleibt.
// transformers.js 3.8.1 samt Rechenkern liegt im eigenen Projekt; nur die Sprachmodelle (reine Daten) kommen von huggingface.co.
import { pipeline, env } from '../lib/transformers/transformers.min.js';
env.backends.onnx.wasm.wasmPaths = new URL('../lib/transformers/', import.meta.url).href;
env.allowLocalModels = false;
import { stimmAnalyse } from './analyse.js?v=2204';

// Whisper erfindet bei Stille manchmal solche Sätze. Sie werden verworfen.
const ERFUNDEN = /untertitel|amara\.org|vielen dank fürs zuschauen|bis zum nächsten mal|copyright|im auftrag des/i;

self.onmessage = async (e) => {
  const { audio, dauer, modell } = e.data;
  try {
    const { werte, fenster } = stimmAnalyse(audio, dauer);
    self.postMessage({ typ: 'stimme', stimme: werte, fenster: fenster.length });
    const asr = await pipeline('automatic-speech-recognition', modell, {
      device: 'wasm', dtype: 'q8',
      session_options: { enableCpuMemArena: false, enableMemPattern: false },   // weniger Arbeitsspeicher, etwas langsamer
      progress_callback: (p) => { if (p.status === 'progress') self.postMessage({ typ: 'laden', pct: p.progress }); },
    });
    self.postMessage({ typ: 'modell' });
    const segmente = [];
    for (let i = 0; i < fenster.length; i++) {
      const f = fenster[i];
      if (f.sprache >= 0.03) {
        const teil = audio.slice(Math.floor(f.von * 16000), Math.floor(f.bis * 16000));
        const out = await asr(teil, { language: 'german', task: 'transcribe', return_timestamps: true });
        const stuecke = out.chunks && out.chunks.length ? out.chunks : [{ timestamp: [0, null], text: out.text }];
        for (const c of stuecke) {
          const text = String(c.text || '').trim();
          if (!text || ERFUNDEN.test(text)) continue;
          segmente.push({ t: Math.round((f.von + ((c.timestamp && c.timestamp[0]) || 0)) * 10) / 10, text });
        }
      }
      self.postMessage({ typ: 'fenster', i: i + 1, n: fenster.length });
    }
    self.postMessage({ typ: 'fertig', segmente });
  } catch (err) {
    self.postMessage({ typ: 'fehler', text: String((err && err.message) || err) });
  }
};
