"use client";

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { Header } from "./Header";
import { LabBackground } from "./LabBackground";
import { LabLighting } from "./LabLighting";
import { PostFX } from "./PostFX";
import { StereoView } from "./StereoView";
import { VrButton, VrExit } from "./VrControls";
import { exitVr, useViewMode } from "@/lib/view/viewMode";
import { LoadingOverlay } from "./LoadingOverlay";
import { useQualityTier } from "./useQualityTier";
import { VariablesPanel } from "./VariablesPanel";
import { VariablesHud3D } from "./VariablesHud3D";
import { ResultPanel } from "./ResultPanel";
import { BriefingPanel } from "./BriefingPanel";
import { TourPanel } from "./TourPanel";
import { TOUR, readTourIndex, tourHref } from "@/lib/tour";
import { VrHud } from "@/components/vr/VrHud";
import { Whiteboard } from "./Whiteboard";
import { ChallengeHUD } from "./ChallengeHUD";
import { GyroCamera } from "./GyroCamera";
import { MovementController } from "./MovementController";
import { DragLookControls } from "./DragLookControls";
import { GamepadStatus } from "./GamepadStatus";
import { OrientationGate } from "./OrientationGate";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { useVariables } from "@/lib/modules/useVariables";
import { VirtualCursor } from "./VirtualCursor";
import { useVirtualCursor } from "./useVirtualCursor";
import { VoiceTutor } from "@/components/tutor/VoiceTutor";
import type { ExperimentDefinition, VrAction } from "@/types/module";
import styles from "./ExperimentShell.module.css";

/** La URL no cambia mientras el experimento está montado (cambiar de parada
 *  monta otra página), así que no hace falta suscribirse a nada. */
const noSubscription = () => () => {};

interface Props {
  experiment: ExperimentDefinition;
  disciplineName: string;
  moduleName: string;
}

/**
 * Shell genérico del laboratorio: es la pieza que le da a TODOS los
 * experimentos el mismo diseño (fondo, header con logo, panel de variables,
 * panel de resultados, cámara). No conoce ninguna disciplina — recibe la
 * definición del experimento como prop.
 *
 * Para agregar un experimento nuevo (colisiones, péndulo, etc.) no hay que
 * tocar este archivo: solo crear su ExperimentDefinition y usarla aquí.
 */
