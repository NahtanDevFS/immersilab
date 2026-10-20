-- =============================================================================
-- ImmersiLab · borrar el progreso propio
--
-- La página de progreso deja borrar los retos logrados (todos o los de un
-- experimento) para volver a hacerlos. challenge_completions solo tenía
-- políticas para ver y registrar: sin esta, Supabase no da error al borrar,
-- pero no borra nada. Cada alumno puede borrar solo sus propias filas. Se
-- puede correr más de una vez.
-- =============================================================================

drop policy if exists "retos: borrar los propios" on public.challenge_completions;
create policy "retos: borrar los propios" on public.challenge_completions
  for delete using (user_id = auth.uid());
