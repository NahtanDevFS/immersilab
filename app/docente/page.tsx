"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DISCIPLINES, EXPERIMENTS, MODULES } from "@/lib/catalog";
import { EXPERIMENT_DEFINITIONS, challengesOf } from "@/components/modules/registry";
import { createClient } from "@/lib/supabase/client";
import { isStaff, useRole, useSession } from "@/lib/progress/useSession";
import {
  challengeStats,
  completionsCsv,
  hardestChallenge,
  summarizeStudents,
  totalsByDiscipline,
  type ChallengeCatalog,
  type CompletionRow,
  type ProfileRow,
} from "@/lib/teacher/aggregate";
import styles from "@/components/progress/Page.module.css";
import own from "./Docente.module.css";

const dayFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const dateTimeFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const percent = (rate: number) => `${Math.round(rate * 100)} %`;

/** Supabase devuelve como mucho 1000 filas por consulta: se piden por tandas. */
const PAGE = 1000;

async function fetchClassData(): Promise<{ profiles: ProfileRow[]; completions: CompletionRow[] }> {
  const supabase = createClient();

  const profiles: ProfileRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    profiles.push(...((data ?? []) as ProfileRow[]));
    if (!data || data.length < PAGE) break;
  }

  const completions: CompletionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("challenge_completions")
      .select("user_id, challenge_id, achieved_at, experiments(slug)")
      .order("achieved_at")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    (data ?? []).forEach((row) => {
      const experiment = (row.experiments as { slug?: string } | null)?.slug;
      if (experiment) {
        completions.push({
          user_id: row.user_id as string,
          challenge_id: row.challenge_id as string,
          achieved_at: row.achieved_at as string,
          experiment,
        });
      }
    });
    if (!data || data.length < PAGE) break;
  }

  return { profiles, completions };
}

const LOAD_ERROR =
  "No se pudieron traer los datos de la clase. Revisa la conexión e intenta de nuevo.";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; profiles: ProfileRow[]; completions: CompletionRow[]; at: Date };

/**
 * Vista docente: cuánto avanzó la clase, quién va atrasado y qué retos
 * cuestan más. Solo para cuentas con rol "teacher" o "admin"; la base lo hace
 * cumplir con RLS, esta pantalla solo explica qué pasa si no hay permiso.
 */
