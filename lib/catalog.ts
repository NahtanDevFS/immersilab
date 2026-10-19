/**
 * Catálogo del laboratorio como datos puros: disciplinas, módulos y en qué
 * módulo y ruta vive cada experimento.
 *
 * Es la fuente que comparten la app y la base: la migración
 * `supabase/migrations/*_catalogo_y_retos.sql` carga estas mismas filas, y
 * el progreso se sincroniza por `slug`, así que un slug que cambie aquí
 * tiene que cambiar también allá.
 *
 * No importa componentes de React ni three: se puede usar en cualquier lado
 * (sincronización, pantalla de progreso, scripts).
 */

export interface DisciplineEntry {
  slug: string;
  name: string;
}

export interface ModuleEntry {
  slug: string;
  discipline: string;
  name: string;
  order: number;
}

export interface ExperimentEntry {
  /** Igual al `slug` de su ExperimentDefinition y a la fila en `experiments`. */
  slug: string;
  module: string;
  href: string;
}

export const DISCIPLINES: DisciplineEntry[] = [
  { slug: "physics", name: "Física" },
  { slug: "calculus", name: "Cálculo" },
  { slug: "networks", name: "Redes y Telecomunicaciones" },
  { slug: "electronics", name: "Electrónica" },
];

export const MODULES: ModuleEntry[] = [
  { slug: "fisica-nucleo-a", discipline: "physics", name: "Núcleo A", order: 0 },
  { slug: "fisica-electromagnetismo", discipline: "physics", name: "Electromagnetismo", order: 1 },
  { slug: "calculo-nucleo-a", discipline: "calculus", name: "Núcleo A", order: 0 },
  // Redes va en el orden del temario del curso (catálogo v2).
  { slug: "redes-arquitectura", discipline: "networks", name: "Arquitectura", order: 0 },
  { slug: "redes-segmentacion", discipline: "networks", name: "Segmentación y redundancia", order: 1 },
  { slug: "redes-capa-de-red", discipline: "networks", name: "Capa de red", order: 2 },
  { slug: "redes-capa-fisica", discipline: "networks", name: "Capa física", order: 3 },
  { slug: "redes-seguridad", discipline: "networks", name: "Seguridad", order: 4 },
  { slug: "electronica-circuitos", discipline: "electronics", name: "Circuitos", order: 0 },
  { slug: "electronica-digital", discipline: "electronics", name: "Electrónica digital", order: 1 },
];

/*
 * Una entrada cuyo experimento todavía no está en el registro se ignora en
 * la pantalla de progreso: el catálogo puede ir un paso adelante del código.
 */
export const EXPERIMENTS: ExperimentEntry[] = [
  { slug: "tiro-parabolico", module: "fisica-nucleo-a", href: "/lab/physics/tiro-parabolico" },
  { slug: "leyes-newton", module: "fisica-nucleo-a", href: "/lab/physics/leyes-newton" },
  { slug: "colisiones-1d", module: "fisica-nucleo-a", href: "/lab/physics/colisiones-1d" },
  { slug: "pendulo", module: "fisica-nucleo-a", href: "/lab/physics/pendulo" },
  { slug: "campo-electrico", module: "fisica-electromagnetismo", href: "/lab/physics/campo-electrico" },
  { slug: "electroiman", module: "fisica-electromagnetismo", href: "/lab/physics/electroiman" },
  { slug: "derivada-pico", module: "calculo-nucleo-a", href: "/lab/calculus/derivada-pico" },
  { slug: "razones-cambio", module: "calculo-nucleo-a", href: "/lab/calculus/razones-cambio" },
  { slug: "suma-riemann", module: "calculo-nucleo-a", href: "/lab/calculus/suma-riemann" },
  { slug: "solidos-revolucion", module: "calculo-nucleo-a", href: "/lab/calculus/solidos-revolucion" },
  { slug: "osi", module: "redes-arquitectura", href: "/lab/networks/osi" },
  { slug: "subredes-vlan", module: "redes-segmentacion", href: "/lab/networks/subredes-vlan" },
  { slug: "stp", module: "redes-segmentacion", href: "/lab/networks/stp" },
  { slug: "enrutamiento", module: "redes-capa-de-red", href: "/lab/networks/enrutamiento" },
  { slug: "cobertura", module: "redes-capa-fisica", href: "/lab/networks/cobertura" },
  { slug: "firewall-nat", module: "redes-seguridad", href: "/lab/networks/firewall-nat" },
  { slug: "protoboard", module: "electronica-circuitos", href: "/lab/electronics/protoboard" },
  { slug: "fuente-poder", module: "electronica-circuitos", href: "/lab/electronics/fuente-poder" },
  { slug: "compuertas", module: "electronica-digital", href: "/lab/electronics/compuertas" },
  { slug: "contador", module: "electronica-digital", href: "/lab/electronics/contador" },
];
