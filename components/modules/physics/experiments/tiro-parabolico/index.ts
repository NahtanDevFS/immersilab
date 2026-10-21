import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import { createProjectileEngine, TARGETS_X, type ProjectileEngine } from "./engine";
import { ProjectileScene } from "./ProjectileScene";
import { ProjectileControls } from "./ProjectileControls";

const variablesSchema: VariablesSchema = {
  modo: {
    type: "select",
    label: "Modo",
    default: "libre",
    options: [
      { label: "Tiro libre", value: "libre" },
      { label: "Artillería: tres blancos", value: "blancos" },
      { label: "Artillería con viento", value: "viento" },
    ],
  },
  angle: {
    type: "number",
    label: "Ángulo",
    unit: "°",
    min: 0,
    max: 90,
    step: 1,
    default: 45,
  },
  velocity: {
    type: "number",
    label: "Velocidad inicial",
    unit: "m/s",
    min: 1,
    max: 50,
    step: 1,
    default: 20,
  },
  gravity: {
    type: "number",
    label: "Gravedad",
    unit: "m/s²",
    min: 1,
    max: 25,
    step: 0.1,
    default: 9.81,
  },
    drag: {
    type: "number",
    label: "Resistencia del aire",
    unit: "1/s",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
  },
};

export const tiroParabolicoExperiment: ExperimentDefinition = {
  slug: "tiro-parabolico",
  name: "Tiro parabólico",
  description:
    "Lanza un proyectil ajustando ángulo, velocidad inicial, gravedad y resistencia del aire, y acierta a tres blancos.",
  variablesSchema,
  conceptTags: ["cinemática", "movimiento parabólico", "gravedad"],
  briefing: {
    what: "Un proyectil lanzado al aire sigue una parábola: avanza en horizontal a velocidad constante mientras la gravedad lo frena y lo trae de vuelta hacia abajo. Los dos movimientos son independientes y pasan al mismo tiempo.",
    how: "Ajusta el ángulo del cañón y la velocidad de salida, y dispara. La gravedad y la resistencia del aire también se pueden cambiar, para ver qué pasa en la Luna o con aire espeso.",
    goal: "Busca con qué ángulo llega más lejos a una misma velocidad: sin aire, el máximo está cerca de los cuarenta y cinco grados. Después cambia el modo a artillería: hay tres blancos a veinte, treinta y dos y cuarenta y cinco metros, y un disparo para cada uno. En el modo con viento, cada ronda sopla distinto y hay que corregir el tiro razonando, no repitiendo el de antes.",
  },
  tutorHints:
    "Las variables son angle (grados), velocity (metros por segundo), gravity (metros por segundo al cuadrado) y drag (coeficiente de resistencia del aire, en uno sobre segundo). " +
    "Después de un disparo que aterrizó, result trae alcance_m, altura_maxima_m y tiempo_vuelo_s de ese disparo, y tutorNotes.resultado_es_del_disparo dice con qué valores se hizo. Si tutorNotes trae aviso, el estudiante cambió valores después y esos números no sirven para los valores actuales. " +
    "tutorNotes.calculo_con_los_valores_actuales trae siempre la cuenta con lo que hay ahora en el panel. Si el estudiante pide que hagas el cálculo, explica los pasos y usa esos números; nunca respondas con el alcance de un disparo hecho con otro ángulo o velocidad. " +
    "Sin aire: fórmulas de siempre. Con viento y sin aire: el tiempo de vuelo no cambia y en horizontal se suma un medio por a_v por t al cuadrado. Con aire (k mayor que cero) sí hay ecuaciones exactas de x(t) e y(t), con exponenciales; lo único sin fórmula cerrada es despejar el t donde y vuelve a cero, que se resuelve numéricamente. No digas que no se puede calcular: explica eso y da el alcance que trae la cuenta. Con aire no escribas fórmulas del caso sin aire (como H = vy²/(2g)): no valen. Las fórmulas están en el pizarrón de la escena. " +
    "Sin resistencia del aire el alcance es v al cuadrado por seno de dos theta, sobre ge, y es máximo a cuarenta y cinco grados; ángulos complementarios, como treinta y sesenta, llegan igual de lejos. " +
    "Con resistencia del aire el ángulo óptimo baja de cuarenta y cinco. " +
    "Confusión típica: creer que el proyectil 'pierde' velocidad horizontal sin aire; sin drag la componente horizontal es constante. " +
    "Modo artillería (variable modo: blancos o viento): tres blancos a 20, 32 y 45 metros del cañón, un disparo por blanco, de cero a cien puntos según cuántos metros erró (pierde ocho por metro); a menos de 1.5 metros es impacto. result trae blanco_actual_m, disparos, puntaje_ronda y, con viento, viento_m_s2 (positivo empuja hacia los blancos). " +
    "El viento es una aceleración horizontal constante: en un vuelo de dos o tres segundos corre la caída unos tres o cuatro metros. A favor hay que tirar más corto, en contra más largo. " +
    "Para ajustar fino conviene dejar la velocidad fija y mover el ángulo, que cambia el alcance de a poco lejos de cuarenta y cinco grados. No le dictes ángulo y velocidad exactos: guíalo con cuánto erró el disparo anterior.",
  // Lejos y de costado: el cañón a la izquierda y el tercer blanco (45 m) a
  // la derecha entran juntos en la vista, y cada disparo se ve completo.
  cameraView: { position: [21, 7, 34], target: [21, 3, 0] },
  // Detrás del campo, entre el cañón y el primer blanco: se ve desde la vista
  // de entrada y las trayectorias pasan por delante. Más ancho que en los
  // otros experimentos porque se mira de lejos.
  whiteboard: {
    title: "Tiro parabólico",
    formulas: [
      "vx = v · cos θ   ·   vy = v · sen θ",
      "x = vx · t   ·   y = vy · t − ½ · g · t²",
      "Alcance: R = v² · sen(2θ) / g",
      "Altura máxima: H = (v · sen θ)² / (2g)",
      "Tiempo de vuelo: T = 2 · v · sen θ / g",
      { text: "Con viento: x = vx · t + ½ · a_v · t² (T no cambia)", showWhen: { modo: "viento" } },
      "Con aire (k > 0): x(t) = (vx/k) · (1 − e^(−k·t))",
      "y(t) = (vy/k + g/k²) · (1 − e^(−k·t)) − (g/k) · t",
    ],
    terms: [
      { symbol: "v", meaning: "velocidad inicial, m/s" },
      { symbol: "θ", meaning: "ángulo del cañón sobre el suelo" },
      { symbol: "vx, vy", meaning: "velocidad horizontal y vertical al salir, m/s" },
      { symbol: "g", meaning: "gravedad, m/s²" },
      { symbol: "t", meaning: "tiempo desde el disparo, s" },
      { symbol: "R, H, T", meaning: "alcance (m), altura máxima (m) y tiempo de vuelo (s), sin aire" },
      { symbol: "k", meaning: "resistencia del aire, 1/s: con aire R no tiene fórmula, se busca el t donde y = 0" },
      { symbol: "a_v", meaning: "aceleración del viento, m/s² (+ a favor, − en contra)", showWhen: { modo: "viento" } },
    ],
    position: [10, 1.9, -5],
    width: 3.2,
  },
  SceneComponent: ProjectileScene,
  ControlsComponent: ProjectileControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const p = engine as ProjectileEngine;
    const r = p.getRuntime();
    const game = r.mode !== "libre";
    if (game && r.round.finished) {
      return [
        { id: "puntaje", label: `Ronda terminada: ${r.round.total} pts`, info: true },
        { id: "ronda", label: "Nueva ronda", onSelect: () => p.newRound(), primary: true },
      ];
    }
    const actions: VrAction[] = [];
    if (game) {
      actions.push({ id: "puntaje", label: `Blanco ${r.round.targetIndex + 1}/3 · ${r.round.total} pts`, info: true });
    }
    actions.push({
      id: "disparar",
      label: game
        ? `Disparar al blanco ${r.round.targetIndex + 1} (${TARGETS_X[r.round.targetIndex]} m)`
        : r.phase === "landed"
          ? "Lanzar de nuevo"
          : "Lanzar",
      onSelect: () => p.fire(),
      disabled: r.phase === "flying",
      primary: true,
    });
    if (game && r.round.targetIndex > 0) {
      actions.push({ id: "reiniciar", label: "Reiniciar ronda", onSelect: () => p.newRound() });
    }
    if (!game && r.phase !== "idle") {
      actions.push({ id: "reiniciar", label: "Reiniciar", onSelect: () => p.reset() });
    }
    return actions;
  },
  createEngine: createProjectileEngine,
};