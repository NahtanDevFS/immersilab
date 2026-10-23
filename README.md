# ImmersiLab

Laboratorio virtual de Física, Cálculo y Redes y Telecomunicaciones, pensado
para usarse con un celular dentro de un visor tipo Cardboard y un control
Bluetooth. También funciona en una computadora con teclado y mouse.

Cada experimento es una escena 3D interactiva con sus variables, una
explicación hablada, retos que dejan registro y un tutor por voz (Google
Gemini) que responde con los valores actuales del experimento.

## Qué incluye

- **20 experimentos** en cuatro áreas, con **72 retos** en total:
  - **Física:** tiro parabólico (artillería), ley de la fuerza, la 2da de Newton
    (plano inclinado, fricción y polea), colisiones 1D (predice el resultado),
    péndulo, guía la carga (campo eléctrico), la grúa electromagnética
    (electroimán).
  - **Cálculo:** derivada (frena en la cima), llena el tanque (razones de
    cambio relacionadas), suma de Riemann, sólidos de revolución.
  - **Redes y Telecomunicaciones:** encapsulación OSI/TCP-IP, divide la red
    (subredes VLSM y VLAN), rompe el bucle (STP y EtherChannel),
    enrutamiento (contra Dijkstra), propagación y cobertura con demanda en
    la hora pico, defiende el borde (firewall y NAT).
  - **Electrónica:** protoboard con multímetro (Ohm y Kirchhoff), fuente de
    poder con osciloscopio (de alterna a continua), compuertas lógicas, el
    contador (flip-flops y contadores de módulo N).
- **Lobby** en 3D con una puerta por experimento: se entra caminando. Al
  volver de un experimento se aparece en el pasillo frente a su puerta, no
  en la entrada. Las luminarias usan iluminación "horneada" (charcos de luz
  pintados y solo cuatro luces reales que siguen al jugador), para que el
  pasillo vaya fluido en un celular de gama media.
- **Tutor por voz:** se mantiene presionado el botón del micrófono (o el
  botón B del control), se pregunta en voz alta y responde hablando.
  Comenta solo cuando se logra un reto. Mientras se mantiene el botón, una
  pausa para pensar no corta la pregunta (también en Android, donde Chrome
  corta solo el reconocimiento). El servidor descarta las respuestas en las
  que el modelo escribe su razonamiento en vez de la respuesta, y manda solo
  oraciones completas.
- **Progreso:** sin cuenta se guarda en el dispositivo; con cuenta se guarda
  en Supabase y se ve desde cualquier lado (`/progreso`). Lo logrado como
  invitado pasa a la cuenta al ingresar.
- **Tutorial de entrada** de 30 segundos y **recorrido guiado** de nueve
  paradas por las cuatro áreas, para mostrar el laboratorio en clase.

## Requisitos

- Node.js 20 o más nuevo.
- Una clave de la API de Gemini.
- Un proyecto de Supabase (gratis alcanza). Sus dos claves son obligatorias:
  sin ellas la app no arranca. Registrarse, en cambio, es opcional para quien
  la usa.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y completa los valores