export default function DocentePage() {
  const { user, loading: sessionLoading } = useSession();
  const { role, loading: roleLoading } = useRole(user);
  const staff = isStaff(role);

  // Retos de cada experimento, leídos de su motor (igual que en /progreso).
  const catalog = useMemo<ChallengeCatalog>(
    () =>
      Object.fromEntries(
        EXPERIMENTS.flatMap((e) => {
          const definition = EXPERIMENT_DEFINITIONS[e.slug];
          return definition ? [[e.slug, challengesOf(definition)]] : [];
        }),
      ),
    [],
  );
  const experimentNames = useMemo(
    () =>
      Object.fromEntries(
        EXPERIMENTS.map((e) => [e.slug, EXPERIMENT_DEFINITIONS[e.slug]?.name ?? e.slug]),
      ),
    [],
  );
  // Los experimentos sin retos (Venturi) no tienen nada que mostrar aquí.
  const withChallenges = useMemo(
    () => EXPERIMENTS.filter((e) => (catalog[e.slug]?.length ?? 0) > 0),
    [catalog],
  );
  const totals = useMemo(() => totalsByDiscipline(catalog), [catalog]);
  const totalChallenges = Object.values(totals).reduce((a, b) => a + b, 0);

  const [load, setLoad] = useState<Load>({ state: "loading" });
  const refresh = useCallback(() => {
    setLoad({ state: "loading" });
    fetchClassData()
      .then((data) => setLoad({ state: "ready", ...data, at: new Date() }))
      .catch((error: unknown) => {
        console.warn("[docente]", error);
        setLoad({ state: "error", message: LOAD_ERROR });
      });
  }, []);

  useEffect(() => {
    if (!staff) return;
    let alive = true;
    fetchClassData()
      .then((data) => {
        if (alive) setLoad({ state: "ready", ...data, at: new Date() });
      })
      .catch((error: unknown) => {
        console.warn("[docente]", error);
        if (alive) setLoad({ state: "error", message: LOAD_ERROR });
      });
    return () => {
      alive = false;
    };
  }, [staff]);

  const students = useMemo(
    () => (load.state === "ready" ? summarizeStudents(load.profiles, load.completions, catalog) : []),
    [load, catalog],
  );
  const stats = useMemo(() => challengeStats(students, catalog), [students, catalog]);
  const hardest = hardestChallenge(stats);
  const achievedTotal = students.reduce((sum, s) => sum + s.total, 0);

  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return q ? students.filter((s) => s.name.toLocaleLowerCase("es").includes(q)) : students;
  }, [students, query]);

  const downloadCsv = () => {
    const csv = completionsCsv(students, catalog, experimentNames);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `immersilab-logros-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const header = (
    <div className={styles.top}>
      <h1 className={styles.title}>Vista docente</h1>
      <Link href="/lab" className={styles.back}>
        ← Laboratorio
      </Link>
    </div>
  );

  // --- Estados sin permiso -------------------------------------------------
  if (sessionLoading || roleLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.inner}>
          {header}
          <p className={styles.lead}>Cargando…</p>
        </div>
      </main>
    );
  }
  if (!user || !staff) {
    return (
      <main className={styles.page}>
        <div className={styles.inner}>
          {header}
          <section className={styles.card}>
            {!user ? (
              <p className={styles.lead}>
                Esta vista es para docentes. <Link href="/cuenta" className={own.link}>Ingresa</Link>{" "}
                con tu cuenta de docente para ver el avance de la clase.
              </p>
            ) : (
              <p className={styles.lead}>
                Tu cuenta no tiene permiso de docente. Si das clases con ImmersiLab, pide a quien
                administra el proyecto que le asigne el rol de docente a tu cuenta.
              </p>
            )}
          </section>
          <Link href="/progreso" className={styles.go}>
            Ver mi progreso →
          </Link>
        </div>
      </main>
    );
  }

  // --- Vista de la clase --------------------------------------------------
  return (
    <main className={styles.page}>
      <div className={`${styles.inner} ${own.wide}`}>
        {header}

        {load.state === "loading" && <p className={styles.lead}>Trayendo los datos de la clase…</p>}
        {load.state === "error" && (
          <p className={`${styles.note} ${styles.error}`}>
            {load.message}{" "}
            <button type="button" className={own.inlineButton} onClick={refresh}>
              Reintentar
            </button>
          </p>
        )}

        {load.state === "ready" && (
          <>
            <section className={own.stats}>
              <div className={styles.card}>
                <span className={own.statValue}>{students.length}</span>
                <span className={own.statLabel}>estudiantes</span>
              </div>
              <div className={styles.card}>
                <span className={own.statValue}>{achievedTotal}</span>
                <span className={own.statLabel}>retos logrados en total</span>
              </div>
              <div className={styles.card}>
                <span className={own.statValue}>
                  {students.length ? (achievedTotal / students.length).toFixed(1) : "—"}
                  <small>/{totalChallenges}</small>
                </span>
                <span className={own.statLabel}>promedio por estudiante</span>
              </div>
              <div className={styles.card}>
                {hardest ? (
                  <>
                    <span className={own.statText}>{hardest.title}</span>
                    <span className={own.statLabel}>
                      el reto más difícil: {experimentNames[hardest.experiment]},{" "}
                      {percent(hardest.rate)} lo logró
                    </span>
                  </>
                ) : (
                  <>
                    <span className={own.statText}>—</span>
                    <span className={own.statLabel}>
                      el reto más difícil aparece cuando haya logros
                    </span>
                  </>
                )}
              </div>
            </section>

            <div className={own.toolbar}>
              <input
                type="search"
                className={`${styles.input} ${own.search}`}
                placeholder="Buscar estudiante…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar estudiante"
              />
              <button
                type="button"
                className={styles.secondary}
                onClick={downloadCsv}
                disabled={achievedTotal === 0}
              >
                Descargar CSV
              </button>
              <button type="button" className={styles.secondary} onClick={refresh}>
                Actualizar
              </button>
            </div>
            <p className={own.updated}>Datos de las {dateTimeFormat.format(load.at)}</p>

            <section className={styles.inner} style={{ gap: "0.5rem" }}>
              <h2 className={styles.discipline}>Estudiantes</h2>
              {students.length === 0 && (
                <p className={styles.lead}>
                  Todavía no hay estudiantes con cuenta. Aparecen aquí apenas se registran en
                  /cuenta; lo que logren como invitados se suma al crear la cuenta.
                </p>
              )}
              {students.length > 0 && visible.length === 0 && (
                <p className={styles.lead}>Nadie coincide con «{query}».</p>
              )}
              {visible.map((s) => (
                <details key={s.id} className={`${styles.card} ${own.student}`}>
                  <summary className={own.studentRow}>
                    <span className={own.studentName}>{s.name}</span>
                    <span className={own.disciplines}>
                      {DISCIPLINES.map((d) => (
                        <span key={d.slug} title={d.name}>
                          {d.name.slice(0, 3)} {s.byDiscipline[d.slug] ?? 0}/{totals[d.slug]}
                        </span>
                      ))}
                    </span>
                    <span className={own.studentTotal}>
                      {s.total}/{totalChallenges}
                    </span>
                    <span className={own.last}>
                      {s.lastAchievedAt
                        ? `último: ${dayFormat.format(new Date(s.lastAchievedAt))}`
                        : "sin logros"}
                    </span>
                    <span className={own.studentMeter}>
                      <span style={{ width: `${totalChallenges ? (s.total / totalChallenges) * 100 : 0}%` }} />
                    </span>
                  </summary>
                  <div className={own.detail}>
                    {withChallenges.map((e) => {
                      const list = catalog[e.slug];
                      const done = s.byExperiment[e.slug] ?? {};
                      const count = list.filter((c) => done[c.id]).length;
                      return (
                        <div key={e.slug} className={own.detailExperiment}>
                          <div className={styles.experimentHead}>
                            <span>{experimentNames[e.slug]}</span>
                            <span className={styles.count} data-all={count === list.length}>
                              {count}/{list.length}
                            </span>
                          </div>
                          {count > 0 && (
                            <ul className={styles.challenges}>
                              {list
                                .filter((c) => done[c.id])
                                .map((c) => (
                                  <li key={c.id} className={styles.challenge} data-done>
                                    <span>✓ {c.title}</span>
                                    <time dateTime={done[c.id]}>
                                      {dayFormat.format(new Date(done[c.id]))}
                                    </time>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </section>

            <section className={styles.inner} style={{ gap: "0.7rem" }}>
              <h2 className={styles.discipline}>Retos: qué parte de la clase los logró</h2>
              {students.length === 0 ? (
                <p className={styles.lead}>Sin estudiantes todavía.</p>
              ) : (
                DISCIPLINES.map((discipline) => (
                  <div key={discipline.slug} className={styles.inner} style={{ gap: "0.6rem" }}>
                    <p className={styles.module}>{discipline.name}</p>
                    {withChallenges
                      .filter(
                        (e) => MODULES.find((m) => m.slug === e.module)?.discipline === discipline.slug,
                      )
                      .map((e) => (
                      <article key={e.slug} className={`${styles.card} ${styles.experiment}`}>
                        <h3 className={styles.experimentName}>{experimentNames[e.slug]}</h3>
                        <ul className={styles.challenges}>
                          {stats
                            .filter((st) => st.experiment === e.slug)
                            .map((st) => (
                              <li key={st.challenge} className={own.rate}>
                                <span className={own.rateTitle}>{st.title}</span>
                                <span className={own.rateBar}>
                                  <span style={{ width: `${st.rate * 100}%` }} data-low={st.rate < 0.25} />
                                </span>
                                <span className={own.rateValue}>
                                  {st.achievedBy}/{students.length} · {percent(st.rate)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
