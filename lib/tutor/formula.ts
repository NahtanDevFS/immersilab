/**
 * Fórmulas en las respuestas del tutor.
 *
 * La respuesta se escucha y también se lee (subtítulos, conversación). Dicha
 * en palabras, una fórmula se entiende al oírla pero leída es un párrafo
 * ("dos pi por la raíz de ele sobre ge"). Por eso el tutor la dice en palabras
 * Y además la escribe entre dobles corchetes: `[[T = 2π·√(L / g)]]`.
 *
 * - La voz se salta lo que va entre corchetes (`SpokenFilter`).
 * - En pantalla va en su propio renglón, como fórmula (`splitFormulas`).
 */

const OPEN = "[[";
const CLOSE = "]]";

export type ReplyPart = { kind: "text" | "formula"; value: string };

/**
 * Separa el texto en partes de texto y fórmulas. Mientras la respuesta llega,
 * una fórmula puede estar abierta sin cerrar: se muestra igual como fórmula,
 * para que no aparezcan los corchetes un instante.
 */
export function splitFormulas(text: string): ReplyPart[] {
  const parts: ReplyPart[] = [];
  let rest = text;
  while (rest) {
    const open = rest.indexOf(OPEN);
    if (open === -1) {
      parts.push({ kind: "text", value: rest });
      break;
    }
    if (open > 0) parts.push({ kind: "text", value: rest.slice(0, open) });
    const close = rest.indexOf(CLOSE, open + OPEN.length);
    const formula = rest.slice(open + OPEN.length, close === -1 ? undefined : close).trim();
    if (formula) parts.push({ kind: "formula", value: formula });
    rest = close === -1 ? "" : rest.slice(close + CLOSE.length);
  }
  return parts
    .map((p) => (p.kind === "text" ? { ...p, value: p.value.replace(/\s+/g, " ") } : p))
    .filter((p) => p.kind === "formula" || p.value.trim() !== "");
}

/**
 * Para donde el texto es un solo string (el texto 3D de la vista VR): cada
 * fórmula en su propio renglón.
 */
export function formulasOnOwnLines(text: string): string {
  return splitFormulas(text)
    .map((p) => p.value.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Saca las fórmulas del stream antes de mandarlo a la voz. Los pedazos llegan
 * cortados en cualquier parte (a veces a mitad de "[["), así que guarda lo
 * que todavía no se sabe si es texto o el comienzo de una fórmula.
 */
export class SpokenFilter {
  private pending = "";
  private inFormula = false;

  push(chunk: string): string {
    this.pending += chunk;
    let spoken = "";
    for (;;) {
      if (this.inFormula) {
        const close = this.pending.indexOf(CLOSE);
        if (close === -1) {
          // Un "]" al final puede ser la mitad del cierre.
          this.pending = this.pending.endsWith("]") ? "]" : "";
          return spoken;
        }
        this.pending = this.pending.slice(close + CLOSE.length);
        this.inFormula = false;
        // Sin la fórmula, que no queden dos palabras pegadas.
        spoken += " ";
      } else {
        const open = this.pending.indexOf(OPEN);
        if (open === -1) {
          // Un "[" al final puede ser la mitad de la apertura.
          const keep = this.pending.endsWith("[") ? 1 : 0;
          spoken += this.pending.slice(0, this.pending.length - keep);
          this.pending = this.pending.slice(this.pending.length - keep);
          return spoken;
        }
        spoken += this.pending.slice(0, open);
        this.pending = this.pending.slice(open + OPEN.length);
        this.inFormula = true;
      }
    }
  }

  /** Al terminar: un "[" suelto era texto; una fórmula sin cerrar no se dice. */
  flush(): string {
    const rest = this.inFormula ? "" : this.pending;
    this.pending = "";
    this.inFormula = false;
    return rest;
  }
}
