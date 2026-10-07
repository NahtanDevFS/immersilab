"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChallengeStatus, ExperimentEngine } from "@/types/module";
import { GUEST, completionKey, recordCompletion } from "@/lib/progress/store";
import { pushPending } from "@/lib/progress/sync";
import { useProgress } from "@/lib/progress/useSession";
import { emitChallengeCompleted } from "@/lib/tutor/events";
import styles from "./ChallengeHUD.module.css";

interface Props {
  engine: ExperimentEngine;
  /** Slug del experimento: con él se guarda el progreso (ver lib/progress). */
  experimentSlug: string;
}

/** Cuánto dura el aviso de reto logrado, en ms. */
const TOAST_MS = 3500;

/**
 * Dos notas cortas ascendentes (Do–Sol) con Web Audio: festeja sin necesitar
 * un archivo de sonido. Si el navegador todavía no permite audio (no hubo
 * gesto del usuario), simplemente no suena.
 */
function playChime() {
  try {
    const context = new AudioContext();
    [523.25, 783.99].forEach((frequency, i) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + i * 0.12;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain).connect(context.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
    window.setTimeout(() => void context.close(), 1200);
  } catch {
    // Sin audio disponible: el aviso visual alcanza.
  }
}

/**
 * HUD de retos del shell — PLAN_DESARROLLO.md §3.4 (Fase C).
 *
 * Un solo componente para todos los experimentos: cada motor reporta sus
 * retos con `getChallenges()` y el shell los dibuja igual en todos lados.
 * Se plega a una píldora ("Retos 2/3") para no tapar la escena en pantallas
 * chicas.
 */
export function ChallengeHUD({ engine, experimentSlug }: Props) {
  // Retos logrados en visitas anteriores (o en otro dispositivo, con cuenta):
  // el motor arranca de cero en cada visita, el registro no.
  const progress = useProgress();
  const saved = (id: string) =>
    Boolean(progress.completions[completionKey(experimentSlug, id)]);

  const [challenges, setChallenges] = useState<ChallengeStatus[]>(
    () => engine.getChallenges?.() ?? [],
  );
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** Retos que ya estaban logrados en la lectura anterior. */
  const doneBefore = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!engine.getChallenges) return;
    let toastTimer: number | undefined;

    const id = window.setInterval(() => {
      const next = engine.getChallenges!();
      setChallenges(next);

      const done = new Set(next.filter((c) => c.done).map((c) => c.id));
      // La primera lectura solo fija la línea base: no se festeja lo que ya
      // estaba logrado al entrar.
      if (doneBefore.current) {
        const fresh = next.find((c) => c.done && !doneBefore.current!.has(c.id));
        if (fresh) {
          // Se guarda siempre (en el dispositivo y, con cuenta, en Supabase);
          // el aviso solo la primera vez, para no festejar de nuevo lo que el
          // alumno ya había logrado en otra visita.
          const firstTime = recordCompletion(experimentSlug, fresh.id, fresh.title);
          void pushPending();
          if (firstTime) {
            setToast(fresh.title);
            playChime();
            // El tutor lo comenta por voz (si no está ocupado).
            emitChallengeCompleted({
              experimentSlug,
              challengeId: fresh.id,
              title: fresh.title,
              detail: fresh.detail,
            });
            window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => setToast(null), TOAST_MS);
          }
        }
      }
      doneBefore.current = done;
    }, 150);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(toastTimer);
    };
  }, [engine, experimentSlug]);

  if (!engine.getChallenges || challenges.length === 0) return null;

  const doneCount = challenges.filter((c) => c.done || saved(c.id)).length;
  const guest = progress.owner === GUEST;
  const allDone = doneCount === challenges.length;

  return (
    <>
      {toast && (
        // data-floating: el dock del shell pone en flujo a sus hijos, pero
        // el aviso flota arriba al centro y tiene que quedar fuera de eso.
        <div className={styles.toast} role="status" data-floating>
          <span className={styles.toastIcon} aria-hidden>
            ✓
          </span>
          <span>
            <small>Reto logrado</small>
            {toast}
          </span>
        </div>
      )}

      <section className={styles.hud} data-collapsed={collapsed} data-all={allDone}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
          >
            <span className={styles.title}>Retos</span>
            <span className={styles.count}>
              {doneCount}/{challenges.length}
            </span>
            <span className={styles.chevron} aria-hidden>
              {collapsed ? "▴" : "▾"}
            </span>
          </button>
          {!collapsed && engine.resetChallenges && doneCount > 0 && (
            <button
              type="button"
              className={styles.reset}
              onClick={() => {
                engine.resetChallenges!();
                // Que reiniciar no dispare avisos: la línea base se rehace.
                doneBefore.current = null;
              }}
            >
              Reiniciar
            </button>
          )}
        </header>

        {!collapsed && (
          <ol className={styles.list}>
            {challenges.map((c) => {
              const before = !c.done && saved(c.id);
              const done = c.done || before;
              return (
                <li key={c.id} className={styles.item} data-done={done}>
                  <span className={styles.check} aria-hidden>
                    {done ? "✓" : ""}
                  </span>
                  <span className={styles.text}>
                    <strong>{c.title}</strong>
                    <span className={styles.detail}>
                      {before ? "Ya lo lograste en una visita anterior." : c.detail}
                    </span>
                    <span className={styles.bar}>
                      <span
                        style={{
                          width: `${Math.round(Math.min(1, Math.max(0, done ? 1 : c.progress)) * 100)}%`,
                        }}
                      />
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Sin cuenta el progreso vive solo en este dispositivo: se avisa,
            sin obligar a registrarse. */}
        {!collapsed && guest && (
          <p className={styles.guest}>
            Sin cuenta, tu progreso se guarda solo en este dispositivo y se puede
            perder. <Link href="/cuenta">Ingresar</Link>
          </p>
        )}
      </section>
    </>
  );
}
