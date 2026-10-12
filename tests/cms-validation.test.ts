import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyToJson, hasAllowedImageSignature, postInputSchema, slugifyTitle } from "../src/lib/cms/validation.ts";

describe("validação do CMS", () => {
  it("normaliza slug sem perder estabilidade lexical", () => {
    assert.equal(slugifyTitle("Giárdia: além das lentes!"), "giardia-alem-das-lentes");
  });

  it("converte somente parágrafos não vazios", () => {
    assert.deepEqual(bodyToJson(" Primeiro. \n\n\n Segundo   parágrafo. "), ["Primeiro.", "Segundo parágrafo."]);
  });

  it("rejeita corpo e categoria inválidos", () => {
    const parsed = postInputSchema.safeParse({ title: "Ok", excerpt: "curto", body: "", categoryId: "forjado" });
    assert.equal(parsed.success, false);
  });

  it("aceita assinaturas JPEG, PNG e WebP e rejeita HTML renomeado", () => {
    assert.equal(hasAllowedImageSignature(Uint8Array.from([0xff, 0xd8, 0xff])), true);
    assert.equal(hasAllowedImageSignature(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), true);
    assert.equal(hasAllowedImageSignature(new TextEncoder().encode("RIFF0000WEBP")), true);
    assert.equal(hasAllowedImageSignature(new TextEncoder().encode("<svg onload=alert(1)>")), false);
  });
});
