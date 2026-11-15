// Schneidet den Ton während der Aufnahme mit: Mono, 16.000 Werte je Sekunde.
// Damit muss für die Messung später nicht das ganze Video in den Arbeitsspeicher.
class Pcm16k extends AudioWorkletProcessor {
  constructor() {
    super();
    this.schritt = sampleRate / 16000;
    this.akk = 0; this.summe = 0; this.anzahl = 0;
    this.puffer = new Int16Array(16000); this.n = 0; this.aus = false;
    this.port.onmessage = () => { this.sende(); this.aus = true; this.port.postMessage('ende'); };
  }
  sende() {
    if (!this.n) return;
    const b = this.puffer.slice(0, this.n);
    this.port.postMessage(b.buffer, [b.buffer]);
    this.n = 0;
  }
  process(eingang) {
    if (this.aus) return false;
    const k = eingang[0];
    if (!k || !k[0]) return true;
    const a = k[0], b = k[1];
    for (let i = 0; i < a.length; i++) {
      this.summe += b ? (a[i] + b[i]) / 2 : a[i]; this.anzahl++; this.akk += 1;
      if (this.akk >= this.schritt) {
        this.akk -= this.schritt;
        const s = Math.max(-1, Math.min(1, this.summe / this.anzahl));
        this.summe = 0; this.anzahl = 0;
        this.puffer[this.n++] = s * 32767;
        if (this.n === 16000) this.sende();
      }
    }
    return true;
  }
}
registerProcessor('pcm16k', Pcm16k);
