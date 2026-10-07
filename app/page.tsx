import { redirect } from "next/navigation";

/**
 * La entrada al laboratorio es el lobby (/lab): ahí están las puertas a
 * todos los experimentos. La raíz solo redirige, para que abrir la URL
 * pelada no muestre una página vacía.
 */
export default function Home() {
  redirect("/lab");
}
