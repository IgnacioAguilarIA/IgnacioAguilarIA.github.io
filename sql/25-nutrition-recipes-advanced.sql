-- Agenda FICH — Etapa E4A: instrucciones, tiempos, variantes e historial de preparaciones.
-- Ejecutar una vez después de sql/07-nutrition-advanced.sql y las migraciones nutricionales previas.
-- La migración agrega metadatos y una tabla nueva; no elimina ni reescribe recetas o consumos existentes.

begin;

alter table public.nutrition_recipes
  add column if not exists instructions jsonb not null default '[]'::jsonb,
  add column if not exists prep_time_minutes integer not null default 0,
  add column if not exists cook_time_minutes integer not null default 0,
  add column if not exists parent_recipe_id uuid null references public.nutrition_recipes(id) on delete set null;

-- Los CHECK se agregan condicionalmente para que una segunda ejecución sea segura.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='nutrition_recipes_instructions_array_check' and conrelid='public.nutrition_recipes'::regclass) then
    alter table public.nutrition_recipes add constraint nutrition_recipes_instructions_array_check
      check (jsonb_typeof(instructions) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname='nutrition_recipes_prep_time_range_check' and conrelid='public.nutrition_recipes'::regclass) then
    alter table public.nutrition_recipes add constraint nutrition_recipes_prep_time_range_check
      check (prep_time_minutes between 0 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname='nutrition_recipes_cook_time_range_check' and conrelid='public.nutrition_recipes'::regclass) then
    alter table public.nutrition_recipes add constraint nutrition_recipes_cook_time_range_check
      check (cook_time_minutes between 0 and 1440);
  end if;
end;
$$;

create index if not exists nutrition_recipes_user_parent_idx
  on public.nutrition_recipes(user_id, parent_recipe_id);

-- Revalida los pasos en servidor; no depende sólo de las comprobaciones del navegador.
create or replace function public.nutrition_recipes_validate_procedure()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_step jsonb; v_text text;
begin
  if new.instructions is null or jsonb_typeof(new.instructions) <> 'array' then
    raise exception 'Las instrucciones deben ser una lista de pasos.' using errcode='22023';
  end if;
  if jsonb_array_length(new.instructions) > 40 then
    raise exception 'Una receta puede tener como máximo 40 pasos.' using errcode='22023';
  end if;
  for v_step in select value from jsonb_array_elements(new.instructions) loop
    if jsonb_typeof(v_step) <> 'string' then
      raise exception 'Cada paso de la receta debe ser texto.' using errcode='22023';
    end if;
    v_text := v_step #>> '{}';
    if length(btrim(coalesce(v_text,''))) < 1 or length(v_text) > 1000 then
      raise exception 'Cada paso debe tener entre 1 y 1000 caracteres.' using errcode='22023';
    end if;
  end loop;
  if new.prep_time_minutes not between 0 and 1440 or new.cook_time_minutes not between 0 and 1440 then
    raise exception 'Los tiempos deben estar entre 0 y 1440 minutos.' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function public.nutrition_recipes_validate_procedure() from public, anon, authenticated;
drop trigger if exists nutrition_recipes_validate_procedure_trigger on public.nutrition_recipes;
create trigger nutrition_recipes_validate_procedure_trigger
before insert or update of instructions, prep_time_minutes, cook_time_minutes on public.nutrition_recipes
for each row execute function public.nutrition_recipes_validate_procedure();

-- Una variante sólo puede apuntar a otra receta perteneciente a la misma cuenta.
create or replace function public.nutrition_recipes_validate_parent_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_parent_user uuid;
begin
  if new.parent_recipe_id is null then return new; end if;
  if new.parent_recipe_id = new.id then
    raise exception 'Una receta no puede ser variante de sí misma.' using errcode='22023';
  end if;
  select user_id into v_parent_user from public.nutrition_recipes where id = new.parent_recipe_id;
  if v_parent_user is null or v_parent_user <> new.user_id then
    raise exception 'La receta original no existe en la cuenta activa.' using errcode='23503';
  end if;
  return new;
end;
$$;
revoke all on function public.nutrition_recipes_validate_parent_owner() from public, anon, authenticated;
drop trigger if exists nutrition_recipes_validate_parent_owner_trigger on public.nutrition_recipes;
create trigger nutrition_recipes_validate_parent_owner_trigger
before insert or update of parent_recipe_id, user_id on public.nutrition_recipes
for each row execute function public.nutrition_recipes_validate_parent_owner();

-- Cada preparación conserva una instantánea inmutable de la receta y de sus datos nutricionales.
create table if not exists public.nutrition_recipe_preparation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid null references public.nutrition_recipes(id) on delete set null,
  recipe_name text not null check (length(btrim(recipe_name)) between 1 and 120),
  recipe_snapshot jsonb not null check (jsonb_typeof(recipe_snapshot) = 'object'),
  operation_key text not null check (length(btrim(operation_key)) between 1 and 240),
  prepared_on date not null default current_date,
  finished_weight_g numeric(12,3) null check (finished_weight_g is null or finished_weight_g > 0),
  servings_made numeric(10,3) not null check (servings_made > 0 and servings_made <= 1000),
  notes text not null default '' check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint nutrition_recipe_preparation_history_user_operation_unique unique (user_id, operation_key)
);

create index if not exists nutrition_recipe_preparation_history_user_date_idx
  on public.nutrition_recipe_preparation_history(user_id, prepared_on desc, created_at desc);
