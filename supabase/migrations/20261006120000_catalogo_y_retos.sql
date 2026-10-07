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
  ('networks', 'Redes y Telecomunicaciones')
on conflict (slug) do update set name = excluded.name;

insert into public.modules (discipline_id, slug, name, order_index)
select d.id, v.slug, v.name, v.ord
from (values
  ('fisica-nucleo-a', 'physics', 'Núcleo A', 0),
  ('fisica-fluidos', 'physics', 'Fluidos', 1),
  ('calculo-nucleo-a', 'calculus', 'Núcleo A', 0),
  ('redes-capa-fisica', 'networks', 'Capa física', 0),
  ('redes-capa-de-red', 'networks', 'Capa de red', 1),
  ('redes-arquitectura', 'networks', 'Arquitectura', 2)
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
  ('colisiones-1d', 'fisica-nucleo-a', 'Colisiones 1D', 'Dos carritos chocan en línea recta — ajusta masa, velocidad y qué tan elástico es el choque.', array['conservación del momento', 'coeficiente de restitución', 'energía cinética']::text[]),
  ('pendulo', 'fisica-nucleo-a', 'Sincroniza los relojes', 'Ajusta tu péndulo hasta que oscile al mismo ritmo que el de referencia, y descubre de qué depende (y de qué no) su período.', array['péndulo simple', 'período', 'conservación de la energía', 'oscilaciones', 'amortiguamiento']::text[]),
  ('ondas', 'fisica-nucleo-a', 'El sintonizador', 'Suma tres ondas senoidales hasta reproducir una onda objetivo: batidos, ondas cuadradas y de sierra salen de sumar senoidales.', array['superposición', 'interferencia', 'batido', 'series de Fourier', 'armónicos']::text[]),
  ('venturi', 'fisica-fluidos', 'Tubo de Venturi', 'Angosta el tubo y mira lo que nadie espera: el fluido se acelera y la presión CAE justo donde va más rápido.', array['mecánica de fluidos', 'ecuación de continuidad', 'principio de Bernoulli', 'cavitación', 'número de Reynolds']::text[]),
  ('suma-riemann', 'calculo-nucleo-a', 'Suma de Riemann', 'Llena el área bajo la curva con bloques. El reto: bajar del 1% de error con la MENOR cantidad de bloques posible.', array['integral definida', 'suma de Riemann', 'convergencia', 'error de aproximación']::text[]),
  ('derivada-pico', 'calculo-nucleo-a', 'Frena en el pico', 'El vagón recorre la curva y el velocímetro marca f''(x). Frena exactamente donde la pendiente es cero.', array['derivada', 'pendiente instantánea', 'puntos críticos', 'máximos y mínimos']::text[]),
  ('solidos-revolucion', 'calculo-nucleo-a', 'Tornea la pieza', 'Moldea el perfil con los sliders y la curva gira para generar el sólido. El reto: igualar la pieza objetivo.', array['sólidos de revolución', 'método de discos', 'método de capas', 'integral definida', 'volumen']::text[]),
  ('taylor', 'calculo-nucleo-a', '¿Cuántos términos?', 'Aproxima una función con un polinomio de Taylor: cada término lo pega más a la curva, pero solo cerca del centro.', array['series de Taylor', 'aproximación polinómica', 'radio de convergencia', 'error de truncamiento']::text[]),
  ('qam', 'redes-capa-fisica', 'Recupera el mensaje', 'Elige la modulación y lucha contra el ruido: más bits por símbolo es más velocidad, pero menos margen de error.', array['modulación digital', 'constelación I/Q', 'relación señal a ruido', 'tasa de error de bit']::text[]),
  ('modulacion', 'redes-capa-fisica', 'Sintoniza la emisora', 'Modula tu propia emisora en AM o FM y sintonízala con el receptor: fuera del canal hay estática, dentro se aclara el audio.', array['modulación AM', 'modulación FM', 'índice de modulación', 'ancho de banda', 'bandas laterales']::text[]),
  ('espectro', 'redes-capa-fisica', 'Tu voz en el espectro', 'Habla, silba o canta y mira tu voz convertida en frecuencias, en una cascada 3D que avanza con el tiempo.', array['dominio de la frecuencia', 'transformada de Fourier', 'espectro de la voz', 'formantes', 'ancho de banda telefónico']::text[]),
  ('cobertura', 'redes-capa-fisica', 'Cubre el campus', 'Coloca hasta tres antenas en el campus, elige banda, potencia y canales, y mira el mapa de cobertura cambiar en vivo.', array['pérdida de trayecto', 'presupuesto de enlace', 'atenuación por obstáculos', 'interferencia cocanal', 'reutilización de frecuencias']::text[]),
  ('enrutamiento', 'redes-capa-de-red', 'Encuentra el camino', 'Eres el router: elige por dónde sale cada paquete y compite contra Dijkstra. Cambia la métrica y mira cómo cambia el mejor camino.', array['enrutamiento', 'métricas de enrutamiento', 'algoritmo de Dijkstra', 'convergencia', 'RIP vs OSPF']::text[]),
  ('osi', 'redes-arquitectura', 'Arma el paquete', 'Baja el mensaje por la pila agregando cabeceras, cruza el cable y quítalas del otro lado. OSI y TCP/IP, lado a lado.', array['modelo OSI', 'modelo TCP/IP', 'encapsulación', 'cabeceras de protocolo', 'PDU']::text[])
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
