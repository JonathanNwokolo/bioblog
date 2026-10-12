-- Read-only verification after the owner runs cleanup-phase212-test-data.sql.
-- Expected: posts 0, media 0, revisions 0, storage_objects 0, audit_events 14, users 1, owners 1, categories 4.
select
  (select count(*) from public.posts)           as posts,
  (select count(*) from public.media_assets)    as media,
  (select count(*) from public.post_revisions)  as revisions,
  (select count(*) from storage.objects where bucket_id = 'post-media') as storage_objects,
  (select count(*) from public.audit_events)    as audit_events,
  (select count(*) from auth.users)             as users,
  (select count(*) from public.owner_accounts)  as owners,
  (select count(*) from public.categories)      as categories;
