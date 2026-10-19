-- =============================================================================
-- ImmersiLab · catálogo v2 (PLAN_NUEVOS_EXPERIMENTOS.md)
--
-- Agrega los módulos de Redes "Segmentación y redundancia" y "Seguridad",
-- reordena los módulos de Redes según el temario del curso y de Física sin
-- el de fluidos, y agrega los siete experimentos nuevos. Se puede correr más
-- de una vez.
--
-- NO se borra nada: los experimentos retirados (taylor, venturi, ondas,
-- modulacion, qam, espectro) y el módulo fisica-fluidos se quedan en la
-- base. challenge_completions tiene "on delete cascade" y borrarlos se
-- llevaría el historial de los estudiantes. La app deja de mostrarlos
-- porque ya no están en lib/catalog.ts.
-- =============================================================================

begin;

-- Módulos nuevos y nuevo orden (Redes sigue el temario; los slugs que ya
-- existían no cambian, solo su order_index).
insert into public.modules (discipline_id, slug, name, order_index)
select d.id, v.slug, v.name, v.ord
from (values
  ('fisica-nucleo-a', 'physics', 'Núcleo A', 0),
  ('fisica-electromagnetismo', 'physics', 'Electromagnetismo', 1),
  ('redes-arquitectura', 'networks', 'Arquitectura', 0),
  ('redes-segmentacion', 'networks', 'Segmentación y redundancia', 1),
  ('redes-capa-de-red', 'networks', 'Capa de red', 2),
  ('redes-capa-fisica', 'networks', 'Capa física', 3),
  ('redes-seguridad', 'networks', 'Seguridad', 4)
) as v(slug, discipline, name, ord)
join public.disciplines d on d.slug = v.discipline
on conflict (slug) do update
  set discipline_id = excluded.discipline_id,
      name = excluded.name,
      order_index = excluded.order_index;

-- El módulo de fluidos queda sin experimentos en la app: se manda al final
-- para que no se cuele entre los de Física si algo lo lista.
update public.modules set order_index = 99 where slug = 'fisica-fluidos';

insert into public.experiments (module_id, slug, name, description, concept_tags)
select m.id, v.slug, v.name, v.description, v.tags
from (values
  ('razones-cambio', 'calculo-nucleo-a', 'Llena el tanque',
   'Razones de cambio relacionadas: predice qué tan rápido sube el agua en un cono o en un cilindro, o qué tan rápido baja la punta de una escalera que resbala.',
   array['razones de cambio relacionadas', 'regla de la cadena', 'derivación implícita']::text[]),
  ('leyes-newton', 'fisica-nucleo-a', 'Leyes de Newton',
   'Una caja en una rampa o tirada por una pesa con una polea: dibuja las fuerzas, predice si se mueve y con qué aceleración.',
   array['segunda ley de Newton', 'fricción estática', 'fricción cinética', 'diagrama de cuerpo libre', 'plano inclinado', 'tensión']::text[]),
  ('campo-electrico', 'fisica-electromagnetismo', 'Guía la carga',
   'Dentro de una cámara de vacío, coloca cargas y voltajes para guiar una partícula cargada hasta el aro, y encuentra el punto donde el campo se anula.',
   array['ley de Coulomb', 'campo eléctrico', 'líneas de campo', 'movimiento de una carga en un campo', 'placas paralelas']::text[]),
  ('subredes-vlan', 'redes-segmentacion', 'Divide la red',
   'Reparte un bloque /24 entre departamentos con máscaras de largo variable, separa cada departamento en su VLAN y haz que se hablen con un router.',
   array['subredes', 'VLSM', 'máscara de subred', 'VLAN', 'enlace troncal', 'router-on-a-stick', 'red jerárquica']::text[]),
  ('stp', 'redes-segmentacion', 'Rompe el bucle',
   'Cuatro switches con enlaces redundantes: provoca una tormenta de broadcast, activa STP y predice qué enlaces bloquea, corta enlaces y agrupa dos con EtherChannel.',
   array['bucle de capa 2', 'tormenta de broadcast', 'STP', 'puente raíz', 'puerto raíz', 'puerto designado', 'EtherChannel']::text[]),
  ('firewall-nat', 'redes-seguridad', 'Defiende el borde',
   'Arma las reglas del firewall con tarjetas, en orden, y mira qué tráfico pasa y qué ataques se frenan. Después configura NAT para publicar solo la web.',
   array['firewall', 'listas de control de acceso', 'deny implícito', 'inspección de estado', 'NAT', 'PAT', 'reenvío de puertos']::text[]),
  ('contador', 'electronica-digital', 'El contador',
   'Un contador asíncrono de cuatro flip-flops T: haz que cuente hacia arriba o hacia abajo, divide la frecuencia y arma contadores de módulo N con una NAND de reinicio.',
   array['flip-flop T', 'contador asíncrono', 'divisor de frecuencia', 'contador de módulo N', 'decodificador de siete segmentos']::text[])
) as v(slug, module, name, description, tags)
join public.modules m on m.slug = v.module
on conflict (slug) do update
  set module_id = excluded.module_id,
      name = excluded.name,
      description = excluded.description,
      concept_tags = excluded.concept_tags;

commit;

-- Comprobación: los siete experimentos nuevos con su módulo, y los módulos
-- de Redes en el orden del temario.
select d.name as area, m.name as modulo, m.order_index, e.slug, e.name
from public.experiments e
join public.modules m on m.id = e.module_id
join public.disciplines d on d.id = m.discipline_id
where e.slug in ('razones-cambio', 'leyes-newton', 'campo-electrico', 'subredes-vlan', 'stp', 'firewall-nat', 'contador')
order by d.name, m.order_index, e.slug;

select slug, name, order_index
from public.modules
where discipline_id = (select id from public.disciplines where slug = 'networks')
order by order_index;
