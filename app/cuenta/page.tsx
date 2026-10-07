"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { displayName, useProgress, useSession } from "@/lib/progress/useSession";
import { GUEST } from "@/lib/progress/store";
import styles from "@/components/progress/Page.module.css";

type Mode = "ingresar" | "registrar";

/** Mensajes de Supabase Auth, en castellano y con qué hacer. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed"))
    return "Todavía no confirmaste tu correo: busca el mensaje de confirmación en tu bandeja.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya hay una cuenta con ese correo. Prueba ingresar.";
  if (m.includes("password should be at least"))
    return "La contraseña tiene que tener al menos 6 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "Ese correo no parece válido.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos seguidos. Espera un momento y vuelve a probar.";
  if (m.includes("fetch")) return "No hay conexión con el servidor. Revisa tu internet.";
  return message;
}

/**
 * Ingreso, registro y cierre de sesión.
 *
 * El registro no es obligatorio para usar el laboratorio: esta página lo
 * explica y dice qué pasa con lo que ya se logró como invitado (pasa a la
 * cuenta al ingresar).
 */
export default function CuentaPage() {
  const { user, loading } = useSession();
  const progress = useProgress();
  const [mode, setMode] = useState<Mode>("ingresar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const guestCount =
    progress.owner === GUEST ? Object.keys(progress.completions).length : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    try {
      if (mode === "ingresar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        // Con "Confirm email" activado en Supabase no hay sesión hasta
        // confirmar: el progreso sigue guardado como invitado mientras tanto.
        if (!data.session) {
          setInfo(
            "Te enviamos un correo para confirmar la cuenta. Cuando la confirmes, ingresa aquí: tu progreso de este dispositivo se va a pasar a tu cuenta.",
          );
        }
      }
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    setBusy(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <h1 className={styles.title}>Tu cuenta</h1>
          <Link href="/lab" className={styles.back}>
            ← Laboratorio
          </Link>
        </div>

        {loading ? null : user ? (
          <section className={styles.card}>
            <p className={styles.lead}>
              Ingresaste como <strong>{displayName(user)}</strong> ({user.email}). Tus retos
              se guardan en tu cuenta y los ves desde cualquier dispositivo.
            </p>
            {progress.pending > 0 && (
              <p className={styles.note} style={{ marginTop: "0.8rem" }}>
                {progress.pending} logro{progress.pending > 1 ? "s" : ""} todavía no se
                subió: se va a subir solo cuando haya conexión.
              </p>
            )}
            <div className={styles.row} style={{ marginTop: "1rem" }}>
              <Link href="/progreso" className={styles.primary}>
                Ver mi progreso
              </Link>
              <button className={styles.secondary} onClick={signOut} disabled={busy}>
                Cerrar sesión
              </button>
            </div>
          </section>
        ) : (
          <>
            <p className={styles.lead}>
              No hace falta una cuenta para usar el laboratorio. Sin cuenta, tus retos se
              guardan solo en este dispositivo: si borras los datos del navegador, usas el
              modo privado o cambias de celular, se pierden. Con cuenta quedan guardados y tu
              docente puede ver tu avance.
            </p>

            {guestCount > 0 && (
              <p className={`${styles.note} ${styles.ok}`}>
                Tienes {guestCount} reto{guestCount > 1 ? "s" : ""} logrado
                {guestCount > 1 ? "s" : ""} en este dispositivo. Al ingresar o crear tu
                cuenta {guestCount > 1 ? "se pasan" : "se pasa"} a tu cuenta automáticamente.
              </p>
            )}

            <section className={styles.card}>
              <div className={styles.tabs} role="tablist">
                <button
                  className={styles.tab}
                  role="tab"
                  aria-selected={mode === "ingresar"}
                  onClick={() => setMode("ingresar")}
                >
                  Ingresar
                </button>
                <button
                  className={styles.tab}
                  role="tab"
                  aria-selected={mode === "registrar"}
                  onClick={() => setMode("registrar")}
                >
                  Crear cuenta
                </button>
              </div>

              <form className={styles.form} onSubmit={submit}>
                {mode === "registrar" && (
                  <label className={styles.field}>
                    Nombre
                    <input
                      className={styles.input}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </label>
                )}
                <label className={styles.field}>
                  Correo
                  <input
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <label className={styles.field}>
                  Contraseña
                  <input
                    className={styles.input}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "ingresar" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                  />
                </label>
                <button className={styles.primary} type="submit" disabled={busy}>
                  {busy ? "Un momento…" : mode === "ingresar" ? "Ingresar" : "Crear cuenta"}
                </button>
              </form>
            </section>

            {error && <p className={`${styles.note} ${styles.error}`}>{error}</p>}
            {info && <p className={`${styles.note} ${styles.ok}`}>{info}</p>}
          </>
        )}
      </div>
    </main>
  );
}
