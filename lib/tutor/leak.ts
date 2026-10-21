/**
 * Detecta cuando el modelo escribe su razonamiento como si fuera la
 * respuesta.
 *
 * Gemini a veces "piensa en voz alta" en el texto de salida, no en las
 * partes de pensamiento (esas el SDK ya las descarta): borradores en inglés
 * que repasan las reglas del system prompt, del estilo
 * "`π²` is fine in brackets. * Round numbers to 2 decimals? 0.57 cm/s".
 * Pasa sobre todo con cálculos. El tutor lo diría en voz alta y lo mostraría
 * en la conversación, así que el servidor lo corta antes.
 *
 * Las señales son cosas que una respuesta buena nunca tiene: el tutor habla
 * en español y sin markdown, así que comillas invertidas, flechas ASCII y
 * palabras funcionales del inglés solo aparecen en un borrador.
 */

/** Una sola de estas ya es razonamiento. */
const STRONG = /`|->|=>|\b(?:wait|let me|let's|the user|the student|I should|I need to|I will|I'll|actually|draft|hmm+)\b/i;

/** Palabras del inglés que no existen en español. Con dos, es un borrador. */
const ENGLISH = /\b(?:the|is|are|to|of|and|should|answer|round|fine|check|need|with|this|that|it's)\b/gi;

/** Dónde empieza el razonamiento en `text`, o -1 si no hay. */
export function reasoningStart(text: string): number {
  // Lo de adentro de [[ ]] es una fórmula para la pantalla: no cuenta.
  const plain = text.replace(/\[\[[^\]]*\]\]/g, (m) => " ".repeat(m.length));
  const strong = STRONG.exec(plain);
  let start = strong ? strong.index : -1;
  const english = [...plain.matchAll(ENGLISH)];
  if (english.length >= 2) {
    const at = english[0].index ?? 0;
    start = start === -1 ? at : Math.min(start, at);
  }
  return start;
}

/**
 * Hasta dónde se puede mandar `text` sin incluir el razonamiento: el final
 * de la última oración completa antes de que empiece, para no dejar media
 * frase colgando.
 */
export function cleanPrefix(text: string, start: number): string {
  const before = text.slice(0, start);
  // Un "]]" solo cierra algo si antes hay un "[[": suelto es un pedazo de
  // fórmula del borrador.
  const close = before.lastIndexOf("]]");
  const formulaEnd = close !== -1 && before.lastIndexOf("[[", close) !== -1 ? close : -1;
  const end = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "), formulaEnd);
  return end === -1 ? "" : before.slice(0, end + (end === formulaEnd ? 2 : 1));
}
