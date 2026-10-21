-- Agenda FICH — Etapa E3: despensa personal, movimientos auditables y descuento confirmado de ingredientes.
-- Requiere las tablas de E2: nutrition_weekly_plan_items y nutrition_shopping_items.
-- Las cantidades de inventario solo pueden cambiar mediante RPC transaccionales.

begin;

create table if not exists public.nutrition_pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 240),
  brand text not null default '' check (length(brand) <= 160),
  quantity numeric(12,3) not null default 0 check (quantity >= 0 and quantity <= 999999999.999),
  unit text not null check (length(btrim(unit)) between 1 and 32),
  preparation_state text not null default 'unspecified' check (preparation_state in ('raw','cooked','prepared','unspecified')),
  expires_on date null,
  location text not null default '' check (length(location) <= 120),
  notes text not null default '' check (length(notes) <= 2000),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_pantry_items_user_active_name_idx
  on public.nutrition_pantry_items (user_id, is_archived, name);
create index if not exists nutrition_pantry_items_user_expiry_idx
  on public.nutrition_pantry_items (user_id, expires_on)
  where is_archived = false and expires_on is not null;

create table if not exists public.nutrition_pantry_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pantry_item_id uuid not null references public.nutrition_pantry_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('initial','add','remove','correction','purchase','consumption')),
  quantity_delta numeric(12,3) not null check (quantity_delta <> 0),
  quantity_before numeric(12,3) not null check (quantity_before >= 0),
  quantity_after numeric(12,3) not null check (quantity_after >= 0),
  unit text not null check (length(btrim(unit)) between 1 and 32),
  reason text not null default '' check (length(reason) <= 500),
  operation_key text not null check (length(btrim(operation_key)) between 1 and 240),
  source_plan_item_id uuid null references public.nutrition_weekly_plan_items(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nutrition_pantry_movements_user_operation_key unique (user_id, operation_key)
);
create index if not exists nutrition_pantry_movements_user_created_idx
  on public.nutrition_pantry_movements (user_id, created_at desc);
create index if not exists nutrition_pantry_movements_item_created_idx
  on public.nutrition_pantry_movements (user_id, pantry_item_id, created_at desc);

-- Esta fila garantiza que una misma comida planificada no descuente stock dos veces.
create table if not exists public.nutrition_pantry_consumption_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_item_id uuid not null references public.nutrition_weekly_plan_items(id) on delete cascade,
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  constraint nutrition_pantry_consumption_runs_user_plan_unique unique (user_id, plan_item_id)
);

alter table public.nutrition_pantry_items enable row level security;
alter table public.nutrition_pantry_movements enable row level security;
alter table public.nutrition_pantry_consumption_runs enable row level security;

revoke all privileges on table public.nutrition_pantry_items from public, anon, authenticated;
revoke all privileges on table public.nutrition_pantry_movements from public, anon, authenticated;
revoke all privileges on table public.nutrition_pantry_consumption_runs from public, anon, authenticated;
grant select on table public.nutrition_pantry_items to authenticated;
grant select on table public.nutrition_pantry_movements to authenticated;
grant select on table public.nutrition_pantry_consumption_runs to authenticated;
grant all privileges on table public.nutrition_pantry_items to service_role;
grant all privileges on table public.nutrition_pantry_movements to service_role;
grant all privileges on table public.nutrition_pantry_consumption_runs to service_role;

drop policy if exists nutrition_pantry_items_account_scope on public.nutrition_pantry_items;
create policy nutrition_pantry_items_account_scope on public.nutrition_pantry_items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists nutrition_pantry_movements_account_scope on public.nutrition_pantry_movements;
create policy nutrition_pantry_movements_account_scope on public.nutrition_pantry_movements
  for select to authenticated using (auth.uid() = user_id and exists (
    select 1 from public.nutrition_pantry_items i where i.id = pantry_item_id and i.user_id = auth.uid()
  ));
drop policy if exists nutrition_pantry_consumption_runs_account_scope on public.nutrition_pantry_consumption_runs;
create policy nutrition_pantry_consumption_runs_account_scope on public.nutrition_pantry_consumption_runs
  for select to authenticated using (auth.uid() = user_id);

