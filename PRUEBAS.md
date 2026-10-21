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
      stick y botón B en el visor con control.
- [ ] *Celular sin control:* en "Camina" pide arrastrar el joystick de abajo
      a la izquierda, y el paso se completa caminando. Al apretar un botón
      del control, el joystick desaparece y el texto cambia al del stick.
- [ ] *Joystick en pantalla:* en el celular sin control, en el lobby y en
      los experimentos (no en el visor). Con un pulgar se camina y con el
      otro se tocan los botones; llevarlo al borde un momento hace correr;
      soltarlo fuera del círculo frena. El panel de variables no lo tapa.
- [ ] *Celular en la mano (giroscopio, sin visor):* los toques van directo a
      lo que hay bajo el dedo; el panel de variables es el normal (no medio
      transparente). El cursor azul aparece solo con un control conectado.
- [ ] Los pasos del tutor y de las puertas avanzan solos (9 s y 7 s) o con
      Enter / botón A.
- [ ] "Saltar tutorial" (o Escape / botón B) lo cierra. Al recargar, ya no
      aparece.
- [ ] Abajo a la izquierda: "¿Cómo me muevo?" lo vuelve a abrir desde el
      principio.
- [ ] Caminar hacia una puerta y mirarla de frente: brilla y entra al
      experimento.
- [ ] No se atraviesan las paredes.

## 2. En cada experimento (los 20)

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

Retos para probar (72 en total):

| Experimento | Retos |
|---|---|
| Tiro parabólico | Primer impacto · Ronda de artillero · Contra el viento |
| Ley de la fuerza (2da de Newton) | ¿Se mueve o no? · Predice la aceleración · El ángulo crítico · Súbela con lo justo · La pesa que tira |
| Colisiones 1D | Predice un choque elástico · Predice un choque plástico · Masas distintas, choque a medias |
| Péndulo | Sincroniza los relojes · ¿Y la masa? · El doble de lento |
| Guía la carga | Primer desvío · Entre placas · Rodea el muro · Donde el campo se anula |
| La grúa electromagnética | Levanta la lata · Separa la chatarra · Levanta el carro sin recalentar |
| Derivada | Frena en una cima o un valle · Frenado perfecto · En las tres pistas |
| Llena el tanque | El cono que se llena · ¿Y si es un cilindro? · La escalera que resbala · El doble de alto |
| Suma de Riemann | Menos de 1 % de error · Con 6 bloques o menos · En las cuatro funciones |
| Sólidos de revolución | Copa · Pesa de gimnasio · Trompo · Jarrón |
| OSI | Sin errores en OSI · Sin errores en TCP/IP |
| Divide la red | Sin desperdiciar · Que todo quepa · Cada quien en su VLAN · Que se hablen |
| Rompe el bucle | Provoca una tormenta · Elige bien la raíz · Piensa como STP · La red se recupera · Todo el ancho de banda |
| Enrutamiento | Gánale a Dijkstra · Con las tres métricas · Re-enruta |
| Cobertura | Cubre el campus · Wi-Fi en 2.4 GHz · Reutiliza canales · Aguanta la hora pico |
| Defiende el borde | Protege la base de datos · El orden importa · Con lo justo · Abre solo lo necesario |
| Arma el circuito | Enciende el LED sin quemarlo · Saca 3.3 V de 9 V · Comprueba Kirchhoff |
| La fuente de poder | Carga el celular · Rizado menor al 5 % con media onda · Lo mismo con la mitad de capacitor |
| Arma la lógica | La alarma · El portón · Los tres jueces · Sin probar a ciegas |
| El contador | Divide la frecuencia · Cuenta hacia atrás · Solo hasta 9 · El temporizador · Las decenas del reloj |

Pistas del catálogo v2 (comprobadas en Node con el motor de cada uno):
- **Tiro parabólico:** sale del suelo (el cañón está en una trinchera), así
  que vale v²·sen(2θ)/g exacto: sin aire, 20 m/s a 45° → 40.77 m; a 30° y a
  60° → 35.31 m los dos. La bala no se ve hasta que sale de la boca.
- **Llena el tanque:** cono con 10 L/s y meta 1 m → 1.27 cm/s; cilindro con
  10 L/s → 1.27 cm/s a cualquier altura; escalera a 0.5 m/s con la base en
  3 m → −37.5 cm/s. El doble de alto: por ejemplo 0.6 m (3.54 cm/s) y 1.2 m
  (0.88 cm/s) con 10 L/s.
