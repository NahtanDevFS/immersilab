-- =============================================================================
-- ImmersiLab · catálogo, retos y seguridad (RLS)
--
-- GENERADO por scripts/generar_migracion_catalogo.py a partir de
-- lib/catalog.ts y de cada components/modules/*/experiments/*/index.ts.
-- No editar a mano: cambiar la fuente y volver a generar.
--
-- Idempotente: se puede correr más de una vez en el SQL Editor de Supabase.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Catálogo
-- -----------------------------------------------------------------------------

-- Módulos de prueba que la app no usa. Solo se borran si siguen vacíos.
delete from public.modules m
where m.slug in ('classical-mechanics', 'gravitation', 'electromagnetism', 'waves')
  and not exists (select 1 from public.experiments e where e.module_id = m.id);

insert into public.disciplines (slug, name)
values
  ('physics', 'Física'),
  ('calculus', 'Cálculo'),
  ('networks', 'Redes y Telecomunicaciones'),
  ('electronics', 'Electrónica')
on conflict (slug) do update set name = excluded.name;

insert into public.modules (discipline_id, slug, name, order_index)
select d.id, v.slug, v.name, v.ord
from (values
  ('fisica-nucleo-a', 'physics', 'Núcleo A', 0),
  ('fisica-electromagnetismo', 'physics', 'Electromagnetismo', 1),
  ('calculo-nucleo-a', 'calculus', 'Núcleo A', 0),
  ('redes-arquitectura', 'networks', 'Arquitectura', 0),
  ('redes-segmentacion', 'networks', 'Segmentación y redundancia', 1),
  ('redes-capa-de-red', 'networks', 'Capa de red', 2),
  ('redes-capa-fisica', 'networks', 'Capa física', 3),
  ('redes-seguridad', 'networks', 'Seguridad', 4),
  ('electronica-circuitos', 'electronics', 'Circuitos', 0),
  ('electronica-digital', 'electronics', 'Electrónica digital', 1)
) as v(slug, discipline, name, ord)
join public.disciplines d on d.slug = v.discipline
on conflict (slug) do update
  set discipline_id = excluded.discipline_id,
      name = excluded.name,
      order_index = excluded.order_index;

