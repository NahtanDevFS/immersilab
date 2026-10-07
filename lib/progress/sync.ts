import { createClient } from "@/lib/supabase/client";
import {
  GUEST,
  adoptGuestProgress,
  completionKey,
  currentOwner,
  markSynced,
  mergeFromServer,
  pendingFor,
  releaseOwner,
  type Completion,
} from "./store";

/**
 * Sincronización del progreso local con Supabase.
 *
 * - Subir: los logros pendientes del dueño activo se insertan en
 *   `challenge_completions` con "on conflict do nothing". Si el reto ya
 *   estaba en la cuenta (logrado en otro dispositivo), la fila del servidor
 *   no se toca: su fecha es la más antigua.
 * - Bajar: al iniciar sesión se traen los logros de la cuenta y se mezclan
 *   con los del dispositivo.
 *
 * Si no hay red, los logros quedan pendientes en el dispositivo y se suben
 * al volver la conexión (ver ProgressBridge).
 */

let experimentIds: Map<string, string> | null = null;
let syncing = false;

async function experimentIdBySlug(): Promise<Map<string, string>> {
  if (experimentIds) return experimentIds;
  const { data, error } = await createClient().from("experiments").select("id, slug");
  if (error) throw error;
  experimentIds = new Map((data ?? []).map((row) => [row.slug as string, row.id as string]));
  return experimentIds;
}

/** Sube lo pendiente del dueño activo. No hace nada sin sesión. */
export async function pushPending(): Promise<void> {
  const owner = currentOwner();
  if (owner === GUEST || syncing) return;
  const pending = pendingFor(owner);
  if (pending.length === 0) return;

  syncing = true;
  try {
    const ids = await experimentIdBySlug();
    const rows = pending
      .filter((c) => ids.has(c.experiment))
      .map((c) => ({
        user_id: owner,
        experiment_id: ids.get(c.experiment)!,
        challenge_id: c.challenge,
        achieved_at: c.achievedAt,
        detail: { title: c.title },
      }));
    if (rows.length > 0) {
      const { error } = await createClient()
        .from("challenge_completions")
        .upsert(rows, {
          onConflict: "user_id,experiment_id,challenge_id",
          ignoreDuplicates: true,
        });
      if (error) throw error;
    }
    // Los de experimentos que la base no conoce (catálogo sin actualizar) se
    // marcan igual: reintentarlos para siempre no los va a arreglar.
    markSynced(owner, pending.map((c) => completionKey(c.experiment, c.challenge)));
  } catch (error) {
    // Sin red o sin permisos: quedan pendientes y se reintenta después.
    console.warn("[progreso] no se pudo subir:", error);
  } finally {
    syncing = false;
  }
}

/** Trae los logros de la cuenta y los mezcla con los del dispositivo. */
async function pullAccount(userId: string): Promise<void> {
  const { data, error } = await createClient()
    .from("challenge_completions")
    .select("challenge_id, achieved_at, detail, experiments(slug)")
    .eq("user_id", userId);
  if (error) throw error;

  const incoming: Completion[] = (data ?? []).flatMap((row) => {
    const experiment = (row.experiments as { slug?: string } | null)?.slug;
    if (!experiment) return [];
    return [
      {
        experiment,
        challenge: row.challenge_id as string,
        title: ((row.detail as { title?: string } | null)?.title ?? row.challenge_id) as string,
        achievedAt: row.achieved_at as string,
        synced: true,
      },
    ];
  });
  mergeFromServer(userId, incoming);
}

/**
 * Se inició sesión: lo logrado como invitado pasa a la cuenta, se sube, y
 * se traen los logros que la cuenta ya tenía de otros dispositivos.
 */
export async function onSignedIn(userId: string): Promise<void> {
  if (currentOwner() !== userId) adoptGuestProgress(userId);
  await pushPending();
  try {
    await pullAccount(userId);
  } catch (error) {
    console.warn("[progreso] no se pudo traer el progreso de la cuenta:", error);
  }
}

export function onSignedOut(userId: string | null): void {
  if (userId) releaseOwner(userId);
}
