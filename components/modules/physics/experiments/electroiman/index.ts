import type { ExperimentDefinition, VariablesSchema, VrAction } from "@/types/module";
import {
  CONTAINER,
  CORES,
  createMagnetEngine,
  ITEMS,
  RATED_POWER,
  type MagnetEngine,
} from "./engine";
import { MagnetScene } from "./MagnetScene";
import { MagnetControls } from "./MagnetControls";

const variablesSchema: VariablesSchema = {
  posicion: {
    type: "select",
    label: "Grúa sobre",
    default: "lata",
    options: [
      ...ITEMS.map((item) => ({ label: `${item.name} (${item.mass} kg)`, value: item.id })),
      { label: "Contenedor", value: CONTAINER },
    ],
  },
  corriente: {
    type: "number",
    label: "Corriente",
    unit: "A",
    min: 0,
    max: 40,
    step: 0.5,
    default: 5,
  },
  vueltas: {
    type: "number",
    label: "Vueltas de la bobina",
    min: 50,
    max: 1000,
    step: 10,
    default: 200,
  },
  nucleo: {
    type: "select",
    label: "Núcleo",
    default: "acero",
    options: CORES.map((core) => ({ label: core.label, value: core.id })),
  },
  separacion: {
    // Distancia entre el polo y el objeto al ir a buscarlo. Una vez pegado,
    // la separación es casi cero (por eso sostiene más de lo que arranca).
    type: "number",
    label: "Separación al bajar",
    unit: "cm",
    min: 1,
    max: 40,
    step: 1,
    default: 10,
  },
};

export const electroimanExperiment: ExperimentDefinition = {
  slug: "electroiman",
  name: "La grúa electromagnética",
  description:
    "Una corriente en una bobina crea un imán que se puede prender y apagar. Úsalo para levantar chatarra… y descubre qué metales no se dejan.",
  variablesSchema,
  // El patio mide unos 20 m: se entra mirando la grúa entera de costado.
  cameraView: { position: [8.5, 5, 14], target: [8.5, 1.4, 0] },
  conceptTags: [
    "electromagnetismo",
    "ley de Ampère",
    "solenoide",
    "permeabilidad magnética",
    "materiales ferromagnéticos",
    "efecto Joule",
  ],
  briefing: {
    what: "Una corriente eléctrica que circula por una bobina crea un campo magnético: eso es un electroimán. El campo crece con la corriente y con el número de vueltas, y si la bobina se enrolla sobre un núcleo de hierro, el campo se multiplica cientos de veces. A diferencia de un imán común, se apaga cortando la corriente.",
    how: "Elige sobre qué objeto se pone la grúa, ajusta la corriente, las vueltas, el núcleo y a qué distancia baja el imán, y enciéndelo. Si la fuerza magnética supera el peso, el objeto sube y lo puedes llevar al contenedor. Mira la temperatura de la bobina: la corriente la calienta.",
    goal: "Primero levanta la lata. Después lleva al contenedor todo lo que el imán pueda levantar, y fíjate en qué pasa con la olla de aluminio y el tubo de cobre. Por último levanta el carro y sostenlo sin pasar la potencia nominal de la bobina: no alcanza con subir la corriente a lo bruto, hay que pensar qué otra cosa aumenta el campo sin calentar tanto.",
  },
  tutorHints:
    "Variables: posicion (sobre qué objeto está la grúa o el contenedor), corriente en amperios, vueltas de la bobina, nucleo (aire, acero con permeabilidad relativa 300, hierro dulce con 2000) y separacion en centímetros, la distancia a la que baja el imán al ir a buscar un objeto. " +
    "result: iman, campo_en_el_polo_T, fuerza_magnetica_N, objeto y peso_N del que está debajo, cargando, resistencia_bobina_ohm (0.01 ohm por vuelta), potencia_W, temperatura_C, nucleo, en_el_contenedor y aviso. " +
    "Física: el campo es mu cero por N por I dividido por la suma del recorrido en el núcleo (un metro sobre mu r) más dos veces la separación; con núcleo de hierro casi toda la oposición está en el aire, por eso unos centímetros de separación hunden el campo. El acero satura en 1.4 tesla y el hierro en 1.6. " +
    "La fuerza es B al cuadrado por el área de contacto sobre dos mu cero; levanta si supera m por g. Una vez pegado, la separación es casi cero y sostiene mucho más de lo que arranca. " +
    "La potencia es I al cuadrado por R, con R proporcional a las vueltas: para el mismo N por I, duplicar las vueltas y bajar la corriente a la mitad da el mismo campo con la mitad de potencia. " +
    `Retos: levantar la lata; llevar al contenedor la lata, el bloque de hierro y el motor; sostener el carro diez segundos sin pasar de ${RATED_POWER} watts (por ejemplo, mil vueltas, unos doce amperes, núcleo de hierro y un centímetro). La protección térmica corta a 120 grados. ` +
    "Confusiones típicas: creer que todos los metales se pegan a un imán (el aluminio y el cobre no son ferromagnéticos), y creer que más corriente siempre es mejor. No des la respuesta directa: guía con preguntas.",
  SceneComponent: MagnetScene,
  ControlsComponent: MagnetControls,
  // Las mismas acciones que el panel HTML, para la vista VR (botones 3D).
  vrActions: (engine) => {
    const magnet = engine as MagnetEngine;
    const r = magnet.getRuntime();
    const actions: VrAction[] = [];
    if (r.message) actions.push({ id: "aviso", label: r.message, info: true });
    actions.push({
      id: "estado",
      label: `${Math.round(r.power)} W · ${Math.round(r.temperature)} °C`,
      info: true,
    });
    actions.push({
      id: "iman",
      label: r.tripped ? "Enfriando la bobina…" : r.magnetOn ? "Apagar imán" : "Encender imán",
      onSelect: () => magnet.toggleMagnet(),
      disabled: r.tripped,
      primary: !r.magnetOn,
    });
    return actions;
  },
  createEngine: createMagnetEngine,
};
