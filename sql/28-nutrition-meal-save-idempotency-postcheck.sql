-- Agenda FICH — Etapa E8: postcheck de solo lectura.
-- Ejecutar después de sql/27-nutrition-meal-save-idempotency.sql.

select
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='nutrition_meals'
      and column_name='save_request_id' and data_type='uuid'
  ) as save_request_id_uuid_exists,
  exists (
    select 1 from pg_index i
    join pg_class t on t.oid=i.indrelid
    join pg_class x on x.oid=i.indexrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='nutrition_meals'
      and x.relname='nutrition_meals_user_save_request_id_uidx'
      and i.indisunique and i.indisvalid
      and pg_get_indexdef(i.indexrelid) ilike '%(user_id, save_request_id)%'
  ) as unique_idempotency_index_valid,
  (select relrowsecurity from pg_class where oid='public.nutrition_meals'::regclass) as rls_enabled,
  has_table_privilege('authenticated','public.nutrition_meals','SELECT') as authenticated_can_select,
  has_table_privilege('authenticated','public.nutrition_meals','INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated','public.nutrition_meals','UPDATE') as authenticated_can_update,
  (select count(*) from public.nutrition_meals where save_request_id is not null) as rows_with_idempotency_key,
  (select count(*) from (
    select user_id, save_request_id
    from public.nutrition_meals
    where save_request_id is not null
    group by user_id, save_request_id having count(*) > 1
  ) duplicate_keys) as duplicate_nonnull_keys;

-- Resultado esperado: las cuatro comprobaciones de estructura/permisos en true,
-- RLS true, duplicate_nonnull_keys = 0. El número rows_with_idempotency_key puede ser 0.
