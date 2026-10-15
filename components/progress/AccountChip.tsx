"use client";

import Link from "next/link";
import { displayName, useSession } from "@/lib/progress/useSession";
import styles from "./AccountChip.module.css";

/**
 * Acceso a la cuenta y al progreso, para el header del lobby. Sin sesión
 * invita a ingresar, pero no obliga: el progreso se guarda igual en el
 * dispositivo.
 */
export function AccountChip() {
  const { user, loading } = useSession();
  if (loading) return null;

  return (
    <span className={styles.chip}>
      {user ? (
        <>
          <Link href="/progreso" className={styles.primary}>
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
