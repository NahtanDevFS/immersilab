/**
 * Progreso del alumno guardado en el dispositivo (localStorage).
 *
 * El registro no es obligatorio: sin cuenta, los retos logrados se guardan
 * aquí y nada más. Con cuenta, esto funciona además como caché y como cola
 * de lo que todavía no se subió a Supabase (ver ./sync.ts).
 *
 * Los datos se guardan SEPARADOS POR DUEÑO ("invitado" o el id de cada
 * cuenta). El laboratorio se usa en celulares y visores compartidos: al
 * cerrar sesión, lo de esa cuenta deja de verse sin perderse lo que faltaba
 * subir, y el progreso de un alumno nunca se mezcla con el del siguiente.
 */

export const GUEST = "invitado";
const STORAGE_KEY = "immersilab.progreso.v1";

export interface Completion {
  experiment: string;
  challenge: string;
  /** Título del reto cuando se logró, para mostrarlo sin cargar el experimento. */
  title: string;
  /** ISO 8601: la PRIMERA vez que se logró. */
  achievedAt: string;
  /** ¿Ya está en Supabase? Solo tiene sentido para dueños con cuenta. */
  synced: boolean;
}

interface StoredProgress {
  /** Completions por dueño; dentro, por clave "experimento/reto". */
  owners: Record<string, Record<string, Completion>>;
}

export interface ProgressSnapshot {
  /** Dueño activo: GUEST o el id de la cuenta con sesión iniciada. */
  owner: string;
  completions: Record<string, Completion>;
  /** Cuántos logros faltan subir (0 sin cuenta). */
  pending: number;
}

export const completionKey = (experiment: string, challenge: string) =>
  `${experiment}/${challenge}`;

let activeOwner = GUEST;
let data: StoredProgress = { owners: {} };
let loaded = false;
let snapshot: ProgressSnapshot = { owner: GUEST, completions: {}, pending: 0 };
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredProgress;
      if (parsed && typeof parsed.owners === "object") data = parsed;
    }
  } catch {
    // Almacenamiento bloqueado o dato corrupto: se arranca vacío.
  }
  refreshSnapshot();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Modo privado o cuota llena: el progreso de esta sesión sigue en
    // memoria, pero no sobrevive a recargar. Es justo el caso "volátil".
  }
}

function refreshSnapshot() {
  const completions = { ...(data.owners[activeOwner] ?? {}) };
  snapshot = {
    owner: activeOwner,
    completions,
    pending:
      activeOwner === GUEST
        ? 0
        : Object.values(completions).filter((c) => !c.synced).length,
  };
  listeners.forEach((listener) => listener());
}

function bucket(owner: string): Record<string, Completion> {
  data.owners[owner] ??= {};
  return data.owners[owner];
}

// --- Lectura (compatible con useSyncExternalStore) ------------------------------

export function subscribe(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ProgressSnapshot {
  load();
  return snapshot;
}

const EMPTY: ProgressSnapshot = { owner: GUEST, completions: {}, pending: 0 };
export function getServerSnapshot(): ProgressSnapshot {
  return EMPTY;
}

// --- Escritura --------------------------------------------------------------------

/** Registra un reto logrado. Devuelve false si ya estaba registrado. */
export function recordCompletion(experiment: string, challenge: string, title: string): boolean {
  load();
  const key = completionKey(experiment, challenge);
  const own = bucket(activeOwner);
  if (own[key]) return false;
  own[key] = {
    experiment,
    challenge,
    title,
    achievedAt: new Date().toISOString(),
    synced: false,
  };
  persist();
  refreshSnapshot();
  return true;
}

/** Marca como subidos los logros indicados del dueño dado. */
export function markSynced(owner: string, keys: string[]) {
  const own = bucket(owner);
  keys.forEach((key) => {
    if (own[key]) own[key].synced = true;
  });
  persist();
  refreshSnapshot();
}

/**
 * Agrega logros que vienen del servidor. Si ya existía, se queda la fecha
 * más antigua: "logrado por primera vez" no puede moverse hacia adelante.
 */
export function mergeFromServer(owner: string, incoming: Completion[]) {
  const own = bucket(owner);
  incoming.forEach((c) => {
    const key = completionKey(c.experiment, c.challenge);
    const existing = own[key];
    if (!existing || c.achievedAt < existing.achievedAt) {
      own[key] = { ...c, title: existing?.title || c.title, synced: true };
    } else {
      existing.synced = true;
    }
  });
  persist();
  refreshSnapshot();
}

/** Logros pendientes de subir de un dueño. */
export function pendingFor(owner: string): Completion[] {
  load();
  return Object.values(data.owners[owner] ?? {}).filter((c) => !c.synced);
}

// --- Sesión -----------------------------------------------------------------------

/**
 * Se inició sesión con la cuenta `userId`. Lo que se había logrado como
 * invitado en este dispositivo pasa a la cuenta (queda pendiente de subir),
 * y el invitado se vacía: el progreso ahora es de esa persona.
 */
export function adoptGuestProgress(userId: string) {
  load();
  const guest = data.owners[GUEST] ?? {};
  const own = bucket(userId);
  Object.entries(guest).forEach(([key, c]) => {
    const existing = own[key];
    if (!existing || c.achievedAt < existing.achievedAt) {
      own[key] = { ...c, synced: false };
    }
  });
  delete data.owners[GUEST];
  activeOwner = userId;
  persist();
  refreshSnapshot();
}

/**
 * Se cerró sesión. Lo de esa cuenta deja de mostrarse. Si ya estaba todo
 * subido, se borra del dispositivo (la cuenta lo tiene); si faltaba subir
 * algo, se guarda aparte y se sube la próxima vez que esa cuenta entre.
 */
export function releaseOwner(userId: string) {
  load();
  const own = data.owners[userId];
  if (own && Object.values(own).every((c) => c.synced)) {
    delete data.owners[userId];
  }
  activeOwner = GUEST;
  persist();
  refreshSnapshot();
}

/** Dueño activo actual (GUEST o id de cuenta). */
export function currentOwner(): string {
  load();
  return activeOwner;
}
