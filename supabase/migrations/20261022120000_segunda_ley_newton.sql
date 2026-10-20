-- =============================================================================
-- ImmersiLab · "Leyes de Newton" pasa a llamarse "Ley de la fuerza (2da de Newton)"
--
-- El experimento solo pone a prueba la segunda ley (ΣF = m·a): en plural
-- hacía esperar experimentos de las tres leyes. El slug no cambia, así que
-- la URL y el progreso de los estudiantes siguen igual. Se puede correr más
-- de una vez.
-- =============================================================================

update public.experiments
set name = 'Ley de la fuerza (2da de Newton)'
where slug = 'leyes-newton';
