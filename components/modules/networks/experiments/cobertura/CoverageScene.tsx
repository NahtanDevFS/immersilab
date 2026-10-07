"use client";

import { useEffect, useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ExperimentEngine, VariablesState } from "@/types/module";
import { useFixedTimestep } from "@/lib/physics-engine/useFixedTimestep";
import {
  BUILDINGS,
  MAP_X,
  MAP_Z,
  POINTS,
  SENSITIVITY_DBM,
  SITES,
  getBand,
  receptionAt,
  type Reception,
} from "./propagation";
import { antennasFrom, type CoverageEngine } from "./engine";
import styles from "./CoverageScene.module.css";

/*
 * El campus es una maqueta sobre el piso: las coordenadas del mapa (1 unidad
 * = 50 m) se usan tal cual como metros de la escena, así que el jugador
 * camina por encima del plano como por una maqueta grande. El mapa de calor
 * va pegado al piso y los edificios se levantan encima.
 */
const GRID_X = 100;
const GRID_Z = 70;
const HEAT_Y = 0.02;

const CHANNEL_COLORS: Record<number, string> = { 1: "#2dd4bf", 6: "#f2a65a", 11: "#c084fc" };

/** Color del mapa de calor para una recepción. */
function heatColor(r: Reception, out: THREE.Color) {
  if (!Number.isFinite(r.bestDbm)) return out.setRGB(0.05, 0.07, 0.12);
  if (r.interfered) return out.setRGB(1.1, 0.25, 1.1);
  if (r.covered) {
    // De ámbar (justo en la sensibilidad) a verde (señal holgada, −55 dBm).
    const t = Math.min(1, (r.bestDbm - SENSITIVITY_DBM) / 23);
    return out.setRGB(1.0 - 0.8 * t, 0.65 + 0.45 * t, 0.2 + 0.2 * t);
  }
  // Sin señal suficiente: de rojo (cerca) a casi negro (muy lejos).
  const t = Math.min(1, (SENSITIVITY_DBM - r.bestDbm) / 22);
  return out.setRGB(0.85 * (1 - t) + 0.08 * t, 0.12 * (1 - t) + 0.06 * t, 0.1);
}

interface Props {
  engine: ExperimentEngine;
  variables: VariablesState;
}

export function CoverageScene({ engine, variables }: Props) {
  const coverage = engine as CoverageEngine;

  useFixedTimestep((dt) => {
    coverage.update(dt, variables);
  });

  const band = getBand(variables.banda ?? "2400");
  const power = Number(variables.potencia ?? 20);
  const antennas = useMemo(() => antennasFrom(variables), [variables]);

  // Mapa de calor: se rearma solo cuando cambian banda, potencia o antenas.
  const heat = useMemo(() => {
    const [x0, x1] = MAP_X;
    const [z0, z1] = MAP_Z;
    const vertsX = GRID_X + 1;
    const vertsZ = GRID_Z + 1;
    const positions = new Float32Array(vertsX * vertsZ * 3);
    const colors = new Float32Array(vertsX * vertsZ * 3);
    const color = new THREE.Color();
    for (let j = 0; j < vertsZ; j++) {
      for (let i = 0; i < vertsX; i++) {
        const x = x0 + ((x1 - x0) * i) / GRID_X;
        const z = z0 + ((z1 - z0) * j) / GRID_Z;
        const v = (j * vertsX + i) * 3;
        positions[v] = x;
        positions[v + 1] = HEAT_Y;
        positions[v + 2] = z;
        heatColor(receptionAt(antennas, x, z, band, power), color);
        colors[v] = color.r;
        colors[v + 1] = color.g;
        colors[v + 2] = color.b;
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < GRID_Z; j++) {
      for (let i = 0; i < GRID_X; i++) {
        const a = j * vertsX + i;
        indices.push(a, a + vertsX, a + 1, a + 1, a + vertsX, a + vertsX + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }, [antennas, band, power]);

  // Libera la geometría anterior: se rearma con cada movimiento de un slider.
  useEffect(() => () => heat.dispose(), [heat]);

  const receptions = useMemo(
    () => POINTS.map((p) => receptionAt(antennas, p.x, p.z, band, power)),
    [antennas, band, power],
  );

  return (
    <group>
      {/* Base del campus, debajo del mapa de calor. */}
      <mesh
        position={[(MAP_X[0] + MAP_X[1]) / 2, 0.01, (MAP_Z[0] + MAP_Z[1]) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[MAP_X[1] - MAP_X[0] + 0.4, MAP_Z[1] - MAP_Z[0] + 0.4]} />
        <meshStandardMaterial color="#0b1220" roughness={0.95} />
      </mesh>

      <mesh geometry={heat}>
        <meshBasicMaterial vertexColors transparent opacity={0.85} toneMapped={false} />
      </mesh>

      {BUILDINGS.map((b) => {
        const [x0, z0, x1, z1] = b.rect;
        return (
          <group key={b.id}>
            <mesh position={[(x0 + x1) / 2, b.height / 2, (z0 + z1) / 2]} castShadow receiveShadow>
              <boxGeometry args={[x1 - x0, b.height, z1 - z0]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.75} transparent opacity={0.88} />
            </mesh>
            <Html position={[(x0 + x1) / 2, b.height + 0.15, (z0 + z1) / 2]} center>
              <div className={styles.building}>{b.name}</div>
            </Html>
          </group>
        );
      })}

      {/* Puntos de medición: columnas verdes (cubierto), rojas (sin señal) o
          magenta (interferencia). */}
      {POINTS.map((p, i) => {
        const r = receptions[i];
        const color = r.covered ? "#34d399" : r.interfered ? "#e879f9" : "#e24b4a";
        return (
          <group key={p.id} position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 1.4, 10]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <Html position={[0, 1.55, 0]} center>
              <div className={styles.point} data-state={r.covered ? "ok" : r.interfered ? "interf" : "weak"}>
                {p.name}
                <span>
                  {Number.isFinite(r.bestDbm) ? `${Math.round(r.bestDbm)} dBm` : "—"}
                </span>
              </div>
            </Html>
          </group>
        );
      })}

      {/* Postes: los vacíos, bajos y grises; los que tienen antena, altos y
          con una esfera del color del canal. */}
      {SITES.map((s) => {
        const indexes = antennas
          .map((a, i) => (a.site.id === s.id ? i : -1))
          .filter((i) => i >= 0);
        const used = indexes.length > 0;
        return (
          <group key={s.id} position={[s.x, 0, s.z]}>
            <mesh position={[0, used ? 1.1 : 0.35, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.05, used ? 2.2 : 0.7, 8]} />
              <meshStandardMaterial color="#8e9bb0" metalness={0.85} roughness={0.3} />
            </mesh>
            {used ? (
              <>
                <mesh position={[0, 2.3, 0]}>
                  <sphereGeometry args={[0.16, 16, 12]} />
                  <meshBasicMaterial
                    color={CHANNEL_COLORS[antennas[indexes[0]].channel] ?? "#ffffff"}
                    toneMapped={false}
                  />
                </mesh>
                <Html position={[0, 2.65, 0]} center>
                  <div className={styles.antenna}>
                    {indexes
                      .map((i) => `Antena ${i + 1} · canal ${antennas[i].channel}`)
                      .join(" / ")}
                  </div>
                </Html>
              </>
            ) : (
              <Html position={[0, 0.85, 0]} center>
                <div className={styles.site}>{s.name}</div>
              </Html>
            )}
          </group>
        );
      })}

    </group>
  );
}
