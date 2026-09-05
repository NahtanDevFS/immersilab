"use client";

import { useEffect } from "react";
import {
  addBounds,
  addCollider,
  type BoundsCollider,
  type BoxCollider,
} from "./colliders";

/**
 * Registra una caja de colisión mientras el componente esté montado.
 *
 * Va como efecto y no en el render para que al navegar del lobby a un
 * experimento las paredes del lobby se den de baja: si quedaran registradas,
 * el jugador chocaría contra paredes invisibles en medio del campo.
 */
export function useCollider(collider: BoxCollider | null) {
  const key = collider ? JSON.stringify(collider) : "";

  useEffect(() => {
    if (!collider) return;
    return addCollider(collider);
    // `key` resume el contenido de la caja: así no se re-registra en cada
    // render solo porque el objeto literal sea nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * Registra el recinto jugable (el pasillo) mientras el componente esté
 * montado. Igual que `useCollider`, se da de baja al desmontar: si quedara
 * registrado, al entrar a un experimento el jugador seguiría encerrado en el
 * rectángulo del lobby, en medio del campo.
 */
export function useBounds(area: BoundsCollider | null) {
  const key = area ? JSON.stringify(area) : "";

  useEffect(() => {
    if (!area) return;
    return addBounds(area);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
