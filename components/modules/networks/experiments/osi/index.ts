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
  name: "Arma el paquete",
  description:
    "Baja el mensaje por la pila agregando cabeceras, cruza el cable y quítalas del otro lado. OSI y TCP/IP, lado a lado.",
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
    how: "El cubo blanco es tu mensaje. En cada capa elige, de las tres opciones, qué cabecera agrega esa capa: vas a ver cómo el mensaje se envuelve en una capa más y cambia de nombre, de datos a segmento, a paquete, a trama. Cuando termina de bajar cruza el cable y del otro lado hay que sacar las cabeceras, de afuera hacia adentro. Arriba puedes cambiar entre el modelo de siete capas y el de cuatro.",
    goal: "Entrega el mensaje sin equivocarte ni una vez. Si te equivocas, abajo se explica qué hace la capa en la que estás. Cuando lo logres con OSI, prueba con TCP/IP y compara: vas a ver que las cabeceras REALES son casi las mismas y que lo que cambia es cómo se agrupan. Por eso se dice que OSI es el modelo para estudiar y TCP/IP el que se usa.",
  },
  tutorHints:
    "Variables: modelo es osi (siete capas) o tcpip (cuatro capas). " +
    "result solo aparece al entregar el mensaje: capas_correctas, de_un_total_de, errores y modelo; estado aparece si no hubo ningún error. " +
    "Al bajar se encapsula y al subir se desencapsula, de afuera hacia adentro. Nombres de la unidad de datos: datos en aplicación, segmento en transporte, paquete en red, trama en enlace y bits en la capa física. " +
    "Transporte agrega puertos y control de orden (TCP o UDP); red agrega las direcciones IP; enlace agrega las direcciones MAC y el control de errores. En Internet real el cifrado de presentación lo hace TLS. " +
    "Confusiones típicas: mezclar MAC con IP, o creer que TCP/IP tiene otras cabeceras; en realidad son casi las mismas, agrupadas en menos capas.",
  SceneComponent: OsiScene,
  ControlsComponent: OsiControls,
  createEngine: createOsiEngine,
};
