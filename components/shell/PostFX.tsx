"use client";

import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import type { QualityTier } from "./useQualityTier";

/**
 * Post-proceso. Deliberadamente mínimo: solo bloom selectivo y viñeta.
 *
 * Nada de SSAO ni profundidad de campo — en un celular gama media el SSAO
 * se come ~40% del frame para un efecto que en un visor Cardboard casi no
 * se percibe. El presupuesto se gasta mejor en sombras y materiales.
 *
 * `luminanceThreshold={1}` es la pieza clave: solo brilla lo que supera 1 en
 * luminancia, y con tone mapping ACES eso solo pasa en materiales marcados
 * `toneMapped={false}` con emissive alto — o sea, las tiras de luz del techo,
 * los marcos de las puertas y las trayectorias. El resto de la escena
 * (paredes, piso, props) queda intacto. Si se bajara el umbral, todo se
 * lavaría en un halo lechoso, que es el error clásico del bloom.
 *
 * NO agregar `mipmapBlur` al <Bloom>. Con esta combinación de versiones
 * (@react-three/postprocessing 3.1.1, postprocessing 6.39.4, three 0.185)
 * deja TODA la escena en negro y no lanza ningún error — lo que lo vuelve
 * muy difícil de rastrear si se agrega junto con otros cambios. Sin él el
 * bloom se ve prácticamente igual.
 */
export function PostFX({ quality }: { quality: QualityTier }) {
  // En "low" no hay post-proceso. Los materiales emisivos siguen viéndose
  // brillantes por su propio color; simplemente no derraman halo.
  if (quality === "low") return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={1} luminanceSmoothing={0.35} intensity={0.7} />
      <Vignette offset={0.28} darkness={0.45} />
    </EffectComposer>
  );
}
