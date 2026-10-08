import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentResponse,
  type ThinkingConfig,
} from "@google/genai";
import {
  formatUserTurn,
  TUTOR_LIMITS,
  type TutorRequest,
  type TutorTurn,
} from "@/lib/tutor/protocol";
import { checkRateLimit, clientIp } from "@/lib/tutor/rate-limit";

/**
 * Tutor por voz — ver PLAN_DESARROLLO.md §4.3.
 *
 * Usa Gemini con el SDK oficial de Google (`@google/genai`). Runtime Node
 * (no Edge). La key se lee de GEMINI_API_KEY y NUNCA sale del servidor: no
 * lleva prefijo NEXT_PUBLIC_.
 *
 * La respuesta es texto plano en streaming; el cliente lo corta en oraciones
 * (lib/tutor/sentence-buffer.ts) y las va hablando a medida que se cierran.
 */
export const runtime = "nodejs";

/*
 * Modelos en orden de preferencia. En voz lo que manda es el tiempo hasta la
 * primera palabra, y para respuestas de tres oraciones un Flash-Lite alcanza
 * de sobra. Medido con la key del proyecto (2026-10-06): 3.5 Flash-Lite
 * responde en ~0.7 s; los Flash más grandes (3.5, 3.8, `flash-latest`)
 * devolvían 503 "high demand" o tardaban 20–30 s.
 *
 * Si el primero está saturado (503/429) se prueba el siguiente, antes de
 * mandarle un solo byte al cliente. Se fijan versiones concretas, no alias
 * `-latest`, para que el tutor no cambie de comportamiento solo a días de la
 * defensa.
 *
 * Cada modelo regula el pensamiento distinto: la familia 3.x usa
 * `thinkingLevel` (y Flash-Lite no acepta MINIMAL), la 2.5 usa
 * `thinkingBudget`. Pensar poco es lo que baja la latencia.
 */
const MODELS: { name: string; thinking: ThinkingConfig }[] = [
  {
    name: "gemini-3.5-flash-lite",
    thinking: { thinkingLevel: ThinkingLevel.LOW },
  },
  { name: "gemini-2.5-flash", thinking: { thinkingBudget: 0 } },
];

/** Errores por los que vale la pena probar con el siguiente modelo. */
const RETRYABLE = new Set([429, 500, 503, 504]);

/*
 * El system prompt es fijo byte a byte: así Gemini puede reutilizar el
 * prefijo con su caché implícito. Por eso el estado del experimento va en
 * el mensaje del usuario, no aquí.
 */
const SYSTEM = `Eres el tutor de ImmersiLab, un laboratorio virtual universitario de la Universidad Mariano Gálvez con experimentos de Física, Cálculo y Redes y Telecomunicaciones.
Hablas en español neutro, tratando al estudiante de tú (nunca de vos ni con regionalismos), con tono de auxiliar de cátedra: cercano pero preciso.

Tu respuesta se convierte en AUDIO con un sintetizador de voz y el estudiante la escucha con el celular puesto en un visor, sin teclado ni pantalla para leer. Por eso:
- Responde en tres oraciones como máximo. Si el tema necesita más, cierra con una pregunta y espera a que el estudiante responda.
- Nada de markdown, listas, viñetas, emojis ni símbolos. Escribe "v sub uno", no "v₁".
- Las fórmulas se dicen habladas: "ele sobre ge, todo bajo raíz", no "√(L/g)".
- Redondea los números a dos decimales como mucho y di las unidades completas ("metros por segundo").
- Es una conversación en tiempo real: empieza a responder de inmediato, sin preámbulos.

Pedagogía:
- Cada pregunta trae el estado actual del experimento. Usa siempre esos valores concretos en la explicación.
- "panel" es el panel de variables tal como lo ve el estudiante: nombre, valor, unidad y rango. Cuando hables de una variable, llámala por ese nombre, nunca por su clave interna. Si pregunta qué significa algo de la pantalla, explícalo con el valor que tiene puesto.
- Si el estudiante puede deducir la respuesta, guíalo con una pregunta antes de dársela.
- Si pregunta algo fuera del experimento, responde brevemente y llévalo de vuelta al experimento.`;

