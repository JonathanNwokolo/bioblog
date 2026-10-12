// Importa as micrografias do CDC DPDx revisadas e aprovadas (src/lib/science/dpdx/registry.ts) para
// public/images/dpdx, SEM alteração dos bytes, e grava um manifesto com SHA-256 e procedência.
//
// Entrada: um JSON {"<caminho DPDx>": {status, type, length, lastModified, b64}} gerado ao buscar as
// imagens numa sessão normal de navegador na origem www.cdc.gov (os dados são tratados como não
// confiáveis: o script só aceita JPEG com assinatura válida e tamanho limitado).
// Uso: node scripts/import-dpdx-images.mjs <entrada.json>
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("uso: node scripts/import-dpdx-images.mjs <entrada.json>");

/** caminho no cdc.gov → id do registro (registry.ts). Só estes arquivos são aceitos. */
const WANTED = {
  "giardiasis/images/1/Giardia_cyst_wtmt.jpg": "giardia-cyst-iodine",
  "giardiasis/images/5/Giardia_troph_tric.jpg": "giardia-trophozoite-trichrome",
  "malaria/images/1/Pf_rings_thinA.jpg": "pfalciparum-rings-thin",
  "malaria/images/4/Pf_gametocyte_thinB.jpg": "pfalciparum-gametocyte-thin",
  "trypanosomiasisamerican/images/2/Tcruzi_thin_giemsa.jpg": "tcruzi-trypomastigote-giemsa",
  "trypanosomiasisamerican/images/5/Tcruzi_tissue_he.jpg": "tcruzi-amastigotes-heart",
  "amebiasis/images/2/Ehistdisp_cyst_tric.jpg": "ehistolytica-cyst-trichrome",
  "amebiasis/images/6/Ehisto_troph_tric3.jpg": "ehistolytica-trophozoite-trichrome",
};

let data = JSON.parse(readFileSync(input, "utf8"));
// A ferramenta de navegador grava o resultado como string JSON: aceita as duas formas.
if (typeof data === "string") data = JSON.parse(data);
const outDir = new URL("../public/images/dpdx/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const manifest = [];
for (const [path, id] of Object.entries(WANTED)) {
  const entry = data[path];
  if (!entry || entry.status !== 200 || !/^image\/jpeg/i.test(entry.type ?? "")) throw new Error(`resposta inválida: ${path}`);
  const bytes = Buffer.from(entry.b64, "base64");
  if (bytes.length !== entry.length || bytes.length < 1000 || bytes.length > 400_000) throw new Error(`tamanho inesperado: ${path}`);
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new Error(`não é JPEG: ${path}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(new URL(`${id}.jpg`, outDir), bytes);
  manifest.push({
    id,
    file: `${id}.jpg`,
    bytes: bytes.length,
    sha256,
    sourceUrl: `https://www.cdc.gov/dpdx/${path}`,
    retrievedAt: "2026-10-11",
    upstreamLastModified: entry.lastModified ?? null,
    modified: false,
  });
  console.log(id, bytes.length, sha256.slice(0, 12));
}
writeFileSync(
  new URL("MANIFEST.json", outDir),
  JSON.stringify(
    {
      note: "Cópias sem alteração de micrografias do CDC DPDx (Division of Parasitic Diseases and Malaria). Fonte: CDC. Uso sem implicar endosso do CDC/HHS. Base de uso e legendas: src/lib/science/dpdx/registry.ts.",
      files: manifest,
    },
    null,
    2,
  ) + "\n",
);
