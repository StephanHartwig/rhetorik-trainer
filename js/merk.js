// Merkzettel: das Wichtigste zum Nachschlagen, in eigenen Worten. Jede Zeile lässt sich aufklappen.
import { h, fuelle, kopf, klappe } from './ui.js?v=2202';

const liste = (...punkte) => h('ul', { class: 'merk' }, punkte.map((p) => h('li', {}, p)));
const nummern = (...punkte) => h('ol', { class: 'merk' }, punkte.map((p) => h('li', {}, p)));
const satz = (t) => h('p', { class: 'grau' }, t);

const REDE = [
  ['Aufbau einer Überzeugungsrede', () => [
    nummern(
      'Einstieg, der Aufmerksamkeit weckt. Die Begrüßung bleibt bei einem Wort und einer Pause.',
      'Thema nennen – nur wenn es die Zuhörer noch nicht kennen.',
      'Naheliegende Einwände selbst ansprechen, bevor es jemand anderes tut.',
      'Drei Hauptargumente. Jedes anders stützen: mit Zahlen und Fakten, einer Geschichte, einem Zitat oder Humor.',
      'Zeigen, was passiert, wenn niemand handelt: „Nur mal angenommen …“',
      'Die drei Punkte in einem Satz wiederholen.',
      'Klare Aufforderung: Was sollen die Zuhörer jetzt tun?',
      'Schlusspunkt setzen, stehen bleiben, den Beifall annehmen.'),
    satz('Eine Rede ohne klare Aufforderung verschenkt ihre Wirkung. Fragen und Diskussion gehören nicht ans Ende der Rede, sondern in die Pause danach.')]],
  ['Neun Arten zu beginnen', () => [
    nummern('sachlich', 'humorvoll', 'mit einem Kompliment an die Zuhörer', 'mit einem Zitat', 'mit einer kurzen Geschichte',
      'mit einer rhetorischen Frage, gern mit Handzeichen', 'mit einem persönlichen Erlebnis', 'mit einem aktuellen Ereignis', 'mit einer Provokation'),
    satz('Die meisten taugen auch als Schluss. Nur die Provokation nicht: Mit ihr sollte niemand nach Hause gehen.')]],
  ['Was am Anfang nichts verloren hat', () => [
    liste('lange Begrüßung und Dank', 'ein Überblick über die Gliederung', 'Organisatorisches', 'die eigene Vorstellung', 'Entschuldigungen'),
    satz('In den ersten Sekunden entscheiden die Zuhörer, ob sie zuhören. Diese Sekunden gehören dem Einstieg.')]],
  ['Geschichte erzählen', () => [
    liste('ein einziges Erlebnis, kein Lebenslauf', 'mitten in der Szene beginnen: Ort, Zeit, wer ist da', 'in der Gegenwart erzählen',
      'ein Wendepunkt: Was kippt?', 'ein Schlusssatz, der sagt, was daraus folgt'),
    satz('Eine Minute reicht für eine gute Geschichte. Die Redezeit stellst du selbst ein.')]],
  ['Sprache und Stimme', () => [
    liste('kurze Sätze, einfache Wörter', 'Bilder und Vergleiche statt Erklärungen', 'Fragen an die Zuhörer stellen',
      'Pause vor dem Wichtigen und danach', 'Tempo, Lautstärke und Tonhöhe wechseln', 'Füllwörter durch Pausen ersetzen'),
    satz('Wie du etwas sagst, wirkt stärker als das, was du sagst.')]],
];
const KOERPER = [
  ['Körpersprache beim Reden', () => [
    liste('Die Bewegung kommt kurz vor dem Wort, nicht danach.', 'Eine klare Bewegung setzen und dann halten, statt vieler kleiner.',
      'Körper und Worte müssen dasselbe sagen, sonst glaubt man den Worten nicht.', 'Dem Publikum zugewandt bleiben.',
      'Eine Hand wirkt sicher, beide Hände bringen Energie.', 'Fakten mit der einen Seite zeigen, Gefühle mit der anderen.',
      'Bei der Kernaussage die Augenbrauen heben.', 'Große Bewegungen hinterlassen großen Eindruck.')]],
  ['Sympathisch wirken', () => [
    liste('schnell und sichtbar auf andere reagieren', 'echt lächeln, bis es die Augen erreicht', 'Augenbrauen heben',
      'Bewegungen nach oben statt nach unten', 'eine leicht asymmetrische Haltung statt starrer Symmetrie')]],
  ['Volle Aufmerksamkeit zeigen', () => [
    nummern('Unterbrich, was du gerade tust.', 'Wende zuerst das Gesicht zu, dann den ganzen Oberkörper.', 'Neige den Kopf leicht nach unten.',
      'Mach eine klare Bewegung – und dann nichts mehr, bis eine Antwort kommt.')]],
  ['Andere lesen', () => [
    liste('Ein einzelnes Signal bedeutet nichts.', 'Erst drei Signale in dieselbe Richtung ergeben ein Bild.',
      'Du siehst nie, wie jemand ist – nur, wie er auf dich wirkt.', 'Achte auf Veränderungen und frag nach, statt zu deuten.')]],
  ['Der erste Eindruck', () => [
    liste('Er entsteht in den ersten Sekunden, noch vor dem ersten Satz.', 'Der erste Eindruck entscheidet, der letzte bleibt.',
      'Kleidung: immer eine Spur besser als die Zuhörer.', 'Erst stehen, schauen, lächeln – dann sprechen.')]],
];
const VORHER = [
  ['Vorbereitung', () => [
    liste('Wie lautet das Thema genau?', 'Was ist das Ziel: Was sollen die Zuhörer danach tun?', 'Wie viele Zuhörer sind es, und wer?',
      'Was wissen sie schon über das Thema?', 'Wie viel Zeit habe ich?', 'Gibt es Vorredner? Zuhören und anknüpfen.',
      'Mit Störungen rechnen und gelassen bleiben.', 'Zwei bis drei fertige Standardreden bereithalten.')]],
  ['Vor Ort prüfen', () => [
    liste('Pult oder freier Platz', 'Mikrofon und ein Ersatz', 'Licht', 'Flipchart mit Papier und Stiften', 'Leinwand und Beamer', 'Laptop und eine Kopie der Datei',
      'Sitzordnung', 'Abstelltisch und Wasser', 'Temperatur und frische Luft', 'das eigene Äußere', 'die Uhrzeit')]],
  ['Stichwortzettel', () => [
    liste('Karteikarten in A5 oder A6', 'nur Stichwörter, keine Sätze', 'groß schreiben', 'schmale Textspalte', 'rechts oben nummerieren', 'Farben für Einstieg, Argumente, Schluss')]],
  ['Aufregung dämpfen', () => [
    liste('lang ausatmen', 'den Bauch lockern', 'sich einen stärkenden Satz laut sagen', 'sich die Zuhörer freundlich vorstellen'),
    satz('Auf dem Startbildschirm führt dich „Aufregung dämpfen“ in zwei Minuten durch diese Schritte.')]],
];

export function merkSeite(app) {
  const block = (name, eintraege) => h('div', { class: 'stapel' }, eintraege.map(([titel, inhalt], i) => klappe('merk.' + name + i, titel, '', inhalt())));
  fuelle(app, kopf('Merkzettel'),
    h('h2', {}, 'Rede'), block('rede', REDE),
    h('h2', {}, 'Körper und Wirkung'), block('koerper', KOERPER),
    h('h2', {}, 'Vor dem Auftritt'), block('vorher', VORHER));
  return null;
}
