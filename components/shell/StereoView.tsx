"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { readPad } from "./gamepad";
import { selectGazed, setPadHeldReader, setScreenHeld, updateGaze } from "@/lib/view/gaze";
import { getVisorSettings, useCalibrating } from "@/lib/view/visorSettings";
import { nudgeUiPitch } from "@/lib/view/recenter";

/** Separación entre los ojos, en metros (la escena está en metros). */
const EYE_SEPARATION = 0.064;

/**
 * Campo visual vertical en la vista VR. Los lentes de un visor genérico
 * agrandan la imagen: con los 50–55° de la vista normal todo se ve como con
 * binoculares. Más abierto se siente a escala real.
 */
const VR_FOV = 75;

/**
 * Resolución en la vista VR: la del celular, hasta 3 píxeles por punto.
 * Fuera del visor se limita a 1.5–2 para ahorrar batería, pero en el visor
 * cada ojo tiene media pantalla y el lente la agranda: con 1.5 las letras
 * quedaban con tan pocos píxeles que costaba distinguirlas.
 */
const VR_MAX_DPR = 3;

/**
 * Cambia el campo visual y devuelve el que tenía. Fuera del componente a
 * propósito: el compilador de React no deja mutar la cámara que devuelve un
 * hook, pero la cámara de three es un objeto que se muta por diseño.
 */
function applyFov(camera: THREE.Camera, fov: number): number {
  const perspective = camera as THREE.PerspectiveCamera;
  const previous = perspective.fov;
  perspective.fov = fov;
  perspective.updateProjectionMatrix();
  return previous;
}

/*
 * Corrección de los lentes del visor. Cada ojo se dibuja primero a una
 * imagen propia y después se pasa a la pantalla con este shader, que:
 * - centra la imagen en el lente (no en el centro de la mitad de pantalla),
 * - la pre-deforma en barril, para que el cojín del lente la deje recta,
 * - deja en negro lo que cae fuera de la imagen.
 * `lensCenter` está en coordenadas de la mitad de pantalla de ese ojo.
 */
