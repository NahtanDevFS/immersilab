"use client";

import { useEffect, useRef, useState } from "react";
import { readPad } from "./gamepad";
import styles from "./LobbyTutorial.module.css";

type Step = "look" | "walk" | "talk" | "doors";
const STEPS: Step[] = ["look", "walk", "talk", "doors"];

/** Pasos que solo se leen: avanzan solos después de este tiempo. */
const READ_MS: Partial<Record<Step, number>> = { talk: 9000, doors: 7000 };

interface Props {
  /** Con giroscopio = el celular está en el visor. */
  gyroActive: boolean;
  /** Ya giró la vista lo suficiente (lo mide TutorialProbe). */
  looked: boolean;
  /** Ya caminó lo suficiente (lo mide TutorialProbe). */
  walked: boolean;
  onClose: () => void;
}

/**
 * Tutorial de entrada del lobby, unos 30 segundos — PLAN_DESARROLLO.md
 * Fase F.3. Enseña lo justo para no quedarse trabado: mirar, caminar, hablar
 * con el tutor y entrar por una puerta.
 *
 * Mirar y caminar avanzan cuando el alumno lo hace de verdad, no al apretar
 * "siguiente": así se sabe que funciona en su aparato. Hablar con el tutor no
 * se puede practicar aquí (el tutor vive dentro de los experimentos), así que
 * ese paso y el último solo se leen y avanzan solos.
 *
 * Con el visor puesto no hay cómo tocar la pantalla: todo se puede hacer con
 * el control (A siguiente, B saltar) o simplemente haciendo lo que se pide.
 */
export function LobbyTutorial({ gyroActive, looked, walked, onClose }: Props) {
  const [read, setRead] = useState<Partial<Record<Step, boolean>>>({});
  const [hasPad, setHasPad] = useState(false);
  const [finePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
  );

  const done: Record<Step, boolean> = {
    look: looked || Boolean(read.look),
    walk: walked || Boolean(read.walk),
    talk: Boolean(read.talk),
    doors: Boolean(read.doors),
  };
  const step = STEPS.find((s) => !done[s]) ?? null;

  // Sin pasos pendientes, se terminó.
  const closed = useRef(false);
  useEffect(() => {
    if (step === null && !closed.current) {
      closed.current = true;
      onClose();
    }
  }, [step, onClose]);

  // Los pasos de lectura avanzan solos.
  useEffect(() => {
    const ms = step ? READ_MS[step] : undefined;
    if (!step || !ms) return;
    const id = window.setTimeout(() => setRead((r) => ({ ...r, [step]: true })), ms);
    return () => window.clearTimeout(id);
  }, [step]);

  // Sin forma de caminar (celular sin control ni teclado), el paso se puede
  // pasar a mano; con control o teclado hay que caminar de verdad. El
  // giroscopio no cuenta: un celular con giroscopio puede estar en la mano,
  // sin control, y quedaría trabado en este paso.
  const canWalk = hasPad || finePointer;
  const canAdvance = step === "talk" || step === "doors" || (step === "walk" && !canWalk);

  const stepRef = useRef(step);
  const canAdvanceRef = useRef(canAdvance);
  useEffect(() => {
    stepRef.current = step;
    canAdvanceRef.current = canAdvance;
  }, [step, canAdvance]);

  const next = () => {
    const current = stepRef.current;
    if (current && canAdvanceRef.current) setRead((r) => ({ ...r, [current]: true }));
  };
  const skip = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };
  const nextRef = useRef(next);
  const skipRef = useRef(skip);
  useEffect(() => {
    nextRef.current = next;
    skipRef.current = skip;
  });

  // Control: A siguiente, B saltar (por flanco, no mientras está apretado).
  // Teclado: Enter siguiente, Escape saltar.
  useEffect(() => {
    let prevA = true; // si ya venía apretado al abrir, no cuenta
    let prevB = true;
    const id = window.setInterval(() => {
      const pad = readPad();
      setHasPad(Boolean(pad));
      const a = pad?.action ?? false;
      const b = pad?.rawButtons[1] ?? false;
      if (a && !prevA) nextRef.current();
      if (b && !prevB) skipRef.current();
      prevA = a;
      prevB = b;
    }, 100);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") nextRef.current();
      if (event.key === "Escape") skipRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!step) return null;

  // Solo se habla del control si hay uno conectado de verdad.
  const pad = hasPad;
  const text: Record<Step, { title: string; body: string }> = {
    look: {
      title: "Mira alrededor",
      body: gyroActive
        ? "Gira la cabeza con el visor puesto."
        : finePointer
          ? "Haz clic y arrastra con el mouse."
          : "Arrastra con el dedo sobre la pantalla.",
    },
    walk: {
      title: "Camina",
      body: pad
        ? "Mueve el stick izquierdo del control."
        : finePointer
          ? "Usa W A S D o las flechas. Con Shift corres."
          : // El navegador no muestra un control hasta que se aprieta
            // algún botón: si ya está conectado, así aparece.
            "Para caminar hace falta un control (Bluetooth o USB) o un teclado. Si ya conectaste uno, aprieta cualquier botón.",
    },
    talk: {
      title: "Pregúntale al tutor",
      body: pad
        ? "Dentro de cada experimento, mantén el gatillo R2, pregunta en voz alta y suéltalo: el tutor te responde."
        : "Dentro de cada experimento, mantén presionado el botón del micrófono, pregunta en voz alta y suéltalo: el tutor te responde.",
    },
    doors: {
      title: "Entra a un experimento",
      body: "Cada puerta es un experimento. Camina hacia una y entra.",
    },
  };
  const index = STEPS.indexOf(step);

  return (
    <div className={styles.card} role="dialog" aria-live="polite" aria-label="Tutorial">
      <div className={styles.dots} aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} data-state={i < index ? "done" : i === index ? "current" : "todo"} />
        ))}
      </div>
      <p className={styles.title}>{text[step].title}</p>
      <p className={styles.body}>{text[step].body}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.skip} onClick={skip}>
          Saltar tutorial
        </button>
        {canAdvance && (
          <button type="button" className={styles.next} onClick={next}>
            {step === "doors" ? "Listo" : "Siguiente"}
          </button>
        )}
      </div>
      {pad && (
        <p className={styles.padHint}>
          {canAdvance ? "A: siguiente · B: saltar" : "B: saltar"}
        </p>
      )}
    </div>
  );
}
