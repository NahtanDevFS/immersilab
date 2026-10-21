import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Modo diagnóstico (lib/debug/deviceProbe.ts): el celular manda dos veces por
 * segundo lo que está leyendo (control, toques, cámara) y acá se agrega a
 * .debug/device.log, una línea JSON por lectura. Sirve para ver qué pasa en
 * el visor sin poder mirarlo: los números reales del control y del celular.
 *
 * Solo existe con `npm run dev`. En producción responde 404 y no escribe
 * nada: es una herramienta de desarrollo, no algo para el público.
 */
export const runtime = "nodejs";

const LOG = path.join(process.cwd(), ".debug", "device.log");
/** Una lectura pesa ~1 KB; más que esto no es una lectura. */
const MAX_BYTES = 8000;

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  const text = await req.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
  try {
    JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  await mkdir(path.dirname(LOG), { recursive: true });
  await appendFile(LOG, text.replace(/\n/g, " ") + "\n", "utf8");
  return new Response(null, { status: 204 });
}
