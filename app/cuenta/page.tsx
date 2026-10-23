import { redirect } from "next/navigation";

/**
 * La cuenta ahora vive arriba de la página de progreso (AccountSection).
 * Esta ruta queda para que no se rompan los enlaces viejos: lleva ahí con el
 * formulario de ingreso abierto.
 */
export default function CuentaPage() {
  redirect("/progreso?ingresar=1");
}
