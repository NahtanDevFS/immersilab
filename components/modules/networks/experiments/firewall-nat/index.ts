import type { ExperimentDefinition, ExperimentEngine, VariablesSchema, VrAction } from "@/types/module";
import { actionControls } from "@/components/modules/shared/ActionList";
import { CARDS, NAT_CARDS, ROUNDS, SLOTS, createFirewallEngine, summaryOf, type FirewallEngine } from "./engine";
import { FirewallScene } from "./FirewallScene";

const cardOptions = [{ label: "— (vacía)", value: "vacia" }, ...CARDS.map((c) => ({ label: c.label, value: c.id }))];

const variablesSchema: VariablesSchema = {
  ronda: {
    type: "select",
    label: "Ronda",
    default: "1",
    options: ROUNDS.map((r) => ({ label: r.title, value: r.id })),
  },
  ...Object.fromEntries(
    Array.from({ length: SLOTS }, (_, i) => [
      `regla${i + 1}`,
      { type: "select" as const, label: `Ranura ${i + 1}`, default: "vacia", options: cardOptions, group: "El rack (de arriba hacia abajo)", showWhen: { ronda: ["1", "2"] } },
    ]),
  ),
  nat_reenvio: {
    type: "select",
    label: "Reenvío de puertos",
    default: "ninguno",
    // En la ronda 3 el router hace NAT en vez de filtrar: el rack no se usa.
    showWhen: { ronda: "3" },
    options: [{ label: "Ninguno", value: "ninguno" }, ...NAT_CARDS.map((c) => ({ label: c.label, value: c.id }))],
  },
};

function actions(engine: ExperimentEngine): VrAction[] {
  const firewall = engine as FirewallEngine;
  const r = firewall.getRuntime();
  const list: VrAction[] = [{ id: "ronda", label: r.round.story, info: true }];
  if (r.launch && r.finished) {
    list.push({
      id: "resumen",
      label: `${summaryOf(r.launch)}${r.launch.clean ? " · ¡red protegida!" : ""}`,
      info: true,
    });
  }
  list.push({
    id: "lanzar",
    label: r.current >= 0 ? `Paquete ${r.current + 1} de ${r.launch?.results.length ?? 0}…` : "Lanzar el tráfico",
    onSelect: () => firewall.launchTraffic(),
    disabled: r.current >= 0,
    primary: true,
  });
  return list;
}

export const firewallNatExperiment: ExperimentDefinition = {
  slug: "firewall-nat",
  name: "Defiende el borde",
  description:
    "Arma las reglas del firewall con tarjetas, en orden, y mira qué tráfico pasa y qué ataques se frenan. Después configura NAT para publicar solo la web.",
  variablesSchema,
  cameraView: { position: [0.2, 3.3, 8.4], target: [0, 1.4, 0] },
  conceptTags: ["firewall", "listas de control de acceso", "deny implícito", "inspección de estado", "NAT", "PAT", "reenvío de puertos"],
  briefing: {
    what: "Un firewall decide qué tráfico entra a una red con una lista de reglas. Las lee de arriba hacia abajo y aplica la primera que coincide; si ninguna coincide, al final hay un bloqueo implícito de todo lo demás. Por eso el orden importa, y por eso alcanza con permitir lo necesario: lo que no permitiste ya queda bloqueado. NAT, por su lado, deja que toda la red salga a internet con una sola dirección pública.",
    how: "Toca una tarjeta del mazo para ponerla en la primera ranura libre del rack, y toca una del rack para sacarla. También puedes elegirlas en el panel. Después lanza el tráfico: cada paquete baja por el rack y se ilumina la regla que coincidió. Verde es tráfico legítimo que pasó o un ataque frenado; naranja es un servicio caído; rojo, un equipo atacado.",
    goal: "En la primera ronda protege la base de datos sin tumbar la web. En la segunda llega el administrador por SSH y un atacante también: el orden de las reglas decide quién entra. Hazlo limpio y después con tres reglas o menos. En la tercera, configura NAT para que un visitante vea la web sin dejar expuesto nada más.",
  },
  tutorHints:
    "Variables: ronda (1, 2 o 3), regla1 a regla6 (la tarjeta en cada ranura del rack, de arriba hacia abajo, o vacia) y nat_reenvio (ninguno, web443, gerencia-todo o bd3306). " +
    "Tarjetas: web (permitir TCP 80 y 443 al servidor web), ssh-admin (permitir SSH desde 200.10.5.7), respuestas (permitir respuestas de conexiones iniciadas desde adentro), bloquear-ssh, bloquear-bd (TCP 3306), bloquear-ping, permitir-todo, bloquear-todo, permitir-bd, permitir-ssh, permitir-ping y bloquear-web. " +
    "result: ronda, reenvio_nat y ultimo_lanzamiento (resumen). tutorNotes: situacion (el enunciado de la ronda), rack (con el bloqueo implícito al final) y detalle_del_ultimo_lanzamiento (qué pasó con cada paquete y qué regla coincidió). " +
    "Modelo: se aplica la primera regla que coincide; si ninguna coincide, se bloquea. Ronda 1: clientes por 443 y 80, la respuesta a un empleado, un ataque a la base de datos por 3306 y un escaneo con ping. Ronda 2: además el administrador por SSH, un atacante probando contraseñas por SSH y un intento por TCP 445 a una PC. Ronda 3: tres PC salen a internet y NAT las traduce a 190.56.20.4 con puertos distintos (PAT); luego llega un visitante al 443 de la IP pública y dos atacantes prueban el 3306 y el 445. Sin reenvío NAT no sabe a quién darle lo que llega y lo descarta. " +
    "Lecciones: permitir lo necesario y dejar que el bloqueo implícito haga el resto es más seguro que intentar bloquear cada cosa mala, porque siempre aparece un ataque que no se previó. Bloquear SSH arriba de la regla del administrador lo deja afuera. Reenviar todos los puertos a una PC la expone completa. " +
    "No digas qué tarjetas van: pregunta qué tráfico necesita entrar y qué pasa con lo que no coincide con ninguna regla.",
  SceneComponent: FirewallScene,
  ControlsComponent: actionControls(actions),
  vrActions: (engine) => [
    ...actions(engine),
    { id: "vaciar-ayuda", label: "Toca una tarjeta del mazo para ponerla y una del rack para sacarla.", info: true },
  ],
  createEngine: createFirewallEngine,
};
