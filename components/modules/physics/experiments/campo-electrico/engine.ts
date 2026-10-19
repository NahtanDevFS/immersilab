import type {
  AIContext,
  ChallengeStatus,
  ExperimentEngine,
  VariablesState,
} from "@/types/module";
import {
  NULL_CHARGES,
  NULL_X,
  PEDESTALS,
  fieldAt,
  getLevel,
  simulate,
  type Charge,
  type Level,
  type Shot,
  type ShotEnd,
} from "./field";

/**
 * Motor de "Guía la carga". El tiro se integra completo al lanzar (ver
 * `field.ts`) y la escena lo va mostrando a tiempo real: así el resultado no
 * depende de los cuadros por segundo del celular.
 *
 * Calibración (búsqueda exhaustiva, ver la entrega del catálogo v2):
 * - Nivel 1: 334 combinaciones de cargas enteras con 1.5, 2.5, 3.5 o 5 m/s
 *   pasan por el aro; también con una sola carga, por ejemplo q2 = −1 µC a
 *   unos 4 m/s. Sin cargas la partícula sigue recta y no llega.
 * - Nivel 2 (placas de 2 m de largo separadas 1 m): con partícula positiva,
 *   a 3 m/s pasa con 800 a 1750 V y a 4 m/s con 1400 a 3000 V; con la
 *   negativa, lo mismo con el voltaje al revés.
 * - Nivel 3: 152 combinaciones con dos o más cargas rodean el muro; solo 6
 *   lo hacen con una sola, por eso el reto pide al menos dos.
 * - Nivel 4: con +4 µC y +1 µC separadas 3 m el campo se anula a 2 m de la
 *   de 4 µC.
 */

export const SENSOR_TOLERANCE = 0.05;
export const SENSOR_HOLD = 1;
/** Cuántas trayectorias viejas quedan dibujadas. */
const KEEP = 5;

export function chargesOf(variables: VariablesState): Charge[] {
  return PEDESTALS.map((p, i) => ({ ...p, q: Number(variables[`q${i + 1}`] ?? 0) }));
}

export interface FieldRuntime {
  level: Level;
  charges: Charge[];
  /** El tiro en curso (o el último) y cuánto se mostró de él, s. */
  shot: Shot | null;
  shotTime: number;
  flying: boolean;
  /** Trayectorias anteriores, para comparar tiros. */
  trails: Array<Array<{ x: number; z: number }>>;
  lastEnd: ShotEnd | null;
  /** Nivel 4: campo en el sensor y cuánto tiempo lleva en el punto nulo. */
  sensorField: number;
  sensorHeld: number;
}

export interface FieldEngine extends ExperimentEngine {
  launch: () => void;
  clearTrails: () => void;
  getRuntime: () => FieldRuntime;
}

export const END_TEXT: Record<ShotEnd, string> = {
  aro: "¡pasó por el aro!",
  esfera: "chocó con una esfera y se pegó",
  muro: "chocó con el muro",
  placa: "chocó con una placa",
  fuera: "se salió de la cámara",
  tiempo: "se quedó dando vueltas",
};

