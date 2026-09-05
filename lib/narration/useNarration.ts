"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voz del laboratorio, sobre la Web Speech API del navegador
 * (`speechSynthesis`).
 *
 * Por qué el TTS del navegador y no un servicio de servidor: funciona sin
 * internet y sin costo por request, que son dos de los riesgos que el plan
 * marca para la defensa (§7 de PLAN_DESARROLLO.md). La contra es que la
 * calidad depende de las voces instaladas en la máquina. Este hook aísla la
 * implementación: si más adelante se pasa a un TTS de servidor, se cambia
 * acá y ningún experimento se entera.
 *
 * QUÉ SE PUEDE Y QUÉ NO CON LO ROBÓTICO
 *
 * Lo que más define si suena a robot es la VOZ, y esa la pone el sistema
 * operativo, no el código: las locales de Windows (Microsoft Sabina, Raul)
 * son concatenativas y suenan a lector de los 2000; las de red (Google,
 * Microsoft Natural/Online) son neuronales y suenan a persona. Por eso acá
 * se hacen tres cosas:
 *
 *   1. Se elige la mejor voz disponible con un puntaje (`voiceScore`), que
 *      prioriza las neuronales.
 *   2. Se deja elegir a mano (`voices` + `setVoice`), porque cuál suena
 *      mejor entre las instaladas es cuestión de gusto y de máquina.
 *   3. Se lee ORACIÓN POR ORACIÓN con una pausa entre medio, en vez de
 *      mandar el párrafo entero de una. Esto es lo que más se nota sin
 *      cambiar de voz: el motor le da a cada oración su propia entonación de
 *      cierre, en lugar de leer todo con la misma curva y sin respirar.
 *
 * Tres trampas de esta API, todas resueltas abajo:
 *
 * 1. **Las voces cargan tarde.** `getVoices()` devuelve una lista vacía en el
 *    primer render de Chrome; hay que esperar el evento `voiceschanged`. Sin
 *    esto, la explicación se lee con la voz por defecto del sistema, que en
 *    una máquina en inglés lee el español como si fuera inglés.
 * 2. **`cancel()` NO cancela lo que todavía no empezó a sonar.** Es la causa
 *    del bug de la voz que seguía leyendo la suma de Riemann después de
 *    salir del experimento: al entrar, el navegador encola la frase (aún no
 *    hay gesto del usuario que habilite el audio), y `cancel()` sobre una
 *    frase encolada no siempre la descarta — se queda esperando y arranca
 *    con el primer clic que hagas, ya en otra pantalla. Por eso, además de
 *    cancelar, cada frase lleva un número de generación: si cuando por fin
 *    arranca su generación ya venció, se corta sola.
 * 3. **`onend` no siempre llega** si se cancela o si el componente se
 *    desmonta a mitad de la frase; el estado se limpia también al desmontar.
 */

export type NarrationStatus = "idle" | "speaking" | "unsupported";

/** Dónde se recuerda la voz elegida a mano. */
const VOICE_STORAGE_KEY = "immersilab.voice";

/** Pausa entre oraciones, en ms. Corta: es una explicación, no un poema. */
const SENTENCE_GAP = 170;

/**
 * Puntaje de qué tan natural suena una voz. Las de red (`localService ===
 * false`: Google, Microsoft Online/Natural) están sintetizadas con modelos
 * neuronales y suenan mucho menos robóticas que las locales del sistema.
 *
 * Se prefiere además español de América sobre el peninsular: el proyecto
 * está escrito en español de Guatemala y una voz de España leyendo voseo
 * suena fuera de lugar.
 */
function voiceScore(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  if (!lang.startsWith("es")) return -1;

  let score = 0;
  const name = voice.name.toLowerCase();

  if (!voice.localService) score += 40; // voz de red = neuronal
  if (/google/.test(name)) score += 25;
  if (/natural|neural|online|premium|enhanced/.test(name)) score += 25;
  if (/^es-(mx|us|419|gt|co|ar|cl|pe)/.test(lang)) score += 10;
  if (voice.default) score += 2;

  return score;
}

/**
 * Parte el guion en oraciones. Se cortan también los dos puntos, porque en
 * estos textos introducen una definición y ahí la pausa cae natural.
 */
