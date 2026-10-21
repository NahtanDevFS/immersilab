import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type ThinkingConfig,
} from "@google/genai";
import {
  formatUserTurn,
  TUTOR_LIMITS,
  type TutorRequest,
  type TutorTurn,
} from "@/lib/tutor/protocol";
import { checkRateLimit, clientIp } from "@/lib/tutor/rate-limit";
import { cleanPrefix, reasoningStart } from "@/lib/tutor/leak";

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

Tu respuesta se convierte en AUDIO con un sintetizador de voz, y además se muestra escrita en subtítulos y en la conversación. Por eso:
- Responde en tres oraciones como máximo. Si el tema necesita más, cierra con una pregunta y espera a que el estudiante responda.
- Nada de markdown, listas, viñetas, emojis ni símbolos en el texto que se dice. Escribe "v sub uno", no "v₁".
- Las fórmulas se dicen habladas dentro de la oración: "ele sobre ge, todo bajo raíz", no "√(L/g)".
- Cada vez que digas una fórmula o una ecuación, escríbela además entre dobles corchetes justo después de la oración que la dice, por ejemplo: El período es dos pi por la raíz de ele sobre ge. [[T = 2π·√(L / g)]]
  Lo que va entre dobles corchetes NO se dice en voz alta, solo se lee en pantalla, así que la oración hablada tiene que decir la fórmula completa igual. Dentro de los corchetes usa símbolos Unicode legibles (π, √, ², ·, /, Δ, θ, ω, subíndices como v₁) y paréntesis cuando haga falta. Nada de LaTeX ni barras invertidas. Una fórmula por par de corchetes. Las fórmulas escritas no cuentan para el límite de tres oraciones.
- Redondea los números a dos decimales como mucho y di las unidades completas ("metros por segundo").
- Todo lo que escribes se dice en voz alta: escribe SOLO la respuesta final, en español. Nunca escribas tu razonamiento, borradores, cuentas sueltas ni repases estas reglas (nada de "wait", "round to two decimals" ni nada en inglés). Piensa antes, en silencio.
- Es una conversación en tiempo real: empieza a responder de inmediato, sin preámbulos. No saludes ni elogies la pregunta ("hola", "qué buena pregunta"): ve directo a la respuesta.

