-- =============================================================================
-- ImmersiLab · módulo Electromagnetismo (Física)
--
-- Agrega el módulo y su experimento "La grúa electromagnética" al catálogo.
-- Es lo mismo que trae la migración completa (20261006120000_catalogo_y_retos),
-- recortado a lo nuevo: no toca nada de lo que ya existe y se puede correr
-- más de una vez.
--
-- Sin esto, los retos del experimento se guardan en el dispositivo pero no
-- se suben a la cuenta: challenge_completions referencia experiments.
-- =============================================================================

insert into public.modules (discipline_id, slug, name, order_index)
select d.id, 'fisica-electromagnetismo', 'Electromagnetismo', 2
from public.disciplines d
where d.slug = 'physics'
on conflict (slug) do update
  set discipline_id = excluded.discipline_id,
      name = excluded.name,
      order_index = excluded.order_index;

insert into public.experiments (module_id, slug, name, description, concept_tags)
select m.id,
       'electroiman',
       'La grúa electromagnética',
       'Una corriente en una bobina crea un imán que se puede prender y apagar. Úsalo para levantar chatarra… y descubre qué metales no se dejan.',
       array['electromagnetismo', 'ley de Ampère', 'solenoide', 'permeabilidad magnética', 'materiales ferromagnéticos', 'efecto Joule']::text[]
from public.modules m
where m.slug = 'fisica-electromagnetismo'
on conflict (slug) do update
  set module_id = excluded.module_id,
      name = excluded.name,
      description = excluded.description,
      concept_tags = excluded.concept_tags;

-- Comprobación: debería devolver una fila con el módulo y el experimento.
select m.name as modulo, e.slug, e.name
from public.experiments e
join public.modules m on m.id = e.module_id
where e.slug = 'electroiman';
