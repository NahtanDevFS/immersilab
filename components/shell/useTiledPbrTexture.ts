"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

/**
 * Carga un set diff/normal/roughness (convención de Poly Haven) y lo
 * configura para repetirse (tiling) según el tamaño real de la superficie
 * en metros — repeatCount = tamaño_superficie / tamaño_físico_textura,
 * usando el dato "wide" que Poly Haven publica en cada textura.
 *
 * Compartido entre el lobby y el fondo de los experimentos — cualquier
 * superficie nueva que necesite una textura real usa este mismo hook.
 */
export function useTiledPbrTexture(
  basePath: string,
  repeatX: number,
  repeatY: number,
) {
  const [map, normalMap, roughnessMap] = useTexture([
    `${basePath}_diff.jpg`,
    `${basePath}_nor_gl.jpg`,
    `${basePath}_rough.jpg`,
  ]);

  useEffect(() => {
    [map, normalMap, roughnessMap].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    });
    /* eslint-disable react-hooks/immutability */
    map.colorSpace = THREE.SRGBColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.colorSpace = THREE.NoColorSpace;
    /* eslint-enable react-hooks/immutability */
  }, [map, normalMap, roughnessMap, repeatX, repeatY]);

  return { map, normalMap, roughnessMap };
}