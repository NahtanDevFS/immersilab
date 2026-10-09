"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrientationState } from "./useDeviceOrientation";
import { readPad } from "./gamepad";
import { publishAlignment, recenterRequests, requestRecenter } from "@/lib/view/recenter";

const DEG = Math.PI / 180;

/**
 * Altura de los ojos, en metros, al entrar en modo visor.
 *
 * El giroscopio solo controla hacia dónde MIRAS, no dónde estás parado: la
 * posición la deja donde la haya dejado la cámara de la escena. En los
 * experimentos esa cámara está pensada para mirar desde afuera (a 5 m de
 * alto y en diagonal), y al ponerse el visor eso se siente como estar
 * flotando o, si la escena la baja, como mirar desde la cintura. Fijarla a
 * una altura de persona parada es lo que hace que la escala del cañón, de
 * los bloques y del pasillo se sienta real.
 */
const EYE_HEIGHT = 1.7;

/** Clic del stick izquierdo en el ESP32 (X / cuadrado en un control
 *  estándar): vuelve a centrar la vista hacia el experimento. */
const RECENTER_BUTTON = 2;

const Y_AXIS = new THREE.Vector3(0, 1, 0);

interface Props {
  orientation: OrientationState;
  enabled: boolean;
  /**
   * Hacia dónde queda el frente al entrar y al centrar la vista: el
   * experimento. Sin esto, el frente era el norte de la brújula del
   * celular, y se podía aparecer de espaldas a todo.
   */
  faceTarget?: [number, number, number];
}

/**
 * Aplica la orientación física del dispositivo a la cámara.
 * Se suaviza con interpolación para evitar el "jitter" del sensor.
 *
 * IMPORTANTE: los eventos deviceorientation (alpha/beta/gamma) siempre
 * llegan como si el teléfono estuviera en vertical, sin importar cómo lo
 * estés sosteniendo ni cómo se vea la pantalla — es una convención fija
 * del sensor, no algo que se ajuste solo. Como este laboratorio fuerza
 * horizontal (ver OrientationGate), hay que restarle ese giro de 90°
 * leyendo `screen.orientation.angle`; si no, la cámara solo queda derecha
 * sosteniendo el teléfono en vertical (el bug que estábamos viendo).
 */
export function GyroCamera({ orientation, enabled, faceTarget = [0, 0, -1000] }: Props) {
  const { camera } = useThree();
  const target = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());
  const screenTransform = useRef(
    new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)),
  );
  const screenAngleCorrection = useRef(new THREE.Quaternion());
  const zAxis = useRef(new THREE.Vector3(0, 0, 1));
  const screenAngle = useRef(0);

  // El ángulo de pantalla puede cambiar mientras la app corre (si el
  // usuario gira el teléfono entre las dos orientaciones horizontales),
  // así que se escucha el evento en vez de leerlo una sola vez.
  useEffect(() => {
    const updateAngle = () => {
      screenAngle.current = (screen.orientation?.angle ?? 0) * DEG;
    };
    updateAngle();
    screen.orientation?.addEventListener("change", updateAngle);
    return () => screen.orientation?.removeEventListener("change", updateAngle);
  }, []);

  // Se corrige UNA vez al entrar en modo visor y después el jugador manda:
  // si se forzara en cada frame, cualquier experimento que quiera mover la
  // cámara en vertical quedaría clavado sin explicación.
  const planted = useRef(false);
  /** Corrección de rumbo: cuánto se gira lo que dice la brújula. */
  const yawOffset = useRef<number | null>(null);
  const lastRequest = useRef(recenterRequests());
  const recenterWasPressed = useRef(true);
  const yawEuler = useRef(new THREE.Euler());
  const yawCorrection = useRef(new THREE.Quaternion());
  useEffect(() => {
    if (!enabled) {
      planted.current = false;
      yawOffset.current = null;
    }
  }, [enabled]);

  useFrame(() => {
    if (!enabled) return;

    if (!planted.current) {
      planted.current = true;
      // `setY` y no `position.y =`: asignarle un campo a un objeto que
      // devuelve un hook (`useThree`) es justo lo que marca el compilador de
      // React. El método hace lo mismo y es la vía que three espera.
      camera.position.setY(EYE_HEIGHT);
    }

    const { alpha, beta, gamma } = orientation;

    // Orden 'YXZ' es el que corresponde a la convención de DeviceOrientation.
    euler.current.set(beta * DEG, alpha * DEG, -gamma * DEG, "YXZ");
    target.current.setFromEuler(euler.current);

    // Corrige el hecho de que la pantalla mira hacia el usuario, no hacia arriba.
    target.current.multiply(screenTransform.current);

    // Corrige el giro de 90° por sostener el teléfono en horizontal.
    target.current.multiply(
      screenAngleCorrection.current.setFromAxisAngle(
        zAxis.current,
        -screenAngle.current,
      ),
    );

    // Centrar la vista: al entrar, con el botón 3D o con el clic del stick
    // izquierdo. Se calcula cuánto hay que girar el rumbo de la brújula para
    // quedar de frente al experimento, y se aplica desde ahí en adelante.
    const pressed = readPad()?.rawButtons[RECENTER_BUTTON] ?? false;
    if (pressed && !recenterWasPressed.current) requestRecenter();
    recenterWasPressed.current = pressed;
    if (recenterRequests() !== lastRequest.current) {
      lastRequest.current = recenterRequests();
      yawOffset.current = null;
    }
    if (yawOffset.current === null) {
      const sensorYaw = yawEuler.current.setFromQuaternion(target.current, "YXZ").y;
      const desired = Math.atan2(
        -(faceTarget[0] - camera.position.x),
        -(faceTarget[2] - camera.position.z),
      );
      yawOffset.current = desired - sensorYaw;
      publishAlignment(desired);
    }
    target.current.premultiply(yawCorrection.current.setFromAxisAngle(Y_AXIS, yawOffset.current));

    // Suavizado — evita que la cámara tiemble con el ruido del sensor.
    camera.quaternion.slerp(target.current, 0.15);
  });

  return null;
}