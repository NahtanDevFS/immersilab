"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DISCIPLINES, EXPERIMENTS, MODULES } from "@/lib/catalog";
import { EXPERIMENT_DEFINITIONS, challengesOf } from "@/components/modules/registry";
import { GUEST, completionKey } from "@/lib/progress/store";
import { deleteProgress } from "@/lib/progress/sync";
import { displayName, useProgress, useSession } from "@/lib/progress/useSession";
import styles from "@/components/progress/Page.module.css";

const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

/**
 * Pantalla de progreso del alumno: cuántos retos lleva de cada experimento,
 * cuáles y cuándo los logró. Funciona igual con cuenta o como invitado; a
 * los invitados les recuerda que el progreso solo vive en este dispositivo.
 */
export default function ProgresoPage() {
  const { user, loading } = useSession();
  const progress = useProgress();

  // Los retos de cada experimento salen de su motor (lógica pura, sin escena).
  const catalog = useMemo(
    () =>
      EXPERIMENTS.flatMap((entry) => {
        const definition = EXPERIMENT_DEFINITIONS[entry.slug];
        return definition
          ? [{ ...entry, name: definition.name, challenges: challengesOf(definition) }]
          : [];
      }),
    [],
  );

  const total = catalog.reduce((sum, e) => sum + e.challenges.length, 0);
  const done = catalog.reduce(
    (sum, e) =>
      sum + e.challenges.filter((c) => progress.completions[completionKey(e.slug, c.id)]).length,
    0,
  );
  const guest = progress.owner === GUEST;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Borra el progreso (todo, o el de un experimento) después de confirmar. */
  async function erase(experiment?: { slug: string; name: string }) {
    const what = experiment ? `los retos de "${experiment.name}"` : "todos tus retos";
    const where = guest ? "de este dispositivo" : "de tu cuenta";
    if (!window.confirm(`¿Borrar ${what} ${where}? Vas a poder volver a hacerlos, pero no se puede deshacer.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteProgress(experiment?.slug);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message.toLowerCase().includes("fetch")
          ? "No hay conexión con el servidor: no se borró nada. Prueba de nuevo con internet."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <h1 className={styles.title}>
            {user ? `Progreso de ${displayName(user)}` : "Tu progreso"}
          </h1>
          <Link href="/lab" className={styles.back}>
            ← Laboratorio
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.summary}>
            <span className={styles.big}>
              {done}/{total}
            </span>
            <span className={styles.lead}>retos logrados en los {catalog.length} experimentos</span>
          </div>
          <div className={styles.meter}>
            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </section>

        {!loading && guest && (
          <p className={styles.note}>
            Estás como invitado: este progreso vive solo en este dispositivo y se puede perder
            si borras los datos del navegador o cambias de celular.{" "}
            <Link href="/cuenta">Ingresa o crea una cuenta</Link> y se guarda en tu cuenta.
          </p>
        )}
        {!guest && progress.pending > 0 && (
          <p className={styles.note}>
            {progress.pending} logro{progress.pending > 1 ? "s" : ""} todavía no se subió a tu
            cuenta: se sube solo cuando vuelva la conexión.
          </p>
        )}

        {error && <p className={`${styles.note} ${styles.error}`}>{error}</p>}

        {DISCIPLINES.map((discipline) => (
          <section key={discipline.slug} className={styles.inner} style={{ gap: "0.7rem" }}>
            <h2 className={styles.discipline}>{discipline.name}</h2>
            {/* Un módulo sin experimentos en el catálogo (por ejemplo, uno cuyos
                experimentos se retiraron) no se muestra: sería un título vacío. */}
            {MODULES.filter(
              (m) => m.discipline === discipline.slug && catalog.some((e) => e.module === m.slug),
            ).map((module) => (
              <div key={module.slug} className={styles.inner} style={{ gap: "0.6rem" }}>
                <p className={styles.module}>{module.name}</p>
                {catalog
                  .filter((e) => e.module === module.slug)
                  .map((experiment) => {
                    const achieved = experiment.challenges.filter(
                      (c) => progress.completions[completionKey(experiment.slug, c.id)],
                    ).length;
                    return (
                      <article key={experiment.slug} className={`${styles.card} ${styles.experiment}`}>
                        <div className={styles.experimentHead}>
                          <h3 className={styles.experimentName}>{experiment.name}</h3>
                          <span
                            className={styles.count}
                            data-all={achieved === experiment.challenges.length}
                          >
                            {achieved}/{experiment.challenges.length}
                          </span>
                        </div>
                        <ul className={styles.challenges}>
                          {experiment.challenges.map((c) => {
                            const completion =
                              progress.completions[completionKey(experiment.slug, c.id)];
                            return (
                              <li key={c.id} className={styles.challenge} data-done={Boolean(completion)}>
                                <span>
                                  {completion ? "✓ " : "○ "}
                                  {c.title}
                                </span>
                                {completion && (
                                  <time dateTime={completion.achievedAt}>
                                    {dateFormat.format(new Date(completion.achievedAt))}
                                  </time>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        <div className={styles.experimentActions}>
                          <Link href={experiment.href} className={styles.go}>
                            {achieved === 0 ? "Empezar →" : "Seguir →"}
                          </Link>
                          {achieved > 0 && (
                            <button
                              type="button"
                              className={styles.erase}
                              onClick={() => void erase(experiment)}
                              disabled={busy}
                            >
                              Borrar estos retos
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
              </div>
            ))}
          </section>
        ))}

        {done > 0 && (
          <section className={styles.card}>
            <p className={styles.lead}>
              ¿Quieres volver a hacer todos los retos desde cero? Esto borra tu progreso
              {guest ? " de este dispositivo" : " de tu cuenta, en todos tus dispositivos"}.
            </p>
            <div className={styles.row} style={{ marginTop: "0.8rem" }}>
              <button type="button" className={styles.danger} onClick={() => void erase()} disabled={busy}>
                {busy ? "Borrando…" : "Borrar todo mi progreso"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
