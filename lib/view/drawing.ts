/**
 * ¿Se está dibujando en un pizarrón? Mientras sí, arrastrar el mouse (o el
 * dedo) no gira la cámara: sin esto, cada trazo movía la vista y era
 * imposible escribir.
 *
 * El pizarrón ya frena el evento antes de que llegue a DragLookControls
 * (escucha el canvas en fase de captura); esta marca es una segunda
 * protección: si por algún motivo el arrastre empezó igual, mientras se
 * dibuja la cámara no se mueve.
 */
let drawing = false;

export function setDrawing(value: boolean) {
  drawing = value;
}

export function isDrawing(): boolean {
  return drawing;
}
