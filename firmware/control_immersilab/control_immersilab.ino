// Control ImmersiLab: el ESP32 se anuncia como gamepad Bluetooth.
//
//   joystick izquierdo -> caminar (a fondo un momento: correr)
//   joystick derecho   -> ajustar la variable que se mira / subir y bajar
//                         la interfaz en el visor
//   botón principal    -> acción (clic / agarrar slider)
//   botón secundario   -> hablarle al tutor (mantener)
//   clic izquierdo     -> centrar la vista
//   clic derecho       -> entrar al visor / mostrar u ocultar paneles
//
// VERSIÓN 2: se describe como un mando ESTÁNDAR. La versión 1 declaraba
// solo 4 botones, ejes de 0 a 32767 y ninguna cruceta: Windows y Samsung lo
// aceptaban, pero Android "puro" (Motorola) y HyperOS (Xiaomi/Poco) se
// conectaban y descartaban todo lo que mandaba. Ahora:
//   - 16 botones, con los clics de los sticks en el 14 y el 15 (los que
//     Android reconoce como THUMBL y THUMBR);
//   - ejes de -32767 a 32767 con el centro en 0;
//   - una cruceta (siempre centrada; no se usa, pero los mandos la tienen);
//   - tipo "gamepad".
// La web reconoce las dos versiones (components/shell/gamepad.ts).
//
// DESPUÉS DE CARGAR ESTA VERSIÓN hay que olvidar el control en cada celular y
// en la compu y volver a emparejarlo: guardan la descripción vieja.
//
// TRUCO DE EMPAREJAMIENTO: si un celular o la compu "se queda conectado pero
// no llegan datos", apaga el ESP32, MANTÉN APRETADO el botón secundario,
// enciéndelo, espera 2 segundos y SUÉLTALO: borra los emparejamientos
// guardados. Después olvida el control en el celular y vuelve a emparejarlo.
//
// Antes bastaba con leer el botón apretado UNA vez al encender, y se borraba
// todo antes de que el Bluetooth estuviera listo: con la librería nueva eso
// colgaba el ESP32 en cada arranque (assert en npl_freertos_mutex_pend), y
// si el botón se leía apretado sin tocarlo, borraba los emparejamientos en
// cada encendido (el celular quedaba "conectado" sin recibir nada).

#include <BleGamepad.h>
#include <NimBLEDevice.h>

// ---- Pines (ver el esquema de conexiones) ----
const int PIN_IZQ_X = 34;
const int PIN_IZQ_Y = 35;
const int PIN_DER_X = 32;
const int PIN_DER_Y = 33;

const int PIN_IZQ_SW = 27;
const int PIN_DER_SW = 14;
const int PIN_BTN_PRINCIPAL = 25;
const int PIN_BTN_SECUNDARIO = 26;

// ---- Botones (numeración de la librería, empieza en 1) ----
// 1 y 2 son A y B en Android; 14 y 15, los clics de los sticks.
const uint8_t BOTON_PRINCIPAL = BUTTON_1;
const uint8_t BOTON_SECUNDARIO = BUTTON_2;
const uint8_t BOTON_CLIC_IZQ = BUTTON_14;
const uint8_t BOTON_CLIC_DER = BUTTON_15;

// ---- Ajustes ----
// La inversión de los sticks se corrige en la web (gamepad.ts), así que
// aquí se dejan en false.
const bool INVERTIR_IZQ_X = false;
const bool INVERTIR_IZQ_Y = false;
const bool INVERTIR_DER_X = false;
const bool INVERTIR_DER_Y = false;

const float ZONA_MUERTA = 0.06f; // ignora ruido cerca del centro
const float SUAVIZADO = 0.25f;   // 0 a 1: más alto responde más rápido, con más ruido

const int16_t EJE_MAX = 32767;

BleGamepad bleGamepad("ImmersiLab Control", "UMG", 100);

/** El botón secundario estaba apretado al encender y no se soltó: se ignora. */
bool secundarioTrabado = false;

/** Para avisar por el Monitor Serie cada vez que se conecta o se desconecta. */
bool estabaConectado = false;
unsigned long conectadoDesde = 0;

// ---- Vigilancia del cifrado (ver vigilarConexion) ----
const unsigned long PEDIR_CIFRADO_MS = 1000; // sin cifrar a este punto: lo pide el control
const unsigned long PLAZO_CIFRADO_MS = 6000; // sin cifrar a este punto: se corta
uint16_t conexionVigilada = BLE_HS_CONN_HANDLE_NONE;
unsigned long vigiladaDesde = 0;
bool cifradoPedido = false;

struct Eje {
  int pin;
  int centro;       // valor del ADC con el stick en reposo (se calibra al encender)
  float filtrado;   // lectura suavizada
  bool invertir;
};

Eje izqX = {PIN_IZQ_X, 2048, 2048, INVERTIR_IZQ_X};
Eje izqY = {PIN_IZQ_Y, 2048, 2048, INVERTIR_IZQ_Y};
Eje derX = {PIN_DER_X, 2048, 2048, INVERTIR_DER_X};
Eje derY = {PIN_DER_Y, 2048, 2048, INVERTIR_DER_Y};

