\pset format unaligned
\pset tuples_only on
-- 1. column-level SELECT/UPDATE per API role on the two tables with internal columns
select 'COL|'||r.rolname||'|'||c.table_name||'|'||c.column_name||'|select='||has_column_privilege(r.rolname, format('public.%I',c.table_name), c.column_name, 'SELECT')||'|update='||has_column_privilege(r.rolname, format('public.%I',c.table_name), c.column_name, 'UPDATE')
from information_schema.columns c, pg_roles r
where c.table_schema='public' and c.table_name in ('posts','media_assets') and r.rolname in ('anon','authenticated')
order by 1;
-- 2. table-level grants per API role (public schema + storage.objects)
select 'TABLE|'||grantee||'|'||table_schema||'.'||table_name||'|'||privs from (
  select grantee, table_schema, table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
  where table_schema in ('public','storage') and grantee in ('anon','authenticated','PUBLIC') and table_name in ('categories','posts','media_assets','owner_accounts','post_revisions','audit_events','objects')
  group by grantee, table_schema, table_name) t order by 1;
-- 3. any SECURITY DEFINER function / view in public (expected: none)
select 'SECDEF_FN|'||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef;
select 'SECDEF_VIEW|'||count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m') and coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name='security_invoker'),'false')<>'true';
-- 4. EXECUTE on every function in public for PUBLIC/anon/authenticated
select 'FN_EXEC|'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|anon='||has_function_privilege('anon',p.oid,'EXECUTE')||'|authenticated='||has_function_privilege('authenticated',p.oid,'EXECUTE')||'|secdef='||p.prosecdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1;
-- 5. policies
select 'POLICY|'||schemaname||'.'||tablename||'|'||policyname||'|'||cmd||'|'||array_to_string(roles,',')
from pg_policies where (schemaname='public') or (schemaname='storage' and tablename='objects') order by 1;
-- 6. RLS enabled
select 'RLS|'||relname||'|'||relrowsecurity||'|force='||relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' order by 1;
-- 7. unwanted privileges (expected 0)
select 'UNWANTED_COUNT|'||count(*) from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES');
