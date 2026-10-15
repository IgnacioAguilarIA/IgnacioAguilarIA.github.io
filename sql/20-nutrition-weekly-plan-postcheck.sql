-- Agenda FICH D5: verificación de instalación, solo lectura.
-- Devuelve metadatos y contadores; no nombres, notas ni ingredientes.
select 'table_status' as section, 'public.nutrition_weekly_plan_items' as object_name,
 jsonb_build_object(
  'exists',to_regclass('public.nutrition_weekly_plan_items') is not null,
  'rls_enabled',coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='nutrition_weekly_plan_items'),false),
  'anon_privileges',coalesce((select jsonb_agg(p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p where has_table_privilege('anon','public.nutrition_weekly_plan_items',p)),'[]'::jsonb),
  'public_privileges',coalesce((select jsonb_agg(a.privilege_type) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where n.nspname='public' and c.relname='nutrition_weekly_plan_items' and a.grantee=0),'[]'::jsonb),
  'authenticated_privileges',coalesce((select jsonb_agg(p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p where has_table_privilege('authenticated','public.nutrition_weekly_plan_items',p)),'[]'::jsonb),
  'service_role_privileges',coalesce((select jsonb_agg(p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p where has_table_privilege('service_role','public.nutrition_weekly_plan_items',p)),'[]'::jsonb)
 ) as details
union all
select 'policy_status','nutrition_weekly_plan_items_account_scope',jsonb_build_object(
 'exists',exists(select 1 from pg_policies where schemaname='public' and tablename='nutrition_weekly_plan_items' and policyname='nutrition_weekly_plan_items_account_scope'),
 'roles',(select roles from pg_policies where schemaname='public' and tablename='nutrition_weekly_plan_items' and policyname='nutrition_weekly_plan_items_account_scope' limit 1),
 'command',(select cmd from pg_policies where schemaname='public' and tablename='nutrition_weekly_plan_items' and policyname='nutrition_weekly_plan_items_account_scope' limit 1),
 'using_expression',(select qual from pg_policies where schemaname='public' and tablename='nutrition_weekly_plan_items' and policyname='nutrition_weekly_plan_items_account_scope' limit 1),
 'check_expression',(select with_check from pg_policies where schemaname='public' and tablename='nutrition_weekly_plan_items' and policyname='nutrition_weekly_plan_items_account_scope' limit 1)
 )
union all
select 'shopping_quantity_status','nutrition_shopping_items_quantity_known',jsonb_build_object(
 'column_exists',exists(select 1 from information_schema.columns where table_schema='public' and table_name='nutrition_shopping_items' and column_name='quantity_known'),
 'unknown_quantity_rows',(select count(*) from public.nutrition_shopping_items where quantity_known=false),
 'generated_unknown_quantity_rows',(select count(*) from public.nutrition_shopping_items where source='generated' and quantity_known=false)
 )
union all
select 'data_counts','nutrition_weekly_plan_items_sanity',jsonb_build_object(
 'rows_total',(select count(*) from public.nutrition_weekly_plan_items),
 'invalid_week_start_rows',(select count(*) from public.nutrition_weekly_plan_items where extract(isodow from week_start)<>1),
 'invalid_day_offset_rows',(select count(*) from public.nutrition_weekly_plan_items where day_offset not between 0 and 6),
 'invalid_snapshot_rows',(select count(*) from public.nutrition_weekly_plan_items where jsonb_typeof(ingredients_snapshot)<>'array' or jsonb_typeof(nutrition_snapshot)<>'object'),
 'source_template_cross_account_rows',(select count(*) from public.nutrition_weekly_plan_items p join public.nutrition_meals m on m.id=p.source_meal_id where p.user_id<>m.user_id),
 'duplicate_user_week_keys',(select count(*) from (select user_id,week_start,plan_key from public.nutrition_weekly_plan_items group by user_id,week_start,plan_key having count(*)>1) d)
 );
