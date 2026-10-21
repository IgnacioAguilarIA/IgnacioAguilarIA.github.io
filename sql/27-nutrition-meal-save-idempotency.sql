-- Agenda FICH — Etapa E8: protección idempotente para nuevos registros de comidas.
-- Requiere que public.nutrition_meals ya exista y conserve user_id + RLS.
-- Es aditiva: no modifica ni elimina comidas anteriores. Las filas existentes
-- quedan con save_request_id = NULL; el índice único permite múltiples NULL.

begin;

do $preflight$
begin
  if to_regclass('public.nutrition_meals') is null then
    raise exception 'E8 cancelada: no existe public.nutrition_meals. No se cambió ningún dato.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='nutrition_meals' and column_name='user_id'
  ) then
    raise exception 'E8 cancelada: falta user_id en public.nutrition_meals. No se cambió ningún dato.';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='nutrition_meals' and c.relrowsecurity
  ) then
    raise exception 'E8 cancelada: RLS no está habilitado en public.nutrition_meals. Revisá la seguridad antes de continuar.';
  end if;
end;
$preflight$;

alter table public.nutrition_meals
  add column if not exists save_request_id uuid;

-- La misma clave de operación solo puede crear una comida por cuenta.
-- PostgreSQL permite múltiples NULL en un índice UNIQUE ordinario, por lo que
-- todas las comidas históricas siguen siendo válidas.
create unique index if not exists nutrition_meals_user_save_request_id_uidx
  on public.nutrition_meals (user_id, save_request_id);

comment on column public.nutrition_meals.save_request_id is
  'UUID idempotente de la creación desde Agenda FICH. Permite reintentar una respuesta incierta sin duplicar la comida; NULL en filas históricas.';

-- No se modifican RLS ni los grants existentes. E8 utiliza los permisos CRUD
-- que las etapas de endurecimiento ya establecieron para authenticated.

do $postflight$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='nutrition_meals'
      and column_name='save_request_id' and data_type='uuid'
  ) then
    raise exception 'E8 falló: falta la columna UUID save_request_id. Se revierte la migración.';
  end if;
  if not exists (
    select 1 from pg_index i
    join pg_class t on t.oid=i.indrelid
    join pg_class x on x.oid=i.indexrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='nutrition_meals'
      and x.relname='nutrition_meals_user_save_request_id_uidx'
      and i.indisunique and i.indisvalid
      and pg_get_indexdef(i.indexrelid) ilike '%(user_id, save_request_id)%'
  ) then
    raise exception 'E8 falló: el índice único idempotente no está válido. Se revierte la migración.';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.nutrition_meals'::regclass) then
    raise exception 'E8 falló: RLS dejó de estar habilitado. Se revierte la migración.';
  end if;
end;
$postflight$;

commit;
