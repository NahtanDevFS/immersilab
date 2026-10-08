import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import { createLogicEngine, GATES, LEVELS, type LogicEngine } from "./engine";
import { LogicScene } from "./LogicScene";
import { LogicControls } from "./LogicControls";

const gateOptions = GATES.map((g) => ({ label: g.label, value: g.id }));

const variablesSchema: VariablesSchema = {
  nivel: {
    type: "select",
    label: "Problema",
    default: "alarma",
    options: LEVELS.map((l) => ({ label: l.title, value: l.id })),
  },
  A: { type: "boolean", label: "Interruptor A", default: false, group: "Interruptores" },
  B: { type: "boolean", label: "Interruptor B", default: false, group: "Interruptores" },
  C: { type: "boolean", label: "Interruptor C (niveles 2 y 3)", default: false, group: "Interruptores" },
  g1: { type: "select", label: "Zócalo 1", default: "vacio", options: gateOptions, group: "Compuertas" },
  g2: { type: "select", label: "Zócalo 2 (niveles 2 y 3)", default: "vacio", options: gateOptions, group: "Compuertas" },
  g3: { type: "select", label: "Zócalo 3 (niveles 2 y 3)", default: "vacio", options: gateOptions, group: "Compuertas" },
  g4: { type: "select", label: "Zócalo 4 (nivel 3)", default: "vacio", options: gateOptions, group: "Compuertas" },
  g5: { type: "select", label: "Zócalo 5 (nivel 3)", default: "vacio", options: gateOptions, group: "Compuertas" },
};

export const compuertasExperiment: ExperimentDefinition = {
  slug: "compuertas",
  name: "Arma la lógica",
  description:
    "Elige qué compuerta lógica va en cada zócalo para resolver problemas reales, y comprueba la tabla de verdad completa con los interruptores.",
  variablesSchema,
  cameraView: { position: [0, 1.75, 3.3], target: [0, 1.45, -0.5] },
  conceptTags: ["compuertas lógicas", "álgebra de Boole", "tabla de verdad", "circuitos combinacionales"],
  briefing: {
    what: "En electrónica digital cada señal vale uno (cinco voltios) o cero. Una compuerta lógica combina sus entradas según una regla: AND da uno solo si todas sus entradas son uno, OR si alguna lo es, y NOT invierte. Combinando compuertas se arma cualquier decisión, y la tabla de verdad dice qué sale para cada combinación de entradas.",
    how: "Cada problema trae el circuito ya cableado y zócalos vacíos. Elige qué compuerta va en cada uno y prueba con los interruptores: los cables con un uno se encienden. Con el botón de probar, el circuito recorre todas las combinaciones y compara su tabla de verdad con la que se pide.",
    goal: "Resuelve la alarma, el portón y los tres jueces. En el último hay un reto extra: acertar en la primera prueba, pensando la lógica antes de probar. Pista: en un zócalo de una sola entrada, la señal entra por las dos patas, así que una compuerta de dos entradas también puede servir de inversor.",
  },
  tutorHints:
    "Variables: nivel (alarma, porton, jueces), A, B y C son los interruptores (verdadero es uno), g1 a g5 la compuerta de cada zócalo (vacio, AND, OR, NOT, NAND, NOR o XOR, con su chip: 7408, 7432, 7404, 7400, 7402, 7486). " +
    "result: problema, se_pide (la expresión booleana), entradas (qué significa cada interruptor), zocalos (qué entra a cada uno y qué compuerta tiene), salida_ahora, ultima_prueba, filas_que_fallan e intentos_en_este_nivel. " +
    "Nivel 1, la alarma: Y igual a A por B, un zócalo, es una AND. Nivel 2, el portón: Y igual a (A más B) por C negado; el zócalo 1 recibe A y B, el 2 solo C, el 3 junta los dos: OR, NOT y AND. Nivel 3, los jueces, mayoría de tres: Y igual a AB más AC más BC; los zócalos 1, 2 y 3 reciben AB, AC y BC, el 4 junta 1 y 2, y el 5 junta 4 y 3: tres AND y dos OR. " +
    "En un zócalo de una entrada la señal entra por las dos patas: NAND o NOR funcionan como inversor. Un NOT en un zócalo de dos entradas usa solo la primera. Cualquier circuito con la tabla de verdad correcta vale. " +
    "Para el reto extra de los jueces hay que acertar en la primera prueba: ayuda a razonar con la tabla de verdad, sin decir qué compuerta va en cada zócalo.",
  SceneComponent: LogicScene,
  ControlsComponent: LogicControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const logic = engine as LogicEngine;
    const r = logic.getRuntime();
    const actions: VrAction[] = [{ id: "problema", label: r.level.story, info: true }];
    if (r.message) actions.push({ id: "aviso", label: r.message, info: true });
    actions.push({
      id: "probar",
      label: r.testingRow >= 0 ? `Probando fila ${r.testingRow + 1} de ${r.rows.length}…` : "Probar todas las combinaciones",
      onSelect: () => logic.runTest(),
      disabled: r.testingRow >= 0,
      primary: true,
    });
    return actions;
  },
  createEngine: createLogicEngine,
};
