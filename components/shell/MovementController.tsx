"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { readPad } from "./gamepad";
import { attachKeyboard, readKeyboard } from "./keyboard";
import { readJoystick } from "@/lib/input/touchJoystick";
import { resolveCollisions } from "@/lib/collision/colliders";

const SPEED = 4; // metros por segundo, caminando
const RUN_MULTIPLIER = 2; // con Shift, o el stick a fondo un momento

/**
 * Correr con el control: no hay botón libre (el ESP32 tiene los cuatro
 * ocupados), así que se corre empujando el stick izquierdo a fondo un
 * momento, como en muchos juegos de celular. Soltarlo un poco vuelve a
 * caminar.
 */
const RUN_STICK = 0.92;
const RUN_AFTER = 0.5; // s con el stick a fondo

/**
 * Subir y bajar la vista (solo en la compu): cada experimento arranca la
 * cámara donde mejor se ve la escena entera, y en algunos eso es muy alto
 * (el tiro parabólico, a 7 m): todo quedaba chico y abajo.
 */
const LIFT_SPEED = 2.5; // m/s con Q/E o el stick derecho
const WHEEL_STEP = 0.004; // m por unidad de la rueda (~0.4 m por muesca)
const MIN_HEIGHT = 0.8;
/** Hasta dónde se puede subir: lo de la vista inicial, o 10 m. */
const MAX_HEIGHT = 10;

/** Radio del jugador para colisionar. Es el "cuerpo" que no atraviesa las
 *  paredes; 0.35 m es hombro a hombro y deja pasar por un vano de 1 m. */
const PLAYER_RADIUS = 0.35;

/**
 * Movimiento en el plano horizontal: stick izquierdo del control, o WASD /
 * flechas del teclado (Shift para correr). Las dos fuentes se suman, así
 * que funciona igual con visor, en la compu, o con las dos a la vez.
 *
 * Funciona igual por USB y por Bluetooth: la Gamepad API no los distingue.
 * La deteccion del control y la resolucion de que eje es cual vive en
 * ./gamepad.ts, que ademas maneja los controles USB genericos que el
 * navegador reporta con mapeo no estandar.
 *
 * Es un reemplazo temporal para pruebas: cuando el control físico del grupo
 * (ESP32, Fase 8 del plan) esté listo, se conecta como otra fuente de input
 * con la misma forma { x, y } sin tener que tocar este componente.
 *
 * El movimiento es relativo a hacia dónde mira la cámara (como caminar en
 * un shooter), y se mantiene a la altura del piso aunque mires hacia arriba
 * o abajo — por eso se anula la componente Y de "forward" antes de mover.
 *
 * Con `lift` (en la compu, sin giroscopio) además se sube y se baja: Q y E,
 * la rueda del mouse sobre la escena, o el stick derecho del control, que en
 * la compu no tiene otro uso (en el visor mueve el cursor o la interfaz, y
 * ahí la altura la da la cabeza).
 */
export function MovementController({ lift = false }: { lift?: boolean }) {
  const { camera, gl } = useThree();
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const fullStick = useRef(0);
  /** Lo que movió la rueda desde el último frame, m. */
  const wheel = useRef(0);
  const maxHeight = useRef(MAX_HEIGHT);

  useEffect(() => attachKeyboard(), []);

  useEffect(() => {
    if (!lift) return;
    // Si la vista inicial ya está más alta que el tope, el tope es ella.
    maxHeight.current = Math.max(MAX_HEIGHT, camera.position.y);
    const element = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      // Rueda hacia adelante (deltaY negativo) sube, como acercarse a algo.
      wheel.current -= event.deltaY * WHEEL_STEP;
      event.preventDefault();
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [lift, camera, gl]);

  useFrame((_, delta) => {
    const pad = readPad();
    const keys = readKeyboard();

    if (lift) {
      // Stick derecho hacia arriba (y negativo) sube.
      const stickLift = Math.abs(pad?.right.y ?? 0) > 0.3 ? -(pad?.right.y ?? 0) : 0;
      const rate = clampAxis(keys.vertical + stickLift) * LIFT_SPEED * (keys.run ? RUN_MULTIPLIER : 1);
      const change = rate * delta + wheel.current;
      wheel.current = 0;
      if (change !== 0) {
        camera.position.setY(Math.min(maxHeight.current, Math.max(MIN_HEIGHT, camera.position.y + change)));
      }
    }

    // El joystick de la pantalla (celular sin control) suma como un stick más.
    const touch = readJoystick();

    // Eje Y negativo = stick hacia arriba = caminar hacia adelante.
    const moveX = clampAxis((pad?.left.x ?? 0) + keys.x + touch.x);
    const moveY = clampAxis((pad?.left.y ?? 0) + keys.y + touch.y);
    // A fondo un momento = correr, sea el stick del control o el de la pantalla.
    const stick = Math.max(Math.hypot(pad?.left.x ?? 0, pad?.left.y ?? 0), Math.hypot(touch.x, touch.y));
    fullStick.current = stick >= RUN_STICK ? fullStick.current + delta : 0;
    if (moveX === 0 && moveY === 0) return;
    const running = keys.run || fullStick.current >= RUN_AFTER;

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();

    right.current.crossVectors(forward.current, camera.up).normalize();

    const step = SPEED * (running ? RUN_MULTIPLIER : 1) * delta;
    camera.position.addScaledVector(forward.current, -moveY * step);
    camera.position.addScaledVector(right.current, moveX * step);

    // Se mueve primero y se corrige después ("mover y resolver"): es más
    // simple que predecir el choque y, con pasos de ~7 cm por frame contra
    // paredes de 20 cm de espesor, no hay forma de atravesarlas de un salto.
    resolveCollisions(camera.position, PLAYER_RADIUS);
  });

  return null;
}

function clampAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}