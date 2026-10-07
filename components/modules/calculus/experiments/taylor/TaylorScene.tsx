"use client";

import { useEffect, useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import {
  TOLERANCE,
  effectiveCenter,
  evalTaylor,
  getSeriesFunction,
  taylorCoefficients,
} from "./series";
import type { TaylorEngine } from "./engine";
import styles from "./TaylorScene.module.css";

/*
 * La gráfica se para de canto, como en Riemann: x de 0 a 10 m, y de 0.3 a
 * 4.3 m, centrada en el punto al que mira la cámara al entrar (5, 1, 0).
 * Sobre el piso, delante de la gráfica, va lo que no es la curva: la franja
 * que dice dónde el polinomio ya vale y la barra del radio de convergencia.
 * Así se lee la curva de frente y, bajando la vista, el diagnóstico.
 */
const PLOT_WIDTH = 10;
const PLOT_BASE = 0.3;
const PLOT_HEIGHT = 4;
const SAMPLES = 320;
const TUBE_RADIUS = 0.045;

const STRIP_Z = 0.9;
const STRIP_DEPTH = 0.6;
const RADIUS_Z = 1.9;

const REAL_COLOR = new THREE.Color(0.3, 2.3, 2.0);
const POLY_COLOR = new THREE.Color(2.2, 1.3, 0.45);
const VALID = new THREE.Color(0.2, 1.6, 0.9);
const INVALID = new THREE.Color(0.5, 0.08, 0.1);

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

/** Corta una serie de puntos en tramos continuos dentro del rango visible. */
function visibleSegments(points: Array<THREE.Vector3 | null>): THREE.Vector3[][] {
  const segments: THREE.Vector3[][] = [];
  let current: THREE.Vector3[] = [];
  for (const p of points) {
    if (p) current.push(p);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments.filter((s) => s.length >= 2);
}

function tubesFor(segments: THREE.Vector3[][]): THREE.BufferGeometry[] {
  return segments.map(
    (points) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        Math.max(8, points.length * 2),
        TUBE_RADIUS,
        6,
      ),
  );
}

export function TaylorScene({ engine, variables }: Props) {
  const taylor = engine as TaylorEngine;

  useFixedTimestep((dt) => {
    taylor.update(dt, variables);
  });

  const fn = getSeriesFunction(variables.funcion ?? "seno");
  const degree = Math.round(Number(variables.grado ?? 1));
  const center = effectiveCenter(fn, Number(variables.centro ?? 0));

  const [x0, x1] = fn.window;
  const [y0, y1] = fn.yRange;
  const toX = (x: number) => ((x - x0) / (x1 - x0)) * PLOT_WIDTH;
  const toY = (y: number) => PLOT_BASE + ((y - y0) / (y1 - y0)) * PLOT_HEIGHT;
  const inRange = (y: number) => Number.isFinite(y) && y >= y0 && y <= y1;

  // Todo lo que depende de las variables se arma junto, una vez por cambio.
  // No hay nada que animar: la gráfica es una función pura de las variables.
  const scene = useMemo(() => {
    const coefficients = taylorCoefficients(fn, center, degree);
    const real: Array<THREE.Vector3 | null> = [];
    const poly: Array<THREE.Vector3 | null> = [];
    const valid: boolean[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = x0 + ((x1 - x0) * i) / SAMPLES;
      const fy = fn.f(x);
      const py = evalTaylor(coefficients, center, x);
      real.push(inRange(fy) ? new THREE.Vector3(toX(x), toY(fy), 0) : null);
      poly.push(inRange(py) ? new THREE.Vector3(toX(x), toY(py), 0.02) : null);
      valid.push(Math.abs(py - fy) < TOLERANCE);
    }

    // Franja del piso: verde donde |P − f| < tolerancia, rojo oscuro donde no.
    const positions = new Float32Array((SAMPLES + 1) * 2 * 3);
    const colors = new Float32Array((SAMPLES + 1) * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = (i / SAMPLES) * PLOT_WIDTH;
      const color = valid[i] ? VALID : INVALID;
      for (let side = 0; side < 2; side++) {
        const v = (i * 2 + side) * 3;
        positions[v] = x;
        positions[v + 1] = 0.03;
        positions[v + 2] = STRIP_Z + side * STRIP_DEPTH;
        colors[v] = color.r;
        colors[v + 1] = color.g;
        colors[v + 2] = color.b;
      }
      if (i < SAMPLES) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const strip = new THREE.BufferGeometry();
    strip.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    strip.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    strip.setIndex(indices);

    return {
      realTubes: tubesFor(visibleSegments(real)),
      polyTubes: tubesFor(visibleSegments(poly)),
      strip,
    };
    // toX/toY/inRange dependen solo de fn, que ya está en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, center, degree]);

  // Las geometrías viejas se liberan: con cada movimiento de un slider se
  // arman nuevas, y sin esto la memoria de video crece sin parar.
  useEffect(
    () => () => {
      scene.realTubes.forEach((g) => g.dispose());
      scene.polyTubes.forEach((g) => g.dispose());
      scene.strip.dispose();
    },
    [scene],
  );

  const radius = fn.radius(center);
  const radiusStart = Math.max(x0, center - radius);
  const radiusEnd = Math.min(x1, center + radius);
  const [t0, t1] = fn.target;
  const xAxisVisible = y0 < 0 && y1 > 0;

  return (
    <group>
      {/* Panel de fondo: le da a las curvas un plano sobre el que leerse. */}
      <mesh position={[PLOT_WIDTH / 2, PLOT_BASE + PLOT_HEIGHT / 2, -0.15]}>
        <planeGeometry args={[PLOT_WIDTH + 0.8, PLOT_HEIGHT + 0.8]} />
        <meshStandardMaterial color="#0b1220" transparent opacity={0.6} roughness={0.9} />
      </mesh>

      {xAxisVisible && (
        <mesh position={[PLOT_WIDTH / 2, toY(0), -0.05]}>
          <boxGeometry args={[PLOT_WIDTH, 0.015, 0.015]} />
          <meshBasicMaterial color={new THREE.Color(1.1, 1.1, 1.3)} toneMapped={false} />
        </mesh>
      )}

      {scene.realTubes.map((geometry, i) => (
        <mesh key={`f${i}`} geometry={geometry}>
          <meshBasicMaterial color={REAL_COLOR} toneMapped={false} />
        </mesh>
      ))}
      {scene.polyTubes.map((geometry, i) => (
        <mesh key={`p${i}`} geometry={geometry}>
          <meshBasicMaterial color={POLY_COLOR} toneMapped={false} />
        </mesh>
      ))}

      {/* Leyenda a la izquierda del panel, a media altura: arriba chocaba
          con la etiqueta del centro, que vive en el borde superior. */}
      <Html position={[-0.5, PLOT_BASE + PLOT_HEIGHT * 0.6, 0]} center>
        <div className={styles.legend}>
          <span data-real>f(x) = {fn.label}</span>
          <span data-poly>polinomio de grado {degree}</span>
        </div>
      </Html>

      {/* Postes del intervalo objetivo. */}
      {[t0, t1].map((x, i) => (
        <mesh key={i} position={[toX(x), (PLOT_BASE + PLOT_HEIGHT) / 2, 0.3]}>
          <boxGeometry args={[0.05, PLOT_BASE + PLOT_HEIGHT, 0.05]} />
          <meshBasicMaterial color={new THREE.Color(1.8, 1.8, 2)} toneMapped={false} transparent opacity={0.5} />
        </mesh>
      ))}
      <Html position={[toX((t0 + t1) / 2), 0.05, STRIP_Z + STRIP_DEPTH + 0.3]} center>
        <div className={styles.target}>
          Objetivo: [{t0.toFixed(2)}, {t1.toFixed(2)}] con error &lt; {TOLERANCE}
        </div>
      </Html>

      {/* Centro de la serie. */}
      <mesh position={[toX(center), (PLOT_BASE + PLOT_HEIGHT) / 2, 0.15]}>
        <boxGeometry args={[0.035, PLOT_BASE + PLOT_HEIGHT, 0.035]} />
        <meshBasicMaterial color={POLY_COLOR} toneMapped={false} />
      </mesh>
      <Html position={[toX(center), PLOT_BASE + PLOT_HEIGHT + 0.25, 0.15]} center>
        <div className={styles.center}>a = {center.toFixed(1)}</div>
      </Html>

      {/* Franja de validez sobre el piso. */}
      <mesh geometry={scene.strip}>
        <meshBasicMaterial vertexColors toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[-0.5, 0.05, STRIP_Z + STRIP_DEPTH / 2]} center>
        <div className={styles.axisNote}>ya vale →</div>
      </Html>

      {/* Radio de convergencia: más allá, ningún grado alcanza. */}
      {Number.isFinite(radius) && radiusEnd > radiusStart && (
        <group>
          <mesh position={[(toX(radiusStart) + toX(radiusEnd)) / 2, 0.06, RADIUS_Z]}>
            <boxGeometry args={[toX(radiusEnd) - toX(radiusStart), 0.08, 0.32]} />
            <meshBasicMaterial color={new THREE.Color(1.6, 0.6, 2.6)} toneMapped={false} />
          </mesh>
          <Html position={[(toX(radiusStart) + toX(radiusEnd)) / 2, 0.05, RADIUS_Z + 0.45]} center>
            <div className={styles.radius}>
              Radio de convergencia R = {radius.toFixed(2)}: fuera de él la serie diverge
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
