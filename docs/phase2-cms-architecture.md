# Fase 2.1 — arquitetura do CMS privado

## Estado

Implementação local concluída e schema aplicado ao projeto Supabase Free `microcosmos` (`oetwoiuzoniwwtrdnohr`, São Paulo). A publicação real ainda depende de conta owner, configuração local segura e QA autenticado.

## Fluxo

1. `/admin/login` autentica por Supabase Auth em cookie SSR.
2. Cada página, action e rota administrativa consulta `owner_accounts.active`; sessão sem allowlist não autoriza nada.
3. A autora cria um rascunho com título, resumo, categoria e parágrafos.
4. O upload autenticado valida assinatura, decodificação e dimensões; converte para WebP e grava no bucket privado `post-media`.
5. A prévia permanece protegida por sessão e URL assinada de 60 segundos.
6. `publish_post()` valida owner, corpo e imagem e altera post/mídia na mesma transação.
7. A homepage, `/diario` e `/diario/[slug]` consultam somente `published`, ordenados por `published_at DESC, id DESC`.
8. Actions invalidam tag `posts` e os paths públicos; há revalidação defensiva de 5 minutos.

## Modelo de dados

- `owner_accounts`: allowlist de IDs do Supabase Auth;
- `categories`: categorias editoriais ativas;
- `media_assets`: metadados, hash, owner, estado e object path aleatório;
- `posts`: slug estável, corpo JSON de parágrafos, estado e timestamps editoriais;
- `post_revisions`: snapshot antes de alteração editorial;
- `audit_events`: publish, unpublish e delete sem corpo privado ou segredo.

Estados: `draft → published ↔ unpublished → deleted`. Delete é lógico. Republicar preserva `first_published_at`/`published_at`, portanto uma correção antiga não toma o destaque.

## Cache e publicação sem rebuild

Consultas públicas usam `unstable_cache` com tag `posts` e revalidação de 300 segundos. Publish, unpublish, edit de post publicado e delete chamam `revalidateTag("posts", "max")` e `revalidatePath`. A rota de artigo não usa `generateStaticParams`; novos slugs funcionam sem novo build.

## Mídia

O bucket é privado. Upload aceita conteúdo JPEG/PNG/WebP, nunca SVG/HTML, valida magic bytes e decodifica com `sharp`, limita 40 MP de entrada, redimensiona para 2000×2000 e grava WebP de até 4 MB em `<auth.uid>/<uuid>.webp`. Nomes do cliente não entram no path. Draft usa URL assinada curta; mídia publicada é resolvida por rota que verifica o estado antes de emitir URL assinada de cinco minutos.

Troca de imagem mantém o ativo antigo privado para recuperação; limpeza de órfãos é uma operação posterior, medida e aprovada. Objetos referenciados por publicação não são apagados automaticamente.

## Rollback

1. Reverter a aplicação para a versão estática anterior sem remover dados.
2. Manter schema e Storage intactos durante investigação.
3. Restaurar conteúdo a partir de export SQL e export separado dos objetos do Storage; backups do banco não contêm os bytes do Storage.
4. Qualquer drop/purge exige backup e autorização explícita.

