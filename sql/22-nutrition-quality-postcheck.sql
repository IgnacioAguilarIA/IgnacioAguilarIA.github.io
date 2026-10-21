-- Agenda FICH — Etapa D7: verificación de solo lectura.
-- No lee nombres de alimentos ni contenido de comidas; devuelve estado y contadores.

select 'columns' as check_group, table_name as object_name, column_name as detail
from information_schema.columns
where table_schema='public'
  and table_name in ('food_catalog','user_foods','nutrition_meal_items')
  and column_name in ('source_url','data_source_label','data_source_url','nutrition_quality_status','nutrition_missing_fields','nutrition_verified_at')
order by table_name,column_name;

select 'rls' as check_group, c.relname as object_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('food_catalog','user_foods','nutrition_meal_items')
order by c.relname;

select 'privileges' as check_group, table_name as object_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as detail
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('food_catalog','user_foods','nutrition_meal_items')
  and grantee in ('PUBLIC','anon','authenticated')
group by table_name,grantee
order by table_name,grantee;

select 'quality_status' as check_group, 'user_foods' as object_name,
       nutrition_quality_status as detail, count(*)::bigint as rows_count
from public.user_foods
group by nutrition_quality_status
union all
select 'quality_status', 'nutrition_meal_items', nutrition_quality_status, count(*)::bigint
from public.nutrition_meal_items
group by nutrition_quality_status
order by object_name,detail;

select 'integrity' as check_group,
       count(*) filter (where data_source_label is null or trim(data_source_label)='')::bigint as empty_source_labels,
       count(*) filter (where cardinality(nutrition_missing_fields)>0)::bigint as rows_with_missing_nutrients,
       count(*) filter (where nutrition_quality_status='user_verified' and nutrition_verified_at is null)::bigint as verified_without_timestamp,
       count(*) filter (where data_source_url is not null and data_source_url !~* '^https?://')::bigint as invalid_source_urls
from public.user_foods
union all
select 'integrity', count(*) filter (where data_source_label is null or trim(data_source_label)='')::bigint,
       count(*) filter (where cardinality(nutrition_missing_fields)>0)::bigint,
       count(*) filter (where nutrition_quality_status='user_verified' and nutrition_verified_at is null)::bigint,
       count(*) filter (where data_source_url is not null and data_source_url !~* '^https?://')::bigint
from public.nutrition_meal_items;
