-- Agenda FICH — D4: postcheck de lista de compras; solo lectura.
-- Devuelve estados/permisos/contadores, nunca nombres ni contenido de listas.

select 'table_status' as section,
       'public.nutrition_shopping_items' as object_name,
       jsonb_build_object(
         'exists', to_regclass('public.nutrition_shopping_items') is not null,
         'rls_enabled', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='nutrition_shopping_items'), false),
         'force_rls', coalesce((select c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='nutrition_shopping_items'), false),
         'anon_privileges', coalesce((select jsonb_agg(p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p where has_table_privilege('anon','public.nutrition_shopping_items',p)), '[]'::jsonb),
         'public_privileges', coalesce((select jsonb_agg(a.privilege_type) from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where n.nspname='public' and c.relname='nutrition_shopping_items' and a.grantee=0), '[]'::jsonb),
         'authenticated_privileges', coalesce((select jsonb_agg(p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p where has_table_privilege('authenticated','public.nutrition_shopping_items',p)), '[]'::jsonb),
         'service_role_privileges', coalesce((select jsonb_agg(p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p where has_table_privilege('service_role','public.nutrition_shopping_items',p)), '[]'::jsonb)
       ) as details
union all
select 'policy_status', 'nutrition_shopping_items_account_scope',
       jsonb_build_object(
         'exists', exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename='nutrition_shopping_items' and p.policyname='nutrition_shopping_items_account_scope'),
         'permissive', (select p.permissive from pg_policies p where p.schemaname='public' and p.tablename='nutrition_shopping_items' and p.policyname='nutrition_shopping_items_account_scope' limit 1),
         'command', (select p.cmd from pg_policies p where p.schemaname='public' and p.tablename='nutrition_shopping_items' and p.policyname='nutrition_shopping_items_account_scope' limit 1),
         'roles', (select p.roles from pg_policies p where p.schemaname='public' and p.tablename='nutrition_shopping_items' and p.policyname='nutrition_shopping_items_account_scope' limit 1),
         'using_expression', (select p.qual from pg_policies p where p.schemaname='public' and p.tablename='nutrition_shopping_items' and p.policyname='nutrition_shopping_items_account_scope' limit 1),
         'check_expression', (select p.with_check from pg_policies p where p.schemaname='public' and p.tablename='nutrition_shopping_items' and p.policyname='nutrition_shopping_items_account_scope' limit 1)
       )
union all
select 'data_counts', 'nutrition_shopping_items_sanity',
       jsonb_build_object(
         'rows_total', (select count(*) from public.nutrition_shopping_items),
         'invalid_quantity_rows', (select count(*) from public.nutrition_shopping_items where quantity < 0 or quantity > 1000000),
         'empty_name_rows', (select count(*) from public.nutrition_shopping_items where btrim(name)=''),
         'invalid_week_start_rows', (select count(*) from public.nutrition_shopping_items where extract(isodow from week_start) <> 1),
         'duplicate_user_week_item_keys', (select count(*) from (select user_id,week_start,item_key from public.nutrition_shopping_items group by user_id,week_start,item_key having count(*)>1) d)
       );