-- Normalización local de nombres para hacer coincidencias conservadoras sin extensiones externas.
create or replace function public.nutrition_pantry_normalize_text(p_value text)
returns text
language sql immutable parallel safe
set search_path = pg_catalog, public
as $$
  select trim(regexp_replace(
    regexp_replace(translate(lower(coalesce(p_value,'')), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.nutrition_pantry_normalize_unit(p_unit text)
returns text
language sql immutable parallel safe
set search_path = pg_catalog, public
as $$
  select case public.nutrition_pantry_normalize_text(p_unit)
    when 'gramo' then 'g' when 'gramos' then 'g' when 'gram' then 'g' when 'grams' then 'g'
    when 'kilogramo' then 'kg' when 'kilogramos' then 'kg' when 'kilogram' then 'kg' when 'kilograms' then 'kg'
    when 'mililitro' then 'ml' when 'mililitros' then 'ml' when 'milliliter' then 'ml' when 'milliliters' then 'ml'
    when 'litro' then 'l' when 'litros' then 'l' when 'liter' then 'l' when 'liters' then 'l'
    when 'unidad' then 'unit' when 'unidades' then 'unit' when 'pieza' then 'unit' when 'piezas' then 'unit'
    when 'porcion' then 'portion' when 'porciones' then 'portion' when 'racion' then 'portion' when 'raciones' then 'portion'
    else public.nutrition_pantry_normalize_text(p_unit)
  end;
$$;

create or replace function public.nutrition_pantry_unit_dimension(p_unit text)
returns text
language sql immutable parallel safe
set search_path = pg_catalog, public
as $$
  select case public.nutrition_pantry_normalize_unit(p_unit)
    when 'g' then 'mass' when 'kg' then 'mass'
    when 'ml' then 'volume' when 'l' then 'volume'
    when 'unit' then 'count' when 'portion' then 'portion' when 'pack' then 'pack'
    else 'custom:' || public.nutrition_pantry_normalize_unit(p_unit)
  end;
$$;

create or replace function public.nutrition_pantry_unit_factor(p_unit text)
returns numeric
language sql immutable parallel safe
set search_path = pg_catalog, public
as $$
  select case public.nutrition_pantry_normalize_unit(p_unit) when 'kg' then 1000::numeric when 'l' then 1000::numeric else 1::numeric end;
$$;

-- RPC transaccional para crear un lote o registrar un movimiento. Un operation_key repetido no duplica stock.
create or replace function public.nutrition_pantry_record_movement(
  p_item_id uuid,
  p_name text,
  p_brand text,
  p_unit text,
  p_preparation_state text,
  p_delta numeric,
  p_movement_type text,
  p_reason text,
  p_expires_on date,
  p_location text,
  p_notes text,
  p_operation_key text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.nutrition_pantry_items%rowtype;
  v_existing public.nutrition_pantry_movements%rowtype;
  v_before numeric(12,3);
  v_after numeric(12,3);
  v_name text := btrim(coalesce(p_name,''));
  v_brand text := btrim(coalesce(p_brand,''));
  v_unit text := public.nutrition_pantry_normalize_unit(p_unit);
  v_prep text := coalesce(nullif(p_preparation_state,''),'unspecified');
  v_type text := lower(btrim(coalesce(p_movement_type,'')));
  v_key text := btrim(coalesce(p_operation_key,''));
  v_item_id uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión para modificar la despensa.' using errcode = '28000'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) >= 1000000000 then raise exception 'La cantidad del movimiento debe ser distinta de cero y estar dentro del límite.' using errcode = '22023'; end if;
  if length(v_key) < 1 or length(v_key) > 240 then raise exception 'Falta la clave segura de la operación.' using errcode = '22023'; end if;
  if v_type not in ('initial','add','remove','correction','purchase') then raise exception 'Tipo de movimiento no permitido.' using errcode = '22023'; end if;
  if v_prep not in ('raw','cooked','prepared','unspecified') then raise exception 'Estado de preparación no válido.' using errcode = '22023'; end if;
  if length(v_unit) < 1 or length(v_unit) > 32 then raise exception 'Unidad no válida.' using errcode = '22023'; end if;

  select * into v_existing from public.nutrition_pantry_movements where user_id = v_uid and operation_key = v_key;
  if found then
    select * into v_item from public.nutrition_pantry_items where id = v_existing.pantry_item_id and user_id = v_uid;
    return jsonb_build_object('duplicate', true, 'item_id', v_existing.pantry_item_id, 'quantity_before', v_existing.quantity_before, 'quantity_after', v_existing.quantity_after, 'current_quantity', v_item.quantity, 'unit', v_existing.unit);
  end if;

  if p_item_id is null then
    if v_type not in ('initial','purchase') or p_delta <= 0 then raise exception 'Un lote nuevo debe comenzar con una cantidad positiva.' using errcode = '22023'; end if;
    if length(v_name) < 1 or length(v_name) > 240 then raise exception 'El nombre del alimento es obligatorio.' using errcode = '22023'; end if;
    insert into public.nutrition_pantry_items(user_id,name,brand,quantity,unit,preparation_state,expires_on,location,notes)
    values(v_uid,v_name,v_brand,round(p_delta,3),v_unit,v_prep,p_expires_on,btrim(coalesce(p_location,'')),coalesce(p_notes,''))
    returning * into v_item;
    v_item_id := v_item.id; v_before := 0; v_after := v_item.quantity;
  else
    if v_type = 'initial' or v_type = 'purchase' then raise exception 'Para una compra nueva, creá un lote nuevo.' using errcode = '22023'; end if;
    select * into v_item from public.nutrition_pantry_items where id = p_item_id and user_id = v_uid for update;
    if not found then raise exception 'El artículo no existe en la despensa de la cuenta activa.' using errcode = 'P0002'; end if;
    if (v_type = 'add' and p_delta < 0) or (v_type = 'remove' and p_delta > 0) then raise exception 'El signo de la cantidad no coincide con el tipo de movimiento.' using errcode = '22023'; end if;
    v_before := v_item.quantity;
    v_after := round(v_before + p_delta,3);
    if v_after < 0 then raise exception 'La operación dejaría una existencia negativa. Revisá la cantidad disponible.' using errcode = '22023'; end if;
    update public.nutrition_pantry_items set quantity = v_after, updated_at = now() where id = v_item.id returning * into v_item;
    v_item_id := v_item.id;
  end if;

  insert into public.nutrition_pantry_movements(user_id,pantry_item_id,movement_type,quantity_delta,quantity_before,quantity_after,unit,reason,operation_key)
  values(v_uid,v_item_id,v_type,round(p_delta,3),v_before,v_after,v_item.unit,left(coalesce(p_reason,''),500),v_key);
  return jsonb_build_object('duplicate',false,'item_id',v_item_id,'quantity_before',v_before,'quantity_after',v_after,'current_quantity',v_after,'unit',v_item.unit);
end;
$$;

-- RPC para modificar metadatos o archivar un lote sin tocar su cantidad ni borrar el historial.
create or replace function public.nutrition_pantry_update_item_details(
  p_item_id uuid,
  p_name text,
  p_brand text,
  p_unit text,
  p_preparation_state text,
  p_expires_on date,
  p_location text,
  p_notes text,
  p_is_archived boolean
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_uid uuid := auth.uid(); v_item public.nutrition_pantry_items%rowtype; v_name text := btrim(coalesce(p_name,'')); v_unit text := public.nutrition_pantry_normalize_unit(p_unit); v_prep text := coalesce(nullif(p_preparation_state,''),'unspecified');
begin
  if v_uid is null then raise exception 'Iniciá sesión para editar la despensa.' using errcode = '28000'; end if;
  if length(v_name) < 1 or length(v_name) > 240 then raise exception 'El nombre del alimento es obligatorio.' using errcode = '22023'; end if;
  if length(v_unit) < 1 or length(v_unit) > 32 then raise exception 'Unidad no válida.' using errcode = '22023'; end if;
  if v_prep not in ('raw','cooked','prepared','unspecified') then raise exception 'Estado de preparación no válido.' using errcode = '22023'; end if;
  select * into v_item from public.nutrition_pantry_items where id=p_item_id and user_id=v_uid for update;
  if not found then raise exception 'El artículo no existe en la despensa de la cuenta activa.' using errcode = 'P0002'; end if;
  if v_unit <> public.nutrition_pantry_normalize_unit(v_item.unit) then
    raise exception 'La unidad de un lote existente no se puede cambiar. Conservá la unidad original o creá un lote nuevo para evitar alterar el historial.' using errcode = '22023';
  end if;
  update public.nutrition_pantry_items set name=v_name, brand=left(btrim(coalesce(p_brand,'')),160), preparation_state=v_prep,
    expires_on=p_expires_on, location=left(btrim(coalesce(p_location,'')),120), notes=left(coalesce(p_notes,''),2000),
    is_archived=coalesce(p_is_archived,false), updated_at=now()
  where id=p_item_id and user_id=v_uid returning * into v_item;
  return jsonb_build_object('id',v_item.id,'name',v_item.name,'quantity',v_item.quantity,'unit',v_item.unit,'is_archived',v_item.is_archived);
end;
$$;

-- RPC transaccional: descuenta una comida fechada una sola vez, por lotes y sin stock negativo.
-- Los lotes próximos a vencer se usan primero; productos/unidades/preparaciones desconocidos no se fuerzan a coincidir.
create or replace function public.nutrition_pantry_consume_planned_meal(p_plan_item_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.nutrition_weekly_plan_items%rowtype;
  v_run_id uuid;
  v_prior jsonb;
  v_ing jsonb;
  v_stock public.nutrition_pantry_items%rowtype;
  v_name text; v_brand text; v_unit text; v_prep text; v_qty numeric; v_remaining_base numeric;
  v_need_dim text; v_stock_factor numeric; v_take_units numeric; v_before numeric; v_after numeric;
  v_operation_key text; v_reason text; v_count integer := 0; v_deducted integer := 0; v_missing integer := 0; v_any boolean;
  v_result jsonb;
  v_ordinal bigint;
begin
  if v_uid is null then raise exception 'Iniciá sesión para registrar el uso de ingredientes.' using errcode = '28000'; end if;
  select * into v_plan from public.nutrition_weekly_plan_items where id=p_plan_item_id and user_id=v_uid for update;
  if not found then raise exception 'La comida planificada no existe en la cuenta activa.' using errcode = 'P0002'; end if;

  insert into public.nutrition_pantry_consumption_runs(user_id,plan_item_id,result)
  values(v_uid,v_plan.id,'{}'::jsonb)
  on conflict (user_id,plan_item_id) do nothing returning id into v_run_id;
  if v_run_id is null then
    select result into v_prior from public.nutrition_pantry_consumption_runs where user_id=v_uid and plan_item_id=v_plan.id;
    return coalesce(v_prior,'{}'::jsonb) || jsonb_build_object('already_recorded',true);
  end if;

  v_reason := 'Uso confirmado: ' || left(coalesce(v_plan.title,'comida planificada'),180);
  for v_ing, v_ordinal in
    select value, ordinality from jsonb_array_elements(coalesce(v_plan.ingredients_snapshot,'[]'::jsonb)) with ordinality
    order by public.nutrition_pantry_normalize_text(value->>'name'), public.nutrition_pantry_normalize_text(value->>'brand'), coalesce(value->>'preparation_state','unspecified'), coalesce(value->>'unit',''), ordinality
  loop
    v_name := btrim(coalesce(v_ing->>'name',''));
    v_brand := btrim(coalesce(v_ing->>'brand',''));
    v_unit := public.nutrition_pantry_normalize_unit(v_ing->>'unit');
    v_prep := coalesce(nullif(v_ing->>'preparation_state',''),'unspecified');
    if v_name = '' or coalesce(v_ing->>'quantity','') !~ '^[0-9]+(\.[0-9]+)?$' or v_unit = '' or v_prep not in ('raw','cooked','prepared','unspecified') then continue; end if;
    v_qty := (v_ing->>'quantity')::numeric;
    if v_qty <= 0 or v_qty > 1000000000 then continue; end if;
    v_count := v_count + 1;
    v_remaining_base := round(v_qty * public.nutrition_pantry_unit_factor(v_unit),3);
    v_need_dim := public.nutrition_pantry_unit_dimension(v_unit);
    v_any := false;

    for v_stock in
      select i.* from public.nutrition_pantry_items i
      where i.user_id=v_uid and i.is_archived=false and i.quantity>0
        and (i.expires_on is null or i.expires_on >= (now() at time zone 'America/Argentina/Cordoba')::date)
        and public.nutrition_pantry_normalize_text(i.name)=public.nutrition_pantry_normalize_text(v_name)
        and public.nutrition_pantry_normalize_text(i.brand)=public.nutrition_pantry_normalize_text(v_brand)
        and i.preparation_state=v_prep
        and public.nutrition_pantry_unit_dimension(i.unit)=v_need_dim
      order by i.expires_on asc nulls last, i.created_at asc, i.id asc
      for update
    loop
      exit when v_remaining_base <= 0;
      v_stock_factor := public.nutrition_pantry_unit_factor(v_stock.unit);
      v_take_units := least(v_stock.quantity, floor((v_remaining_base / v_stock_factor) * 1000) / 1000);
      if v_take_units <= 0 then continue; end if;
      v_before := v_stock.quantity; v_after := round(v_before-v_take_units,3);
      update public.nutrition_pantry_items set quantity=v_after,updated_at=now() where id=v_stock.id and user_id=v_uid;
      v_operation_key := left('plan-consume:'||v_plan.id::text||':'||v_ordinal::text||':'||v_stock.id::text,240);
      insert into public.nutrition_pantry_movements(user_id,pantry_item_id,movement_type,quantity_delta,quantity_before,quantity_after,unit,reason,operation_key,source_plan_item_id)
      values(v_uid,v_stock.id,'consumption',-v_take_units,v_before,v_after,v_stock.unit,left(v_reason||' · ingrediente: '||v_name,500),v_operation_key,v_plan.id);
      v_remaining_base := greatest(0,round(v_remaining_base-v_take_units*v_stock_factor,3));
      v_any := true; v_deducted := v_deducted+1;
    end loop;
    if v_remaining_base > 0 then v_missing := v_missing+1; end if;
  end loop;

  if v_count = 0 then
    raise exception 'Esta comida no contiene ingredientes con cantidad y unidad válidas; no se descontó stock.' using errcode = '22023';
  end if;

  v_result := jsonb_build_object('already_recorded',false,'plan_item_id',v_plan.id,'title',v_plan.title,
    'ingredients_considered',v_count,'inventory_batches_deducted',v_deducted,'ingredients_without_full_stock',v_missing,
    'message',case when v_count=0 then 'No había ingredientes con cantidad y unidad válidas para descontar.'
      when v_missing=0 then 'Se descontaron las existencias disponibles para todos los ingredientes identificados.'
      else 'Se descontaron las existencias disponibles; algunos ingredientes no tenían stock suficiente o una coincidencia segura.' end);
  update public.nutrition_pantry_consumption_runs set result=v_result where id=v_run_id and user_id=v_uid;
  return v_result;
end;
$$;

-- Las funciones SECURITY DEFINER validan auth.uid() internamente y no quedan ejecutables por anon/PUBLIC.
revoke all on function public.nutrition_pantry_normalize_text(text) from public, anon, authenticated;
revoke all on function public.nutrition_pantry_normalize_unit(text) from public, anon, authenticated;
revoke all on function public.nutrition_pantry_unit_dimension(text) from public, anon, authenticated;
revoke all on function public.nutrition_pantry_unit_factor(text) from public, anon, authenticated;
revoke all on function public.nutrition_pantry_record_movement(uuid,text,text,text,text,numeric,text,text,date,text,text,text) from public, anon, authenticated;
revoke all on function public.nutrition_pantry_update_item_details(uuid,text,text,text,text,date,text,text,boolean) from public, anon, authenticated;
revoke all on function public.nutrition_pantry_consume_planned_meal(uuid) from public, anon, authenticated;
grant execute on function public.nutrition_pantry_record_movement(uuid,text,text,text,text,numeric,text,text,date,text,text,text) to authenticated;
grant execute on function public.nutrition_pantry_update_item_details(uuid,text,text,text,text,date,text,text,boolean) to authenticated;
grant execute on function public.nutrition_pantry_consume_planned_meal(uuid) to authenticated;

commit;