- **Ley de la fuerza (2da de Newton):** madera, 30°, 10 kg → se mueve con 2.36 m/s²; ángulo
  crítico de la madera 26.57° (quieta a 26°, resbala a 27°); fuerza mínima a
  30° con 10 kg: 92 N; polea 5 kg y 3 kg en madera → 1.84 m/s².
- **Guía la carga:** nivel 1 con q2 = −1 µC a 4 m/s; nivel 2 con partícula
  positiva a 3 m/s entre 800 y 1750 V (negativa: −800 a −1750 V); nivel 3,
  por ejemplo q = −5, −5, −3, +3 µC a 4 m/s y 0°; nivel 4, sensor en
  x = 0.5 m.
- **Divide la red:** ronda 1 /26, /27, /28, /29 (120 de 256); ronda 2 /25,
  /26, /27, /28, /30 (244 de 256); VLAN: PC2 y PC6 en 20, PC3 y PC8 en 30,
  PC5 en 40; probar sin subinterfaces y después con troncal y subinterfaces.
- **Rompe el bucle:** prioridad del Núcleo en 4096; con esa raíz se
  bloquean los enlaces 2, 5 y 6; con EtherChannel solo 5 y 6.
- **Cobertura, hora pico:** a las 12 (320 Mbps), 2.4 GHz con antenas en los
  postes 1, 2 y 3 a 27 dBm y canales 1, 6 y 11.
- **Defiende el borde:** ronda 1 web y respuestas; ronda 2 ssh-admin, web y
  respuestas (en cualquier orden, pero nunca bloquear SSH arriba del
  administrador); ronda 3 reenviar 443 al servidor web.
- **El contador:** década con NAND en Q3 y Q1 y carga 0; módulo 6 con Q2 y
  Q1; de 9 a 0 descendente con las cuatro salidas y carga 9; con reloj de
  8 Hz, Q3 va a 0.5 Hz.

Pistas de los experimentos nuevos:
- **Grúa:** la lata con separación de 1 cm; el carro con hierro dulce, 1000
  vueltas, 12 A y 1 cm (1440 W, dentro de lo nominal). La olla de aluminio y
  el tubo de cobre no suben nunca.
- **Protoboard:** LED rojo con 470 Ω (15 mA); divisor con 4.7 kΩ y 2.7 kΩ
  (3.28 V); Kirchhoff con R2 y R3 distintas, midiendo las tres corrientes.
- **Fuente:** con 250 mA, media onda con 34 espiras y 22 000 µF; puente con
  38 espiras y 10 000 µF.
- **Compuertas:** alarma AND; portón OR, NOT, AND; jueces tres AND y dos OR.

*Visor:* el panel de variables aparece dentro de la escena; el cursor se
mueve con el stick derecho y A toca; B mantenido habla con el tutor.

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

## 5. Recorrido guiado

- [ ] En el lobby, "Recorrido guiado" lleva a Tiro parabólico con la tarjeta
      "Recorrido · 1 de 9", que se lee en voz alta.
- [ ] El cañón arranca en modo artillería (tres blancos).
- [ ] No aparece la explicación larga; "Explicación completa" la abre.
- [ ] "Ver el experimento" pliega la tarjeta a una pastilla arriba al centro;
      "1/9 · Ver texto" la vuelve a abrir.
- [ ] "Siguiente" recorre las paradas: Ley de la fuerza (2da de Newton) →
      La grúa electromagnética → Tornea la pieza → Divide la red →
      Encuentra el camino → Arma el paquete → Arma el circuito →
      Arma la lógica → `/progreso`.
- [ ] "Salir del recorrido" deja el experimento normal, con el "?" de la
      explicación.
- [ ] Recargar en una parada no saca del recorrido.

## 6. Celular y visor

- [ ] Fuerza horizontal: en vertical pide girar el celular.
- [ ] El giroscopio se activa (en iPhone, con el botón "Activar giroscopio").
- [ ] El control se detecta (indicador arriba al centro).
- [ ] Fluidez aceptable en el lobby y en los experimentos más pesados
      (Cobertura, Espectro, Tiro parabólico). Si va lento, probar `?q=low`.
- [ ] Los textos se leen bien a través de los lentes.
- [ ] Vista VR: mirando al frente no se ve ningún panel, solo la escena
      (y al empezar, un aviso de dónde está cada cosa). Girando la cabeza a
      la izquierda, las variables; a la derecha, retos y acciones, y más a
      la derecha el resultado y los botones generales. Al girar para mirar
      un panel, el panel no se aleja.
- [ ] Al entrar a un experimento aparece la explicación adelante;
      "Entendido" la cierra y "Ver la explicación" (a la derecha) la reabre.
