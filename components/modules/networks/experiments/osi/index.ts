import type { ExperimentDefinition, VariablesSchema } from "@/types/module";
import { createOsiEngine } from "./engine";
import { OsiScene } from "./OsiScene";
import { OsiControls } from "./OsiControls";

const variablesSchema: VariablesSchema = {
  modelo: {
    type: "select",
    label: "Modelo",
    default: "osi",
    options: [
      { label: "OSI (7 capas)", value: "osi" },
      { label: "TCP/IP (4 capas)", value: "tcpip" },
    ],
  },
};

export const osiExperiment: ExperimentDefinition = {
  slug: "osi",
  name: "Armá el paquete",
  description:
    "Bajá el mensaje por la pila agregando cabeceras, cruzá el cable y sacalas del otro lado. OSI y TCP/IP, lado a lado.",
  variablesSchema,
  conceptTags: [
    "modelo OSI",
    "modelo TCP/IP",
    "encapsulación",
    "cabeceras de protocolo",
    "PDU",
  ],
  briefing: {
    what: "Un mensaje no sale de tu computadora tal cual: baja por una pila de capas y cada una le agrega su propia cabecera adelante. Eso se llama encapsulación. Del otro lado ocurre lo inverso: el mensaje sube por la pila del receptor y cada capa saca la cabecera que le corresponde. El modelo OSI describe siete capas y es una referencia teórica; el modelo TCP/IP describe cuatro y es el que realmente corre en Internet.",
    how: "El cubo blanco es tu mensaje. En cada capa elegí, de las tres opciones, qué cabecera agrega esa capa: vas a ver cómo el mensaje se envuelve en una capa más y cambia de nombre, de datos a segmento, a paquete, a trama. Cuando termina de bajar cruza el cable y del otro lado hay que sacar las cabeceras, de afuera hacia adentro. Arriba podés cambiar entre el modelo de siete capas y el de cuatro.",
    goal: "Entregá el mensaje sin equivocarte ni una vez. Si te equivocás, abajo te dice qué hace la capa en la que estás parado. Cuando lo logres con OSI, probá con TCP/IP y compará: vas a ver que las cabeceras REALES son casi las mismas y que lo que cambia es cómo se agrupan. Por eso se dice que OSI es el modelo para estudiar y TCP/IP el que se usa.",
  },
  SceneComponent: OsiScene,
  ControlsComponent: OsiControls,
  createEngine: createOsiEngine,
};
