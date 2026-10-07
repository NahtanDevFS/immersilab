/**
 * Corta un stream de texto en oraciones completas para el TTS.
 *
 * La respuesta del tutor llega de a pedacitos (a veces media palabra). Si se
 * mandara cada pedazo a `speechSynthesis`, la voz leería palabras sueltas con
 * entonación de cierre; si se esperara la respuesta entera, el usuario se
 * quedaría 2–4 s en silencio. El punto medio es hablar cada oración apenas se
 * cierra: el primer audio arranca con la primera oración (~600 ms).
 *
 * Una oración se considera cerrada cuando a un `.`, `?`, `!` o `;` le sigue
 * un espacio. Esperar el espacio evita cortar "3.5" o "m/s." a la mitad: el
 * punto decimal nunca va seguido de espacio.
 */
const SENTENCE_END = /[.;!?…](?=\s)/g;

export class SentenceBuffer {
  private pending = "";

  /** Agrega un pedazo del stream; devuelve las oraciones que quedaron completas. */
  push(chunk: string): string[] {
    this.pending += chunk;

    let lastCut = 0;
    const sentences: string[] = [];
    for (const match of this.pending.matchAll(SENTENCE_END)) {
      const end = match.index + match[0].length;
      const sentence = this.pending.slice(lastCut, end).trim();
      if (sentence) sentences.push(sentence);
      lastCut = end;
    }

    this.pending = this.pending.slice(lastCut);
    return sentences;
  }

  /** Lo que quedó sin cerrar al terminar el stream (la última oración suele no traer espacio final). */
  flush(): string | null {
    const rest = this.pending.trim();
    this.pending = "";
    return rest || null;
  }
}
