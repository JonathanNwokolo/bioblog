import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addComment,
  getEngagement,
  likeCount,
  MAX_COMMENT_LENGTH,
  parseEngagement,
  removeComment,
  toggleLike,
  validateComment,
} from "../src/lib/engagement.ts";

describe("engagement", () => {
  it("começa vazio e sem curtida", () => {
    const e = getEngagement({}, "post");
    assert.equal(e.liked, false);
    assert.deepEqual(e.comments, []);
  });

  it("alterna a curtida sem mutar o mapa anterior", () => {
    const a = {};
    const b = toggleLike(a, "post");
    const c = toggleLike(b, "post");
    assert.deepEqual(a, {});
    assert.equal(getEngagement(b, "post").liked, true);
    assert.equal(getEngagement(c, "post").liked, false);
  });

  it("soma a curtida local à contagem base", () => {
    assert.equal(likeCount(0, { liked: false, comments: [] }), 0);
    assert.equal(likeCount(0, { liked: true, comments: [] }), 1);
    assert.equal(likeCount(5, { liked: true, comments: [] }), 6);
  });

  it("valida comentários vazios e longos demais", () => {
    assert.deepEqual(validateComment({ author: "", text: "   " }), { ok: false, reason: "empty" });
    assert.deepEqual(validateComment({ author: "", text: "x".repeat(MAX_COMMENT_LENGTH + 1) }), {
      ok: false,
      reason: "too-long",
    });
    const ok = validateComment({ author: "  Ana ", text: " Olá " });
    assert.deepEqual(ok, { ok: true, author: "Ana", text: "Olá" });
  });

  it("adiciona e remove comentários por id", () => {
    const withOne = addComment({}, "post", {
      id: "c1",
      author: "Ana",
      text: "Olá",
      createdAt: "2026-10-10T12:00:00.000Z",
    });
    const withTwo = addComment(withOne, "post", {
      id: "c2",
      author: "",
      text: "Segundo",
      createdAt: "2026-10-10T12:01:00.000Z",
    });
    assert.equal(getEngagement(withTwo, "post").comments.length, 2);
    const removed = removeComment(withTwo, "post", "c1");
    assert.deepEqual(
      getEngagement(removed, "post").comments.map((c) => c.id),
      ["c2"],
    );
    assert.equal(getEngagement(withTwo, "post").comments.length, 2);
  });

  it("tolera JSON inválido ou fora do formato", () => {
    assert.deepEqual(parseEngagement(null), {});
    assert.deepEqual(parseEngagement("{nao é json"), {});
    assert.deepEqual(parseEngagement("[1,2]"), {});
    const parsed = parseEngagement(
      JSON.stringify({
        ok: { liked: true, comments: [{ id: "1", author: "A", text: "t", createdAt: "x" }, { id: 2 }] },
        ruim: 7,
      }),
    );
    assert.equal(parsed.ok.liked, true);
    assert.equal(parsed.ok.comments.length, 1);
    assert.equal("ruim" in parsed, false);
  });
});
