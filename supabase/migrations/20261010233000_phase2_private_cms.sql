-- MICROCosmos Phase 2.1: private CMS, publication lifecycle and private media.
-- Designed for a fresh Supabase Free project. No demo content is published.

create type public.post_status as enum ('draft', 'published', 'unpublished', 'deleted');
create type public.media_state as enum ('draft', 'published', 'deleted');

create table public.owner_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (char_length(label) between 2 and 80),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  storage_bucket text not null default 'post-media' check (storage_bucket = 'post-media'),
  object_key text not null unique check (object_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  state public.media_state not null default 'draft',
  mime_type text not null check (mime_type = 'image/webp'),
  bytes integer not null check (bytes between 1 and 4194304),
  width integer not null check (width between 1 and 2000),
  height integer not null check (height between 1 and 2000),
  alt_text text not null check (char_length(alt_text) between 3 and 500),
  credit text not null default '' check (char_length(credit) <= 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 180),
  excerpt text not null check (char_length(excerpt) between 10 and 420),
  body_json jsonb not null default '[]'::jsonb check (jsonb_typeof(body_json) = 'array'),
  category_id uuid not null references public.categories(id),
  hero_media_id uuid references public.media_assets(id),
  status public.post_status not null default 'draft',
  first_published_at timestamptz,
  published_at timestamptz,
  author_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint post_state_dates check (
    (status = 'published' and published_at is not null and deleted_at is null)
    or (status <> 'published')
  )
);

create index posts_public_order_idx
  on public.posts (published_at desc, id desc)
  where status = 'published' and deleted_at is null;
create index posts_author_idx on public.posts (author_user_id, updated_at desc);
create index posts_category_idx on public.posts (category_id);
create index posts_hero_media_idx on public.posts (hero_media_id) where hero_media_id is not null;

create table public.post_revisions (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  revision integer not null,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (post_id, revision)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  action text not null check (action in ('create', 'update', 'publish', 'unpublish', 'delete', 'media_upload', 'media_delete')),
  entity_type text not null check (entity_type in ('post', 'media')),
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index media_assets_owner_idx on public.media_assets (owner_id, created_at desc);
create index post_revisions_creator_idx on public.post_revisions (created_by);
create index audit_events_actor_idx on public.audit_events (actor_user_id) where actor_user_id is not null;

insert into public.categories (slug, label, sort_order) values
  ('identificacao', 'Identificação', 10),
  ('protozoarios', 'Protozoários', 20),
  ('diagnostico', 'Diagnóstico', 30),
  ('bastidores', 'Bastidores do laboratório', 40)
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 4194304, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_active_owner(candidate uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.owner_accounts
    where user_id = candidate and active = true
  );
$$;

create or replace function public.record_post_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare next_revision integer;
begin
  if old.title is not distinct from new.title
    and old.excerpt is not distinct from new.excerpt
    and old.body_json is not distinct from new.body_json
    and old.category_id is not distinct from new.category_id
    and old.hero_media_id is not distinct from new.hero_media_id then
    return new;
  end if;

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.post_revisions where post_id = old.id;

  insert into public.post_revisions (post_id, revision, snapshot, created_by)
  values (
    old.id,
    next_revision,
    jsonb_build_object(
      'slug', old.slug, 'title', old.title, 'excerpt', old.excerpt,
      'body_json', old.body_json, 'category_id', old.category_id,
      'hero_media_id', old.hero_media_id, 'status', old.status
    ),
    auth.uid()
  );
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_revision_before_update
before update on public.posts
for each row execute function public.record_post_revision();

create or replace function public.publish_post(target_post_id uuid)
returns public.posts
language plpgsql
security invoker
set search_path = ''
as $$
declare selected_post public.posts;
begin
  if not public.is_active_owner() then raise exception 'not_authorized' using errcode = '42501'; end if;

  select * into selected_post from public.posts
  where id = target_post_id and author_user_id = auth.uid() and deleted_at is null
  for update;

  if selected_post.id is null then raise exception 'post_not_found' using errcode = 'P0002'; end if;
  if selected_post.hero_media_id is null then raise exception 'hero_media_required' using errcode = '23514'; end if;
  if jsonb_array_length(selected_post.body_json) = 0 then raise exception 'body_required' using errcode = '23514'; end if;

  update public.media_assets set state = 'published', deleted_at = null
  where id = selected_post.hero_media_id and owner_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'media_not_found' using errcode = '23514'; end if;

  update public.posts set
    status = 'published',
    first_published_at = coalesce(first_published_at, now()),
    published_at = coalesce(first_published_at, now()),
    deleted_at = null,
    updated_at = now()
  where id = target_post_id
  returning * into selected_post;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'publish', 'post', target_post_id);
  return selected_post;
end;
$$;

