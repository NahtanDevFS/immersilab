"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { readPad } from "./gamepad";
import { attachKeyboard, readKeyboard } from "./keyboard";
import { readJoystick } from "@/lib/input/touchJoystick";
import { resolveCollisions } from "@/lib/collision/colliders";

/*
 * 3 m/s caminando y 1.6 veces eso corriendo. Antes eran 4 y el doble (8 m/s):
 * en el pasillo del lobby, con el stick del control a fondo, se sentía como
 * una aceleración brusca, y en el visor marea.
 */
const SPEED = 3; // metros por segundo, caminando
const RUN_MULTIPLIER = 1.6; // con Shift, o el stick a fondo un momento
/** Qué tan rápido entra la carrera (1/s): en ~0.4 s, no de golpe. */
const RUN_RAMP = 2.5;

/**
 * Correr con el control: no hay botón libre (el ESP32 tiene los cuatro
 * ocupados), así que se corre empujando el stick izquierdo a fondo un
 * momento, como en muchos juegos de celular. Soltarlo un poco vuelve a
 * caminar.
 */
const RUN_STICK = 0.95;
const RUN_AFTER = 1; // s con el stick a fondo (con 0.5 s se corría sin querer)

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
 * Con `lift` (en la compu y en el visor) además se sube y se baja: Q y E, la
 * rueda del mouse sobre la escena, o el stick derecho del control hacia
 * arriba o abajo. Con el celular en la mano no: ahí el stick derecho mueve
 * el cursor virtual.
 */
export function MovementController({
  lift = false,
  maxLift = MAX_HEIGHT,
}: {
  lift?: boolean;
  /** Tope de altura, m: en el lobby, por debajo del techo. */
  maxLift?: number;
}) {
  const { camera, gl } = useThree();
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const fullStick = useRef(0);
  /** Multiplicador de carrera actual: va hacia RUN_MULTIPLIER de a poco. */
  const runFactor = useRef(1);
  /** Lo que movió la rueda desde el último frame, m. */
  const wheel = useRef(0);
  const maxHeight = useRef(maxLift);

  useEffect(() => attachKeyboard(), []);

  useEffect(() => {
    if (!lift) return;
    // Si la vista inicial ya está más alta que el tope, el tope es ella.
    maxHeight.current = Math.max(maxLift, camera.position.y);
    const element = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      // Rueda hacia adelante (deltaY negativo) sube, como acercarse a algo.
      wheel.current -= event.deltaY * WHEEL_STEP;
      event.preventDefault();
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [lift, maxLift, camera, gl]);

  useFrame((_, delta) => {
    const pad = readPad();
    const keys = readKeyboard();

    if (lift) {
      // Stick derecho hacia arriba (y negativo) sube. Solo si se empuja más
      // en vertical que en horizontal: en el visor, el stick hacia los lados
      // ajusta la variable que se está mirando, y no debe subir de paso.
      const ry = pad?.right.y ?? 0;
      const rx = pad?.right.x ?? 0;
      const stickLift = Math.abs(ry) > 0.3 && Math.abs(ry) > Math.abs(rx) ? -ry : 0;
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
    let moveX = clampAxis((pad?.left.x ?? 0) + keys.x + touch.x);
    let moveY = clampAxis((pad?.left.y ?? 0) + keys.y + touch.y);
    // En diagonal no se camina más rápido: con cada eje limitado por separado,
    // el stick en la esquina daba 1.41 veces la velocidad.
    const length = Math.hypot(moveX, moveY);
    if (length > 1) {
      moveX /= length;
      moveY /= length;
    }
    // A fondo un momento = correr, sea el stick del control o el de la pantalla.
    const stick = Math.max(Math.hypot(pad?.left.x ?? 0, pad?.left.y ?? 0), Math.hypot(touch.x, touch.y));
    fullStick.current = stick >= RUN_STICK ? fullStick.current + delta : 0;
    if (moveX === 0 && moveY === 0) {
      runFactor.current = 1;
      return;
    }
    const running = keys.run || fullStick.current >= RUN_AFTER;
    const target = running ? RUN_MULTIPLIER : 1;
    runFactor.current += (target - runFactor.current) * Math.min(1, RUN_RAMP * delta);

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();

    right.current.crossVectors(forward.current, camera.up).normalize();

    const step = SPEED * runFactor.current * delta;
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