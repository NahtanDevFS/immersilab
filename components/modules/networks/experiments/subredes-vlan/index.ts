import type { ExperimentDefinition, ExperimentEngine, VariablesSchema, VrAction } from "@/types/module";
import { actionControls } from "@/components/modules/shared/ActionList";
import { DEPARTMENTS, PCS, ROUNDS, SUBNET_NAMES, createVlanEngine, deptOf, type VlanEngine } from "./engine";
import { VlanScene } from "./VlanScene";

// Solo el prefijo: cuántos hosts caben es justo lo que hay que calcular.
const maskOptions = Array.from({ length: 7 }, (_, k) => ({ label: `/${24 + k}`, value: `/${24 + k}` }));
const vlanOptions = DEPARTMENTS.map((d) => ({ label: `VLAN ${d.vlan}`, value: String(d.vlan) }));

const variablesSchema: VariablesSchema = {
  ronda: { type: "select", label: "Ronda", default: "1", options: ROUNDS.map((r) => ({ label: r.title, value: r.id })) },
  ...Object.fromEntries(
    Object.keys(SUBNET_NAMES).map((id) => [
      `mascara_${id}`,
      {
        type: "select" as const,
        label: id === "enlace" ? "Enlace al ISP" : SUBNET_NAMES[id],
        default: "/24",
        options: maskOptions,
        group: "Máscaras",
        // El enlace al ISP solo existe en la ronda 2.
        ...(id === "enlace" ? { showWhen: { ronda: "2" } } : {}),
      },
    ]),
  ),
  ...Object.fromEntries(
    PCS.map((p) => [
      p.id,
      { type: "select" as const, label: `${p.id.toUpperCase()} · ${deptOf(p.dept).name} (piso ${p.floor})`, default: "10", options: vlanOptions, group: "Puertos" },
    ]),
  ),
  troncal: { type: "boolean", label: "Enlace entre switches troncal", default: false, group: "Enlaces" },
  subinterfaces: { type: "boolean", label: "Router con subinterfaces", default: false, group: "Enlaces" },
};

function actions(engine: ExperimentEngine): VrAction[] {
  const vlanEngine = engine as VlanEngine;
  const r = vlanEngine.getRuntime();
  const plan = r.config.plan;
  const list: VrAction[] = [
    {
      id: "tabla",
      label: `${plan.used} de 256 direcciones usadas${plan.overflow ? " · se sale del bloque" : ""}${plan.rows.some((x) => !x.fits) ? " · alguna subred no alcanza" : ""}`,
      info: true,
    },
  ];
  if (r.results) {
    const ok = r.results.filter((x) => x.ok).length;
    list.push({ id: "prueba", label: `Última prueba: ${ok} de ${r.results.length} pings llegaron`, info: true });
  }
  list.push({
    id: "ping",
    label: r.current >= 0 ? `Ping ${r.current + 1} de ${r.results?.length ?? 0}…` : "Probar con ping",
    onSelect: () => vlanEngine.runPings(),
    disabled: r.current >= 0,
    primary: true,
  });
  return list;
}

