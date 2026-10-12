# Fase 2.1 — relatório de segurança

## Resultado atual

**PARTIAL / NOT APPROVED FOR PRODUCTION.** O schema remoto e os advisors estão limpos, mas ainda não há conta owner nem teste autenticado de RLS e Storage.

## Controles implementados

- cadastro público não é usado pela aplicação;
- autorização baseada somente em `owner_accounts`, nunca `user_metadata` enviado pelo cliente;
- `getClaims()` valida a sessão SSR; cada mutação chama `requireEditor()`;
- RLS habilitado nas seis tabelas públicas;
- 19 policies após separar operações de categorias;
- functions editoriais são `SECURITY INVOKER`, com `search_path=''` e `EXECUTE` restrito a `authenticated`;
- `public.rls_auto_enable()` do provisionamento teve `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`;
- bucket privado, paths limitados ao UID, leitura pública somente se `media_assets.state='published'`;
- sem `service_role` no código da aplicação;
- inputs validados no servidor e constraints repetem invariantes no banco;
- publish/unpublish/delete são transacionais e produzem auditoria;
- SVG, HTML disfarçado, payload inválido, arquivo grande e decompression bomb são rejeitados;
- responses autenticadas recebem `Cache-Control: private, no-store` via proxy.

## Evidência remota de 2026-10-10

- projeto: `microcosmos`, ref `oetwoiuzoniwwtrdnohr`, região `sa-east-1`, Free/Nano;
- consulta de verificação: 6/6 tabelas com RLS, bucket `post-media` privado, 4 MB, `image/webp`, quatro categorias, zero posts publicados;
- Security Advisor: 0 errors, 0 warnings, 0 info;
- Performance Advisor: 0 errors, 0 warnings; sugestões restantes são índices ainda não usados em banco vazio.

## Bloqueios

- owner Auth não provisionada e não inserida na allowlist;
- public signup ainda precisa ser verificado/desabilitado no painel — alterar acesso exige confirmação explícita no momento da ação;
- testes reais como `anon`, `authenticated non-owner`, `owner` e sessão expirada ainda não executados;
- upload e revogação de signed URL ainda não exercitados com sessão real;
- o conector Supabase do Codex permaneceu desconectado (`USER_NOT_LOGGED_IN`); inspeção/aplicação ocorreu pelo dashboard autenticado.

## Ameaças tratadas

- BOLA/IDOR: owner + author predicates no banco e aplicação;
- escalação de role/owner: client input não define owner nem status published;
- draft leakage: consulta pública e Storage filtram estados;
- XSS: corpo é array de texto renderizado por React, não HTML arbitrário;
- path traversal/overwrite: UUIDs no servidor e `upsert:false`;
- inconsistência de publicação: RPC transacional;
- cache de sessão: rotas Auth/admin são dinâmicas e `private,no-store`.


## Atualização — Fase 2.1.1 (2026-10-11)

Achados comprovados em Postgres real e corrigidos: revalidação por slug do formulário, vazamento de `owner_id`/`author_user_id`/UUID em `object_key`, `permission denied` para anon, publicados sem capa derrubando o Diário. Ver [`phase211-local-verification.md`](phase211-local-verification.md). Itens remotos continuam não verificados.


## Phase 2.1.2 remote update (2026-10-11)

See `docs/phase212-remote-verification.md` §12. Free Plan, spend cap on and all add-ons disabled were confirmed in the dashboard; no billing change. `.env.local` configured with public URL and publishable key only. Remote Auth/RLS-session/Storage/E2E/browser QA remain NOT EXECUTED pending owner user creation (verdict PARTIAL). Public sign-ups are currently enabled; disable after the owner user exists.
