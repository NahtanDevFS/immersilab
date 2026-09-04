"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

/**
 * Carga un set PBR (color/normal/roughness, y opcionalmente oclusión
 * ambiental) y lo configura para repetirse (tiling) según el tamaño real de
 * la superficie en metros — repeatCount = tamaño_superficie / tamaño_físico
 * de la textura.
 *
 * Convención de nombres del proyecto (independiente de la fuente):
 *   <basePath>_diff.jpg    color base
 *   <basePath>_nor_gl.jpg  normal, formato OpenGL (no DirectX)
 *   <basePath>_rough.jpg   rugosidad
 *   <basePath>_ao.jpg      oclusión ambiental (opcional)
 *
 * Poly Haven ya usa esos sufijos. Las de ambientCG vienen como _Color /
 * _NormalGL / _Roughness / _AmbientOcclusion — se renombran al copiarlas a
 * public/textures/, para que acá solo exista una convención.
 *
 * Compartido entre el lobby y el fondo de los experimentos.
 */
export function useTiledPbrTexture(
  basePath: string,
  repeatX: number,
  repeatY: number,
  /** Cargar también el mapa de oclusión ambiental (<basePath>_ao.jpg). */
  withAo = false,
) {
  const paths = [
    `${basePath}_diff.jpg`,
    `${basePath}_nor_gl.jpg`,
    `${basePath}_rough.jpg`,
  ];
  if (withAo) paths.push(`${basePath}_ao.jpg`);

  const [map, normalMap, roughnessMap, aoMap] = useTexture(paths);

  useEffect(() => {
    const all = [map, normalMap, roughnessMap, aoMap].filter(
      Boolean,
    ) as THREE.Texture[];

    all.forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      // Anisotropía: sin esto, una textura vista en ángulo rasante (el piso,
      // que es el 90% de lo que se ve al caminar) se vuelve una papilla
      // borrosa a pocos metros. 8 es el punto donde deja de notarse la
      // mejora y todavía es barato en móvil.
      tex.anisotropy = 8;
    });

    /* eslint-disable react-hooks/immutability */
    map.colorSpace = THREE.SRGBColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.colorSpace = THREE.NoColorSpace;
    if (aoMap) {
      aoMap.colorSpace = THREE.NoColorSpace;
      // three.js lee el aoMap del segundo juego de UVs (canal 1) por
      // defecto, y las geometrías primitivas (plane, box) solo traen el
      // primero. Sin esta línea el mapa carga pero no se ve nada.
      aoMap.channel = 0;
    }
    /* eslint-enable react-hooks/immutability */
  }, [map, normalMap, roughnessMap, aoMap, repeatX, repeatY]);

  return withAo
    ? { map, normalMap, roughnessMap, aoMap }
    : { map, normalMap, roughnessMap };
}