export function createFieldEngine(): FieldEngine {
  let lastVariables: VariablesState = {};
  const done = { desvia: false, placas: false, obstaculo: false, "campo-nulo": false };
  /** Signos de la partícula con que se pasó el aro entre las placas. */
  const plateSigns = new Set<number>();
  let launchInfo: { sign: number; nonZero: number } = { sign: 1, nonZero: 0 };

  const runtime: FieldRuntime = {
    level: getLevel("desvia"),
    charges: chargesOf({}),
    shot: null,
    shotTime: 0,
    flying: false,
    trails: [],
    lastEnd: null,
    sensorField: 0,
    sensorHeld: 0,
  };

  function finish() {
    const shot = runtime.shot;
    if (!shot) return;
    runtime.flying = false;
    runtime.lastEnd = shot.end;
    runtime.trails = [...runtime.trails, shot.points.map(({ x, z }) => ({ x, z }))].slice(-KEEP);
    if (shot.end !== "aro") return;
    const id = runtime.level.id;
    if (id === "desvia") done.desvia = true;
    if (id === "placas") {
      plateSigns.add(launchInfo.sign);
      if (plateSigns.size === 2) done.placas = true;
    }
    if (id === "obstaculo" && launchInfo.nonZero >= 2) done.obstaculo = true;
  }

  return {
    init(variables) {
      lastVariables = variables;
      runtime.level = getLevel(variables.nivel);
      runtime.charges = chargesOf(variables);
    },

    update(dt, variables) {
      lastVariables = variables;
      const level = getLevel(variables.nivel);
      if (level.id !== runtime.level.id) {
        runtime.level = level;
        runtime.shot = null;
        runtime.flying = false;
        runtime.trails = [];
        runtime.lastEnd = null;
      }
      runtime.charges = chargesOf(variables);

      if (runtime.flying && runtime.shot) {
        runtime.shotTime += dt;
        if (runtime.shotTime >= runtime.shot.duration) finish();
      }

      if (level.id === "campo-nulo") {
        const x = Number(variables.sensor_x ?? -1);
        const [ex, ez] = fieldAt(NULL_CHARGES, x, 0);
        runtime.sensorField = Math.hypot(ex, ez);
        // Hay que dejar el sensor quieto ahí un segundo, no pasar de largo.
        runtime.sensorHeld = Math.abs(x - NULL_X) < SENSOR_TOLERANCE ? runtime.sensorHeld + dt : 0;
        if (runtime.sensorHeld >= SENSOR_HOLD) done["campo-nulo"] = true;
      }
    },

    launch() {
      if (runtime.flying || runtime.level.id === "campo-nulo") return;
      const sign = lastVariables.signo_particula === "negativa" ? -1 : 1;
      launchInfo = { sign, nonZero: runtime.charges.filter((c) => c.q !== 0).length };
      runtime.shot = simulate({
        level: runtime.level,
        charges: runtime.charges,
        sign: sign as 1 | -1,
        speed: Number(lastVariables.velocidad ?? 3),
        angleDeg: Number(lastVariables.angulo ?? 0),
        voltage: Number(lastVariables.voltaje ?? 0),
      });
      runtime.shotTime = 0;
      runtime.flying = true;
      runtime.lastEnd = null;
    },

    clearTrails() {
      runtime.trails = [];
      if (!runtime.flying) runtime.shot = null;
    },

    reset() {
      runtime.flying = false;
      runtime.shot = null;
      runtime.trails = [];
      runtime.lastEnd = null;
    },

    resetChallenges() {
      for (const id of Object.keys(done) as Array<keyof typeof done>) done[id] = false;
      plateSigns.clear();
    },

    getRuntime() {
      return runtime;
    },

    getSeries() {
      // Distancia lateral (z) contra x del último tiro: la curva de la desviación.
      return runtime.shot ? runtime.shot.points.filter((_, i) => i % 3 === 0).map((p) => ({ x: p.x, y: p.z })) : [];
    },

    getChallenges(): ChallengeStatus[] {
      const c = (id: keyof typeof done, title: string, detail: string, progress?: number): ChallengeStatus => ({
        id, title, detail, done: done[id], progress: done[id] ? 1 : progress ?? 0,
      });
      return [
        c("desvia", "Primer desvío", "Nivel 1: pasa por el aro, que está fuera de la línea recta del lanzador."),
        c(
          "placas",
          "Entre placas",
          plateSigns.size === 1
            ? "Ya pasaste con un signo: ahora invierte la partícula y ajusta el voltaje."
            : "Nivel 2: pasa por el aro con la partícula positiva y también con la negativa.",
          plateSigns.size / 2,
        ),
        c("obstaculo", "Rodea el muro", "Nivel 3: pasa por el aro usando al menos dos cargas."),
        c("campo-nulo", "Donde el campo se anula", "Nivel 4: deja el sensor a menos de 5 cm del punto exacto durante un segundo."),
      ];
    },

    getState(): AIContext {
      const level = runtime.level;
      const result: Record<string, number | string> = { nivel: level.title };
      if (level.id === "campo-nulo") {
        result.cargas_fijas = "+4 µC en x = −1.5 m y +1 µC en x = +1.5 m";
        result.sensor_x_m = Number(lastVariables.sensor_x ?? -1);
        result.campo_en_el_sensor_v_m = Math.round(runtime.sensorField);
      } else {
        if (level.charges) result.cargas_uc = runtime.charges.map((c, i) => `q${i + 1} ${c.q}`).join(", ");
        if (level.plates) result.campo_entre_placas_v_m = Number(lastVariables.voltaje ?? 0) / level.plates.d;
        result.estado = runtime.flying ? "en vuelo" : runtime.lastEnd ? END_TEXT[runtime.lastEnd] : "sin lanzar";
        if (runtime.shot && !runtime.flying) result.duracion_del_tiro_s = Number(runtime.shot.duration.toFixed(2));
      }
      return {
        experimentName: "Guía la carga",
        disciplineName: "Física",
        variables: lastVariables,
        result,
        conceptTags: ["ley de Coulomb", "campo eléctrico", "líneas de campo", "movimiento de una carga en un campo", "placas paralelas"],
      };
    },
  };
}
