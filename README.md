# ImmersiLab

Laboratorio virtual de Física, Cálculo y Redes y Telecomunicaciones, pensado
para usarse con un celular dentro de un visor tipo Cardboard y un control
Bluetooth. También funciona en una computadora con teclado y mouse.

Cada experimento es una escena 3D interactiva con sus variables, una
explicación hablada, retos que dejan registro y un tutor por voz (Google
Gemini) que responde con los valores actuales del experimento.

## Qué incluye

- **15 experimentos** en tres áreas, con **47 retos** en total:
  - **Física:** tiro parabólico (artillería), colisiones 1D (predice el
    resultado), péndulo, ondas y superposición, tubo de Venturi.
  - **Cálculo:** derivada (frena en el pico), suma de Riemann, sólidos de
    revolución, series de Taylor.
  - **Redes y Telecomunicaciones:** modulación AM/FM, constelación QAM,
    propagación y cobertura, enrutamiento (contra Dijkstra), encapsulación
    OSI/TCP-IP, espectro de tu voz en vivo (FFT del micrófono).
- **Lobby** en 3D con una puerta por experimento: se entra caminando.
- **Tutor por voz:** se mantiene presionado el botón del micrófono (o el
  gatillo R2 del control), se pregunta en voz alta y responde hablando.
  Comenta solo cuando se logra un reto.
- **Progreso:** sin cuenta se guarda en el dispositivo; con cuenta se guarda
  en Supabase y se ve desde cualquier lado (`/progreso`). Lo logrado como
  invitado pasa a la cuenta al ingresar.
- **Vista docente** (`/docente`): avance de la clase, retos más difíciles y
  descarga en CSV. Solo para cuentas con rol de docente.
- **Tutorial de entrada** de 30 segundos y **recorrido guiado** por cuatro
  experimentos, para mostrar el laboratorio en clase.

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

Si cambia el catálogo de experimentos, la migración se regenera con:

```bash
python scripts/generar_migracion_catalogo.py
```

Para dar el rol de docente a una cuenta:

```sql
update public.profiles set role = 'teacher' where id = '<uuid de la cuenta>';
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
| Cursor | Stick derecho; A (✕ en PlayStation) para tocar | Mouse |
| Tutor | Mantener R2 | Mantener el botón del micrófono |

Algunos atajos por URL, útiles para depurar en el dispositivo: `?q=low` o
`?q=high` fuerzan la calidad gráfica (queda guardada).

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
app/                      rutas: lobby, experimentos, cuenta, progreso, docente, API del tutor
components/shell/         lo común a todos los experimentos: escena, paneles, controles, retos
components/lobby/         el pasillo con las puertas
components/modules/       un directorio por experimento: index.ts, engine.ts y la escena
components/tutor/         tutor por voz (micrófono, voz, sesión con el servidor)
components/progress/      chip de cuenta, sincronización del progreso
lib/                      catálogo, progreso, Supabase, recorrido, cálculos de la vista docente
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
