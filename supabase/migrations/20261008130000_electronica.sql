-- =============================================================================
-- ImmersiLab · área Electrónica
--
-- Agrega el área (disciplina) Electrónica, sus módulos Circuitos y Electrónica
-- digital, y sus tres experimentos. No toca nada de lo que ya existe y se
-- puede correr más de una vez.
--
-- Los slugs son los que usa la app (lib/catalog.ts): challenge_completions
-- referencia experiments, así que sin estas filas los retos se guardan en el
-- dispositivo pero no se suben a la cuenta.
-- =============================================================================

insert into public.disciplines (slug, name)
values ('electronics', 'Electrónica')
on conflict (slug) do update set name = excluded.name;

insert into public.modules (discipline_id, slug, name, order_index)
select d.id, v.slug, v.name, v.ord
from (values
  ('electronica-circuitos', 'Circuitos', 0),
  ('electronica-digital', 'Electrónica digital', 1)
) as v(slug, name, ord)
join public.disciplines d on d.slug = 'electronics'
on conflict (slug) do update
  set discipline_id = excluded.discipline_id,
      name = excluded.name,
      order_index = excluded.order_index;

insert into public.experiments (module_id, slug, name, description, concept_tags)
select m.id, v.slug, v.name, v.description, v.tags
from (values
  ('protoboard', 'electronica-circuitos', 'Arma el circuito',
   'Arma circuitos en una protoboard con resistencias comerciales y mídelos con el multímetro: enciende un LED sin quemarlo, saca 3.3 V de una batería de 9 V y comprueba las leyes de Kirchhoff.',
   array['ley de Ohm', 'leyes de Kirchhoff', 'divisor de voltaje', 'resistencias en serie y paralelo', 'código de colores', 'LED']::text[]),
  ('fuente-poder', 'electronica-circuitos', 'La fuente de poder',
   'Convierte los 120 V de alterna del enchufe en 5 V de continua para un cargador USB: transformador, rectificador y capacitor, mirando cada etapa en el osciloscopio.',
   array['transformador', 'diodo', 'rectificador', 'puente de diodos', 'capacitor de filtro', 'rizado']::text[]),
  ('compuertas', 'electronica-digital', 'Arma la lógica',
   'Elige qué compuerta lógica va en cada zócalo para resolver problemas reales, y comprueba la tabla de verdad completa con los interruptores.',
   array['compuertas lógicas', 'álgebra de Boole', 'tabla de verdad', 'circuitos combinacionales']::text[])
) as v(slug, module, name, description, tags)
join public.modules m on m.slug = v.module
on conflict (slug) do update
  set module_id = excluded.module_id,
      name = excluded.name,
      description = excluded.description,
      concept_tags = excluded.concept_tags;

-- Comprobación: debería devolver tres filas.
select d.name as area, m.name as modulo, e.slug, e.name
from public.experiments e
join public.modules m on m.id = e.module_id
join public.disciplines d on d.id = m.discipline_id
where d.slug = 'electronics'
order by m.order_index, e.slug;