Pedagogía:
- Cada pregunta trae el estado actual del experimento. Usa siempre esos valores concretos en la explicación.
- "panel" es el panel de variables tal como lo ve el estudiante: nombre, valor, unidad y rango. Cuando hables de una variable, llámala por ese nombre, nunca por su clave interna. Si pregunta qué significa algo de la pantalla, explícalo con el valor que tiene puesto.
- "result" puede traer el resultado de un intento anterior (un disparo, una soltada, un choque) hecho con otros valores. Antes de usar un número de ahí, comprueba que corresponde a las variables actuales; si no, no lo uses como respuesta.
- Si te piden que hagas un cálculo, hazlo de verdad con los valores actuales y di los pasos con sus números. Si "tutorNotes" trae la cuenta ya hecha, usa esos números para no equivocarte en la aritmética. "tutorNotes" son notas para ti que el estudiante no ve en pantalla: no las nombres. Nunca digas que algo no se puede calcular si "tutorNotes" trae el resultado: si no hay fórmula cerrada, explica por qué y da el resultado que trae.
- Si el estudiante puede deducir la respuesta, guíalo con una pregunta antes de dársela.
- Si pregunta algo fuera del experimento, responde brevemente y llévalo de vuelta al experimento.`;

/** Si el modelo bloquea la respuesta (filtros de seguridad), al menos se dice algo. */
const BLOCKED_LINE =
  "Esa no te la puedo responder, pero pregúntame lo que quieras del experimento.";

/** Si todos los intentos salieron con el razonamiento escrito. */
const LEAK_LINE = "Perdón, se me enredó la respuesta. ¿Me lo preguntas otra vez?";

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
  // esto corta la generación en Google (deja de consumir tokens). Cada
  // intento tiene su propio AbortController (uno descartado por razonamiento
  // se corta solo); `cancelled` corta el que esté vivo.
  let current: AbortController | null = null;
  let cancelled = false;

  /**
   * Abre un intento y junta la primera oración antes de mandar nada: así se
   * puede revisar que no sea razonamiento (lib/tutor/leak.ts) y, si lo es,
   * probar de nuevo sin que el estudiante escuche nada. No suma demora: el
   * cliente igual habla de a oraciones enteras.
   */
  const open = async (model: (typeof MODELS)[number], nudge: boolean) => {
    const controller = new AbortController();
    current = controller;
    const stream = await ai.models.generateContentStream({
      model: model.name,
      contents: nudge ? withNudge(contents) : contents,
      config: {
        systemInstruction,
        thinkingConfig: model.thinking,
        // En la familia 3.x lo que piensa cuenta dentro de este tope: con
        // 1024, una respuesta con fórmulas a veces se quedaba sin lugar y
        // terminaba a media oración.
        maxOutputTokens: 2048,
        abortSignal: controller.signal,
      },
    });
    let text = "";
    let done = false;
    while (!/[.?!](\s|$)/.test(text) && text.length < 160) {
      const next = await stream.next();
      if (next.done) {
        done = true;
        break;
      }
      text += next.value.text ?? "";
    }
    const leakAt = reasoningStart(text);
    if (leakAt !== -1) {
      controller.abort();
      const clean = cleanPrefix(text, leakAt);
      // Si arrancó bien y se desvió después, se manda lo bueno y nada más.
      return clean ? { stream: null, text: clean, done: true } : null;
    }
    return { stream, text, done };
  };

  let opened: Awaited<ReturnType<typeof open>> = null;
  let leaked = false;
  let lastError: unknown = null;
  attempts: for (const model of MODELS) {
    // Si el modelo se puso a razonar en el texto, se le pide de nuevo una
    // vez con un recordatorio; si vuelve a pasar, se prueba el siguiente.
    for (const nudge of leaked ? [true] : [false, true]) {
      try {
        opened = await open(model, nudge);
        if (opened) break attempts;
        leaked = true;
        console.warn(`[tutor] ${model.name} escribió su razonamiento; se reintenta`);
      } catch (error) {
        lastError = error;
        logError(error, model.name);
        if (!(error instanceof ApiError && RETRYABLE.has(error.status))) break attempts;
        continue attempts;
      }
    }
  }

  if (!opened) {
    if (leaked) return plainText(LEAK_LINE);
    const status = lastError instanceof ApiError ? lastError.status : 502;
    return Response.json(
      { error: "el tutor no está disponible" },
      { status: status >= 400 ? status : 502 },
    );
  }
  const { stream, text: head, done: headDone } = opened;

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        // Se manda solo hasta la última oración completa y el resto espera
        // a cerrarse: si después hay que cortar (razonamiento escrito), no
        // queda una frase colgando como "Dado que". No suma demora: el
        // cliente igual habla de a oraciones enteras.
        let received = head;
        let sent = 0;
        let finish = headDone ? "head" : "";
        let cut = "";
        const flush = (upTo: number) => {
          if (upTo > sent) {
            controller.enqueue(encoder.encode(received.slice(sent, upTo)));
            sent = upTo;
          }
        };
        try {
          flush(headDone ? received.length : sentenceEnd(received));
          if (stream && !headDone) {
            for (let next = await stream.next(); !next.done; next = await stream.next()) {
              finish = next.value.candidates?.[0]?.finishReason ?? finish;
              const text = next.value.text;
              if (!text) continue;
              const full = received + text;
              const leakAt = reasoningStart(full);
              if (leakAt !== -1) {
                // Se desvió a mitad de la respuesta: se manda hasta la
                // última oración completa y se corta la generación.
                const clean = cleanPrefix(full, leakAt);
                received = clean.length >= sent ? clean : received.slice(0, sent);
                cut = full.slice(leakAt, leakAt + 300);
                console.warn("[tutor] razonamiento a mitad de la respuesta; se corta");
                current?.abort();
                break;
              }
              received = full;
              flush(sentenceEnd(received));
            }
          }
          // Si se quedó sin tokens, lo último es media oración: se descarta.
          if (finish === "MAX_TOKENS") received = received.slice(0, Math.max(sent, sentenceEnd(received)));
          flush(received.length);
          // Sin un solo pedazo de texto = bloqueado por seguridad o vacío.
          if (!received) controller.enqueue(encoder.encode(BLOCKED_LINE));
          controller.close();
          void debugLog({ pregunta: transcript, fin: finish, cortado: cut || undefined, respuesta: received });
        } catch (error) {
          if (cancelled || current?.signal.aborted) return;
          // El cliente ve el stream cortado y dice el mensaje sin conexión.
          logError(error);
          void debugLog({ pregunta: transcript, error: String(error), respuesta: received });
          controller.error(error);
        }
      },
      cancel() {
        cancelled = true;
        current?.abort();
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

/**
 * Dónde termina la última oración completa de `text` (un punto, signo de
 * pregunta o exclamación seguido de espacio, o el cierre de una fórmula
 * [[ ]]). Un punto pegado a un número ("0.57") no cuenta: sigue la cifra.
 */
function sentenceEnd(text: string): number {
  let end = 0;
  for (const match of text.matchAll(/[.?!](?=\s)|\]\]/g)) {
    end = (match.index ?? 0) + match[0].length;
  }
  return end;
}

/**
 * Solo en desarrollo: cada respuesta queda en .debug/tutor.log, con por qué
 * terminó (STOP, MAX_TOKENS…) y lo que se cortó si hubo razonamiento. Sirve
 * para ver qué pasó cuando una respuesta sale a medias.
 */
async function debugLog(entry: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  try {
    const { appendFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), ".debug", "tutor.log");
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify({ hora: new Date().toISOString(), ...entry }) + "\n", "utf8");
  } catch {
    // Un registro de depuración nunca debe tumbar al tutor.
  }
}

/** El recordatorio del reintento, al final de la pregunta del estudiante. */
function withNudge(contents: Content[]): Content[] {
  const last = contents[contents.length - 1];
  const text = last.parts?.[0]?.text ?? "";
  return [
    ...contents.slice(0, -1),
    { ...last, parts: [{ text: `${text}\n\n(Recuerda: escribe solo lo que le vas a decir al estudiante, en español. Nada de razonamientos, borradores ni revisiones de las reglas.)` }] },
  ];
}

function plainText(text: string) {
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
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
