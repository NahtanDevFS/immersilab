import type { ExperimentDefinition, ExperimentEngine, VariablesSchema, VrAction } from "@/types/module";
import { actionControls } from "@/components/modules/shared/ActionList";
import { HEX, createCounterEngine, type CounterEngine } from "./engine";
import { CounterScene } from "./CounterScene";

const sourceOptions = [
  { label: "Q del anterior", value: "q" },
  { label: "Q negada del anterior", value: "qn" },
];

const variablesSchema: VariablesSchema = {
  reloj: {
    type: "select",
    label: "Reloj",
    default: "manual",
    options: [
      { label: "Manual (un pulso a la vez)", value: "manual" },
      { label: "Automático", value: "automatico" },
    ],
  },
  frecuencia: { type: "number", label: "Frecuencia del reloj", unit: "Hz", min: 0.5, max: 8, step: 0.5, default: 1 },
  clk_ff2: { type: "select", label: "Reloj del FF1", default: "q", options: sourceOptions, group: "Relojes de los flip-flops" },
  clk_ff3: { type: "select", label: "Reloj del FF2", default: "q", options: sourceOptions, group: "Relojes de los flip-flops" },
  clk_ff4: { type: "select", label: "Reloj del FF3", default: "q", options: sourceOptions, group: "Relojes de los flip-flops" },
  rst_q0: { type: "boolean", label: "Q0 a la NAND", default: false, group: "Reinicio" },
  rst_q1: { type: "boolean", label: "Q1 a la NAND", default: false, group: "Reinicio" },
  rst_q2: { type: "boolean", label: "Q2 a la NAND", default: false, group: "Reinicio" },
  rst_q3: { type: "boolean", label: "Q3 a la NAND", default: false, group: "Reinicio" },
  valor_carga: { type: "number", label: "Valor que se carga", min: 0, max: 15, step: 1, default: 0, group: "Reinicio" },
  // El plan pedía 0 a 8 Hz con paso 0.125, pero Q3 va entre 0.03 y 0.8 Hz:
  // con ese paso solo cuatro relojes tenían una respuesta que se pudiera poner.
  pred_frecuencia_q3: { type: "number", label: "Tu predicción: frecuencia de Q3", unit: "Hz", min: 0, max: 1, step: 0.005, default: 0 },
};

function actions(engine: ExperimentEngine): VrAction[] {
  const counter = engine as CounterEngine;
  const r = counter.getRuntime();
  const list: VrAction[] = [
    {
      id: "cuenta",
      label: `Cuenta: ${[3, 2, 1, 0].map((i) => (r.q[i] ? 1 : 0)).join("")} = ${r.value} (display ${HEX[r.value]})`,
      info: true,
    },
  ];
  if (r.lastCheck) {
    list.push({
      id: "q3",
      label: `Q3 medida: ${r.lastCheck.measured.toFixed(4)} Hz · tu predicción ${r.lastCheck.predicted} Hz ${r.lastCheck.ok ? "(bien)" : "(no)"}`,
      info: true,
    });
  }
  if (r.config.manual) {
    list.push({ id: "pulso", label: "Dar un pulso", onSelect: () => counter.pulse(), primary: true });
  } else {
    list.push({ id: "marcha", label: r.running ? "Detener" : "Arrancar", onSelect: () => counter.toggleRun(), primary: true });
  }
  list.push({ id: "cero", label: "Poner en cero", onSelect: () => counter.clear() });
  return list;
}

