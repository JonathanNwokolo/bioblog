# Fase 2.1 — setup e operação

## Projeto remoto

- organização existente: `NWK Culture` (Free);
- projeto: `microcosmos`;
- ref: `oetwoiuzoniwwtrdnohr`;
- URL: `https://oetwoiuzoniwwtrdnohr.supabase.co`;
- região: São Paulo (`sa-east-1`);
- migration: `supabase/migrations/20261010233000_phase2_private_cms.sql`.

## Ambiente local

1. Copie `.env.example` para `.env.local`.
2. Use apenas Project URL e publishable key do projeto. Não use `service_role`.
3. Configure `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
4. Execute `npm install`, `npm test`, `npm run typecheck` e `npm run build`.
5. Execute `npm run dev` e abra `/admin/login`.

Nunca envie `.env.local`, senha, token, secret key ou e-mail pessoal ao Git.

## Provisionamento da proprietária

Bloqueado até a proprietária fornecer o e-mail que deve ser usado. Depois, com confirmação no momento da ação:

1. desabilitar public signup em Auth settings;
2. criar/convidar a conta da Ynara sem senha previsível;
3. obter o UUID do usuário sem registrar senha;
4. executar `insert into public.owner_accounts(user_id) values ('UUID');`;
5. ativar MFA TOTP quando disponível no plano e testar recuperação;
6. incluir URLs locais/deploy aprovadas nas redirect URLs.

O SMTP padrão do Supabase tem limites e pode restringir destinatários. Se o convite não puder ser entregue gratuitamente, parar e escolher com a proprietária um fluxo manual seguro; não contratar SMTP pago automaticamente.

## Migration e rollback

Para ambiente novo, aplique o arquivo SQL integral. Para ambiente já inicializado, compare schema antes de executar: o arquivo não é um script destrutivo de reset. Após qualquer alteração, rode Security e Performance Advisors.

Rollback de aplicação não apaga banco. Preserve posts e mídia; restaure versão anterior do app. Antes de alteração destrutiva, exporte tabelas e objetos separadamente.

## Backup/restore no Free

Backups automáticos/PITR não fazem parte do Free. Estabeleça export periódico manual do PostgreSQL e cópia dos objetos de Storage. Teste restauração antes de publicar conteúdo insubstituível. O backup do banco não inclui bytes do Storage.

## Deploy

Deploy não foi executado. Candidato: Netlify Free com hard limit de 300 créditos/mês. Configure env no painel do host, confirme build Node 22+, execute smoke tests e monitore créditos. Vercel Hobby só é aceitável após confirmar uso pessoal e não comercial.

## Limitações conhecidas

- likes e comentários permanecem locais ao navegador e devem ser apresentados assim;
- editor visual suporta parágrafos e prévia tipográfica, não HTML rico arbitrário;
- mídia substituída fica privada para recuperação; limpeza de órfãos é manual e aprovada;
- sem domínio próprio e sem SLA;
- projeto Free pode pausar por inatividade.



## Phase 2.1.2 remote update (2026-10-11)

See `docs/phase212-remote-verification.md` §12. Free Plan, spend cap on and all add-ons disabled were confirmed in the dashboard; no billing change. `.env.local` configured with public URL and publishable key only. Remote Auth/RLS-session/Storage/E2E/browser QA remain NOT EXECUTED pending owner user creation (verdict PARTIAL). Public sign-ups are currently enabled; disable after the owner user exists.
