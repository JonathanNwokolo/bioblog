-- OWNER-EXECUTED. Removes ONLY the rows created by the remote smoke test (docs/phase213-owner-runbook.md, passo 5).
-- Rule: posts whose title starts with 'SMOKE ' AND status = 'deleted' (i.e. already excluded in the CMS).
-- Run AFTER pressing "Remover imagens sem uso" in the CMS dashboard (it deletes the Storage objects through
-- the Storage API using the owner session and soft-deletes the media rows; wait > 1 h or see the runbook).
-- Single statement; audit_events are retained.
with doomed as (
  select id, hero_media_id from public.posts
  where title like 'SMOKE %' and status = 'deleted' and deleted_at is not null
),
deleted_posts as (
  delete from public.posts p using doomed d where p.id = d.id returning p.id, p.hero_media_id
),
deleted_media as (
  delete from public.media_assets m
  where m.id in (select hero_media_id from deleted_posts)
    and m.state = 'draft'
    and not exists (select 1 from public.posts p2 where p2.hero_media_id = m.id and p2.id not in (select id from deleted_posts))
  returning m.id
)
select (select count(*) from deleted_posts) as posts_deleted, (select count(*) from deleted_media) as media_deleted;