create or replace function public.unpublish_post(target_post_id uuid)
returns public.posts
language plpgsql
security invoker
set search_path = ''
as $$
declare selected_post public.posts;
begin
  if not public.is_active_owner() then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.posts set status = 'unpublished', updated_at = now()
  where id = target_post_id and author_user_id = auth.uid() and deleted_at is null
  returning * into selected_post;
  if selected_post.id is null then raise exception 'post_not_found' using errcode = 'P0002'; end if;

  update public.media_assets set state = 'draft'
  where id = selected_post.hero_media_id
    and not exists (
      select 1 from public.posts p
      where p.hero_media_id = selected_post.hero_media_id
        and p.status = 'published' and p.deleted_at is null and p.id <> target_post_id
    );
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'unpublish', 'post', target_post_id);
  return selected_post;
end;
$$;

create or replace function public.soft_delete_post(target_post_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare selected_media uuid;
begin
  if not public.is_active_owner() then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.posts set status = 'deleted', deleted_at = now(), updated_at = now()
  where id = target_post_id and author_user_id = auth.uid() and deleted_at is null
  returning hero_media_id into selected_media;
  if not found then raise exception 'post_not_found' using errcode = 'P0002'; end if;
  update public.media_assets set state = 'draft'
  where id = selected_media
    and not exists (
      select 1 from public.posts p where p.hero_media_id = selected_media
        and p.status = 'published' and p.deleted_at is null
    );
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'delete', 'post', target_post_id);
end;
$$;

alter table public.owner_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.media_assets enable row level security;
alter table public.posts enable row level security;
alter table public.post_revisions enable row level security;
alter table public.audit_events enable row level security;

create policy owner_reads_self on public.owner_accounts for select to authenticated
using (user_id = (select auth.uid()));

create policy public_reads_categories on public.categories for select to anon, authenticated
using (active or public.is_active_owner());
create policy owner_inserts_categories on public.categories for insert to authenticated
with check (public.is_active_owner());
create policy owner_updates_categories on public.categories for update to authenticated
using (public.is_active_owner()) with check (public.is_active_owner());
create policy owner_deletes_categories on public.categories for delete to authenticated
using (public.is_active_owner());

create policy public_reads_published_media on public.media_assets for select to anon, authenticated
using (state = 'published' or (owner_id = (select auth.uid()) and public.is_active_owner()));
create policy owner_inserts_media on public.media_assets for insert to authenticated
with check (owner_id = (select auth.uid()) and public.is_active_owner());
create policy owner_updates_media on public.media_assets for update to authenticated
using (owner_id = (select auth.uid()) and public.is_active_owner())
with check (owner_id = (select auth.uid()) and public.is_active_owner());

create policy public_reads_published_posts on public.posts for select to anon, authenticated
using (
  (status = 'published' and deleted_at is null)
  or (author_user_id = (select auth.uid()) and public.is_active_owner())
);
create policy owner_inserts_posts on public.posts for insert to authenticated
with check (author_user_id = (select auth.uid()) and public.is_active_owner());
create policy owner_updates_posts on public.posts for update to authenticated
using (author_user_id = (select auth.uid()) and public.is_active_owner())
with check (author_user_id = (select auth.uid()) and public.is_active_owner());

create policy owner_reads_revisions on public.post_revisions for select to authenticated
using (public.is_active_owner());
create policy owner_inserts_revisions on public.post_revisions for insert to authenticated
with check (created_by = (select auth.uid()) and public.is_active_owner());
create policy owner_reads_audit on public.audit_events for select to authenticated
using (public.is_active_owner());
create policy owner_inserts_audit on public.audit_events for insert to authenticated
with check (actor_user_id = (select auth.uid()) and public.is_active_owner());

create policy owner_uploads_private_media on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_active_owner()
);
create policy owner_reads_private_media on storage.objects for select to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_active_owner()
);
create policy public_reads_published_objects on storage.objects for select to anon, authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1 from public.media_assets m
    where m.object_key = name and m.state = 'published' and m.deleted_at is null
  )
);
create policy owner_deletes_private_media on storage.objects for delete to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_active_owner()
);

revoke all on public.owner_accounts, public.post_revisions, public.audit_events from anon;
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.posts, public.media_assets to anon, authenticated;
grant insert, update, delete on public.categories, public.posts, public.media_assets to authenticated;
grant select, insert on public.post_revisions, public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on public.owner_accounts to authenticated;
grant usage on type public.post_status, public.media_state to anon, authenticated;
revoke all on function public.publish_post(uuid), public.unpublish_post(uuid), public.soft_delete_post(uuid) from public, anon;
grant execute on function public.publish_post(uuid), public.unpublish_post(uuid), public.soft_delete_post(uuid) to authenticated;

-- Supabase's "Enable automatic RLS" provisioning creates this SECURITY DEFINER
-- trigger function in public. The event trigger does not need API roles to call it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

