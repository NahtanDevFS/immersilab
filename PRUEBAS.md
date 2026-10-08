# Lista de pruebas

Para revisar todo punto por punto. Conviene hacerla dos veces: una en la
computadora y otra en el celular con el visor y el control. Lo que solo
aplica a uno de los dos lo dice al principio.

Antes de empezar: `npm run dev` y, para el celular, abrir el laboratorio por
HTTPS (ver README). Para ver el tutorial de nuevo y empezar como invitado
limpio, en la consola del navegador: `localStorage.clear()`.

## 1. Lobby y tutorial

- [ ] La raíz (`/`) lleva al lobby (`/lab`).
- [ ] Mientras carga se ve la barra de progreso, no una pantalla negra.
- [ ] La primera vez aparece el tutorial abajo al centro, con 4 rayitas.
- [ ] **Mirar:** al arrastrar el mouse (o girar la cabeza en el visor) unos
      60°, pasa solo a "Camina".
- [ ] **Caminar:** al caminar unos 2 m con WASD (o el stick), pasa a
      "Pregúntale al tutor".
- [ ] Los textos coinciden con el aparato: mouse/teclado en la compu; cabeza,
      stick y gatillo R2 en el visor con control.
- [ ] *Celular sin control:* en "Camina" avisa que hace falta un control y
      deja pasar con "Siguiente". Al apretar un botón del control, el texto
      cambia al del stick.
- [ ] Los pasos del tutor y de las puertas avanzan solos (9 s y 7 s) o con
      Enter / botón A.
- [ ] "Saltar tutorial" (o Escape / botón B) lo cierra. Al recargar, ya no
      aparece.
- [ ] Abajo a la izquierda: "¿Cómo me muevo?" lo vuelve a abrir desde el
      principio.
- [ ] Caminar hacia una puerta y mirarla de frente: brilla y entra al
      experimento.
- [ ] No se atraviesan las paredes.

## 2. En cada experimento (los 15)

Para cada uno:

- [ ] Abre la explicación "Cómo funciona" y se lee en voz alta.
- [ ] Las variables cambian la escena en el momento.
- [ ] El panel de resultados muestra valores con sentido.
- [ ] El panel de retos (abajo a la derecha) muestra los retos con su barra.
- [ ] Al lograr un reto: aviso arriba, sonido, y el tutor lo comenta por voz
      (si no estaba hablando).
- [ ] Al preguntarle algo al tutor, responde con los valores actuales del
      experimento.
- [ ] "← Lobby" vuelve al pasillo.

Retos para probar (47 en total):

| Experimento | Retos |
|---|---|
| Tiro parabólico | Primer impacto · Ronda de artillero · Contra el viento |
| Colisiones 1D | Predice un choque elástico · Predice un choque plástico · Masas distintas, choque a medias |
| Péndulo | Sincroniza los relojes · ¿Y la masa? · El doble de lento |
| Ondas | Una sola onda · Batido · Onda cuadrada · Onda de sierra |
| Tubo de Venturi | Nueve veces más rápido · Al borde de la cavitación · Flujo laminar |
| Suma de Riemann | Menos de 1 % de error · Con 6 bloques o menos · En las cuatro funciones |
| Derivada | Frena en un pico o un valle · Frenado perfecto · En las tres pistas |
| Sólidos de revolución | Copa · Pesa de gimnasio · Trompo · Jarrón |
| Taylor | sen(x) · eˣ · ln(1 + x) · 1 / (1 − x) |
| QAM | Mensaje intacto · Intacto en 16-QAM · Intacto en 64-QAM |
| Modulación | Sintoniza Radio UMG (AM) · Modula al 100 % sin pasarte · Sintoniza UMG FM |
| Espectro | Silba · De «u» a «i» · Habla 3 segundos |
| Cobertura | Cubre el campus · Wi-Fi en 2.4 GHz · Reutiliza canales |
| Enrutamiento | Gánale a Dijkstra · Con las tres métricas · Re-enruta |
| OSI | Sin errores en OSI · Sin errores en TCP/IP |

