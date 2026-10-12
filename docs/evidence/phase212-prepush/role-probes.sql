\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on
select 'ANON_COLUMN_SELECT|'||table_name||'|'||string_agg(column_name, ',' order by column_name)
  from information_schema.column_privileges
  where table_schema='public' and grantee='anon' and privilege_type='SELECT' group by table_name;
select 'AUTH_NONOWNER_TABLE_PRIV_REFERENCES_TRIGGER_TRUNCATE|'||count(*) from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES');
\echo --- anon / authenticated attempts (each must error with permission denied)
begin; set local role anon;          truncate public.posts;                      rollback;
begin; set local role authenticated; truncate public.posts;                      rollback;
begin; set local role authenticated; truncate public.media_assets;               rollback;
begin; set local role authenticated; truncate public.owner_accounts;             rollback;
begin; set local role authenticated; truncate storage.objects;                   rollback;
begin; set local role anon;          create trigger t after insert on public.posts for each row execute function public.protect_in_use_media(); rollback;
begin; set local role authenticated; create trigger t after insert on public.posts for each row execute function public.protect_in_use_media(); rollback;
begin; set local role authenticated; alter table public.posts add constraint x foreign key (author_user_id) references public.categories(id); rollback;
begin; set local role anon;          select public.is_active_owner();             rollback;
begin; set local role authenticated; select public.record_post_revision();        rollback;
begin; set local role anon;          update public.posts set title='x';           rollback;
begin; set local role authenticated; update public.owner_accounts set active=false; rollback;
begin; set local role authenticated; delete from public.audit_events;             rollback;