insert into public.experiments (module_id, slug, name, description, concept_tags)
select m.id, v.slug, v.name, v.description, v.tags
from (values
  ('tiro-parabolico', 'fisica-nucleo-a', 'Tiro parabólico', 'Lanza un proyectil ajustando ángulo, velocidad inicial, gravedad y resistencia del aire, y acierta a tres blancos.', array['cinemática', 'movimiento parabólico', 'gravedad']::text[]),
  ('leyes-newton', 'fisica-nucleo-a', 'Leyes de Newton', 'Una caja en una rampa o tirada por una pesa con una polea: dibuja las fuerzas, predice si se mueve y con qué aceleración.', array['segunda ley de Newton', 'fricción estática', 'fricción cinética', 'diagrama de cuerpo libre', 'plano inclinado', 'tensión']::text[]),
  ('colisiones-1d', 'fisica-nucleo-a', 'Colisiones 1D', 'Dos carritos chocan en línea recta — ajusta masa, velocidad y qué tan elástico es el choque.', array['conservación del momento', 'coeficiente de restitución', 'energía cinética']::text[]),
  ('pendulo', 'fisica-nucleo-a', 'Sincroniza los relojes', 'Ajusta tu péndulo hasta que oscile al mismo ritmo que el de referencia, y descubre de qué depende (y de qué no) su período.', array['péndulo simple', 'período', 'conservación de la energía', 'oscilaciones', 'amortiguamiento']::text[]),
  ('campo-electrico', 'fisica-electromagnetismo', 'Guía la carga', 'Dentro de una cámara de vacío, coloca cargas y voltajes para guiar una partícula cargada hasta el aro, y encuentra el punto donde el campo se anula.', array['ley de Coulomb', 'campo eléctrico', 'líneas de campo', 'movimiento de una carga en un campo', 'placas paralelas']::text[]),
  ('electroiman', 'fisica-electromagnetismo', 'La grúa electromagnética', 'Una corriente en una bobina crea un imán que se puede prender y apagar. Úsalo para levantar chatarra… y descubre qué metales no se dejan.', array['electromagnetismo', 'ley de Ampère', 'solenoide', 'permeabilidad magnética', 'materiales ferromagnéticos', 'efecto Joule']::text[]),
  ('derivada-pico', 'calculo-nucleo-a', 'Frena en el pico', 'El vagón recorre la curva y el velocímetro marca f''(x). Frena exactamente donde la pendiente es cero.', array['derivada', 'pendiente instantánea', 'puntos críticos', 'máximos y mínimos']::text[]),
  ('razones-cambio', 'calculo-nucleo-a', 'Llena el tanque', 'Razones de cambio relacionadas: predice qué tan rápido sube el agua en un cono o en un cilindro, o qué tan rápido baja la punta de una escalera que resbala.', array['razones de cambio relacionadas', 'regla de la cadena', 'derivación implícita']::text[]),
  ('suma-riemann', 'calculo-nucleo-a', 'Suma de Riemann', 'Llena el área bajo la curva con bloques. El reto: bajar del 1% de error con la MENOR cantidad de bloques posible.', array['integral definida', 'suma de Riemann', 'convergencia', 'error de aproximación']::text[]),
  ('solidos-revolucion', 'calculo-nucleo-a', 'Tornea la pieza', 'Moldea el perfil con los sliders y la curva gira para generar el sólido. El reto: igualar la pieza objetivo.', array['sólidos de revolución', 'método de discos', 'método de capas', 'integral definida', 'volumen']::text[]),
  ('osi', 'redes-arquitectura', 'Arma el paquete', 'Baja el mensaje por la pila agregando cabeceras, cruza el cable y quítalas del otro lado. OSI y TCP/IP, lado a lado.', array['modelo OSI', 'modelo TCP/IP', 'encapsulación', 'cabeceras de protocolo', 'PDU']::text[]),
  ('subredes-vlan', 'redes-segmentacion', 'Divide la red', 'Reparte un bloque /24 entre departamentos con máscaras de largo variable, separa cada departamento en su VLAN y haz que se hablen con un router.', array['subredes', 'VLSM', 'máscara de subred', 'VLAN', 'enlace troncal', 'router-on-a-stick', 'red jerárquica']::text[]),
  ('stp', 'redes-segmentacion', 'Rompe el bucle', 'Cuatro switches con enlaces redundantes: provoca una tormenta de broadcast, activa STP y predice qué enlaces bloquea, corta enlaces y agrupa dos con EtherChannel.', array['bucle de capa 2', 'tormenta de broadcast', 'STP', 'puente raíz', 'puerto raíz', 'puerto designado', 'EtherChannel']::text[]),
  ('enrutamiento', 'redes-capa-de-red', 'Encuentra el camino', 'Eres el router: elige por dónde sale cada paquete y compite contra Dijkstra. Cambia la métrica y mira cómo cambia el mejor camino.', array['enrutamiento', 'métricas de enrutamiento', 'algoritmo de Dijkstra', 'convergencia', 'RIP vs OSPF']::text[]),
  ('cobertura', 'redes-capa-fisica', 'Cubre el campus', 'Coloca hasta tres antenas en el campus, elige banda, potencia y canales, y mira el mapa de cobertura cambiar en vivo.', array['pérdida de trayecto', 'presupuesto de enlace', 'atenuación por obstáculos', 'interferencia cocanal', 'reutilización de frecuencias', 'capacidad y demanda']::text[]),
  ('firewall-nat', 'redes-seguridad', 'Defiende el borde', 'Arma las reglas del firewall con tarjetas, en orden, y mira qué tráfico pasa y qué ataques se frenan. Después configura NAT para publicar solo la web.', array['firewall', 'listas de control de acceso', 'deny implícito', 'inspección de estado', 'NAT', 'PAT', 'reenvío de puertos']::text[]),
  ('protoboard', 'electronica-circuitos', 'Arma el circuito', 'Arma circuitos en una protoboard con resistencias comerciales y mídelos con el multímetro: enciende un LED sin quemarlo, saca 3.3 V de una batería de 9 V y comprueba las leyes de Kirchhoff.', array['ley de Ohm', 'leyes de Kirchhoff', 'divisor de voltaje', 'resistencias en serie y paralelo', 'código de colores', 'LED']::text[]),
  ('fuente-poder', 'electronica-circuitos', 'La fuente de poder', 'Convierte los 120 V de alterna del enchufe en 5 V de continua para un cargador USB: transformador, rectificador y capacitor, mirando cada etapa en el osciloscopio.', array['transformador', 'diodo', 'rectificador', 'puente de diodos', 'capacitor de filtro', 'rizado']::text[]),
  ('compuertas', 'electronica-digital', 'Arma la lógica', 'Elige qué compuerta lógica va en cada zócalo para resolver problemas reales, y comprueba la tabla de verdad completa con los interruptores.', array['compuertas lógicas', 'álgebra de Boole', 'tabla de verdad', 'circuitos combinacionales']::text[]),
  ('contador', 'electronica-digital', 'El contador', 'Un contador asíncrono de cuatro flip-flops T: haz que cuente hacia arriba o hacia abajo, divide la frecuencia y arma contadores de módulo N con una NAND de reinicio.', array['flip-flop T', 'contador asíncrono', 'divisor de frecuencia', 'contador de módulo N', 'decodificador de siete segmentos']::text[])
) as v(slug, module, name, description, tags)
join public.modules m on m.slug = v.module
on conflict (slug) do update
  set module_id = excluded.module_id,
      name = excluded.name,
      description = excluded.description,
      concept_tags = excluded.concept_tags;