Pistas de lo nuevo en Venturi: 9× sale con el cuello de 2 cm; al borde, por
ejemplo agua a 12 L/s con cuello de 1.25 cm; laminar con agua es imposible,
con aceite sí.

*Visor:* el panel de variables aparece dentro de la escena; el cursor se
mueve con el stick derecho y A toca; R2 mantenido habla con el tutor.

## 3. Tutor por voz

- [ ] Mantener el botón del micrófono, preguntar, soltar: aparece lo que
      entendió y la respuesta se va diciendo por oraciones.
- [ ] Apretar mientras habla lo corta (y empieza a escuchar).
- [ ] Sin internet: avisa que no se puede conectar, no se queda colgado.
- [ ] Al lograr un reto sin internet: dice "¡Reto logrado!" y se calla, sin
      mensaje de error.

## 4. Progreso y cuentas

- [ ] Como invitado, lograr un reto. En `/progreso` aparece con fecha y el
      aviso de que vive solo en este dispositivo.
- [ ] Crear una cuenta en `/cuenta`. El reto del invitado pasa a la cuenta.
- [ ] Cerrar sesión: el progreso de la cuenta deja de verse.
- [ ] Ingresar desde otro navegador o dispositivo: el progreso aparece.
- [ ] Lograr un reto sin conexión con sesión iniciada: al volver la conexión,
      se sube solo (en `/progreso` deja de decir "pendiente").

## 5. Vista docente

Necesita una cuenta con rol `teacher` (ver README) y al menos otra cuenta de
estudiante con algún reto logrado.

- [ ] Sin sesión, `/docente` pide ingresar. Con una cuenta de estudiante,
      dice que no tiene permiso.
- [ ] Con la cuenta de docente: el botón "Vista docente" aparece en el lobby.
- [ ] Resumen: estudiantes, retos logrados, promedio y el reto más difícil.
- [ ] La lista de estudiantes se filtra con el buscador; al tocar uno se ven
      sus retos con fecha.
- [ ] Porcentaje de la clase por reto; los de menos de 25 % en naranja.
- [ ] "Descargar CSV" baja un archivo que Excel abre con los acentos bien.
- [ ] La cuenta del docente no cuenta como estudiante.

## 6. Recorrido guiado

- [ ] En el lobby, "Recorrido guiado" lleva a Tiro parabólico con la tarjeta
      "Recorrido · 1 de 6", que se lee en voz alta.
- [ ] El cañón arranca en modo artillería (tres blancos).
- [ ] No aparece la explicación larga; "Explicación completa" la abre.
- [ ] "Ver el experimento" pliega la tarjeta a una pastilla arriba al centro;
      "1/6 · Ver texto" la vuelve a abrir.
- [ ] "Siguiente" recorre un experimento por módulo: Tubo de Venturi →
      Tornea la pieza → Tu voz en el espectro → Encuentra el camino →
      Arma el paquete → `/progreso`.
- [ ] "Salir del recorrido" deja el experimento normal, con el "?" de la
      explicación.
- [ ] Recargar en una parada no saca del recorrido.

## 7. Celular y visor

- [ ] Fuerza horizontal: en vertical pide girar el celular.
- [ ] El giroscopio se activa (en iPhone, con el botón "Activar giroscopio").
- [ ] El control se detecta (indicador arriba al centro).
- [ ] Fluidez aceptable en el lobby y en los experimentos más pesados
      (Cobertura, Espectro, Tiro parabólico). Si va lento, probar `?q=low`.
- [ ] Los textos se leen bien a través de los lentes.
- [ ] Latencia del tutor: cuánto tarda en empezar a responder.

## Anotar lo que falle

Para cada falla: qué aparato, qué experimento, qué se hizo y qué pasó. Con
eso se puede reproducir y arreglar.
