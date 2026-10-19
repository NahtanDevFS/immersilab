import type { ExperimentDefinition, ExperimentEngine, VariablesSchema, VrAction } from "@/types/module";
import { actionControls } from "@/components/modules/shared/ActionList";
import { createRatesEngine, type RatesEngine } from "./engine";
import { RatesScene } from "./RatesScene";

const variablesSchema: VariablesSchema = {
  escenario: {
    type: "select",
    label: "Situación",
    default: "cono",
    options: [
      { label: "Cono invertido", value: "cono" },
      { label: "Cilindro", value: "cilindro" },
      { label: "Escalera que resbala", value: "escalera" },
    ],
  },
  caudal: { type: "number", label: "Caudal", unit: "L/s", min: 2, max: 20, step: 1, default: 10, group: "Tanques" },
  altura_meta: { type: "number", label: "Altura meta", unit: "m", min: 0.4, max: 1.8, step: 0.1, default: 1, group: "Tanques" },
  velocidad_base: { type: "number", label: "Velocidad de la base", unit: "m/s", min: 0.2, max: 1, step: 0.1, default: 0.5, group: "Escalera" },
  x_meta: { type: "number", label: "Base a (x meta)", unit: "m", min: 1, max: 4.5, step: 0.5, default: 3, group: "Escalera" },
  // El plan pedía ±100 cm/s, pero en la escalera, con la base a 4.5 m y a
  // 1 m/s, la punta baja a 206 cm/s: con ±100 esa respuesta no se podía poner.
  prediccion: { type: "number", label: "Tu predicción", unit: "cm/s", min: -250, max: 250, step: 0.01, default: 0, group: "Predicción" },
  camara_lenta: { type: "boolean", label: "Cámara lenta cerca de la meta", default: true, group: "Predicción" },
};

/** Las acciones, iguales en el panel HTML y en el visor. */
function actions(engine: ExperimentEngine): VrAction[] {
  const rates = engine as RatesEngine;
  const r = rates.getRuntime();
  const ladder = r.scenario === "escalera";
  const list: VrAction[] = [];
  const a = r.attempt;
  if (r.phase === "done" && a && a.actual !== null) {
    list.push({
      id: "puntaje",
      label: `Real ${a.actual.toFixed(2)} cm/s · tú ${a.predicted.toFixed(2)} · ${a.score} pts${a.hit ? " · ¡acierto!" : ""}`,
      info: true,
    });
  }
  list.push({
    id: "empezar",
    label:
      r.phase === "running"
        ? ladder ? "La escalera resbala…" : "Llenando…"
        : ladder ? "Jalar la escalera" : "Abrir la llave",
    onSelect: () => rates.start(),
    disabled: r.phase === "running",
    primary: true,
  });
  if (r.phase !== "idle") {
    list.push({
      id: "vaciar",
      label: ladder ? "Volver a poner la escalera" : "Vaciar el tanque",
      onSelect: () => rates.reset(),
    });
  }
  return list;
}