const LENS_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const LENS_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec2 lensCenter;
uniform float k1;
uniform float k2;
uniform float zoom;
uniform float aspect;
uniform float chroma;
varying vec2 vUv;
void main() {
  // Distancia al centro del lente, con 1 = medio alto de la pantalla.
  vec2 d = (vUv - lensCenter) * vec2(aspect, 1.0) * 2.0;
  float r2 = dot(d, d);
  float f = 1.0 + k1 * r2 + k2 * r2 * r2;
  vec2 toUv = vec2(aspect, 1.0) * 2.0;
  vec2 offset = d * f / zoom;
  vec2 src = 0.5 + offset / toUv;
  if (src.x < 0.0 || src.x > 1.0 || src.y < 0.0 || src.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  // La imagen ya trae el tono y el sRGB aplicados (ver makeEyeTarget):
  // se copia tal cual, sin volver a convertir.
  // Aberración cromática: el rojo y el azul se toman un poco más adentro o
  // más afuera que el verde, al revés de como los separa el lente.
  float r = texture2D(map, 0.5 + offset * (1.0 - chroma) / toUv).r;
  float g = texture2D(map, src).g;
  float b = texture2D(map, 0.5 + offset * (1.0 + chroma) / toUv).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
`;

/**
 * Imagen de un ojo. Marcarla como isXRRenderTarget hace que three aplique el
 * mapeo de tonos y la salida sRGB al dibujar en ella, igual que al dibujar
 * en la pantalla: así la vista con visor tiene los mismos colores que la
 * normal. Se guarda en RGBA8 lineal para que nadie vuelva a convertir.
 */
function makeEyeTarget(): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  // Con mipmaps: hacia los bordes la corrección comprime la imagen, y sin
  // ellos se veían escalones y parpadeo (el "pixelado" de la periferia).
  target.texture.generateMipmaps = true;
  target.texture.minFilter = THREE.LinearMipmapLinearFilter;
  target.texture.colorSpace = THREE.SRGBColorSpace;
  target.texture.internalFormat = "RGBA8";
  (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  return target;
}

function sizeTarget(target: THREE.WebGLRenderTarget, width: number, height: number) {
  if (target.width !== width || target.height !== height) target.setSize(width, height);
}

function setLensUniforms(
  material: THREE.ShaderMaterial,
  map: THREE.Texture,
  lensCenterX: number,
  aspect: number,
) {
  const { distortion, zoom, chroma } = getVisorSettings();
  material.uniforms.map.value = map;
  material.uniforms.lensCenter.value.set(lensCenterX, 0.5);
  material.uniforms.k1.value = distortion;
  material.uniforms.k2.value = distortion * 0.5;
  material.uniforms.zoom.value = zoom;
  material.uniforms.aspect.value = aspect;
  material.uniforms.chroma.value = chroma;
}

function prepareEyes(
  parts: { stereo: THREE.StereoCamera; left: THREE.WebGLRenderTarget; right: THREE.WebGLRenderTarget; buffer: THREE.Vector2 },
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) {
  if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
  if (camera.parent === null && camera.matrixWorldAutoUpdate) camera.updateMatrixWorld();
  parts.stereo.update(camera as THREE.PerspectiveCamera);
  // Cada ojo, a su imagen, a la resolución real de su mitad de pantalla.
  gl.getDrawingBufferSize(parts.buffer);
  const eyeWidth = Math.max(1, Math.floor(parts.buffer.x / 2));
  const eyeHeight = Math.max(1, Math.floor(parts.buffer.y));
  sizeTarget(parts.left, eyeWidth, eyeHeight);
  sizeTarget(parts.right, eyeWidth, eyeHeight);
}

/**
 * Dibuja la escena dos veces, lado a lado, con las cámaras separadas como
 * dos ojos, cada una centrada en su lente y con la curvatura del lente
 * compensada (lib/view/visorSettings.ts, "Ajustar el visor"). Antes cada ojo
 * iba centrado en su mitad de pantalla, sin corrección: en un celular
 * grande los ojos tenían que separarse hacia afuera (visión doble) y los
 * bordes se veían curvos y borrosos.
 *
 * Se monta SOLO en la vista VR: con prioridad 1, R3F deja de dibujar por su
 * cuenta y el que dibuja es este componente. Por lo mismo, el post-proceso
 * (que también toma el dibujo) tiene que estar apagado en esta vista.
 */
export function StereoView() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const setDpr = useThree((state) => state.setDpr);
  const calibrating = useCalibrating();

  useEffect(() => {
    const previous = gl.getPixelRatio();
    setDpr(Math.min(window.devicePixelRatio || 1, VR_MAX_DPR));
    return () => setDpr(previous);
  }, [gl, setDpr]);

  const parts = useMemo(() => {
    const stereo = new THREE.StereoCamera();
    stereo.aspect = 0.5;
    stereo.eyeSep = EYE_SEPARATION;
    const material = new THREE.ShaderMaterial({
      vertexShader: LENS_VERTEX,
      fragmentShader: LENS_FRAGMENT,
      uniforms: {
        map: { value: null },
        lensCenter: { value: new THREE.Vector2(0.5, 0.5) },
        k1: { value: 0 },
        k2: { value: 0 },
        zoom: { value: 1 },
        aspect: { value: 1 },
        chroma: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const lensScene = new THREE.Scene();
    lensScene.add(quad);
    return {
      stereo,
      material,
      lensScene,
      lensCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      left: makeEyeTarget(),
      right: makeEyeTarget(),
      buffer: new THREE.Vector2(),
    };
  }, []);

  useEffect(() => {
    const previousFov = applyFov(camera, VR_FOV);
    return () => {
      applyFov(camera, previousFov);
      // Al volver a la vista 360 se dibuja de nuevo en toda la pantalla.
      gl.setRenderTarget(null);
      gl.setScissorTest(false);
      gl.setViewport(0, 0, size.width, size.height);
    };
  }, [camera, gl, size.width, size.height]);

  useEffect(
    () => () => {
      parts.left.dispose();
      parts.right.dispose();
      parts.material.dispose();
    },
    [parts],
  );

  useFrame(({ scene, camera: current }) => {
    const { stereo, material, lensScene, lensCamera, left, right } = parts;
    prepareEyes(parts, gl, scene, current);
    gl.setScissorTest(false);
    gl.setRenderTarget(left);
    gl.clear();
    gl.render(scene, stereo.cameraL);
    gl.setRenderTarget(right);
    gl.clear();
    gl.render(scene, stereo.cameraR);

    // A la pantalla, cada imagen centrada en su lente.
    gl.setRenderTarget(null);
    const half = size.width / 2;
    const aspect = half / size.height;
    // Separación de los lentes como fracción del ancho de la pantalla.
    const separation = Math.min(1, getVisorSettings().lensSeparation / size.width);
    gl.setScissorTest(true);
    gl.setScissor(0, 0, half, size.height);
    gl.setViewport(0, 0, half, size.height);
    setLensUniforms(material, left.texture, 1 - separation, aspect);
    gl.render(lensScene, lensCamera);
    gl.setScissor(half, 0, half, size.height);
    gl.setViewport(half, 0, half, size.height);
    setLensUniforms(material, right.texture, separation, aspect);
    gl.render(lensScene, lensCamera);
    gl.setScissorTest(false);
  }, 1);

  return (
    <>
      <GazeReticle />
      {calibrating ? <CalibrationGrid /> : null}
    </>
  );
}

/**
 * Cuadrícula para ajustar el visor: con la separación bien puesta se ve una
 * sola y nítida; con la curvatura bien puesta, sus líneas se ven rectas
 * hasta los bordes. Va pegada a la cabeza, adelante.
 */
function CalibrationGrid() {
  const group = useRef<THREE.Group>(null);
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(4, 16, "#fbbf24", "#e7ecf5");
    helper.rotation.x = Math.PI / 2;
    return helper;
  }, []);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={group}>
      <primitive object={grid} position={[0, 0, -2.2]} />
    </group>
  );
}

/** Grados por segundo que se mueve la interfaz con el stick derecho a fondo. */
const UI_PITCH_SPEED = 40;

/** Un toque más largo o con más recorrido que esto es arrastrar, no tocar. */
const TAP_MAX_MS = 400;
const TAP_MAX_PX = 12;

/**
 * Mira en el centro de la vista: un anillo chico que sigue a la cabeza, a
 * metro y medio. Sin ella, en el visor no hay referencia de hacia dónde se
 * está mirando exactamente. Se dibuja encima de todo (sin prueba de
 * profundidad) para que no se esconda detrás de una pared.
 *
 * También es el "puntero" de la vista VR (lib/view/gaze.ts): cada cuadro
 * mira qué botón 3D queda al centro, y se agranda cuando hay uno. Se activa
 * con A en el control, tocando la pantalla (el botón de muchos visores
 * genéricos toca la pantalla) o con Enter en la compu.
 */
function GazeReticle() {
  const ref = useRef<THREE.Mesh>(null);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const canvas = useThree((state) => state.gl.domElement);
  const padWasPressed = useRef(true); // si ya venía apretado al entrar, no cuenta

  useEffect(() => {
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      setScreenHeld(true);
    };
    const onUp = (e: PointerEvent) => {
      setScreenHeld(false);
      if (!down) return;
      const tap =
        performance.now() - down.t < TAP_MAX_MS &&
        Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MAX_PX;
      down = null;
      if (tap) selectGazed();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") selectGazed();
    };
    canvas.addEventListener("pointerdown", onDown);
    // En window: si el dedo se suelta fuera del canvas, igual cuenta.
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    setPadHeldReader(() => readPad()?.action ?? false);
    return () => {
      setScreenHeld(false);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [canvas]);

  useFrame(({ camera }, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    camera.getWorldDirection(forward);
    mesh.position.copy(camera.position).addScaledVector(forward, 1.5);
    mesh.quaternion.copy(camera.quaternion);

    const gazed = updateGaze(camera);
    mesh.scale.setScalar(gazed ? 1.8 : 1);

    // Stick derecho arriba o abajo: sube o baja la interfaz (ver recenter.ts).
    // Hacia abajo, el contenido sube: se ve lo que estaba más abajo.
    const pad = readPad();
    if (pad && Math.abs(pad.right.y) > 0.3) nudgeUiPitch(pad.right.y * UI_PITCH_SPEED * delta);

    // A del control: por flanco, una vez por apretón.
    const pressed = pad?.action ?? false;
    if (pressed && !padWasPressed.current) selectGazed();
    padWasPressed.current = pressed;
  });

  return (
    <mesh ref={ref} renderOrder={999} frustumCulled={false}>
      <ringGeometry args={[0.012, 0.02, 32]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.85}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