// Promedia varias lecturas para calibrar el centro de cada eje.
void calibrar(Eje &e) {
  long suma = 0;
  const int muestras = 32;
  for (int i = 0; i < muestras; i++) {
    suma += analogRead(e.pin);
    delay(2);
  }
  e.centro = suma / muestras;
  e.filtrado = e.centro;
}

// Convierte la lectura del ADC (0-4095) al rango estándar del gamepad
// (-32767 a 32767, centro 0). Se normaliza por mitades porque el ADC del
// ESP32 no es lineal y el reposo casi nunca cae justo en 2048.
int16_t procesarEje(Eje &e) {
  e.filtrado += SUAVIZADO * (analogRead(e.pin) - e.filtrado);

  float n; // -1 a 1
  if (e.filtrado >= e.centro) {
    n = (e.filtrado - e.centro) / (4095.0f - e.centro);
  } else {
    n = (e.filtrado - e.centro) / (float)e.centro;
  }

  if (fabsf(n) < ZONA_MUERTA) n = 0;
  n = constrain(n, -1.0f, 1.0f);
  if (e.invertir) n = -n;

  return (int16_t)(n * EJE_MAX);
}

/** ¿El botón está apretado sin interrupción durante `ms` milisegundos? */
bool sostenido(int pin, unsigned long ms) {
  unsigned long inicio = millis();
  while (millis() - inicio < ms) {
    if (digitalRead(pin) != LOW) return false;
    delay(20);
  }
  return true;
}

// Con INPUT_PULLUP, apretado = LOW.
void actualizarBoton(int pin, uint8_t boton) {
  bool apretado = digitalRead(pin) == LOW;
  if (apretado && !bleGamepad.isPressed(boton)) {
    bleGamepad.press(boton);
  } else if (!apretado && bleGamepad.isPressed(boton)) {
    bleGamepad.release(boton);
  }
}

