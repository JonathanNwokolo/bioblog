import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { posts, sortPublished, splitDiary } from "../src/content/posts.ts";
import type { Post } from "../src/content/types.ts";

function make(id: string, publishedAt: string, extra: Partial<Post> = {}): Post {
  return {
    id,
    slug: `slug-${id}`,
    status: "placeholder",
    source: null,
    title: `Post ${id}`,
    excerpt: "Resumo.",
    body: ["Corpo."],
    publishedAt,
    tag: { label: "Teste" },
    media: { kind: "illustration", specimen: "egg", alt: "Ilustração de teste.", credit: "Teste" },
    baseLikes: 0,
    ...extra,
  };
}

describe("feed do Diário de Bancada", () => {
  it("ordena do mais recente ao mais antigo, independente da ordem de entrada", () => {
    const input = [make("a", "2026-01-02"), make("b", "2026-03-01"), make("c", "2026-02-10")];
    assert.deepEqual(
      sortPublished(input).map((p) => p.id),
      ["b", "c", "a"],
    );
  });

  it("desempata de forma determinística (data, depois id numérico, depois slug)", () => {
    const input = [make("post-9", "2026-05-05"), make("post-10", "2026-05-05")];
    const forward = sortPublished(input).map((p) => p.id);
    const reversed = sortPublished([...input].reverse()).map((p) => p.id);
    assert.deepEqual(forward, ["post-10", "post-9"]);
    assert.deepEqual(reversed, forward);
  });

  it("horário desempata posts do mesmo dia", () => {
    const input = [make("a", "2026-05-05"), make("b", "2026-05-05T09:30")];
    assert.equal(splitDiary(input).lead?.id, "b");
  });

  it("a publicação mais recente é o destaque e as demais vão para o feed, sem repetição", () => {
    const input = Array.from({ length: 12 }, (_, i) =>
      make(`p${String(i).padStart(2, "0")}`, `2026-02-${String(i + 1).padStart(2, "0")}`),
    );
    const { lead, archive } = splitDiary(input);
    assert.equal(lead?.id, "p11");
    assert.equal(archive.length, 11, "nenhum post pode sumir por limite de itens");
    assert.ok(!archive.some((p) => p.id === lead?.id));
    assert.equal(new Set(archive.map((p) => p.id)).size, archive.length);
  });

  it("nova publicação assume o destaque e o anterior vai ao topo do feed", () => {
    const before = [make("a", "2026-01-01"), make("b", "2026-01-02")];
    const after = [...before, make("c", "2026-01-03")];
    assert.equal(splitDiary(before).lead?.id, "b");
    const split = splitDiary(after);
    assert.equal(split.lead?.id, "c");
    assert.equal(split.archive[0].id, "b");
  });

  it("rascunhos não entram no feed", () => {
    const input = [make("a", "2026-01-01"), make("d", "2026-09-09", { publication: "draft" })];
    const { lead, archive } = splitDiary(input);
    assert.equal(lead?.id, "a");
    assert.equal(archive.length, 0);
  });

  it("trata zero, uma e várias publicações", () => {
    assert.deepEqual(splitDiary([]), { lead: null, archive: [] });
    const one = splitDiary([make("a", "2026-01-01")]);
    assert.equal(one.lead?.id, "a");
    assert.deepEqual(one.archive, []);
  });

  it("ids repetidos na coleção não duplicam o artigo", () => {
    const input = [make("a", "2026-01-01"), make("a", "2026-01-01")];
    assert.equal(sortPublished(input).length, 1);
  });

  it("`posts` exportado já vem ordenado", () => {
    const dates = posts.map((p) => p.publishedAt);
    assert.deepEqual(dates, [...dates].sort().reverse());
  });
});
