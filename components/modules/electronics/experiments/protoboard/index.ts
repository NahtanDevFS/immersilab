import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import {
  createProtoboardEngine,
  formatOhms,
  LED_COLORS,
  LEVELS,
  MEASURE_POINTS,
  RESISTOR_VALUES,
  type ProtoboardEngine,
} from "./engine";
import { ProtoboardScene } from "./ProtoboardScene";
import { ProtoboardControls } from "./ProtoboardControls";

const resistorOptions = RESISTOR_VALUES.map((ohms) => ({ label: formatOhms(ohms), value: String(ohms) }));

const variablesSchema: VariablesSchema = {
  nivel: {
    type: "select",
    label: "Circuito",
    default: "led",
    options: LEVELS.map((l) => ({ label: l.label, value: l.id })),
  },
  r1: { type: "select", label: "R1", default: "1000", options: resistorOptions },
  r2: { type: "select", label: "R2 (niveles 2 y 3)", default: "1000", options: resistorOptions },
  r3: { type: "select", label: "R3 (nivel 3)", default: "2200", options: resistorOptions },
  led: {
    type: "select",
    label: "Color del LED (nivel 1)",
    default: "rojo",
    options: LED_COLORS.map((c) => ({ label: c.label, value: c.id })),
  },
  medir: {
    type: "select",
    label: "El multímetro mide",
    default: "i_total",
    options: MEASURE_POINTS.map((p) => ({ label: p.label, value: p.id })),
  },
};

export const protoboardExperiment: ExperimentDefinition = {
  slug: "protoboard",
  name: "Arma el circuito",
  description:
    "Arma circuitos en una protoboard con resistencias comerciales y mídelos con el multímetro: enciende un LED sin quemarlo, saca 3.3 V de una batería de 9 V y comprueba las leyes de Kirchhoff.",
  variablesSchema,
  // La mesa con la protoboard, vista desde adelante y un poco arriba.
  cameraView: { position: [0.15, 2.3, 3.1], target: [0.15, 0.85, 0] },
  whiteboard: {
    title: "Arma el circuito",
    formulas: [
      "Ley de Ohm: V = I · R",
      "Kirchhoff (voltajes): 9 V = V_R1 + V_LED (o + V_R2)",
      "LED: R = (9 V − V_LED) / I",
      "Divisor: V_R2 = 9 V · R2 / (R1 + R2)",
      "Paralelo: 1/Rp = 1/R2 + 1/R3",
      "Kirchhoff (corrientes): I_total = I_R2 + I_R3",
      "Potencia: P = I² · R (cada resistencia aguanta 0.25 W)",
    ],
    // Detrás de la mesa, de frente al jugador.
    position: [0, 1.42, -1.4],
    width: 2.4,
  },
  conceptTags: [
    "ley de Ohm",
    "leyes de Kirchhoff",
    "divisor de voltaje",
    "resistencias en serie y paralelo",
    "código de colores",
    "LED",
  ],
  briefing: {
    what: "La ley de Ohm dice que la corriente que pasa por una resistencia es el voltaje sobre ella dividido por su valor. Con eso y las leyes de Kirchhoff (los voltajes de una malla suman lo de la batería, y las corrientes que entran a un nodo son las que salen) se resuelve cualquier circuito de resistencias.",
    how: "Elige el circuito y las resistencias: solo hay valores comerciales, los que se consiguen en una tienda, y cada una tiene su código de colores. Elige también qué mide el multímetro. Ojo: las resistencias aguantan un cuarto de watt y el LED, unos treinta miliamperios; si te pasas, se queman.",
    goal: "Primero enciende el LED sin quemarlo: tienen que pasar entre diez y veinte miliamperios. Después saca 3.3 voltios de la batería de 9 con un divisor de voltaje, sin quemar ninguna resistencia. Por último, con dos ramas en paralelo distintas, mide la corriente total y la de cada rama, y comprueba que suman lo mismo.",
  },
  tutorHints:
    "Variables: nivel (led, divisor o paralelo), r1, r2 y r3 en ohmios (valores comerciales E12 de 10 ohmios a 100 kilohmios), led (rojo 1.8 voltios, verde 2.1, azul 3.0) y medir (qué mide el multímetro: voltaje de la batería, voltaje en R1, R2, R3 o el LED, o corriente por R1, que es la total porque R1 está en serie con todo, por R2 o por R3). " +
    "result: corriente_total_mA, voltajes y corrientes de cada resistencia, potencia_R1_W y las demás, voltaje_LED_V, multimetro (la lectura actual), quemados y aviso. La batería es de 9 voltios. " +
    "Sobre la mesa se ve el balance de voltajes: los nueve voltios de la batería se reparten entre lo que está en serie (ley de voltajes de Kirchhoff); si alguien pregunta por qué R1 no tiene nueve voltios, es porque el LED se queda con su caída. " +
    "Nivel 1: R1 en serie con el LED; la corriente es nueve menos la caída del LED, dividido R1. Entre 10 y 20 miliamperios brilla bien; con más de 30 se quema. Por ejemplo, con el LED rojo, 470 ohmios dan 15.3 miliamperios. " +
    "Nivel 2: divisor, el voltaje en R2 es nueve por R2 sobre R1 más R2. Para 3.3 voltios hace falta R1 alrededor de 1.73 veces R2, como 4.7 kilohmios y 2.7 kilohmios; con valores chicos como 47 y 27 ohmios el voltaje da, pero se queman porque disipan más de un cuarto de watt. " +
    "Nivel 3: R1 en serie con R2 y R3 en paralelo; la corriente total se reparte entre las ramas (ley de corrientes de Kirchhoff), más corriente por la resistencia menor. Para el reto hay que medir la total y la de cada rama con R2 distinta de R3. " +
    "Código de colores: dos dígitos, multiplicador y tolerancia dorada del 5 por ciento; amarillo violeta marrón es 470 ohmios. No des la respuesta directa: guía con preguntas.",
  SceneComponent: ProtoboardScene,
  ControlsComponent: ProtoboardControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const board = engine as ProtoboardEngine;
    const r = board.getRuntime();
    const point = MEASURE_POINTS.find((p) => p.id === r.point)?.label ?? "";
    const actions: VrAction[] = [{ id: "lectura", label: `Multímetro · ${point}: ${r.display}`, info: true }];
    if (r.message) actions.push({ id: "aviso", label: r.message, info: true });
    if (Object.values(r.burned).some(Boolean)) {
      actions.push({ id: "cambiar", label: "Cambiar lo quemado", onSelect: () => board.replaceBurned(), primary: true });
    }
    return actions;
  },
  createEngine: createProtoboardEngine,
};
