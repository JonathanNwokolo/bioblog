\pset format unaligned
\pset tuples_only on
select 'TABLE_PRIV|'||grantee||'|'||table_name||'|'||string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated')
group by grantee, table_name order by 1;
select 'UNWANTED_COUNT|'||count(*) from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES');
select 'FN_EXEC|'||r.rolname||'|'||p.proname||'|'||has_function_privilege(r.rolname, p.oid, 'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace, pg_roles r
where n.nspname='public' and r.rolname in ('anon','authenticated','public') is not false and r.rolname in ('anon','authenticated')
order by 1;
