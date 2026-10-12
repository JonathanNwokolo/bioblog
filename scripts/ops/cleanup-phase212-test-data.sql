-- Phase 2.1.2 test-data cleanup — OWNER-EXECUTED. NOT run by the agent.
-- Project: microcosmos (oetwoiuzoniwwtrdnohr) — confirm the project name in the dashboard header first.
--
-- Single data-modifying statement (works in the Dashboard SQL Editor and in `supabase db query --linked -f`).
-- It is guarded: if the two posts are not exactly the temporary test rows (status 'deleted', QA titles,
-- the expected hero media), NOTHING is deleted and the result shows posts_deleted = 0.
--
-- Run AFTER removing the two Storage objects (see docs/phase213-cms-hardening-report.md §3):
--   npx supabase@2.120.0 storage rm --linked --experimental \
--     "ss:///post-media/64735f74-5c82-41fa-a001-406813663c6b/c786d6c9-b51b-46f4-87cd-99c4a02625f3.webp" \
--     "ss:///post-media/f65424d0-c1b5-469a-b578-b6183d919d96/934f9a6e-dff2-4013-bcc7-b255f36610ce.webp"
-- (or Dashboard → Storage → post-media → select the two objects → Delete).
--
-- audit_events are deliberately NOT touched (audit trail retained).
with guard as (
  select count(*) as matching
  from public.posts
  where (id, slug, hero_media_id) in (
          ('98a207ba-5289-4801-9e53-08d78dcbd146'::uuid, 'qa-fase-2-1-2-teste-temporario', '8180ee80-a46f-479b-a82f-2d9ee4c18a0a'::uuid),
          ('e12a49b8-b0ae-45b5-bbf8-a934376359fe'::uuid, 'qa-producao-temporaria',        '291e010c-2db8-45af-a3fa-c4081c53b5d1'::uuid))
    and status = 'deleted'
    and deleted_at is not null
    and title like 'QA %'
),
deleted_posts as (
  delete from public.posts p
  using guard
  where guard.matching = 2
    and p.id in ('98a207ba-5289-4801-9e53-08d78dcbd146', 'e12a49b8-b0ae-45b5-bbf8-a934376359fe')
  returning p.id, p.hero_media_id
),
deleted_media as (
  delete from public.media_assets m
  where m.id in (select hero_media_id from deleted_posts)
    and m.state = 'draft'
    and m.id in ('8180ee80-a46f-479b-a82f-2d9ee4c18a0a', '291e010c-2db8-45af-a3fa-c4081c53b5d1')
  returning m.id
)
select
  (select matching from guard)                  as guard_matching_rows,
  (select count(*) from deleted_posts)          as posts_deleted,
  (select count(*) from deleted_media)          as media_deleted;
-- Expected: guard_matching_rows = 2, posts_deleted = 2, media_deleted = 2
-- (post_revisions 4, 5, 6 disappear through ON DELETE CASCADE).
