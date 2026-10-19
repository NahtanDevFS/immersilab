# Créditos

Origen y licencia de todo lo que ImmersiLab usa y no se hizo en el proyecto.
Lo que no aparece aquí (curvas, sólidos, grafos, mapas de cobertura, cajas
de encapsulación, la puerta y el pasillo del lobby, y todo lo de los siete
experimentos del catálogo v2: tanques, rampa, cámara de vacío, edificio,
switches, rack y flip-flops) se genera por código.

## Texturas y entorno

| Archivo | Recurso | Fuente | Licencia |
|---|---|---|---|
| `public/textures/sky/qwantani_dusk_2_puresky.hdr` | Qwantani Dusk 2 (Pure Sky) | [Poly Haven](https://polyhaven.com/a/qwantani_dusk_2_puresky) | CC0 |
| `public/textures/grass/grass_005_*` | Grass005 | [ambientCG](https://ambientcg.com/view?id=Grass005) | CC0 |
| `public/textures/lab-wall/fabric_081c_*` | Fabric081C | [ambientCG](https://ambientcg.com/view?id=Fabric081C) | CC0 |
| `public/textures/door/wood_028_*` | Wood028 | [ambientCG](https://ambientcg.com/view?id=Wood028) | CC0 |
| `public/textures/wood/red-oak*.jpg` | Madera de roble rojo (cañón), incluida en el pack del cañón | [Free3D: Naval Cannon](https://free3d.com/3d-model/naval-cannon-88974.html) | Personal Use License |

CC0 es dominio público: no exige dar crédito. Se deja igual por orden.

## Modelos 3D

| Archivo | Recurso | Fuente | Licencia |
|---|---|---|---|
| `public/models/trees.glb` | Trees 9, de kim (`trees_9_obj.zip`), convertido y comprimido con `scripts/obj2glb.py` | [Free3D: Trees 9](https://free3d.com/3d-model/trees-9-53338.html) | Personal Use License |
| `public/models/cannon-barrel.glb`, `cannon-carriage.glb` | Naval Cannon, de lamarovsky (`NavalCannon.rar`, convertido de `.obj`) | [Free3D: Naval Cannon](https://free3d.com/3d-model/naval-cannon-88974.html) | Personal Use License |

> El origen de los tres recursos de Free3D se identificó por los nombres de
> los archivos originales (`NavalCannon/`, `trees_9_obj`) que aparecen en el
> código y en los materiales de los modelos. Su licencia es de uso personal:
> sirve para este proyecto académico, no para un uso comercial.

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
| Supabase | Cuentas y progreso |

## Bibliotecas principales

| Biblioteca | Licencia |
|---|---|
| Next.js, React | MIT |
| three.js | MIT |
| @react-three/fiber, @react-three/drei, @react-three/postprocessing | MIT |
| @supabase/supabase-js, @supabase/ssr | MIT |
| @google/genai | Apache 2.0 |
| zustand | MIT |