-- -----------------------------------------------------------------------------
-- 2. Retos logrados
--
-- Una fila por (alumno, experimento, reto). El id del reto es el mismo que
-- devuelve getChallenges() en el motor del experimento. achieved_at es la
-- PRIMERA vez que se logró: la app inserta con "on conflict do nothing", así
-- que un logro repetido no pisa la fecha original.
-- -----------------------------------------------------------------------------

create table if not exists public.challenge_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  challenge_id text not null,
  achieved_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint challenge_completions_unique unique (user_id, experiment_id, challenge_id)
);

create index if not exists challenge_completions_user_idx
  on public.challenge_completions (user_id);

-- -----------------------------------------------------------------------------
-- 3. Perfil automático al registrarse
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existieran sin perfil.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Seguridad (RLS)
--
-- Antes de esto las tablas se podían leer con la clave pública sin iniciar
-- sesión. Ahora: el catálogo es de lectura pública; cada alumno ve y escribe
-- solo lo suyo; docentes y administradores leen todo.
-- -----------------------------------------------------------------------------

-- ¿El usuario actual es docente o administrador? security definer para que
-- las políticas de profiles puedan usarla sin recursión infinita.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher', 'admin')
  );
$$;

-- Catálogo: lectura pública, escritura solo desde el SQL Editor / service role.
alter table public.disciplines enable row level security;
alter table public.modules enable row level security;
alter table public.experiments enable row level security;

drop policy if exists "catalogo: lectura publica" on public.disciplines;
create policy "catalogo: lectura publica" on public.disciplines for select using (true);
drop policy if exists "catalogo: lectura publica" on public.modules;
create policy "catalogo: lectura publica" on public.modules for select using (true);
drop policy if exists "catalogo: lectura publica" on public.experiments;
create policy "catalogo: lectura publica" on public.experiments for select using (true);

-- Perfiles: cada uno ve el suyo (el personal, todos) y solo puede cambiar
-- su nombre. El rol no se puede tocar desde la app: sin esto, un alumno
-- podía hacerse "admin" con una sola llamada.
alter table public.profiles enable row level security;

drop policy if exists "perfiles: ver el propio o personal" on public.profiles;
create policy "perfiles: ver el propio o personal" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists "perfiles: editar el propio" on public.profiles;
create policy "perfiles: editar el propio" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Retos logrados.
alter table public.challenge_completions enable row level security;

drop policy if exists "retos: ver los propios o personal" on public.challenge_completions;
create policy "retos: ver los propios o personal" on public.challenge_completions
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "retos: registrar los propios" on public.challenge_completions;
create policy "retos: registrar los propios" on public.challenge_completions
  for insert with check (user_id = auth.uid());

-- Tablas que la app todavía no usa: quedan protegidas igual.
alter table public.sessions enable row level security;
drop policy if exists "sesiones: las propias o personal" on public.sessions;
create policy "sesiones: las propias o personal" on public.sessions
  for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "sesiones: crear las propias" on public.sessions;
create policy "sesiones: crear las propias" on public.sessions
  for insert with check (user_id = auth.uid());
drop policy if exists "sesiones: cerrar las propias" on public.sessions;
create policy "sesiones: cerrar las propias" on public.sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.user_progress enable row level security;
drop policy if exists "progreso: el propio o personal" on public.user_progress;
create policy "progreso: el propio o personal" on public.user_progress
  for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "progreso: escribir el propio" on public.user_progress;
create policy "progreso: escribir el propio" on public.user_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.predictions enable row level security;
drop policy if exists "predicciones: de sesiones propias" on public.predictions;
create policy "predicciones: de sesiones propias" on public.predictions
  for all
  using (exists (select 1 from public.sessions s
                 where s.id = session_id and (s.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from public.sessions s
                      where s.id = session_id and s.user_id = auth.uid()));

alter table public.ai_conversations enable row level security;
drop policy if exists "conversaciones: de sesiones propias" on public.ai_conversations;
create policy "conversaciones: de sesiones propias" on public.ai_conversations
  for all
  using (exists (select 1 from public.sessions s
                 where s.id = session_id and (s.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from public.sessions s
                      where s.id = session_id and s.user_id = auth.uid()));

commit;