export const subredesVlanExperiment: ExperimentDefinition = {
  slug: "subredes-vlan",
  name: "Divide la red",
  description:
    "Reparte un bloque /24 entre departamentos con máscaras de largo variable, separa cada departamento en su VLAN y haz que se hablen con un router.",
  variablesSchema,
  cameraView: { position: [0.6, 2.7, 9.2], target: [0.3, 1.6, 0] },
  conceptTags: ["subredes", "VLSM", "máscara de subred", "VLAN", "enlace troncal", "router-on-a-stick", "red jerárquica"],
  briefing: {
    what: "Una red se divide en subredes para que cada departamento tenga sus propias direcciones. La máscara dice cuántas direcciones tiene cada subred, y dos de ellas no se pueden usar: la de la red y la de broadcast. Con VLAN, además, departamentos que comparten el mismo switch quedan separados como si estuvieran en switches distintos, y para que se hablen hace falta un router.",
    how: "En el grupo de máscaras elige el tamaño de la subred de cada departamento. El pizarrón muestra la tabla: dirección de red, rango usable, broadcast y cuánto sobra. Una fila en rojo no alcanza. Después toca cada PC para pasarla a la VLAN de su departamento, decide si el enlace entre switches es troncal y si el router tiene subinterfaces, y prueba con ping.",
    goal: "Reparte la primera ronda sin desperdiciar y haz que en la segunda todo quepa en el bloque. Pon cada PC en su VLAN y comprueba que sin router los departamentos no se ven. Al final, haz que dos VLAN distintas se hablen.",
  },
  tutorHints:
    "Variables: ronda (1 o 2), mascara_ventas, mascara_soporte, mascara_contabilidad, mascara_gerencia y mascara_enlace (de /24 a /30), pc1 a pc8 (la VLAN de cada puerto: 10, 20, 30 o 40), troncal y subinterfaces. " +
    "Departamentos y VLAN: Ventas 10, Soporte 20, Contabilidad 30, Gerencia 40. PC1 y PC4 son de Ventas, PC2 de Soporte y PC3 de Contabilidad en el piso 1; PC5 de Gerencia, PC6 de Soporte, PC7 de Ventas y PC8 de Contabilidad en el piso 2. " +
    "result: ronda, direcciones_usadas, se_sale_del_bloque, enlace_troncal y subinterfaces_en_el_router. tutorNotes: pedido, tabla (cada subred con su máscara, red, usables y lo que sobra), puertos (la VLAN de cada PC) y ultima_prueba. " +
    "Modelo: bloque 192.168.10.0/24. Hosts usables es 2 a la (32 menos el prefijo) menos 2. Se asignan de la subred más grande a la más chica, una detrás de otra. Ronda 1: Ventas 50, Soporte 25, Contabilidad 12 y Gerencia 5; lo justo es /26, /27, /28 y /29 y usa 120 de 256. Ronda 2: Ventas 100, Soporte 60, Contabilidad 28, Gerencia 10 y un enlace al ISP de 2; lo justo es /25, /26, /27, /28 y /30 y usa 244 de 256. " +
    "Ping: misma VLAN en el mismo switch llega; misma VLAN en otro switch llega solo con troncal; VLAN distintas llegan solo con troncal y subinterfaces, por el router, usando como puerta de enlace la primera IP de cada subred. Una PC en una VLAN que no es la de su departamento es un error de configuración. La red jerárquica tiene acceso (los switches de cada piso), distribución y núcleo con el router. " +
    "Confusión típica: elegir la máscara por el número de hosts sin restar la red y el broadcast; 62 hosts caben en /26, 64 no. No des las máscaras: pregunta cuántas direcciones necesita cada departamento y cuál es la potencia de dos más chica que alcanza.",
  whiteboard: {
    title: "Divide la red",
    formulas: [
      "Usables = 2^(32 − prefijo) − 2",
      "/30 = 2 · /29 = 6 · /28 = 14 · /27 = 30",
      "/26 = 62 · /25 = 126 · /24 = 254",
      "Asigna de la más grande a la más chica",
      "Puerta de enlace = primera IP de la subred",
    ],
    terms: [
      { symbol: "/prefijo", meaning: "cuántos bits de la IP son de la red (/26: 26 de 32)" },
      { symbol: "Usables", meaning: "IP que se pueden dar a equipos: se restan la de red y la de broadcast" },
      { symbol: "VLAN", meaning: "red separada dentro del mismo switch, una por departamento" },
      { symbol: "Troncal", meaning: "enlace que lleva varias VLAN a la vez entre switches" },
      { symbol: "Subinterfaz", meaning: "una entrada del router por VLAN: deja que VLAN distintas se hablen" },
    ],
    position: [-4.6, 1.7, 0.6],
    rotationY: 0.9,
    width: 2.1,
  },
  SceneComponent: VlanScene,
  ControlsComponent: actionControls(actions),
  vrActions: (engine) => [
    ...actions(engine),
    { id: "ayuda", label: "Toca una PC para pasarla a la VLAN siguiente.", info: true },
  ],
  createEngine: createVlanEngine,
};
