-- MICROCosmos Phase 2.1.2 (pre-push validation): two findings from real local probes.
-- See docs/phase212-prepush-report.md and docs/evidence/phase212-prepush/.
--
--  1. An authenticated user WITHOUT an owner role could not read published posts, published
--     media metadata or published objects: the hardening migration split the old combined
--     policies into `anon_*` (published) and `owner_*` (owner only) and left the
--     `authenticated` role with no published-read policy. Any logged-in non-owner (or an owner
--     whose session cookie is attached to a public request) saw an empty diary.
--     Fix: add published-only read policies for `authenticated`. Drafts, unpublished/deleted
--     rows, private media and administrative tables stay unreachable for non-owners.
--
--  2. Besides TRUNCATE/TRIGGER/REFERENCES (revoked by 20261011020000), the default privileges
--     still left INSERT/UPDATE/DELETE on public tables to `anon` and broader-than-intended
--     DML to `authenticated` (e.g. UPDATE/DELETE on owner_accounts, audit_events and
--     post_revisions). RLS already blocked them; this removes the grants as defence in depth
--     so that a future policy mistake cannot expose a write path.
--
-- No data is read, changed or deleted by this migration.

-- ------------------------------------------------ 1. published reads for `authenticated`
create policy authenticated_reads_published_posts on public.posts for select to authenticated
using (status = 'published' and deleted_at is null);

create policy authenticated_reads_published_media on public.media_assets for select to authenticated
using (state = 'published' and deleted_at is null);

create policy authenticated_reads_published_objects on storage.objects for select to authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1 from public.media_assets m
    where m.object_key = name and m.state = 'published' and m.deleted_at is null
  )
);

-- ------------------------------------------------ 2. DML least privilege
-- anon is read-only: SELECT on categories (table) and the column grants on posts/media_assets
-- already made by the hardening migration.
revoke insert, update, delete on all tables in schema public from anon;

-- authenticated: only what the owner UI needs and what policies exist for.
--   owner_accounts: SELECT only
--   audit_events, post_revisions: SELECT + INSERT (append-only)
--   categories: SELECT, INSERT, UPDATE, DELETE (policies exist)
--   posts, media_assets: SELECT, INSERT, UPDATE (lifecycle is soft-delete; no DELETE policy)
revoke insert, update, delete on public.owner_accounts from authenticated;
revoke update, delete on public.audit_events, public.post_revisions from authenticated;
revoke delete on public.posts, public.media_assets from authenticated;