create index if not exists nutrition_recipe_preparation_history_user_recipe_idx
  on public.nutrition_recipe_preparation_history(user_id, recipe_id, prepared_on desc);

alter table public.nutrition_recipe_preparation_history enable row level security;
revoke all privileges on table public.nutrition_recipe_preparation_history from public, anon, authenticated;
grant select on table public.nutrition_recipe_preparation_history to authenticated;
grant all privileges on table public.nutrition_recipe_preparation_history to service_role;

drop policy if exists nutrition_recipe_preparation_history_select_own on public.nutrition_recipe_preparation_history;
create policy nutrition_recipe_preparation_history_select_own
  on public.nutrition_recipe_preparation_history for select to authenticated
  using (auth.uid() = user_id);

-- RPC transaccional e idempotente: consulta la receta de la cuenta activa y crea la instantánea en servidor.
create or replace function public.nutrition_record_recipe_preparation(
  p_recipe_id uuid,
  p_operation_key text,
  p_prepared_on date,
  p_finished_weight_g numeric,
  p_servings_made numeric,
  p_notes text default ''
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_recipe public.nutrition_recipes%rowtype;
  v_record public.nutrition_recipe_preparation_history%rowtype;
  v_key text := btrim(coalesce(p_operation_key,''));
  v_snapshot jsonb;
  v_inserted boolean := false;
begin
  if v_uid is null then raise exception 'Iniciá sesión para registrar una preparación.' using errcode='28000'; end if;
  if p_recipe_id is null then raise exception 'Falta identificar la receta.' using errcode='22023'; end if;
  if length(v_key) < 1 or length(v_key) > 240 then raise exception 'La clave de operación no es válida.' using errcode='22023'; end if;
  if p_prepared_on is null then raise exception 'Ingresá la fecha de preparación.' using errcode='22023'; end if;
  if p_finished_weight_g is not null and (p_finished_weight_g <= 0 or p_finished_weight_g > 100000000) then raise exception 'El peso final debe ser mayor que cero y estar dentro del límite.' using errcode='22023'; end if;
  if p_servings_made is null or p_servings_made <= 0 or p_servings_made > 1000 then raise exception 'La cantidad de porciones debe estar entre 0 y 1000.' using errcode='22023'; end if;
  if length(coalesce(p_notes,'')) > 2000 then raise exception 'Las notas no pueden superar 2000 caracteres.' using errcode='22023'; end if;

  -- Un reintento con la misma clave devuelve el registro anterior y no duplica la preparación.
  select * into v_record from public.nutrition_recipe_preparation_history
    where user_id=v_uid and operation_key=v_key;
  if found then
    if coalesce(v_record.recipe_id::text,v_record.recipe_snapshot->>'recipe_id') is distinct from p_recipe_id::text then
      raise exception 'La clave de operación ya se usó para otra receta.' using errcode='23505';
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'id',v_record.id,'recipe_name',v_record.recipe_name,'prepared_on',v_record.prepared_on);
  end if;

  select * into v_recipe from public.nutrition_recipes where id=p_recipe_id and user_id=v_uid for share;
  if not found then raise exception 'La receta no existe en la cuenta activa.' using errcode='P0002'; end if;

  v_snapshot := jsonb_build_object(
    'schema_version',1,
    'recipe_id',v_recipe.id,
    'name',v_recipe.name,
    'notes',v_recipe.notes,
    'servings',v_recipe.servings,
    'ingredients',v_recipe.ingredients,
    'instructions',v_recipe.instructions,
    'prep_time_minutes',v_recipe.prep_time_minutes,
    'cook_time_minutes',v_recipe.cook_time_minutes,
    'parent_recipe_id',v_recipe.parent_recipe_id,
    'total_weight_g',v_recipe.total_weight_g,
    'finished_weight_g',v_recipe.finished_weight_g,
    'calories_per_100g',v_recipe.calories_per_100g,
    'protein_per_100g',v_recipe.protein_per_100g,
    'carbs_per_100g',v_recipe.carbs_per_100g,
    'fat_per_100g',v_recipe.fat_per_100g,
    'fiber_per_100g',v_recipe.fiber_per_100g,
    'captured_at',now()
  );

  insert into public.nutrition_recipe_preparation_history(
    user_id,recipe_id,recipe_name,recipe_snapshot,operation_key,prepared_on,finished_weight_g,servings_made,notes
  ) values (
    v_uid,v_recipe.id,v_recipe.name,v_snapshot,v_key,p_prepared_on,p_finished_weight_g,p_servings_made,btrim(coalesce(p_notes,''))
  ) on conflict (user_id,operation_key) do nothing returning * into v_record;
  v_inserted := found;
  if not v_inserted then
    select * into v_record from public.nutrition_recipe_preparation_history where user_id=v_uid and operation_key=v_key;
    if coalesce(v_record.recipe_id::text,v_record.recipe_snapshot->>'recipe_id') is distinct from p_recipe_id::text then
      raise exception 'La clave de operación ya se usó para otra receta.' using errcode='23505';
    end if;
  end if;

  return jsonb_build_object('ok',true,'duplicate',not v_inserted,'id',v_record.id,'recipe_name',v_record.recipe_name,'prepared_on',v_record.prepared_on);
end;
$$;
revoke all on function public.nutrition_record_recipe_preparation(uuid,text,date,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.nutrition_record_recipe_preparation(uuid,text,date,numeric,numeric,text) to authenticated;

commit;