npm run dev
```

Abre <http://localhost:3000>: la raíz lleva al lobby (`/lab`).

### Variables de entorno

| Variable | Para qué |
|---|---|
| `GEMINI_API_KEY` | Tutor por voz. Solo se usa en el servidor (`app/api/tutor`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Cuentas y progreso guardado. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ídem. Es pública por diseño: los datos los protege RLS. |

### Base de datos (Supabase)

Corre en el SQL Editor de Supabase el archivo
`supabase/migrations/20261006120000_catalogo_y_retos.sql`. Crea el catálogo
de disciplinas, módulos y experimentos, la tabla `challenge_completions`, el
perfil automático al registrarse y las reglas de acceso (RLS).

Después, en orden, las migraciones que agregan experimentos:
`20261008120000_electromagnetismo.sql`, `20261008130000_electronica.sql` y
`20261020120000_catalogo_v2.sql` (los siete experimentos del catálogo v2; no
borra los retirados, para no perder el historial).

Para que cada alumno pueda borrar su progreso desde la página de progreso,
corre también `20261021120000_borrar_progreso.sql` (agrega la regla de RLS
que permite borrar los retos propios).

Si cambia el catálogo de experimentos, la migración se regenera con:

```bash
python scripts/generar_migracion_catalogo.py
```

## Probar en el celular con el visor

El navegador solo entrega el giroscopio y el micrófono en **HTTPS** o en
`localhost`. Para abrir el servidor de desarrollo desde el celular hace falta
un túnel HTTPS (por ejemplo `npx next dev --experimental-https` en la misma
red, o un servicio de túnel). Por HTTP plano el laboratorio carga, pero sin
giroscopio ni tutor por voz, y lo avisa en pantalla.

Controles:

| | Visor + control | Computadora |
|---|---|---|
| Mirar | Girar la cabeza | Arrastrar con el mouse |
| Caminar | Stick izquierdo | W A S D o flechas (Shift corre) |
| Caminar en el celular sin control | — | El joystick de la pantalla, abajo a la izquierda |
| Bajar y subir la vista | Stick derecho arriba o abajo (centrar la vista vuelve a la altura de los ojos) | Q / E, la rueda del mouse o el stick derecho del control |
| Cursor | Stick derecho; A (✕ en PlayStation) para tocar | Mouse |
| Tutor | Mantener B | Mantener el botón del micrófono |
| Cancelar al tutor | Mantener B y apretar A | La ✕ junto al micrófono o Esc |

El control ImmersiLab (ESP32) se reconoce solo en el celular y en la
computadora. En Windows, Chrome no muestra su nombre (aparece como
"Unknown Gamepad (Vendor: e502 Product: bbab)"), así que se reconoce por esos
dos códigos. Los sticks y los botones funcionan igual que en el celular.

Algunos atajos por URL, útiles para depurar en el dispositivo:

- `?q=low` o `?q=high` fuerzan la calidad gráfica (queda guardada).
- `?diagnostico=1` activa el modo diagnóstico: con `npm run dev`, el aparato
  manda dos veces por segundo lo que lee (control, toques, cámara, fps) y el
  servidor lo agrega a `.debug/device.log`. Sirve para ver qué pasa en el
  visor sin poder mirar la pantalla.

En desarrollo, además, cada respuesta del tutor queda en `.debug/tutor.log`:
la pregunta tal como se entendió, cómo terminó (`STOP` es lo normal,
`MAX_TOKENS` es que se quedó sin espacio) y lo que se cortó si el modelo
escribió su razonamiento. La carpeta `.debug/` no se sube al repositorio.

## Comandos

```bash
npm run dev     # desarrollo
npm run build   # compilación de producción
npm run start   # servir la compilación
npm run lint    # ESLint
npx tsc --noEmit -p .   # revisión de tipos
```

## Estructura

```
app/                      rutas: lobby, experimentos, cuenta, progreso, API del tutor
components/shell/         lo común a todos los experimentos: escena, paneles, controles, retos
components/lobby/         el pasillo con las puertas
components/modules/       un directorio por experimento: index.ts, engine.ts y la escena
components/tutor/         tutor por voz (micrófono, voz, sesión con el servidor)
components/progress/      chip de cuenta, sincronización del progreso
lib/                      catálogo, progreso, Supabase, recorrido, vista y tutor
types/module.ts           el contrato que implementa cada experimento
supabase/migrations/      esquema de la base
scripts/                  conversión de modelos 3D y generación de la migración
```

### Agregar un experimento

1. Crear su carpeta en `components/modules/<área>/experiments/<slug>/` con:
   - `engine.ts`: la lógica pura (sin React), que implementa
     `ExperimentEngine`; los retos van en `getChallenges()`.
   - la escena (`*Scene.tsx`), que dibuja a partir del motor;
   - `index.ts`: la `ExperimentDefinition` (variables, explicación, pistas
     para el tutor).
2. Agregar la página en `app/lab/<área>/<slug>/page.tsx` con `ExperimentShell`.
3. Sumarlo a `lib/catalog.ts`, a `components/modules/registry.ts` y a la puerta
   del lobby (`components/lobby/catalog.ts`).
4. Regenerar y correr la migración del catálogo.

El shell no se toca: paneles, retos, tutor y progreso funcionan solos con la
definición.

## Documentación

- `PLAN_DESARROLLO.md`: decisiones, diseño de cada experimento, fases y
  estado del proyecto.
- `CREDITOS.md`: origen y licencia de texturas, modelos y tipografías.
- `scripts/README.md`: cómo convertir y comprimir modelos 3D.
