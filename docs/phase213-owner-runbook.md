# Runbook do proprietário — fechamento remoto da Fase 2.1.x

Projeto: **microcosmos** (`oetwoiuzoniwwtrdnohr`, org NWK Culture, Free). Nunca executar nada disto em `nwk-culture-production`.
Execute **em ordem**, na raiz do repositório. Nenhuma senha vai para o chat nem para o Git.

## 0. Antes de tudo (1 min)
1. Dashboard → confirme que o cabeçalho diz `microcosmos`.
2. `npx supabase@2.120.0 migration list --linked` → 5 linhas com local = remoto.
3. `npx supabase@2.120.0 projects list` → o projeto `microcosmos` aparece como `linked: true`.

## 1. Limpeza dos dados de teste da Fase 2.1.2 (exclusão permanente — só você)
Manifesto: `docs/evidence/phase213/cleanup-manifest.json`.
```bash
npx supabase@2.120.0 storage rm --linked --experimental "ss:///post-media/64735f74-5c82-41fa-a001-406813663c6b/c786d6c9-b51b-46f4-87cd-99c4a02625f3.webp" "ss:///post-media/f65424d0-c1b5-469a-b578-b6183d919d96/934f9a6e-dff2-4013-bcc7-b255f36610ce.webp"
npx supabase@2.120.0 db query --linked -f scripts/ops/cleanup-phase212-test-data.sql
npx supabase@2.120.0 db query --linked -f scripts/ops/verify-phase212-cleanup.sql
```
Sucesso: 2º comando → `guard_matching_rows 2, posts_deleted 2, media_deleted 2`; 3º → `posts 0, media 0, revisions 0, storage_objects 0, audit_events 14, users 1, owners 1, categories 4`. Se `guard_matching_rows` ≠ 2, **nada foi apagado**: pare e avise.

## 2. Conta não-owner temporária (criar conta é ação só sua)
1. Dashboard → Authentication → Users → *Add user* → *Create new user*: e-mail descartável (ex.: `nonowner-temp@…`), senha forte gerada, **Auto Confirm User**. Não adicione a `owner_accounts`.
2. Mantenha "Allow new users to sign up" **desligado**.

## 3. Verificação remota real
Build e servidor apontando para o remoto (usa `.env.local`):
```bash
npm run build
npm start        # porta 3000; deixe rodando em outro terminal
```
Em outro terminal (substitua os valores; PowerShell: `$env:NOME="valor"`):
```bash
TARGET=remote ALLOW_REMOTE=oetwoiuzoniwwtrdnohr NONOWNER_EMAIL=<email> NONOWNER_PASSWORD=<senha> APP_URL=http://localhost:3000 node scripts/verify-phase213-auth.mjs
node scripts/verify-phase213-anon-remote.mjs
npx supabase@2.120.0 db advisors --linked --type all --level warn
```
Esperado: `N/N PASS` nos dois scripts (resultados em `docs/evidence/phase213/auth-probe-remote.json` e `anon-probe-remote.json`); advisors: apenas os WARN já conhecidos (leaked password — plano pago; 2× `multiple_permissive_policies`). Nenhum dado é criado.
Depois: Dashboard → Users → exclua a conta temporária; `auth.users` volta a 1.

## 4. MFA (TOTP) — **depende de desenvolvimento, não só de configuração**
O CMS atual **não tem** telas de cadastro/desafio de TOTP e as políticas RLS não exigem `aal2`. Ativar MFA no painel isoladamente não protege nada. Opções: (a) aceitar o risco com senha longa e única + cadastro fechado (estado atual), ou (b) aprovar uma fase pequena "MFA do proprietário" (enroll/challenge + exigir `aal2` em `is_active_owner()`/RLS). **Não declarado como feito.**
Verifique também Authentication → URL Configuration: *Site URL* e *Redirect URLs* só com o domínio real (hoje `localhost`).

## 5. Smoke test remoto com o código novo
Com `npm start` rodando (passo 3):
1. `http://localhost:3000/admin` → entrar com **sua** conta (você digita a senha).
2. Novo rascunho com título **`SMOKE teste`** (prefixo obrigatório), resumo e conteúdo; Categoria qualquer.
3. Enviar imagem pequena com texto alternativo; salvar; abrir *Prévia privada*.
4. Publicar → abrir `http://localhost:3000/diario` e o artigo (devem aparecer sem rebuild).
5. Retirar do ar → o artigo deve dar 404 na hora; Publicar de novo; **Excluir** (digite `EXCLUIR`).
6. Painel → *Remover imagens sem uso* (só atua em imagens com mais de 1 h; volte depois) — apaga o arquivo do Storage pela API.
7. Limpeza das linhas: `npx supabase@2.120.0 db query --linked -f scripts/ops/cleanup-smoke-test.sql` → `posts_deleted 1`.
8. `scripts/ops/verify-phase212-cleanup.sql` → `posts 0, media 0, storage_objects 0`.
9. Sair (logout) e confirmar que `/admin` volta ao login.

## 6. Encerramento
Pare `npm start`. Informe os resultados dos passos 1, 3 e 5. Só então a Fase 2.1.2 pode ser reclassificada para PASS e o lançamento controlado reavaliado.

## Quem faz o quê
| Passo | Agente (sem nova autorização) | Depende de você |
| --- | --- | --- |
| Testes, lint, typecheck, build, E2E, sondas **locais** (Docker/Supabase local) | ✔ | — |
| Sondas **remotas somente leitura** (anônimas, advisors, `migration list`, contagens) | ✔ | — |
| Preparar scripts, SQL protegido, manifesto, documentação | ✔ | — |
| Exclusão permanente remota (storage + linhas) | ✘ | ✔ passo 1 e 5.7 |
| Criar/excluir conta de teste no Auth | ✘ | ✔ passos 2 e 3 |
| Executar a sonda de não-owner remota | ✘ (precisa da senha da conta) | ✔ passo 3 |
| Digitar senha/entrar no CMS remoto | ✘ | ✔ passo 5 |
| MFA / URLs de redirecionamento / plano | ✘ | ✔ passo 4 |
| Commit, push, deploy, mudança de plano | ✘ (não solicitado) | ✔ quando decidir |
