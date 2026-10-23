"use client";

import { useEffect } from "react";
import { PAD_READER_VERSION, readPad } from "@/components/shell/gamepad";
import { selectHeldSources } from "@/lib/view/gaze";

/**
 * Modo diagnóstico: manda al servidor de desarrollo lo que el celular está
 * leyendo, para encontrar errores que solo pasan en el visor (no se pueden
 * reproducir en la compu: el giroscopio y el control son del celular).
 *
 * Se activa abriendo cualquier página con `?diagnostico=1` (queda guardado)
 * y se apaga con `?diagnostico=0`. Las lecturas llegan a .debug/device.log
 * (app/api/diagnostico). Mientras está activo se ve un aviso chico arriba.
 */

const KEY = "immersilab.diagnostico";
const EVERY_MS = 500;

/**
 * Marca de la versión del código que está corriendo en el celular. Se cambia
 * con cada arreglo que haya que probar en el aparato: si el log llega con una
 * marca vieja, el celular sigue con la página de antes (hay que recargarla).
 */
export const CODE_STAMP = "2026-10-23 · visor a 2.35 píxeles por punto";

/** Lo que cada pantalla informa de sí misma (vista, giroscopio, cámara). */
const report: Record<string, unknown> = {};

export function probeReport(values: Record<string, unknown>) {
  Object.assign(report, values);
}

/**
 * Qué aparato es, en pocas palabras: el modelo no lo da ningún navegador,
 * pero sí si es iPhone, Android o computadora, y la densidad de la
 * pantalla. Sirve para separar en el registro las pruebas de cada uno.
 */
if (typeof window !== "undefined") {
  const ua = navigator.userAgent;
  report.aparato = {
    sistema: /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "otro",
    navegador: /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "otro",
    dpr: window.devicePixelRatio,
    nucleos: navigator.hardwareConcurrency,
  };
}

export function probeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("diagnostico");
    if (param === "1") window.localStorage.setItem(KEY, "1");
    if (param === "0") window.localStorage.removeItem(KEY);
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Engancha el envío de lecturas mientras la pantalla está montada. */
export function useDeviceProbe() {
  useEffect(() => {
    if (!probeEnabled()) return;

    const badge = document.createElement("div");
    badge.textContent = "Diagnóstico activo";
    badge.setAttribute("data-vr-keep", "");
    badge.style.cssText =
      "position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "font:600 11px system-ui;color:#fbbf24;background:rgba(0,0,0,.55);padding:2px 8px;" +
      "border-radius:6px;pointer-events:none";
    document.body.appendChild(badge);

    // Cuadros por segundo reales del celular.
    let frames = 0;
    let rafId = 0;
    const count = () => {
      frames++;
      rafId = requestAnimationFrame(count);
    };
    rafId = requestAnimationFrame(count);

    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;

      const raw = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => p !== null);
      const pad = readPad();
      const held = selectHeldSources();
      const snapshot = {
        t: new Date().toISOString(),
        path: window.location.pathname,
        version: CODE_STAMP,
        codigoDelControl: PAD_READER_VERSION,
        screen: `${window.innerWidth}x${window.innerHeight}`,
        fullscreen: Boolean(document.fullscreenElement),
        fps,
        ...report,
        held,
        pad: pad && {
          id: pad.id,
          mapping: pad.mapping,
          left: [round(pad.left.x), round(pad.left.y)],
          right: [round(pad.right.x), round(pad.right.y)],
          action: pad.action,
          talk: pad.talk,
          cancelTalk: pad.cancelTalk,
          buttons: pad.rawButtons.map((b) => (b ? 1 : 0)).join(""),
        },
        rawPads: raw.map((p) => ({
          index: p.index,
          id: p.id,
          mapping: p.mapping,
          axes: p.axes.map(round),
          buttons: p.buttons.map((b) => (b.pressed ? 1 : 0)).join(""),
        })),
      };
      void fetch("/api/diagnostico", { method: "POST", body: JSON.stringify(snapshot), keepalive: true }).catch(() => {});
    }, EVERY_MS);

    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(rafId);
      badge.remove();
    };
  }, []);
}
