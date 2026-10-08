"use client";

import Link from "next/link";
import { displayName, isStaff, useRole, useSession } from "@/lib/progress/useSession";
import styles from "./AccountChip.module.css";

/**
 * Acceso a la cuenta y al progreso, para el header del lobby. Sin sesión
 * invita a ingresar, pero no obliga: el progreso se guarda igual en el
 * dispositivo.
 */
export function AccountChip() {
  const { user, loading } = useSession();
  const { role } = useRole(user);
  if (loading) return null;

  return (
    <span className={styles.chip}>
      {user ? (
        <>
          {isStaff(role) && (
            <Link href="/docente" className={styles.primary}>
              Vista docente
            </Link>
          )}
          <Link href="/progreso" className={isStaff(role) ? styles.secondary : styles.primary}>
            Mi progreso
          </Link>
          <Link href="/cuenta" className={styles.secondary}>
            {displayName(user)}
          </Link>
        </>
      ) : (
        <>
          <Link href="/progreso" className={styles.secondary}>
            Progreso
          </Link>
          <Link href="/cuenta" className={styles.primary}>
            Invitado · Ingresar
          </Link>
        </>
      )}
    </span>
  );
}
