"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { displayName, useProgress, useSession } from "@/lib/progress/useSession";
import { GUEST } from "@/lib/progress/store";
import styles from "./Page.module.css";

type Mode = "ingresar" | "registrar" | "recuperar";

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
  if (m.includes("security purposes"))
    return "Por seguridad hay que esperar un minuto antes de pedir otro enlace.";
  if (m.includes("should be different"))
    return "La contraseña nueva tiene que ser distinta de la anterior.";
  if (m.includes("fetch")) return "No hay conexión con el servidor. Revisa tu internet.";
  return message;
}

/**
 * Campo de contraseña con un botón para verla: en el celular es fácil
 * equivocarse una letra sin darse cuenta.
 */
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className={styles.field}>
      {label}
      <span className={styles.passwordWrap}>
        <input
          className={styles.input}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={6}
          required
        />
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
          aria-pressed={visible}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </span>
    </label>
  );
}

/**
 * La cuenta, arriba de la página de progreso: con sesión, quién ingresó y
 * "Cerrar sesión"; como invitado, el aviso de que el progreso vive solo en
 * este dispositivo y el formulario para ingresar o crear la cuenta.
 *
 * Antes era una página aparte (/cuenta) que repetía parte de esta y mandaba
 * de una a la otra. El formulario arranca plegado, para no empujar el
 * progreso hacia abajo; `?ingresar=1` en la dirección lo abre (lo usan los
 * enlaces de "Ingresar").
 *
 * Recuperar la contraseña: "¿Olvidaste tu contraseña?" pide el correo y
 * Supabase manda un enlace que vuelve aquí con `?nueva=1`. El cliente de
 * Supabase canjea solo el código del enlace por una sesión de recuperación;
 * con esa sesión y `?nueva=1`, en vez de la cuenta se muestra el formulario
 * de la contraseña nueva. Para que el enlace funcione, la dirección del
 * sitio tiene que estar en Supabase, en Authentication → URL Configuration →
 * Redirect URLs (ver README).
 */
export function AccountSection() {
  const { user, loading } = useSession();
  const progress = useProgress();
  const params = useSearchParams();
  const router = useRouter();
  const recovering = params.get("nueva") === "1";
  const [open, setOpen] = useState(() => params.get("ingresar") === "1");
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
      if (mode === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/progreso?nueva=1`,
        });
        if (error) throw error;
        // Supabase no dice si el correo existe (para no revelar cuentas):
        // el mensaje tampoco.
        setInfo(
          "Si hay una cuenta con ese correo, te llegó un enlace para crear una contraseña nueva. Ábrelo en este mismo navegador. Revisa también la carpeta de spam.",
        );
      } else if (mode === "ingresar") {
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

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setInfo("Listo: tu contraseña cambió. La próxima vez ingresa con la nueva.");
      // Fuera de la dirección del enlace: recargar no vuelve a pedirla.
      router.replace("/progreso");
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  // Volvió del enlace del correo: la sesión de recuperación ya está abierta.
  if (user && recovering) {
    return (
      <section className={styles.card}>
        <p className={styles.lead}>
          Crea una contraseña nueva para <strong>{user.email}</strong>.
        </p>
        <form className={styles.form} onSubmit={savePassword} style={{ marginTop: "0.9rem" }}>
          <PasswordField
            label="Contraseña nueva"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <button className={styles.primary} type="submit" disabled={busy}>
            {busy ? "Un momento…" : "Guardar la contraseña"}
          </button>
        </form>
        {error && <p className={`${styles.note} ${styles.error}`}>{error}</p>}
      </section>
    );
  }

  // Abrió el enlace en otro navegador (o venció): no hay sesión para cambiarla.
  if (!user && recovering && !open) {
    return (
      <section className={styles.card}>
        <p className={`${styles.note} ${styles.error}`}>
          El enlace no sirvió: puede que haya vencido o que lo hayas abierto en otro navegador.
          Pide uno nuevo desde el mismo navegador donde lo vas a abrir.
        </p>
        <div className={styles.row} style={{ marginTop: "0.8rem" }}>
          <button
            className={styles.primary}
            onClick={() => {
              setOpen(true);
              setMode("recuperar");
            }}
          >
            Pedir otro enlace
          </button>
        </div>
      </section>
    );
  }

  if (user) {
    return (
      <section className={`${styles.card} ${styles.account}`}>
        <p className={styles.lead}>
          Ingresaste como <strong>{displayName(user)}</strong> ({user.email}). Tus retos se
          guardan en tu cuenta y los ves desde cualquier dispositivo.
          {info && (
            <>
              <br />
              <span className={styles.okText}>{info}</span>
            </>
          )}
        </p>
        <button className={styles.secondary} onClick={signOut} disabled={busy}>
          {busy ? "Un momento…" : "Cerrar sesión"}
        </button>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.account}>
        <p className={styles.lead}>
          Estás como invitado: tus retos se guardan solo en este dispositivo y se pierden si
          borras los datos del navegador, usas el modo privado o cambias de celular. Con una
          cuenta quedan guardados y los ves desde cualquier dispositivo.
        </p>
        {!open && (
          <button className={styles.primary} onClick={() => setOpen(true)}>
            Ingresar o crear cuenta
          </button>
        )}
      </div>

      {open && (
        <>
          {guestCount > 0 && (
            <p className={`${styles.note} ${styles.ok}`} style={{ marginTop: "0.8rem" }}>
              Tienes {guestCount} reto{guestCount > 1 ? "s" : ""} logrado
              {guestCount > 1 ? "s" : ""} en este dispositivo. Al ingresar o crear tu cuenta{" "}
              {guestCount > 1 ? "se pasan" : "se pasa"} a tu cuenta automáticamente.
            </p>
          )}

          <div className={styles.tabs} role="tablist" style={{ marginTop: "1rem" }}>
            <button
              className={styles.tab}
              role="tab"
              aria-selected={mode !== "registrar"}
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
            {mode === "recuperar" ? (
              <p className={styles.lead}>
                Escribe el correo de tu cuenta y te mandamos un enlace para crear una
                contraseña nueva.
              </p>
            ) : (
              <PasswordField
                label="Contraseña"
                value={password}
                onChange={setPassword}
                autoComplete={mode === "ingresar" ? "current-password" : "new-password"}
              />
            )}
            <button className={styles.primary} type="submit" disabled={busy}>
              {busy
                ? "Un momento…"
                : mode === "ingresar"
                  ? "Ingresar"
                  : mode === "registrar"
                    ? "Crear cuenta"
                    : "Mandarme el enlace"}
            </button>
            {mode === "ingresar" && (
              <button type="button" className={styles.linkButton} onClick={() => setMode("recuperar")}>
                ¿Olvidaste tu contraseña?
              </button>
            )}
            {mode === "recuperar" && (
              <button type="button" className={styles.linkButton} onClick={() => setMode("ingresar")}>
                ← Volver a ingresar
              </button>
            )}
          </form>

          {error && <p className={`${styles.note} ${styles.error}`}>{error}</p>}
          {info && <p className={`${styles.note} ${styles.ok}`}>{info}</p>}
        </>
      )}
    </section>
  );
}
