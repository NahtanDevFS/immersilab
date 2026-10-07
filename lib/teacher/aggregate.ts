/**
 * Cuentas de la vista docente, como funciones puras: reciben las filas tal
 * como vienen de Supabase y el catálogo de retos, y devuelven lo que la
 * pantalla muestra. Separado de la página para poder probarlo sin red.
 */

import { DISCIPLINES, EXPERIMENTS, MODULES } from "@/lib/catalog";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export interface CompletionRow {
  user_id: string;
  challenge_id: string;
  achieved_at: string;
  experiment: string;
}

/** Retos de cada experimento: slug → [{ id, title }]. */
export type ChallengeCatalog = Record<string, Array<{ id: string; title: string }>>;

export interface StudentSummary {
  id: string;
  name: string;
  total: number;
  /** Logrados por disciplina (slug → cantidad). */
  byDiscipline: Record<string, number>;
  /** Logrados por experimento (slug → ids de reto con su fecha). */
  byExperiment: Record<string, Record<string, string>>;
  lastAchievedAt: string | null;
  joinedAt: string;
}

export interface ChallengeStat {
  experiment: string;
  challenge: string;
  title: string;
  achievedBy: number;
  /** 0–1 sobre el total de estudiantes. */
  rate: number;
}

const disciplineOf: Record<string, string> = Object.fromEntries(
  EXPERIMENTS.map((e) => [
    e.slug,
    MODULES.find((m) => m.slug === e.module)?.discipline ?? "",
  ]),
);

/** Total de retos por disciplina, según el catálogo. */
export function totalsByDiscipline(catalog: ChallengeCatalog): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(DISCIPLINES.map((d) => [d.slug, 0]));
  Object.entries(catalog).forEach(([slug, challenges]) => {
    const discipline = disciplineOf[slug];
    if (discipline) totals[discipline] += challenges.length;
  });
  return totals;
}

export function displayName(profile: ProfileRow): string {
  return profile.full_name?.trim() || `Sin nombre (${profile.id.slice(0, 8)})`;
}

/**
 * Un resumen por estudiante. Solo cuentan los perfiles con rol "student" y
 * solo los retos que siguen existiendo en el catálogo: si un reto se renombra
 * o se quita, sus filas viejas no inflan el total.
 */
export function summarizeStudents(
  profiles: ProfileRow[],
  completions: CompletionRow[],
  catalog: ChallengeCatalog,
): StudentSummary[] {
  const valid = new Set(
    Object.entries(catalog).flatMap(([slug, list]) => list.map((c) => `${slug}/${c.id}`)),
  );
  const students = new Map<string, StudentSummary>();
  profiles
    .filter((p) => p.role === "student")
    .forEach((p) =>
      students.set(p.id, {
        id: p.id,
        name: displayName(p),
        total: 0,
        byDiscipline: Object.fromEntries(DISCIPLINES.map((d) => [d.slug, 0])),
        byExperiment: {},
        lastAchievedAt: null,
        joinedAt: p.created_at,
      }),
    );

  completions.forEach((c) => {
    const student = students.get(c.user_id);
    if (!student || !valid.has(`${c.experiment}/${c.challenge_id}`)) return;
    const experiment = (student.byExperiment[c.experiment] ??= {});
    if (experiment[c.challenge_id]) return; // por las dudas: la tabla ya es única
    experiment[c.challenge_id] = c.achieved_at;
    student.total += 1;
    const discipline = disciplineOf[c.experiment];
    if (discipline) student.byDiscipline[discipline] += 1;
    if (!student.lastAchievedAt || c.achieved_at > student.lastAchievedAt) {
      student.lastAchievedAt = c.achieved_at;
    }
  });

  return [...students.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"),
  );
}

/** Para cada reto, cuántos estudiantes lo lograron (en el orden del catálogo). */
export function challengeStats(
  students: StudentSummary[],
  catalog: ChallengeCatalog,
): ChallengeStat[] {
  const n = students.length;
  return EXPERIMENTS.flatMap((e) =>
    (catalog[e.slug] ?? []).map((c) => {
      const achievedBy = students.filter((s) => s.byExperiment[e.slug]?.[c.id]).length;
      return {
        experiment: e.slug,
        challenge: c.id,
        title: c.title,
        achievedBy,
        rate: n ? achievedBy / n : 0,
      };
    }),
  );
}

/**
 * El reto que menos estudiantes lograron. null si nadie logró nada todavía:
 * con todo en cero, señalar "el más difícil" sería elegir uno al azar.
 * En un empate gana el primero del catálogo.
 */
export function hardestChallenge(stats: ChallengeStat[]): ChallengeStat | null {
  if (stats.every((s) => s.achievedBy === 0)) return null;
  return stats.reduce((min, s) => (s.rate < min.rate ? s : min));
}

/** CSV de todos los logros, para abrir en Excel u hojas de cálculo. */
export function completionsCsv(
  students: StudentSummary[],
  catalog: ChallengeCatalog,
  experimentNames: Record<string, string>,
): string {
  const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [["estudiante", "experimento", "reto", "logrado"].join(",")];
  students.forEach((s) => {
    Object.entries(s.byExperiment).forEach(([slug, challenges]) => {
      Object.entries(challenges).forEach(([id, at]) => {
        const title = catalog[slug]?.find((c) => c.id === id)?.title ?? id;
        lines.push(
          [s.name, experimentNames[slug] ?? slug, title, at].map(escape).join(","),
        );
      });
    });
  });
  // BOM: sin él, Excel abre los acentos rotos.
  return "﻿" + lines.join("\n");
}
