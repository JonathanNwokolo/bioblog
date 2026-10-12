do $$
declare
  r text := '';
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); us uuid := gen_random_uuid();
  cat uuid; ma uuid := gen_random_uuid(); pa uuid := gen_random_uuid();
  n int; v text; res public.post_lifecycle_result;
  mkey text := gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.webp';

  procedure_dummy int;
begin
  -- setup as postgres (rolled back at the end)
  insert into auth.users(id, email, aud, role) values
    (ua, 'a-'||ua||'@example.test', 'authenticated', 'authenticated'),
    (ub, 'b-'||ub||'@example.test', 'authenticated', 'authenticated'),
    (us, 's-'||us||'@example.test', 'authenticated', 'authenticated');
  insert into public.owner_accounts(user_id) values (ua), (ub);
  select id into cat from public.categories where active limit 1;
  insert into public.media_assets(id, owner_id, object_key, mime_type, bytes, width, height, alt_text, sha256)
    values (ma, ua, mkey, 'image/webp', 100, 10, 10, 'alt probe', repeat('a', 64));
  insert into public.posts(id, slug, title, excerpt, body_json, category_id, hero_media_id, author_user_id)
    values (pa, 'probe-'||left(pa::text, 8), 'Probe title', 'Probe excerpt long enough', '[{"type":"p","text":"x"}]', cat, ma, ua);

  -- helper macro via inline blocks: each test sets role/claims, runs, records.
  -- ===== ANON
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform author_user_id from public.posts; r := r || E'
' || 'FAIL anon_select_author_user_id_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS anon_select_author_user_id_denied'; end;
  begin perform owner_id from public.media_assets; r := r || E'
' || 'FAIL anon_select_owner_id_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS anon_select_owner_id_denied'; end;
  begin perform sha256 from public.media_assets; r := r || E'
' || 'FAIL anon_select_sha256_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS anon_select_sha256_denied'; end;
  select count(*) into n from public.posts;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' anon_sees_no_drafts n=' || n;
  begin insert into public.posts(slug,title,excerpt,category_id,author_user_id) values ('x-x','abc','abcdefghijk',cat,ua);
    r := r || E'
' || 'FAIL anon_insert_post_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS anon_insert_post_denied'; end;
  begin perform public.publish_post(pa); r := r || E'
' || 'FAIL anon_publish_rpc_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS anon_publish_rpc_denied'; end;
  begin select count(*) into n from public.audit_events; r := r || E'
' || 'FAIL anon_audit_readable';
  exception when insufficient_privilege then r := r || E'
' || 'PASS anon_audit_denied'; end;
  begin select count(*) into n from public.owner_accounts; r := r || E'
' || 'FAIL anon_owner_accounts_readable';
  exception when insufficient_privilege then r := r || E'
' || 'PASS anon_owner_accounts_denied'; end;
  reset role;

  -- ===== STRANGER (authenticated, not owner)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated')::text, true);
  select count(*) into n from public.posts;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' stranger_sees_no_drafts n=' || n;
  begin perform author_user_id from public.posts; r := r || E'
' || 'FAIL stranger_author_user_id_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS stranger_author_user_id_denied'; end;
  begin perform public.publish_post(pa); r := r || E'
' || 'FAIL stranger_publish_allowed';
  exception when others then r := r || E'
' || (case when sqlerrm = 'not_authorized' then 'PASS' else 'FAIL' end) || ' stranger_publish_rejected:' || sqlerrm; end;
  begin insert into public.posts(slug,title,excerpt,category_id,author_user_id) values ('str-str','abc','abcdefghijk',cat,us);
    r := r || E'
' || 'FAIL stranger_insert_post_allowed';
  exception when others then r := r || E'
' || 'PASS stranger_insert_post_rejected:' || sqlstate; end;
  select count(*) into n from public.owner_accounts;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' stranger_owner_accounts_rows=' || n;
  select count(*) into n from public.audit_events;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' stranger_audit_rows=' || n;
  reset role;

  -- ===== OWNER A: publish
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  select count(*) into n from public.posts where id = pa;
  r := r || E'
' || (case when n = 1 then 'PASS' else 'FAIL' end) || ' owner_sees_own_draft';
  begin perform owner_id from public.media_assets; r := r || E'
' || 'FAIL owner_owner_id_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS owner_owner_id_denied'; end;
  begin update public.posts set slug = 'hijack' where id = pa; r := r || E'
' || 'FAIL owner_slug_update_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS owner_slug_update_denied'; end;
  begin delete from public.posts where id = pa; r := r || E'
' || 'FAIL owner_hard_delete_allowed';
  exception when insufficient_privilege then r := r || E'
' || 'PASS owner_hard_delete_denied'; end;
  begin
    res := public.publish_post(pa);
    r := r || E'
' || (case when res.status = 'published' and res.slug like 'probe-%' then 'PASS' else 'FAIL' end) || ' owner_publish status=' || res.status;
  exception when others then r := r || E'