// La librería solo manda datos cuando la conexión se cifra, y tiene dos
// fallas al reconectar: no pide el cifrado (espera a que el celular lo
// haga, y algunos no lo hacen) y si el cifrado falla igual se cree
// conectada. En los dos casos el celular quedaba "conectado" sin recibir
// nada hasta reiniciar el ESP32. Aquí el control pide el cifrado él mismo y,
// si no se logra a tiempo, corta la conexión: vuelve a anunciarse solo y el
// celular reintenta sin reiniciar nada.
void vigilarConexion() {
  NimBLEServer *servidor = NimBLEDevice::getServer();
  if (servidor == nullptr || servidor->getConnectedCount() == 0) {
    conexionVigilada = BLE_HS_CONN_HANDLE_NONE;
    return;
  }

  NimBLEConnInfo info = servidor->getPeerInfo(0);
  if (info.getConnHandle() == BLE_HS_CONN_HANDLE_NONE) return;
  if (info.getConnHandle() != conexionVigilada) {
    conexionVigilada = info.getConnHandle();
    vigiladaDesde = millis();
    cifradoPedido = false;
  }
  if (info.isEncrypted()) return;

  const unsigned long transcurrido = millis() - vigiladaDesde;
  if (transcurrido >= PLAZO_CIFRADO_MS) {
    Serial.println("La conexion no se pudo cifrar: se corta para que el celular reintente. "
                   "Si se repite, olvida el control en el celular y emparejalo de nuevo.");
    servidor->disconnect(conexionVigilada);
    conexionVigilada = BLE_HS_CONN_HANDLE_NONE;
  } else if (!cifradoPedido && transcurrido >= PEDIR_CIFRADO_MS) {
    Serial.println("El celular no cifro la conexion: el control se lo pide.");
    NimBLEDevice::startSecurity(conexionVigilada);
    cifradoPedido = true;
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_IZQ_SW, INPUT_PULLUP);
  pinMode(PIN_DER_SW, INPUT_PULLUP);
  pinMode(PIN_BTN_PRINCIPAL, INPUT_PULLUP);
  pinMode(PIN_BTN_SECUNDARIO, INPUT_PULLUP);
  delay(50);

  // Diagnóstico: cómo se leen los botones al encender, sin tocarlos. Todos
  // deberían decir "suelto"; si alguno dice "apretado" sin tocarlo, ese
  // botón está cableado al revés o haciendo contacto.
  Serial.printf("Botones al encender: principal=%s secundario=%s clic_izq=%s clic_der=%s\n",
                digitalRead(PIN_BTN_PRINCIPAL) == LOW ? "apretado" : "suelto",
                digitalRead(PIN_BTN_SECUNDARIO) == LOW ? "apretado" : "suelto",
                digitalRead(PIN_IZQ_SW) == LOW ? "apretado" : "suelto",
                digitalRead(PIN_DER_SW) == LOW ? "apretado" : "suelto");

  // Borrar emparejamientos: mantener el secundario 2 s seguidos y SOLTARLO.
  // Si no se suelta en unos segundos, el botón está trabado o mal cableado:
  // no se borra nada (si no, se borraban en CADA encendido y el celular
  // quedaba "conectado" sin recibir nada) y se ignora hasta que se suelte
  // (si no, el control se quedaba esperando y nunca terminaba de arrancar).
  bool borrarEmparejamientos = false;
  if (sostenido(PIN_BTN_SECUNDARIO, 2000)) {
    Serial.println("Boton secundario apretado: sueltalo para borrar los emparejamientos...");
    unsigned long inicio = millis();
    while (digitalRead(PIN_BTN_SECUNDARIO) == LOW && millis() - inicio < 6000) {
      delay(20);
    }
    if (digitalRead(PIN_BTN_SECUNDARIO) == LOW) {
      secundarioTrabado = true;
      Serial.println("AVISO: el boton secundario sigue apretado sin tocarlo (cableado o atascado). "
                     "No se borra nada y se ignora hasta que se suelte.");
    } else {
      borrarEmparejamientos = true;
    }
  }

  // No toques los sticks mientras enciende: ese instante define el "centro".
  delay(500);
  calibrar(izqX);
  calibrar(izqY);
  calibrar(derX);
  calibrar(derY);

  // Descripción de un mando estándar (ver el comentario de arriba).
  BleGamepadConfiguration config;
  config.setControllerType(CONTROLLER_TYPE_GAMEPAD);
  config.setAutoReport(false);   // mandamos un solo reporte por vuelta
  config.setButtonCount(16);
  config.setHatSwitchCount(1);
  config.setWhichAxes(true, true, true, false, false, true, false, false);
  // orden: X, Y, Z, RX, RY, RZ, slider1, slider2 (stick derecho en Z y RZ)
  config.setAxesMin(-EJE_MAX);
  config.setAxesMax(EJE_MAX);

  bleGamepad.begin(&config);

  // La librería arranca el Bluetooth en segundo plano: antes de tocar los
  // emparejamientos (borrarlos o contarlos) hay que esperar a que esté
  // listo, si no el ESP32 se cuelga y se reinicia en bucle.
  unsigned long inicio = millis();
  while (!NimBLEDevice::isInitialized() && millis() - inicio < 5000) {
    delay(50);
  }
  delay(200);
  const bool bluetoothListo = NimBLEDevice::isInitialized();

  // Truco de emparejamiento.
  if (borrarEmparejamientos) {
    if (bluetoothListo) {
      NimBLEDevice::deleteAllBonds();
      Serial.println("Emparejamientos borrados. Olvida el control en el celular y vuelve a emparejarlo.");
    } else {
      Serial.println("No se pudieron borrar los emparejamientos: el Bluetooth no arranco.");
    }
  }

  if (bluetoothListo) {
    Serial.printf("Emparejamientos guardados en el control: %d\n", NimBLEDevice::getNumBonds());
  } else {
    Serial.println("AVISO: el Bluetooth no arranco en 5 s.");
  }
  Serial.println("Control listo (v2): emparejalo desde Bluetooth como 'ImmersiLab Control'");
}

void loop() {
  vigilarConexion();

  // Diagnóstico: cada conexión y desconexión, con cuánto duró. Si la compu
  // se conecta y se desconecta en bucle, esto muestra cada cuánto.
  const bool conectado = bleGamepad.isConnected();
  if (conectado != estabaConectado) {
    if (conectado) {
      conectadoDesde = millis();
      NimBLEServer *servidor = NimBLEDevice::getServer();
      const bool cifrado = servidor != nullptr && servidor->getConnectedCount() > 0 &&
                           servidor->getPeerInfo(0).isEncrypted();
      Serial.printf("Conectado (cifrado: %s).\n", cifrado ? "si" : "NO, el celular no recibira datos");
    } else {
      Serial.printf("Desconectado (duro %lu ms conectado).\n", millis() - conectadoDesde);
    }
    estabaConectado = conectado;
  }

  if (conectado) {
    bleGamepad.setLeftThumb(procesarEje(izqX), procesarEje(izqY));
    bleGamepad.setRightThumb(procesarEje(derX), procesarEje(derY));
    bleGamepad.setHat1(HAT_CENTERED);

    actualizarBoton(PIN_BTN_PRINCIPAL, BOTON_PRINCIPAL);
    // Trabado al encender: se ignora hasta que se lea suelto una vez.
    if (secundarioTrabado && digitalRead(PIN_BTN_SECUNDARIO) != LOW) {
      secundarioTrabado = false;
      Serial.println("El boton secundario se solto: vuelve a funcionar.");
    }
    if (!secundarioTrabado) actualizarBoton(PIN_BTN_SECUNDARIO, BOTON_SECUNDARIO);
    actualizarBoton(PIN_IZQ_SW, BOTON_CLIC_IZQ);
    actualizarBoton(PIN_DER_SW, BOTON_CLIC_DER);

    bleGamepad.sendReport();
  }
  delay(10); // unos 100 reportes por segundo
}