export const razonesCambioExperiment: ExperimentDefinition = {
  slug: "razones-cambio",
  name: "Llena el tanque",
  description:
    "Razones de cambio relacionadas: predice qué tan rápido sube el agua en un cono o en un cilindro, o qué tan rápido baja la punta de una escalera que resbala.",
  variablesSchema,
  cameraView: { position: [0.6, 2.7, 9], target: [0.5, 2, 0] },
  conceptTags: ["razones de cambio relacionadas", "regla de la cadena", "derivación implícita"],
  briefing: {
    what: "Cuando dos cantidades están unidas por una ecuación, sus rapideces de cambio también lo están. Si el agua entra a un tanque a ritmo constante, el volumen crece parejo, pero la altura no tiene por qué: en un cono con la punta abajo, al principio sube rápido y después cada vez más lento, porque el tanque se ensancha. Para saber qué tan rápido cambia una, se deriva la ecuación que las une respecto al tiempo.",
    how: "Elige la situación y lee el enunciado del cartel. Calcula cuántos centímetros por segundo sube el agua cuando llega a la marca roja, o qué tan rápido se mueve la punta de la escalera, y ponlo en tu predicción. Después abre la llave, o jala la escalera. Al llegar a la meta todo se detiene y ves la rapidez real junto a la tuya.",
    goal: "Acierta con un error menor al cinco por ciento en el cono con la meta en un metro o más, en el cilindro y en la escalera. Ojo con el signo: la punta de la escalera baja. El último reto es acertar dos veces seguidas en el cono con el mismo caudal y una meta al doble de la otra, y mirar qué le pasa a la rapidez.",
  },
  tutorHints:
    "Variables: escenario (cono, cilindro o escalera), caudal en litros por segundo (2 a 20), altura_meta en metros (0.4 a 1.8), velocidad_base de la escalera en metros por segundo (0.2 a 1), x_meta en metros (1 a 4.5), prediccion en centímetros por segundo (se congela al empezar) y camara_lenta. " +
    "result: situacion (el enunciado), estado, tiempo_s, altura_m y volumen_l en los tanques, base_x_m y punta_y_m en la escalera, prediccion_cm_s y, al llegar a la meta, rapidez_real_cm_s, puntaje (cien menos el error relativo en por ciento) y acierto (error menor al cinco por ciento). " +
    "Modelo: el caudal en metros cúbicos por segundo es el de litros dividido entre mil. Cono invertido de 2 m de alto y 1 m de radio arriba: por semejanza r es h sobre 2, así que V es pi por h al cubo sobre doce; derivando, dV/dt es pi por h al cuadrado sobre cuatro por dh/dt, y dh/dt es cuatro por Q sobre pi por h al cuadrado. Cilindro de 0.5 m de radio: V es pi por r al cuadrado por h y dh/dt es Q sobre pi por r al cuadrado, igual a cualquier altura. Escalera de 5 m: x al cuadrado más y al cuadrado es 25; derivando, 2x dx/dt más 2y dy/dt es cero, así que dy/dt es menos x sobre y por dx/dt. " +
    "Valores: cono con 10 litros por segundo a 1 m da 0.0127 m/s, 1.27 cm/s, y tarda unos 26 segundos; cilindro con 10 litros por segundo da 1.27 cm/s a cualquier altura; escalera a 0.5 m/s con la base a 3 m (punta a 4 m) da menos 0.375 m/s, menos 37.5 cm/s. En el cono, al doble de altura la rapidez baja a la cuarta parte, porque va con uno sobre h al cuadrado. " +
    "Confusiones típicas: usar el volumen total o dividir volumen entre tiempo en vez de derivar; olvidar pasar los litros a metros cúbicos o los metros por segundo a centímetros por segundo; usar el radio de arriba del cono en vez del radio a la altura del agua; olvidar el signo negativo de la escalera. " +
    "No des el número de la predicción: guía con preguntas, por ejemplo qué relación une el volumen y la altura, cuánto vale el radio cuando el agua está a esa altura, y qué pasa al derivar los dos lados respecto al tiempo.",
  whiteboard: {
    title: "Llena el tanque",
    formulas: [
      "Cono: r = h/2 → V = πh³/12",
      "dV/dt = (πh²/4) · dh/dt",
      "Cilindro: V = πr²h → dh/dt = Q/(πr²)",
      "Escalera: x² + y² = L²",
      "2x·dx/dt + 2y·dy/dt = 0",
      "1 L = 0.001 m³ · 1 m/s = 100 cm/s",
    ],
    position: [-3.2, 1.6, 1.2],
    rotationY: 0.9,
    width: 2.1,
  },
  SceneComponent: RatesScene,
  ControlsComponent: actionControls(actions),
  vrActions: (engine) => {
    const r = (engine as RatesEngine).getRuntime();
    return [
      {
        id: "situacion",
        label:
          r.scenario === "escalera"
            ? "Escalera de 5 m: ¿qué tan rápido se mueve la punta al llegar la base a la meta?"
            : "¿Qué tan rápido sube el agua al llegar a la marca roja? Pon tu predicción en cm/s.",
        info: true,
      },
      ...actions(engine),
    ];
  },
  createEngine: createRatesEngine,
};
