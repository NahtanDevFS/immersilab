"""Genera la migración SQL del catálogo y los retos de ImmersiLab.

Lee `lib/catalog.ts` (disciplinas, módulos y a qué módulo va cada
experimento) y el `index.ts` de cada experimento (nombre, descripción y
etiquetas de concepto), y escribe un archivo en `supabase/migrations/`.
Así los slugs y textos de la base salen de la misma fuente que la app.

Uso (desde la raíz del proyecto):
    python scripts/generar_migracion_catalogo.py

La migración es idempotente: se puede correr de nuevo en el SQL Editor de
Supabase después de agregar un experimento.
"""
import glob
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "supabase" / "migrations" / "20261006120000_catalogo_y_retos.sql"

# Módulos de prueba que había en la base y la app no usa (estaban vacíos).
PLACEHOLDER_MODULES = ["classical-mechanics", "gravitation", "electromagnetism", "waves"]


def q(text: str) -> str:
    """Literal de texto SQL."""
    return "'" + text.replace("'", "''") + "'"


catalog = (ROOT / "lib" / "catalog.ts").read_text(encoding="utf-8")


def entries(name: str) -> list[dict]:
    block = re.search(rf"export const {name}: .*?= \[(.*?)\n\];", catalog, re.S).group(1)
    rows = []
    for obj in re.findall(r"\{([^}]*)\}", block):
        row = dict(re.findall(r'(\w+): "([^"]*)"', obj))
        row.update({k: int(v) for k, v in re.findall(r"(\w+): (\d+)", obj)})
        rows.append(row)
    return rows


disciplines = entries("DISCIPLINES")
modules = entries("MODULES")
experiments = entries("EXPERIMENTS")

# Textos de cada experimento, leídos de su definición.
definitions = {}
for path in glob.glob(str(ROOT / "components/modules/*/experiments/*/index.ts")):
    src = Path(path).read_text(encoding="utf-8")
    slug = re.search(r'^  slug: "([^"]+)"', src, re.M).group(1)
    name = re.search(r'^  name: "([^"]+)"', src, re.M).group(1)
    description = re.search(r'^  description:\s*"([^"]+)"', src, re.M).group(1)
    tags_block = re.search(r"^  conceptTags: \[(.*?)\]", src, re.M | re.S).group(1)
    tags = re.findall(r'"([^"]+)"', tags_block)
    definitions[slug] = {"name": name, "description": description, "tags": tags}

missing = [e["slug"] for e in experiments if e["slug"] not in definitions]
if missing:
    raise SystemExit(f"Experimentos del catálogo sin definición: {missing}")


def tags_sql(tags: list[str]) -> str:
    return "array[" + ", ".join(q(t) for t in tags) + "]::text[]"


disc_values = ",\n  ".join(f"({q(d['slug'])}, {q(d['name'])})" for d in disciplines)
mod_values = ",\n  ".join(
    f"({q(m['slug'])}, {q(m['discipline'])}, {q(m['name'])}, {m['order']})" for m in modules
)
exp_values = ",\n  ".join(
    f"({q(e['slug'])}, {q(e['module'])}, {q(definitions[e['slug']]['name'])}, "
    f"{q(definitions[e['slug']]['description'])}, {tags_sql(definitions[e['slug']]['tags'])})"
    for e in experiments
)
placeholders = ", ".join(q(s) for s in PLACEHOLDER_MODULES)

sql = f"""-- =============================================================================
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
where m.slug in ({placeholders})
  and not exists (select 1 from public.experiments e where e.module_id = m.id);

insert into public.disciplines (slug, name)
values
  {disc_values}
on conflict (slug) do update set name = excluded.name;

insert into public.modules (discipline_id, slug, name, order_index)
select d.id, v.slug, v.name, v.ord
from (values
  {mod_values}
) as v(slug, discipline, name, ord)
join public.disciplines d on d.slug = v.discipline
on conflict (slug) do update
  set discipline_id = excluded.discipline_id,
      name = excluded.name,
      order_index = excluded.order_index;

insert into public.experiments (module_id, slug, name, description, concept_tags)
select m.id, v.slug, v.name, v.description, v.tags
from (values
  {exp_values}
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
  detail jsonb not null default '{{}}'::jsonb,
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
"""

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(sql, encoding="utf-8")
print(f"Escrito {OUT.relative_to(ROOT)}: {len(disciplines)} disciplinas, "
      f"{len(modules)} módulos, {len(experiments)} experimentos.")
