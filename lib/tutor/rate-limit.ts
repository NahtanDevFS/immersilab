/**
 * Límite de preguntas al tutor por IP, en memoria del servidor.
 *
 * El endpoint es público y cada pregunta gasta cuota de la key de Gemini:
 * sin esto, cualquiera que encuentre la URL puede agotarla. Ventana
 * deslizante simple: se guardan los instantes de las últimas preguntas de
 * cada IP y se rechaza si ya hay demasiadas dentro de la ventana.
 *
 * Alcance: vive en la memoria de UN proceso de Node. Alcanza para `next
 * start` en un servidor (o la laptop de la defensa); en un despliegue
 * serverless con varias instancias cada una cuenta por su lado, y ahí haría
 * falta un almacén compartido (p. ej. una tabla en Supabase).
 */

/** Preguntas permitidas por IP dentro de la ventana. Una charla real con el tutor no pasa de ~1 cada 10 s. */
const MAX_REQUESTS = 12;
const WINDOW_MS = 60_000;
/** Tope de IPs recordadas, para que un barrido de IPs falsas no llene la memoria. */
const MAX_TRACKED_IPS = 5_000;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos hasta que vuelva a haber cupo (solo si `allowed` es false). */
  retryAfter: number;
}

export function checkRateLimit(ip: string, now = Date.now()): RateLimitResult {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  recent.push(now);
  // delete + set: el Map conserva orden de inserción, así la IP más vieja
  // queda primera y es la que se descarta si se llega al tope.
  hits.delete(ip);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED_IPS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * IP del cliente. Detrás de un proxy (Vercel, nginx) llega en
 * `x-forwarded-for`, donde la primera es la del cliente; sin proxy no hay
 * cabecera y todos comparten la clave "local", que en desarrollo está bien.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
