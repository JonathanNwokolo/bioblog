import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildCrosswalk } from "../src/lib/science/crosswalk.ts";
import {
  dpdxImages,
  dpdxOrganisms,
  gateImage,
  imagesForOrganism,
  type DpdxImage,
} from "../src/lib/science/dpdx/registry.ts";

const sample = (over: Partial<DpdxImage["rights"]> = {}, image: Partial<DpdxImage> = {}): DpdxImage => ({
  ...dpdxImages.find((i) => i.id === "giardia-cyst-iodine")!,
  ...image,
  rights: { ...dpdxImages.find((i) => i.id === "giardia-cyst-iodine")!.rights, ...over },
});

describe("CDC DPDx: portão de direitos por imagem", () => {
  it("AC-DPDX-01: imagens da mesma página recebem decisões independentes", () => {
    const giardia = imagesForOrganism("giardia-duodenalis");
    assert.deepEqual(giardia.shown.map((i) => i.id), ["giardia-cyst-iodine", "giardia-trophozoite-trichrome"]);
    assert.deepEqual(giardia.withheld.map((d) => [d.image.id, d.reason]), [["giardia-trophozoite-vermont", "IMAGE_PERMISSION_REQUIRED"]]);
    assert.equal(giardia.shown[0].sourcePageUrl, giardia.withheld[0].image.sourcePageUrl);
  });

  it("AC-DPDX-02: imagem exibida tem evidência, data, atribuição e URL no padrão do CDC", () => {
    for (const image of dpdxImages.filter((i) => gateImage(i).show)) {
      assert.equal(image.rights.status, "permitted");
      assert.equal(image.rights.thirdPartyCredit, null);
      assert.match(image.rights.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(image.rights.evidenceUrl, /^https:\/\/www\.cdc\.gov\/dpdx\/[a-z]+\/index\.html$/);
      assert.match(image.imageUrl ?? "", /^\/images\/dpdx\/[a-z0-9-]+\.jpg$/);
      assert.match(image.sourceImageUrl, /^https:\/\/www\.cdc\.gov\/dpdx\/[a-z]+\/images\/\d+\/[\w.-]+\.jpg$/);
      assert.match(image.rights.attributionText, /CDC/);
      assert.ok(image.captionEn.length > 10 && image.captionPt.length > 10);
    }
  });

  it("AC-DPDX-03: direitos ausentes ou conflitantes bloqueiam, falhando fechado", () => {
    assert.equal(gateImage(sample({ status: "unverified" })).show, false);
    assert.equal(gateImage(sample({ status: "permission_required" })).show, false);
    assert.equal(gateImage(sample({ status: "prohibited" })).show, false);
    assert.equal(gateImage(sample({ verifiedAt: "" })).show, false);
    assert.equal(gateImage(sample({ attributionText: "  " })).show, false);
    assert.equal(gateImage(sample({ evidenceUrl: "https://example.com/x.html" })).show, false);
    const blocked = gateImage(sample({ status: "unverified" }));
    assert.equal(!blocked.show && blocked.reason, "IMAGE_RIGHTS_UNVERIFIED");
  });

  it("AC-DPDX-04: crédito de terceiros vence a declaração geral da página", () => {
    const decision = gateImage(sample({ status: "permitted", thirdPartyCredit: "Algum Laboratório" }));
    assert.equal(decision.show, false);
    assert.equal(!decision.show && decision.reason, "IMAGE_PERMISSION_REQUIRED");
  });

  it("não exibe imagem cujo URL não segue o padrão do CDC DPDx (sem proxy de URL arbitrária)", () => {
    for (const imageUrl of [
      "https://evil.example/images/dpdx/a.jpg",
      "https://www.cdc.gov/dpdx/giardiasis/images/1/a.jpg",
      "/images/dpdx/a.svg",
      "/images/dpdx/../../secret.jpg",
      "//evil.example/images/dpdx/a.jpg",
      ["java", "script:alert(1)"].join(""),
      null,
    ]) {
      assert.equal(gateImage(sample({}, { imageUrl })).show, false, String(imageUrl));
    }
    for (const sourceImageUrl of ["https://evil.example/dpdx/g/images/1/a.jpg", "http://www.cdc.gov/dpdx/giardiasis/images/1/a.jpg"]) {
      assert.equal(gateImage(sample({}, { sourceImageUrl })).show, false, sourceImageUrl);
    }
  });

  it("toda imagem com crédito de terceiros na legenda está registrada como bloqueada", () => {
    const credited = dpdxImages.filter((i) => /contributed by|courtesy of/i.test(i.captionEn));
    assert.ok(credited.length >= 3);
    for (const image of credited) {
      assert.equal(gateImage(image).show, false, image.id);
      assert.ok(image.rights.thirdPartyCredit);
    }
  });

  it("cada organismo tem página de origem, ao menos duas imagens exibíveis e nome para busca", () => {
    for (const organism of dpdxOrganisms) {
      assert.match(organism.dpdxPageUrl, /^https:\/\/www\.cdc\.gov\/dpdx\//);
      assert.ok(imagesForOrganism(organism.slug).shown.length >= 2, organism.slug);
      assert.ok(organism.lookupName.length > 3);
    }
  });

  it("AC-DPDX-02: cópias locais existem, não foram alteradas e o manifesto bate com o registro", () => {
    const manifest = JSON.parse(readFileSync(new URL("../public/images/dpdx/MANIFEST.json", import.meta.url), "utf8")) as {
      files: Array<{ id: string; file: string; bytes: number; sha256: string; sourceUrl: string; modified: boolean }>;
    };
    const shown = dpdxImages.filter((i) => gateImage(i).show);
    assert.deepEqual(manifest.files.map((f) => f.id).sort(), shown.map((i) => i.id).sort());
    for (const entry of manifest.files) {
      const image = dpdxImages.find((i) => i.id === entry.id)!;
      const url = new URL(`../public${image.imageUrl}`, import.meta.url);
      assert.ok(existsSync(url), entry.file);
      const bytes = readFileSync(url);
      assert.equal(bytes.length, entry.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
      assert.equal(entry.sourceUrl, image.sourceImageUrl);
      assert.equal(entry.modified, false);
      assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], "JPEG");
    }
  });

  it("imagens retidas não têm arquivo local nem URL carregável", () => {
    for (const image of dpdxImages.filter((i) => !gateImage(i).show)) {
      assert.equal(image.imageUrl, null, image.id);
      assert.equal(existsSync(new URL(`../public/images/dpdx/${image.id}.jpg`, import.meta.url)), false, image.id);
    }
  });

  it("estágio diagnóstico é separado da espécie e anotações vêm da legenda", () => {
    for (const image of dpdxImages) {
      assert.ok(image.stage.pt && image.stage.en);
      for (const note of image.notes) {
        // Cada anotação cita o trecho literal da legenda de onde saiu.
        assert.ok(image.captionEn.includes(note.fromCaption), `${image.id}: nota fora da legenda`);
      }
    }
  });
});

describe("mapeamento entre fontes (crosswalk)", () => {
  const ncbi = { taxId: "5741", scientificName: "Giardia duodenalis", rank: "species", synonyms: ["Giardia lamblia"] };
  const gbif = { acceptedKey: 8562913, canonicalName: "Giardia duodenalis", acceptedName: "Giardia duodenalis", rank: "SPECIES", isSynonym: false };

  it("liga somente quando a identidade nominal confere", () => {
    const linked = buildCrosswalk(ncbi, gbif);
    assert.equal(linked.agreement, "name_match");
    assert.equal(linked.linked, true);
  });

  it("nomes diferentes sem sinonímia declarada não são ligados", () => {
    const result = buildCrosswalk(ncbi, { ...gbif, acceptedName: "Lamblia sp.", canonicalName: "Lamblia sp." });
    assert.equal(result.agreement, "name_conflict");
    assert.equal(result.linked, false);
  });

  it("sinônimo declarado pelo NCBI liga com confiança menor e evidência", () => {
    const result = buildCrosswalk(ncbi, { ...gbif, acceptedName: "Giardia lamblia", canonicalName: "Giardia lamblia" });
    assert.equal(result.agreement, "synonym_match");
    assert.equal(result.linked, true);
    assert.match(result.evidence[0], /sinônimo/);
  });

  it("mesmo nome em níveis diferentes não é ligado; fonte única não é ligada", () => {
    assert.equal(buildCrosswalk(ncbi, { ...gbif, rank: "GENUS" }).linked, false);
    assert.equal(buildCrosswalk(ncbi, null).agreement, "single_source");
    assert.equal(buildCrosswalk(null, gbif).linked, false);
  });

  it("nunca compara identificadores numéricos entre fontes", () => {
    const equalNumbers = buildCrosswalk({ ...ncbi, taxId: "8562913", scientificName: "Outra espécie", synonyms: [] }, gbif);
    assert.equal(equalNumbers.linked, false);
  });
});
