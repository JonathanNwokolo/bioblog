-- MICROCosmos Phase 2.1.2: least-privilege cleanup found by the remote pre-migration audit.
--
-- Supabase's default privileges on the public schema leave TRUNCATE, TRIGGER and REFERENCES
-- granted to anon/authenticated on every table. PostgREST does not expose TRUNCATE and RLS
-- does not apply to it, so removing the grants is pure defence in depth. The CMS needs none
-- of these three privileges; data access is only SELECT/INSERT/UPDATE/DELETE under RLS.
--
-- Trigger functions are not meant to be called through the API either. Triggers do not check
-- EXECUTE at fire time, so revoking from PUBLIC/anon/authenticated is safe.

revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

revoke execute on function public.record_post_revision() from public, anon, authenticated;
revoke execute on function public.enforce_published_post_invariants() from public, anon, authenticated;
revoke execute on function public.protect_in_use_media() from public, anon, authenticated;
