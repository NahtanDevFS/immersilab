# Créditos

Origen y licencia de todo lo que ImmersiLab usa y no se hizo en el proyecto.
Lo que no aparece aquí (curvas, sólidos, ondas, constelaciones, grafos,
mapas de cobertura, cajas de encapsulación, la puerta y el pasillo del lobby)
se genera por código.

## Texturas y entorno

| Archivo | Recurso | Fuente | Licencia |
|---|---|---|---|
| `public/textures/sky/qwantani_dusk_2_puresky.hdr` | Qwantani Dusk 2 (Pure Sky) | [Poly Haven](https://polyhaven.com/a/qwantani_dusk_2_puresky) | CC0 |
| `public/textures/grass/grass_005_*` | Grass005 | [ambientCG](https://ambientcg.com/view?id=Grass005) | CC0 |
| `public/textures/lab-wall/fabric_081c_*` | Fabric081C | [ambientCG](https://ambientcg.com/view?id=Fabric081C) | CC0 |
| `public/textures/door/wood_028_*` | Wood028 | [ambientCG](https://ambientcg.com/view?id=Wood028) | CC0 |
| `public/textures/wood/red-oak*.jpg` | Madera de roble rojo (cañón) | **Por confirmar** | **Por confirmar** |

CC0 es dominio público: no exige dar crédito. Se deja igual por orden.

## Modelos 3D

| Archivo | Recurso | Fuente | Licencia |
|---|---|---|---|
| `public/models/trees.glb` | Pack de 9 árboles (`22-trees_9_obj`), convertido y comprimido con `scripts/obj2glb.py` | **Por confirmar** | **Por confirmar** |
| `public/models/cannon-barrel.glb`, `cannon-carriage.glb` | Cañón y cureña (convertidos de `.obj`) | **Por confirmar** | **Por confirmar** |

> Si alguno de estos tiene licencia CC-BY, hay que nombrar al autor aquí y
> en el informe del proyecto.

## Marca

| Archivo | Uso |
|---|---|
| `public/brand/logo-umg.png` | Logo de la Universidad Mariano Gálvez de Guatemala, en el encabezado. Uso académico. |

## Tipografías

| Familia | Fuente | Licencia |
|---|---|---|
| Space Grotesk | Google Fonts (cargada con `next/font`) | SIL Open Font License 1.1 |
| JetBrains Mono | Google Fonts (cargada con `next/font`) | SIL Open Font License 1.1 |
| Geist (`public/fonts/Geist-Regular.ttf`) | Vercel, copiada del paquete de Next. Se usa para el texto 3D de la vista VR, que no puede usar las fuentes de la página | SIL Open Font License 1.1 |

## Servicios

| Servicio | Uso |
|---|---|
| Google Gemini (`@google/genai`) | Respuestas del tutor por voz |
| Web Speech API del navegador | Reconocimiento de voz y voz del laboratorio |
| Supabase | Cuentas, progreso y vista docente |

## Bibliotecas principales

| Biblioteca | Licencia |
|---|---|
| Next.js, React | MIT |
| three.js | MIT |
| @react-three/fiber, @react-three/drei, @react-three/postprocessing | MIT |
| @supabase/supabase-js, @supabase/ssr | MIT |
| @google/genai | Apache 2.0 |
| zustand | MIT |