export function ExperimentShell({
  experiment,
  disciplineName,
  moduleName,
}: Props) {
  const { values, setValue } = useVariables(experiment.variablesSchema);
  const { orientation, permission, requestPermission, insecure } =
    useDeviceOrientation();
  const quality = useQualityTier();

  const gyroActive = permission === "granted";
  // Vista VR: pantalla partida para el visor (ver lib/view/viewMode.ts).
  const view = useViewMode();
  const vr = view === "vr";
  // hoveredKey: qué slider está bajo el cursor ahora mismo (con dedo o con
  // el stick derecho del gamepad) — se usa para resaltarlo en el panel.
  // En la vista VR no hay cursor: se apunta con la mira (lib/view/gaze.ts).
  const { position: cursorPos, hoveredKey } = useVirtualCursor(gyroActive && !vr);

  // Una única instancia del motor durante toda la vida del componente.
  const engine = useMemo(() => experiment.createEngine(), [experiment]);

  useEffect(() => {
    engine.init(values);
    // Solo se corre al montar: re-inicializar en cada cambio de variable
    // borraría el estado en curso del experimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const { SceneComponent, ControlsComponent } = experiment;

  // Recorrido guiado (lib/tour.ts): activo si la URL trae ?recorrido=N y la
  // parada N es este experimento.
  const router = useRouter();
  const pathname = usePathname();
  const tourIndex = useSyncExternalStore(
    noSubscription,
    () => readTourIndex(window.location.search),
    () => null,
  );
  const [tourExited, setTourExited] = useState(false);
  const touring =
    tourIndex !== null && TOUR[tourIndex].slug === experiment.slug && !tourExited;
  // null = lo de siempre: abierta al entrar, salvo en el recorrido.
  const [briefingOpen, setBriefingOpen] = useState<boolean | null>(null);

  // En la vista VR la tarjeta del recorrido no se ve (es HTML): el paso a la
  // siguiente parada va como un botón más del panel de acciones 3D.
  const nextStop = touring && tourIndex !== null ? TOUR[tourIndex + 1] : undefined;
  const exitTour = () => {
    setTourExited(true);
    // Que siga cerrada al salir, con su "?" para abrirla.
    setBriefingOpen((open) => open ?? false);
    router.replace(pathname);
  };
  const tourActions: VrAction[] =
    touring && tourIndex !== null
      ? [
          {
            id: "recorrido",
            label: nextStop ? `Siguiente parada: ${nextStop.name}` : "Terminar el recorrido",
            onSelect: () => {
              if (nextStop) {
                router.push(tourHref(tourIndex + 1));
                return;
              }
              // La pantalla de progreso es HTML: se ve sin el visor.
              void exitVr();
              router.push("/progreso");
            },
          },
          { id: "salir-recorrido", label: "Salir del recorrido", onSelect: () => exitTour() },
        ]
      : [];

  return (
    <OrientationGate>
      <div className={styles.container} data-view={view}>
        <Header
          actions={
            <VrButton onBeforeEnter={permission === "prompt" ? requestPermission : undefined} />
          }
          subtitle={`${disciplineName} / ${moduleName} / ${experiment.name}`}
          showBackLink
        />

        {/* En modo visor el panel NO va pegado a la pantalla: se dibuja
            dentro del Canvas, a distancia de lectura (VariablesHud3D). Con
            mouse, en cambio, la esquina es lo cómodo. */}
        {!gyroActive && (
          <VariablesPanel
            title="Variables"
            schema={experiment.variablesSchema}
            values={values}
            onChange={setValue}
            selectedKey={hoveredKey ?? undefined}
          />
        )}

        <ResultPanel engine={engine} />

        {experiment.briefing && (
          <BriefingPanel
            experimentName={experiment.name}
            briefing={experiment.briefing}
            // En el recorrido la explicación larga arranca cerrada: la
            // reemplaza la tarjeta corta de la parada.
            open={briefingOpen ?? !touring}
            onOpenChange={setBriefingOpen}
            hideReopen={touring}
          />
        )}

        {touring && tourIndex !== null && (
          <TourPanel
            index={tourIndex}
            onPreset={(preset) =>
              Object.entries(preset).forEach(([key, value]) => setValue(key, value))
            }
            onExit={exitTour}
            onShowBriefing={() => setBriefingOpen(true)}
          />
        )}

        {/* Dock inferior derecho: el HUD de retos arriba y los controles
            propios del experimento abajo, apilados. Cada ControlsComponent
            se posiciona solo en esa esquina; el dock los pone en flujo para
            que no se encimen con el HUD (ver ExperimentShell.module.css). */}
        <div className={styles.dock}>
          <ChallengeHUD engine={engine} experimentSlug={experiment.slug} />
          {ControlsComponent && <ControlsComponent engine={engine} />}
        </div>

        {gyroActive && <GamepadStatus />}

        {/* Tutor por voz: R2 o el botón para preguntar. Se remonta con cada
            experimento, así que cada uno arranca con memoria nueva. */}
        <VoiceTutor
          engine={engine}
          hints={experiment.tutorHints}
          schema={experiment.variablesSchema}
        />

        {/* El botón aparece SIEMPRE que el sensor todavía no entregó datos.
            En Android el enganche automático lo pone en "granted" en
            milisegundos, así que casi nunca se llega a ver; en iOS, donde
            hace falta el gesto, es imprescindible. Ocultarlo por "ya aceptó
            antes" dejaba el juego sin giroscopio y sin forma de activarlo. */}
        {permission === "prompt" && (
          <button className={styles.gyroButton} onClick={requestPermission}>
            Activar giroscopio
          </button>
        )}

        {permission === "denied" && (
          <p className={styles.gyroNote}>Permiso de giroscopio denegado.</p>
        )}

        {permission === "unsupported" && (
          <p className={styles.gyroNote}>
            {insecure
              ? // Este caso confunde muchísimo si no se dice: el teléfono
                // TIENE giroscopio, pero el navegador no lo entrega fuera de
                // HTTPS o localhost, y no avisa de ninguna forma.
                "El navegador bloquea el giroscopio fuera de HTTPS — abre el laboratorio por https:// o desde localhost."
              : "Sin giroscopio: WASD o flechas para caminar, arrastra para mirar."}
          </p>
        )}

        <Canvas
          // Lo único que queda visible en la vista VR (ver el CSS del shell).
          data-vr-keep
          data-vr-scene
          /* Contexto de apilamiento propio (z-index 0): las etiquetas <Html>
             de drei se montan junto al canvas con z-index calculados que
             pueden ser enormes, y se dibujaban ENCIMA de los paneles del
             shell (variables, resultados, retos, avisos). Así quedan todas
             debajo, sin tocar cada etiqueta. */
          style={{ zIndex: 0 }}
          shadows={quality === "high" ? "soft" : true}
          dpr={[1, quality === "high" ? 2 : 1.5]}
          camera={{
            position: experiment.cameraView?.position ?? [8, 5, 10],
            fov: 50,
            // near alto y far ajustado al tamaño real de la escena: es lo
            // que quita el parpadeo entre caras coplanares del cañón.
            // Subir `near` de 0.1 a 0.5 multiplica por 5 la precisión de
            // profundidad útil, y no se pierde nada porque la cámara nunca
            // se acerca tanto a un objeto.
            near: 0.5,
            far: 400,
          }}
        >
          {/* El ambiente lo aporta el HDRI de LabBackground; LabLighting
              agrega la luz principal en ángulo (la única con castShadow) y
              un contraluz que despega los props del pasto. */}
          <LabLighting variant="outdoor" quality={quality} shadowRadius={18} />

          <Suspense fallback={null}>
            <LabBackground quality={quality} />
          </Suspense>
          <SceneComponent engine={engine} variables={values} />

          {gyroActive && !vr && (
            <VariablesHud3D
              schema={experiment.variablesSchema}
              values={values}
              onChange={setValue}
              selectedKey={hoveredKey ?? undefined}
            />
          )}

          {/* Sombra de contacto: sin esto los objetos se ven "flotando"
              sobre el pasto aunque tengan sombra proyectada. Es la mejora
              más barata que hay para asentar algo en el suelo. */}
          <ContactShadows
            position={[5, 0.01, 0]}
            scale={26}
            blur={2.4}
            opacity={0.5}
            far={9}
            resolution={quality === "high" ? 512 : 256}
          />

          <GyroCamera
            orientation={orientation}
            enabled={gyroActive}
            faceTarget={experiment.cameraView?.target ?? [5, 1, 0]}
          />
          {/* Caminar funciona siempre (gamepad o teclado). Mirar: con visor
              lo hace el giroscopio; sin él, arrastrando el mouse o el dedo. */}
          <MovementController />
          {!gyroActive && (
            <DragLookControls target={experiment.cameraView?.target ?? [5, 1, 0]} />
          )}

          {/* En la vista VR dibuja StereoView (dos ojos) y el post-proceso
              se apaga: los dos quieren tomar el dibujo de cada cuadro. */}
          {vr ? <StereoView /> : <PostFX quality={quality} />}

          {/* Pizarrón con fórmulas y lugar para hacer cuentas, si el experimento lo trae. */}
          {experiment.whiteboard && <Whiteboard spec={experiment.whiteboard} />}

          {/* La interfaz de la vista VR, dentro de la escena. */}
          {vr && (
            <VrHud
              engine={engine}
              experimentSlug={experiment.slug}
              experimentName={experiment.name}
              briefing={experiment.briefing}
              briefingOpen={briefingOpen ?? !touring}
              onBriefingOpenChange={setBriefingOpen}
              tourIndex={touring ? tourIndex : null}
              onExitTour={exitTour}
              onBackToLobby={() => router.push("/lab")}
              schema={experiment.variablesSchema}
              values={values}
              onChange={setValue}
              vrActions={experiment.vrActions}
              extraActions={tourActions}
            />
          )}
        </Canvas>
        <VirtualCursor position={cursorPos} visible={gyroActive} />

        {vr && <VrExit />}

        <LoadingOverlay label={experiment.name} />
      </div>
    </OrientationGate>
  );
}