function toSentences(text: string): string[] {
  return text
    .split(/(?<=[.;:!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * ¿El navegador dejaría sonar audio ahora mismo?
 *
 * Los navegadores bloquean el audio hasta que el usuario interactúa con la
 * página al menos una vez. Lo importante no es que el bloqueo exista, sino
 * qué hace `speechSynthesis` con lo que se le pidió mientras tanto: NO lo
 * descarta, lo deja ENCOLADO. Después, al primer clic, larga todo junto —
 * frases viejas incluidas, y a veces la misma dos veces. Eso es lo que se
 * escuchaba como una explicación repitiéndose en bucle.
 *
 * Por eso no se pide nada hasta que hay activación: sin cola, no hay
 * repeticiones. Si el navegador no expone la API, se asume que NO hay
 * activación y queda el botón, que es el lado seguro del error.
 */
function canPlayAudio(): boolean {
  const activation = (
    navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  ).userActivation;
  return activation?.hasBeenActive ?? false;
}

export function useNarration() {
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  /** Sube en cada stop/speak; invalida las frases encoladas de antes. */
  const generation = useRef(0);
  /** Timer de la pausa entre oraciones, para poder cortarlo al cancelar. */
  const gapTimer = useRef<number | null>(null);

  useEffect(() => {
    // Sin `speechSynthesis` no hay nada que suscribir. El estado
    // "unsupported" NO se fija acá: marcarlo desde un efecto dispara un
    // render en cascada (y en SSR el efecto ni corre). Se resuelve en
    // `speak()`, que es el único momento en que hace falta saberlo.
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const pickVoice = () => {
      const all = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("es"));
      if (all.length === 0) return;

      setVoices(all);

      const remembered = window.localStorage.getItem(VOICE_STORAGE_KEY);
      const chosen =
        all.find((voice) => voice.name === remembered) ??
        all.reduce((best, voice) =>
          voiceScore(voice) > voiceScore(best) ? voice : best,
        );

      voiceRef.current = chosen;
      setVoiceName(chosen.name);
    };

    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);

    // Cerrar o recargar la pestaña con la voz hablando la deja sonando en
    // algunos navegadores hasta que termina la frase.
    const silence = () => window.speechSynthesis.cancel();
    window.addEventListener("pagehide", silence);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
      window.removeEventListener("pagehide", silence);
      generation.current += 1;
      silence();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // Invalida cualquier frase encolada ANTES de cancelar: si el navegador
    // la larga igual, su `onstart` va a ver que su generación venció.
    generation.current += 1;
    if (gapTimer.current !== null) {
      window.clearTimeout(gapTimer.current);
      gapTimer.current = null;
    }
    window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("unsupported");
      return;
    }

    // Siempre se cancela lo anterior: si no, las frases se encolan y tocar
    // el botón dos veces lee la explicación dos veces seguidas en vez de
    // reiniciarla.
    generation.current += 1;
    if (gapTimer.current !== null) window.clearTimeout(gapTimer.current);
    window.speechSynthesis.cancel();

    const mine = generation.current;
    const sentences = toSentences(text);
    if (sentences.length === 0) return;

    const sayFrom = (index: number) => {
      if (mine !== generation.current) return;
      if (index >= sentences.length) {
        setStatus("idle");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      utterance.lang = voiceRef.current?.lang ?? "es-MX";
      if (voiceRef.current) utterance.voice = voiceRef.current;
      // Apenas por debajo del default: es una explicación técnica, con
      // términos ("Riemann", "derivada") que a velocidad normal se pierden.
      // Más lento que esto ya suena a robot deletreando.
      utterance.rate = 0.97;
      // Un pelo arriba del centro: las voces concatenativas leen planas, y
      // subir el tono apenas les saca algo del tono de contestador.
      utterance.pitch = 1.05;

      utterance.onstart = () => {
        if (mine !== generation.current) {
          // Frase zombi: se encoló, se pidió cancelarla, y el navegador la
          // largó igual (ver trampa 2 arriba). Se corta apenas arranca.
          window.speechSynthesis.cancel();
        }
      };
      utterance.onend = () => {
        if (mine !== generation.current) return;
        // La pausa entre oraciones es la mitad de lo que hace que no suene a
        // párrafo leído de corrido.
        gapTimer.current = window.setTimeout(
          () => sayFrom(index + 1),
          SENTENCE_GAP,
        );
      };
      utterance.onerror = () => setStatus("idle");

      window.speechSynthesis.speak(utterance);
    };

    setStatus("speaking");
    sayFrom(0);
  }, []);

  /** Cambia la voz a mano y la recuerda para las próximas sesiones. */
  const setVoice = useCallback(
    (name: string) => {
      const chosen = voices.find((voice) => voice.name === name);
      if (!chosen) return;
      voiceRef.current = chosen;
      setVoiceName(name);
      window.localStorage.setItem(VOICE_STORAGE_KEY, name);
    },
    [voices],
  );

  return { status, speak, stop, voices, voiceName, setVoice, canPlayAudio };
}
