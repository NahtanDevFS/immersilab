-- =============================================================================
-- ImmersiLab · "Frena en el pico" pasa a llamarse "Frena en la cima"
--
-- Solo cambia el nombre que se ve. El slug (derivada-pico) no cambia, así que
-- la URL y el progreso de los estudiantes siguen igual. Se puede correr más
-- de una vez.
-- =============================================================================

update public.experiments
set name = 'Frena en la cima'
where slug = 'derivada-pico';