- [ ] "Preguntar al tutor": tocarlo, hablar, tocarlo de nuevo; responde.
      Mientras escucha, "Cancelar la pregunta" no envía nada; mientras
      responde, "Callar al tutor" lo corta y oculta los subtítulos.
- [ ] Conversación con el tutor: en la PC, "Conversación (n)" abre la
      ventana con todas las preguntas y respuestas; "Minimizar" la cierra
      (y quedan los subtítulos de la respuesta en curso). En el visor, el
      panel "Conversación" a la izquierda: muestra lo mismo, se minimiza y
      con "Ver anteriores" se leen los mensajes viejos.
- [ ] Arrastrar un panel: mirar su barra de arriba, mantener A (o el dedo)
      y girar la cabeza; al soltar queda ahí, también al volver a entrar.
      "Acomodar los paneles" los devuelve a su lugar.
- [ ] Enrutamiento en el visor: mirar un enlace y presionar A lo corta o
      lo repara.
- [ ] Lobby en el visor: Mi progreso / Mi cuenta salen del visor y abren
      la página.
- [ ] "Volver al lobby" regresa al pasillo sin salir del visor. En el
      lobby, a la derecha, el panel "Cómo moverte" y "Empezar el recorrido
      guiado".
- [ ] Recorrido en el visor: tarjeta de cada parada, "Siguiente parada" y
      "Salir del recorrido".
- [ ] QAM: "Cambiar el mensaje" pasa por la lista. Cobertura: se ve la
      leyenda del piso.
- [ ] La pantalla de carga se ve en los dos ojos.
- [ ] En el visor, hacer el gesto de atrás o bajar la barra de
      notificaciones: NO se sale del visor, aparece "Toca la pantalla para
      volver a pantalla completa" en los dos ojos y un toque la recupera.
      Probar también con un botón del control (puede que el navegador no lo
      acepte; en ese caso, el toque).
- [ ] Con el visor puesto, las letras de los paneles y de las etiquetas se
      leen sin esfuerzo. Si el celular se calienta o va lento en los
      experimentos pesados, avisar (la vista VR ahora usa la resolución
      completa del celular).
- [ ] Con el control: el stick izquierdo a fondo un momento corre; soltarlo
      un poco vuelve a caminar.
- [ ] En el visor, stick derecho arriba o abajo sube o baja los paneles y
      las tarjetas; "Centrar la vista" los devuelve.
- [ ] En el lobby, Mi progreso / Mi cuenta preguntan antes de salir del
      visor; "Quedarme en el visor" cancela.
- [ ] Mantener A (o el dedo) mirando un panel: a los ~0.3 s se acerca y se
      agranda; al soltar vuelve a su lugar. Sobre un botón no pasa (el
      botón se toca normal).
- [ ] Al bajar la vista aparece el panel del resultado con los botones
      generales, entre ellos "Salir del visor", que vuelve a la vista
      normal. En el celular ya no aparece la ✕ de arriba.
- [ ] "Ajustar el visor" (panel del resultado o panel del lobby) muestra una
      cuadrícula. Con "Separación de los lentes" se logra verla una sola y
      nítida (sin visión doble); con "Corrección de la curvatura", sus líneas
      se ven rectas hasta los bordes. Con "Corrección de color" (en un sentido
      o en el otro) desaparecen los bordes rojizos o azulados de las líneas
      hacia los costados. "Listo" cierra y el ajuste queda
      guardado al volver a entrar.
- [ ] En la vista normal del celular, con el control conectado, el clic del
      stick derecho (Y en un control estándar) entra al visor.
- [ ] Al entrar con el giroscopio quedas de frente al experimento (no a
      los árboles), sin importar hacia dónde apunte el celular.
- [ ] Gira el cuerpo hacia otro lado y usa "Centrar la vista" (o el clic
      del stick izquierdo): el experimento y los paneles vuelven al frente.
- [ ] Botón Y (clic del stick derecho en el ESP32) oculta y vuelve a
      mostrar los paneles; al ocultarlos aparece un aviso corto.
- [ ] Mirar una variable la resalta; el stick derecho la cambia de forma
      continua (lento con poco empuje, rápido a fondo). En las listas pasa
      de una opción a otra; en Sí/No, derecha = Sí, izquierda = No.
- [ ] Latencia del tutor: cuánto tarda en empezar a responder.

## Anotar lo que falle

Para cada falla: qué aparato, qué experimento, qué se hizo y qué pasó. Con
eso se puede reproducir y arreglar.
