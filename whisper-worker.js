// Stufe 0: Whisper-Transkript im Browser (läuft in einem eigenen Arbeits-Thread)
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

self.onmessage = async (e) => {
  const { audio, model, device } = e.data;
  try {
    const t0 = performance.now();
    const dtype = device === 'webgpu'
      ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
      : 'q8';
    const asr = await pipeline('automatic-speech-recognition', model, {
      device,
      dtype,
      progress_callback: (p) => {
        if (p.status === 'progress') {
          self.postMessage({ type: 'progress', file: p.file, pct: p.progress });
        }
      },
    });
    const t1 = performance.now();
    self.postMessage({ type: 'loaded', loadMs: t1 - t0 });
    const out = await asr(audio, {
      language: 'german',
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({ type: 'done', loadMs: t1 - t0, runMs: performance.now() - t1, out });
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};
