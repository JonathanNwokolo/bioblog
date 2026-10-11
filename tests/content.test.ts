import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { featuredOrganism } from "../src/content/featured-organism.ts";
import { getPost, posts } from "../src/content/posts.ts";
import { primaryNav, site } from "../src/content/site.ts";
import { trajectory } from "../src/content/trajectory.ts";

const allItems = [
  ...trajectory.map((item) => ({ kind: "trajectory", item })),
  ...posts.map((item) => ({ kind: "post", item })),
  { kind: "featured", item: featuredOrganism },
];

describe("convenção de verificação (docs/content-placeholders.md)", () => {
  it("todo item é placeholder ou verified", () => {
    for (const { kind, item } of allItems) {
      assert.ok(
        item.status === "placeholder" || item.status === "verified",
        `${kind}: status inválido`,
      );
    }
  });

  it("item verified exige source; placeholder não pode declarar source", () => {
    for (const { kind, item } of allItems) {
      if (item.status === "verified") {
        assert.ok(item.source && item.source.trim().length > 0, `${kind}: verified sem source`);
      } else {
        assert.equal(item.source, null, `${kind}: placeholder com source`);
      }
    }
  });

  it("marcos da trajetória pendentes não carregam dados profissionais", () => {
    for (const entry of trajectory.filter((e) => e.status === "placeholder")) {
      assert.equal(entry.period, null);
      assert.equal(entry.title, null);
      assert.equal(entry.institution, null);
      assert.equal(entry.description, null);
    }
  });
});

describe("posts do diário", () => {
  it("slugs e ids são únicos e getPost resolve cada um", () => {
    assert.equal(new Set(posts.map((p) => p.slug)).size, posts.length);
    assert.equal(new Set(posts.map((p) => p.id)).size, posts.length);
    for (const post of posts) assert.equal(getPost(post.slug), post);
    assert.equal(getPost("nao-existe"), undefined);
  });

  it("cada post tem imagem com texto alternativo, data ISO e corpo", () => {
    for (const post of posts) {
      assert.ok(post.media.alt.length > 10, `${post.slug}: alt curto`);
      assert.match(post.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(post.body.length >= 1);
      assert.equal(post.baseLikes, 0, `${post.slug}: contagem base deve ser 0 sem backend`);
    }
  });

  it("o organismo em destaque aponta para um post existente", () => {
    assert.ok(getPost(featuredOrganism.relatedPostSlug), "post relacionado inexistente");
  });
});

describe("site", () => {
  it("não inventa contato: e-mail ausente é null", () => {
    assert.equal(site.email, null);
  });

  it("navegação usa âncoras absolutas da homepage", () => {
    for (const item of primaryNav) assert.match(item.href, /^\/#[a-z]+$/);
  });
});