' || 'FAIL owner_publish:' || sqlerrm; end;
  reset role;

  -- anon / stranger after publish
  set local role anon; perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.posts;
  r := r || E'
' || (case when n = 1 then 'PASS' else 'FAIL' end) || ' anon_sees_published n=' || n;
  select count(*) into n from public.media_assets;
  r := r || E'
' || (case when n = 1 then 'PASS' else 'FAIL' end) || ' anon_sees_published_media n=' || n;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated')::text, true);
  select count(*) into n from public.posts;
  r := r || E'
' || (case when n = 1 then 'PASS' else 'FAIL' end) || ' stranger_sees_published n=' || n;
  reset role;

  -- ===== OWNER B (other active owner): cross-ownership
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  update public.posts set title = 'hijacked title' where id = pa; get diagnostics n = row_count;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' ownerB_update_foreign_rows=' || n;
  begin perform public.save_post_changes(pa, 'hijack title', 'hijack excerpt long', '[{"a":1}]', cat, ma);
    r := r || E'
' || 'FAIL ownerB_save_foreign_allowed';
  exception when others then r := r || E'
' || (case when sqlerrm in ('post_not_found','media_not_found') then 'PASS' else 'FAIL' end) || ' ownerB_save_foreign:' || sqlerrm; end;
  begin perform public.unpublish_post(pa); r := r || E'
' || 'FAIL ownerB_unpublish_foreign_allowed';
  exception when others then r := r || E'
' || (case when sqlerrm = 'post_not_found' then 'PASS' else 'FAIL' end) || ' ownerB_unpublish_foreign:' || sqlerrm; end;
  begin perform public.soft_delete_post(pa); r := r || E'
' || 'FAIL ownerB_delete_foreign_allowed';
  exception when others then r := r || E'
' || (case when sqlerrm = 'post_not_found' then 'PASS' else 'FAIL' end) || ' ownerB_delete_foreign:' || sqlerrm; end;
  update public.media_assets set state = 'draft' where id = ma; get diagnostics n = row_count;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' ownerB_update_foreign_media_rows=' || n;
  reset role;

  -- ===== OWNER A: edit / invariants / unpublish / republish / delete
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  begin
    res := public.save_post_changes(pa, 'Edited title', 'Edited excerpt long enough', '[{"type":"p","text":"y"}]', cat, ma);
    r := r || E'
' || 'PASS owner_edit slug_kept=' || (res.slug like 'probe-%');
  exception when others then r := r || E'
' || 'FAIL owner_edit:' || sqlerrm; end;
  begin perform public.save_post_changes(pa, 'Edited title', 'Edited excerpt long enough', '[]', cat, ma);
    r := r || E'
' || 'FAIL published_empty_body_allowed';
  exception when others then r := r || E'
' || (case when sqlerrm = 'body_required' then 'PASS' else 'FAIL' end) || ' published_empty_body:' || sqlerrm; end;
  begin perform public.save_post_changes(pa, 'Edited title', 'Edited excerpt long enough', '[{"a":1}]', cat, null);
    r := r || E'
' || 'FAIL published_no_hero_allowed';
  exception when others then r := r || E'
' || (case when sqlerrm = 'hero_media_required' then 'PASS' else 'FAIL' end) || ' published_no_hero:' || sqlerrm; end;
  begin update public.media_assets set state = 'draft' where id = ma; r := r || E'
' || 'FAIL in_use_media_unpublished';
  exception when others then r := r || E'
' || (case when sqlerrm = 'media_in_use_by_published_post' then 'PASS' else 'FAIL' end) || ' in_use_media_protected:' || sqlerrm; end;
  begin
    res := public.unpublish_post(pa);
    r := r || E'
' || (case when res.status = 'unpublished' then 'PASS' else 'FAIL' end) || ' owner_unpublish';
  exception when others then r := r || E'
' || 'FAIL owner_unpublish:' || sqlerrm; end;
  reset role;
  set local role anon; perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.posts;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' anon_sees_nothing_after_unpublish n=' || n;
  select count(*) into n from public.media_assets;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' anon_media_hidden_after_unpublish n=' || n;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  begin
    res := public.publish_post(pa);
    r := r || E'
' || (case when res.status = 'published' and res.published_at is not null then 'PASS' else 'FAIL' end) || ' owner_republish';
  exception when others then r := r || E'
' || 'FAIL owner_republish:' || sqlerrm; end;
  begin
    res := public.soft_delete_post(pa);
    r := r || E'
' || (case when res.status = 'deleted' then 'PASS' else 'FAIL' end) || ' owner_soft_delete';
  exception when others then r := r || E'
' || 'FAIL owner_soft_delete:' || sqlerrm; end;
  select count(*) into n from public.audit_events;
  r := r || E'
' || 'INFO owner_audit_rows=' || n;
  reset role;
  set local role anon; perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.posts;
  r := r || E'
' || (case when n = 0 then 'PASS' else 'FAIL' end) || ' anon_sees_nothing_after_delete n=' || n;
  reset role;

  raise exception 'PROBE_RESULT %', r;
end;
$$;