/** Si el modelo bloquea la respuesta (filtros de seguridad), al menos se dice algo. */
const BLOCKED_LINE =
  "Esa no te la puedo responder, pero pregúntame lo que quieras del experimento.";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  // Sin key, fallar al toque y con un motivo claro.
  if (!apiKey) {
    console.error("[tutor] falta GEMINI_API_KEY en .env");
    return Response.json({ error: "tutor sin configurar" }, { status: 503 });
  }

  // Antes de leer el body: un abuso no debería costar ni el parseo.
  const limit = checkRateLimit(clientIp(req));
  if (!limit.allowed) {
    return Response.json(
      { error: "demasiadas preguntas seguidas" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: TutorRequest;
  try {
    body = (await req.json()) as TutorRequest;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript || transcript.length > TUTOR_LIMITS.transcriptChars) {
    return Response.json({ error: "transcript inválido" }, { status: 400 });
  }
  if (
    !body.context ||
    typeof body.context !== "object" ||
    JSON.stringify(body.context).length > TUTOR_LIMITS.contextChars
  ) {
    return Response.json({ error: "context inválido" }, { status: 400 });
  }

  const history = sanitizeHistory(body.history);
  if (!history) {
    return Response.json({ error: "history inválido" }, { status: 400 });
  }

  const hints =
    typeof body.hints === "string"
      ? body.hints.slice(0, TUTOR_LIMITS.hintsChars).trim()
      : "";
  // Las pistas son fijas por experimento: el prefijo sigue estable durante
  // toda la sesión.
  const systemInstruction = hints
    ? `${SYSTEM}\n\nNotas sobre este experimento:\n${hints}`
    : SYSTEM;

  const contents: Content[] = [
    ...history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    {
      role: "user",
      parts: [{ text: formatUserTurn(transcript, body.context) }],
    },
  ];

  const ai = new GoogleGenAI({ apiKey });
  // Barge-in: si el estudiante habla encima, el cliente corta la conexión y
  // esto corta la generación en Google (deja de consumir tokens).
  const abort = new AbortController();

  let chunks: AsyncGenerator<GenerateContentResponse> | null = null;
  let first: IteratorResult<GenerateContentResponse> | null = null;
  let lastError: unknown = null;
  for (const model of MODELS) {
    try {
      chunks = await ai.models.generateContentStream({
        model: model.name,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: model.thinking,
          maxOutputTokens: 1024,
          abortSignal: abort.signal,
        },
      });
      // Se espera el primer pedazo ANTES de responder: si la key es
      // inválida o el modelo está saturado, falla aquí — se puede probar
      // otro modelo, o devolver un status de error de verdad en vez de un
      // 200 con el stream cortado.
      first = await chunks.next();
      break;
    } catch (error) {
      lastError = error;
      logError(error, model.name);
      chunks = null;
      if (!(error instanceof ApiError && RETRYABLE.has(error.status))) break;
    }
  }

  if (!chunks || !first) {
    const status = lastError instanceof ApiError ? lastError.status : 502;
    return Response.json(
      { error: "el tutor no está disponible" },
      { status: status >= 400 ? status : 502 },
    );
  }
  const stream = chunks;
  const firstChunk = first;

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        let emitted = false;
        try {
          for (
            let next = firstChunk;
            !next.done;
            next = await stream.next()
          ) {
            const text = next.value.text;
            if (text) {
              emitted = true;
              controller.enqueue(encoder.encode(text));
            }
          }
          // Sin un solo pedazo de texto = bloqueado por seguridad o vacío.
          if (!emitted) controller.enqueue(encoder.encode(BLOCKED_LINE));
          controller.close();
        } catch (error) {
          if (abort.signal.aborted) return;
          // El cliente ve el stream cortado y dice el mensaje sin conexión.
          logError(error);
          controller.error(error);
        }
      },
      cancel() {
        abort.abort();
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function sanitizeHistory(raw: unknown): TutorTurn[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;

  const turns = raw.slice(-TUTOR_LIMITS.historyTurns);
  const clean: TutorTurn[] = [];
  for (const turn of turns) {
    if (
      !turn ||
      (turn.role !== "user" && turn.role !== "assistant") ||
      typeof turn.content !== "string" ||
      turn.content.length > TUTOR_LIMITS.turnChars
    ) {
      return null;
    }
    clean.push({ role: turn.role, content: turn.content });
  }
  // Al recortar puede quedar el modelo primero; la conversación empieza en user.
  while (clean.length > 0 && clean[0].role !== "user") clean.shift();
  return clean;
}

function logError(error: unknown, model?: string) {
  if (model) console.error(`[tutor] falló ${model}`);
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      console.error(`[tutor] GEMINI_API_KEY rechazada (${error.status}):`, error.message);
    } else if (error.status === 400) {
      console.error("[tutor] request inválido para Gemini:", error.message);
    } else if (error.status === 429) {
      console.error("[tutor] cuota de Gemini agotada o límite de requests");
    } else {
      console.error(`[tutor] error de API ${error.status}:`, error.message);
    }
  } else {
    console.error("[tutor] error inesperado:", error);
  }
}