export const contadorExperiment: ExperimentDefinition = {
  slug: "contador",
  name: "El contador",
  description:
    "Un contador asíncrono de cuatro flip-flops T: haz que cuente hacia arriba o hacia abajo, divide la frecuencia y arma contadores de módulo N con una NAND de reinicio.",
  variablesSchema,
  cameraView: { position: [0.3, 2.1, 3.4], target: [0.3, 1.45, -0.4] },
  conceptTags: ["flip-flop T", "contador asíncrono", "divisor de frecuencia", "contador de módulo N", "decodificador de siete segmentos"],
  briefing: {
    what: "Un flip-flop T guarda un bit y lo invierte cada vez que su reloj baja de uno a cero. Si el reloj de cada flip-flop es la salida del anterior, cada uno cambia la mitad de veces que el anterior: juntos cuentan en binario. Por eso un contador también divide la frecuencia, y con una compuerta que lo reinicie se puede hacer que cuente solo hasta donde quieras.",
    how: "Elige si el reloj va a mano, con un pulso a la vez, o automático. Para cada flip-flop elige si su reloj sale de la salida Q del anterior o de la salida negada: con Q cuenta hacia arriba y con la negada hacia abajo. En el grupo de reinicio elige qué salidas entran a la NAND y qué número se carga cuando se activa. La pantalla de atrás muestra el diagrama de tiempos y el display, el número.",
    goal: "Predice la frecuencia de Q3 con un reloj distinto de un hercio. Haz que cuente de quince a cero, que cuente de cero a nueve sin mostrar letras, que haga de temporizador de nueve a cero dos veces seguidas, y que cuente de cero a cinco como las decenas de un reloj. Pista: la NAND tiene que mirar el primer número que no quieres mostrar, no el último que sí.",
  },
  tutorHints:
    "Variables: reloj (manual o automatico), frecuencia en hercios (0.5 a 8), clk_ff2, clk_ff3 y clk_ff4 son la fuente del reloj de los flip-flops 1, 2 y 3 (q o qn, la salida negada del anterior), rst_q0 a rst_q3 eligen qué salidas entran a la NAND de reinicio, valor_carga es el número que se carga cuando la NAND se activa, y pred_frecuencia_q3 es la predicción en hercios. " +
    "result: reloj, relojes_de_los_flip_flops, sentido, reinicio, cuenta_binaria (Q3 Q2 Q1 Q0), cuenta_decimal, display, frecuencia_q3_medida_hz y si la predicción acertó. " +
    "Modelo: flip-flops T con J y K en uno, activos en el flanco de bajada. FF0 toma el reloj del generador; cada uno de los siguientes de Q o de Q negada del anterior. Con Q cuenta hacia arriba, con Q negada hacia abajo, y mezclando salen secuencias raras. Cada etapa divide la frecuencia entre dos: Qn va a f sobre 2 a la n más uno, así que Q3 va a f sobre 16 sin reinicio (con 8 hercios, 0.5). Con reinicio, Q3 cambia: en un contador de década sube una vez cada diez pulsos. Reinicio asíncrono: cuando todas las salidas elegidas valen uno, se carga valor_carga; un instante antes el display alcanza a mostrar el estado prohibido, y eso se ve como un destello naranja. Sin entradas elegidas la NAND no hace nada. " +
    "Soluciones: década, ascendente con la NAND en Q3 y Q1 (el diez es 1010) y carga cero; módulo seis, ascendente con Q2 y Q1 (el seis es 0110) y carga cero; temporizador de nueve a cero, descendente con las cuatro salidas (el quince aparece después del cero) y carga nueve; cuenta atrás, los tres relojes en Q negada. El display es hexadecimal: de 10 a 15 muestra A, b, C, d, E y F. " +
    "Confusión típica: poner en la NAND el último número que debe mostrarse (el nueve) en vez del primero que no (el diez). Pide que escriba en binario el número donde debe reiniciar y que vea qué bits valen uno. No des la combinación de la NAND: guía con esa pregunta.",
  whiteboard: {
    title: "El contador",
    formulas: [
      "f(Qn) = f(reloj) / 2^(n+1)",
      "Sin reinicio: f(Q3) = f / 16",
      "Q → cuenta hacia arriba",
      "Q̄ → cuenta hacia abajo",
      "Reinicio: NAND de las salidas que valen 1 en el número N",
      "10 = 1010 · 6 = 0110 · 15 = 1111",
    ],
    position: [-3.0, 1.6, -0.2],
    rotationY: 0.8,
    width: 2.1,
  },
  SceneComponent: CounterScene,
  ControlsComponent: actionControls(actions),
  vrActions: actions,
  createEngine: createCounterEngine,
};
