"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNarration } from "@/lib/narration/useNarration";
import type { ExperimentBriefing } from "@/types/module";
import styles from "./BriefingPanel.module.css";

interface Props {
  experimentName: string;
  briefing: ExperimentBriefing;
}

/**
 * Cuándo se narró por última vez cada ruta. Va a nivel de módulo a propósito:
 * tiene que sobrevivir al desmontaje y montaje inmediato que hace React en
 * modo estricto, y un `useRef` se reinicia justo ahí.
 */
const narratedAt = new Map<string, number>();

/**
 * Explicación hablada del experimento, con el texto en pantalla.
 *
 * El problema que resuelve: alguien que no sabe qué es una suma de Riemann
 * entraba al experimento, veía unos bloques naranjas y no tenía forma de
 * saber qué estaba mirando ni qué se supone que tiene que hacer.
 *
 * Aparece abierto al entrar y se lee solo (un intento; si el navegador lo
 * bloquea por no haber interacción todavía, queda el botón). El texto SIEMPRE
 * está, no solo el audio: en un salón de clase con ruido, o en un celular en
 * silencio, el audio no sirve — y además así el que ya sabe puede leerlo de
 * un vistazo y cerrar.
 */
export function BriefingPanel({ experimentName, briefing }: Props) {
  const { status, speak, stop, voices, voiceName, setVoice, canPlayAudio } =
    useNarration();
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  // El guion hablado es el mismo texto de la tarjeta, en orden: qué es, qué
  // hacés y qué mirar. Mantenerlo unificado evita que la voz y la pantalla
  // digan cosas distintas cuando alguien edita solo una de las dos.
  const script = [
    `${experimentName}.`,
    briefing.what,
    briefing.how,
    briefing.goal,
  ].join(" ");

  useEffect(() => {
    // Un único intento automático al entrar, y SOLO si el navegador ya
    // dejaría sonar audio. Pedirlo antes no lo reproduce: lo encola, y esa
    // cola es la que después se largaba de golpe y sonaba repetida.
    //
    // `narratedAt` corta además el segundo disparo del modo estricto de React
    // (que en desarrollo monta cada componente dos veces) y los rebotes del
    // hot-reload: sin esto, la misma explicación arrancaba dos veces con
    // milisegundos de diferencia y se escuchaban las dos superpuestas.
    const now = Date.now();
    const alreadyNarrated = now - (narratedAt.get(pathname) ?? 0) < 3000;

    if (canPlayAudio() && !alreadyNarrated) {
      narratedAt.set(pathname, now);
      speak(script);
    }

    // La limpieza va atada a `pathname` y no a un array vacío: al cambiar de
    // experimento, Next reusa el shell y este componente puede NO
    // desmontarse, así que sin esta dependencia la explicación anterior
    // seguía sonando en el experimento nuevo.
    return stop;
    // El guion depende solo del experimento, que es lo que cambia con la ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) {
    return (
      <button
        className={styles.reopen}
        onClick={() => setOpen(true)}
        aria-label="Ver la explicación del experimento"
      >
        ?
      </button>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>Cómo funciona</h2>
        <button
          className={styles.close}
          onClick={() => {
            stop();
            setOpen(false);
          }}
          aria-label="Cerrar la explicación"
        >
          ✕
        </button>
      </header>

      <dl className={styles.body}>
        <dt className={styles.label}>Qué es</dt>
        <dd className={styles.text}>{briefing.what}</dd>
        <dt className={styles.label}>Qué hacés</dt>
        <dd className={styles.text}>{briefing.how}</dd>
        <dt className={styles.label}>El reto</dt>
        <dd className={styles.text}>{briefing.goal}</dd>
      </dl>

      {status === "unsupported" ? (
        <p className={styles.note}>Este navegador no tiene voz disponible.</p>
      ) : (
        <div className={styles.voiceRow}>
          <button
            className={styles.speak}
            onClick={() => (status === "speaking" ? stop() : speak(script))}
          >
            {status === "speaking" ? "⏹ Detener" : "▶ Escuchar"}
          </button>

          {/* Selector de voz. Cuál suena mejor depende de qué tenga instalado
              la máquina — el código elige la más natural que encuentra, pero
              entre dos voces locales la diferencia es cuestión de gusto, y
              esto evita tener que tocar código para cambiarla. La elección
              se recuerda. */}
          {voices.length > 1 && (
            <select
              className={styles.voice}
              value={voiceName}
              onChange={(e) => setVoice(e.target.value)}
              aria-label="Voz del laboratorio"
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name.replace(/^Microsoft /, "")}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </section>
  );
}
