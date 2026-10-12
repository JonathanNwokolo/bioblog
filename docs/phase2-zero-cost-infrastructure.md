# Fase 2.1 — infraestrutura de custo zero

**Data da verificação:** 2026-10-10  
**Restrição:** R$ 0; nenhum trial é tratado como plano permanente; nenhum upgrade, add-on, domínio ou cobrança foi autorizado.

## Serviços adotados

| Serviço | Uso | Elegibilidade gratuita | Decisão |
|---|---|---|---|
| Supabase Free | PostgreSQL, Auth e Storage | 2 projetos gratuitos por proprietário/admin; o projeto `microcosmos` é o segundo projeto da organização Free existente | Adotado |
| Next.js 16.4 | aplicação, cache e rotas servidor | software open source | Adotado |
| `sharp` | validação, redimensionamento e conversão local para WebP | Apache-2.0 | Adotado; evita Image Transformations pagas do Supabase |
| Netlify Free | candidato principal de hosting | US$ 0, 300 créditos/mês, limite rígido e sem auto recharge no Free | Compatível para blog pequeno; deploy não executado |
| Vercel Hobby | alternativa para projeto pessoal | gratuito, mas limitado a uso pessoal e não comercial | Somente se a proprietária confirmar caráter pessoal e não comercial |

## Limites relevantes do Supabase Free

Fonte vigente: [Supabase — billing](https://supabase.com/docs/guides/platform/billing-on-supabase) e [pricing](https://supabase.com/pricing).

- banco: 500 MB por projeto; acima disso o Free entra em modo somente leitura;
- Storage: 1 GB;
- egress: 5 GB/mês;
- Auth: 50.000 usuários ativos mensais;
- Edge Functions: 500.000 invocações/mês, não usadas nesta fase;
- tamanho global máximo de arquivo: 50 MB no Free; o bucket deste projeto é deliberadamente limitado a 4 MB;
- Image Transformations do Supabase: indisponíveis no Free e não usadas;
- backups automáticos e PITR: não incluídos no Free.

O projeto usa entrada máxima de 6 MB na aplicação, decodifica o conteúdo real, limita a 40 MP, remove orientação implícita, redimensiona para no máximo 2000×2000 e grava somente WebP de até 4 MB. Não armazena variantes redundantes.

## Estimativa para blog científico pessoal pequeno

Estimativa, não medição de produção:

- 100 posts × 40 KB de texto/metadados: cerca de 4 MB de banco, sem contar índices e overhead;
- 100 imagens × 700 KB após otimização: cerca de 70 MB de Storage;
- 2.000 visitas/mês × 1,5 MB transferidos por visita: cerca de 3 GB de egress;
- uma autora ativa: 1 MAU de Auth;
- sem polling, Realtime, cron ou Edge Functions.

O perfil cabe nos limites atuais com margem, mas uma imagem viral ou tráfego acima da estimativa pode esgotar egress. O produto não promete disponibilidade, tráfego ou armazenamento ilimitados.

## Pausa e inatividade

Segundo [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing), projetos Free com baixa atividade durante sete dias podem ser pausados. Algumas consultas diárias normalmente evitam a pausa, mas não constituem garantia. Um projeto pausado pode ser restaurado pelo painel por até um ano. A primeira visita após uma pausa pode falhar até a restauração; não será criado tráfego artificial para contornar a política.

## Hosting gratuito

### Netlify Free — recomendação condicional

A página oficial de [preços do Netlify](https://www.netlify.com/pricing/) declara US$ 0 permanente, 300 créditos/mês e limite rígido que pausa os projetos sem gerar cobrança. O adapter oficial suporta Next.js; o build local do Next.js 16.4 passou. Cada deploy de produção consome créditos, assim como compute, bandwidth e requests. Para um blog pequeno e poucos deploys, é uma opção plausível, mas o consumo real precisa ser acompanhado. Quando os créditos acabam, todos os projetos da conta podem pausar até o próximo ciclo.

### Vercel Hobby — alternativa restrita

O [Vercel Hobby](https://vercel.com/docs/plans/hobby) é gratuito e pausa ao exceder limites, mas a política oficial restringe o plano a uso pessoal e não comercial. Sem confirmação desse enquadramento, ele não é escolhido como solução de produção.

## Riscos e alternativas gratuitas

- **Storage/egress:** comprimir mais agressivamente e limitar uploads; exportar mídia antiga para arquivo local antes de excluir, mediante aprovação.
- **Banco:** remover payloads redundantes e manter apenas conteúdo editorial necessário; não armazenar respostas científicas externas nesta fase.
- **Pausa:** restauração manual gratuita; para conteúdo somente leitura, uma exportação estática pode ser alternativa futura, mas reduziria publicação imediata.
- **Hosting:** Netlify Free com hard limit; Vercel Hobby somente se o uso for pessoal/não comercial; auto-hospedagem local não é tratada como disponibilidade pública.
- **E-mail:** usar apenas o provedor embutido do Supabase dentro dos limites/restrições. Nenhum SMTP pago foi adicionado.

## Ações que poderiam gerar cobrança

- upgrade de organização/projeto para Pro/Team;
- desabilitar spend cap em plano pago;
- adicionar compute, réplica, PITR, domínio customizado Supabase ou IPv4 dedicado;
- ativar Image Transformations do Supabase;
- habilitar auto recharge ou migrar para plano pago no host;
- comprar domínio;
- contratar SMTP, CMS ou API pagos.

**Confirmação:** nenhum serviço pago, trial, add-on, pay-as-you-go, domínio ou cobrança foi ativado. O projeto remoto `microcosmos` usa o plano Supabase Free e compute Nano.



## Phase 2.1.2 remote update (2026-10-11)

See `docs/phase212-remote-verification.md` §12. Free Plan, spend cap on and all add-ons disabled were confirmed in the dashboard; no billing change. `.env.local` configured with public URL and publishable key only. Remote Auth/RLS-session/Storage/E2E/browser QA remain NOT EXECUTED pending owner user creation (verdict PARTIAL). Public sign-ups are currently enabled; disable after the owner user exists.
