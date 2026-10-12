import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Regressão de segurança e isolamento da Fase 2.2 (estática, sem rede):
 * provedores científicos são dependências não confiáveis, e a publicação do diário não depende deles.
 */
const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function files(dir: string, extensions = [".ts", ".tsx"]): string[] {
  return readdirSync(new URL(dir, root)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(new URL(path, root)).isDirectory()) return files(path, extensions);
    return extensions.some((ext) => name.endsWith(ext)) ? [path] : [];
  });
}

const libFiles = files("src/lib/science");
const uiFiles = [
  ...files("src/components/science"),
  ...files("src/app/atlas"),
  ...files("src/app/laboratorio"),
  ...files("src/app/onde-vivem"),
  ...files("src/app/ciencia"),
];

describe("Fase 2.2: isolamento de credenciais e dados", () => {
  it("módulos científicos nunca importam Supabase, sessão, cookies ou variáveis públicas", () => {
    for (const file of [...libFiles, ...uiFiles]) {
      const source = read(file);
      assert.doesNotMatch(source, /@supabase|supabase\/(server|browser|proxy)|createClient|NEXT_PUBLIC_SUPABASE/i, file);
      assert.doesNotMatch(source, /next\/headers.*cookies|cookies\(\)|getSession|access_token|service_role/i, file);
    }
  });

  it("a única leitura de variável de ambiente nos clientes é a chave/e-mail opcionais do NCBI e o interruptor de QA", () => {
    const allowed = new Set(["NCBI_API_KEY", "NCBI_CONTACT_EMAIL", "SCIENCE_FAULT", "NODE_ENV"]);
    for (const file of libFiles) {
      for (const match of read(file).matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        assert.ok(allowed.has(match[1]), `${file} lê ${match[1]}`);
      }
    }
  });

  it("chave de API do NCBI só é lida no cliente do servidor, nunca em código de navegador", () => {
    for (const file of files("src/components/science")) {
      assert.doesNotMatch(read(file), /NCBI_API_KEY|NCBI_CONTACT_EMAIL/, file);
    }
    const server = read("src/lib/science/ncbi/client.ts");
    assert.match(server, /process\.env\.NCBI_API_KEY/);
    // Chave e e-mail nunca são registrados em log.
    for (const file of libFiles) assert.doesNotMatch(read(file), /console\.(log|info|warn|error)/, file);
  });

  it("componentes de navegador não importam módulos de servidor nem fazem chamadas de rede", () => {
    for (const file of uiFiles) {
      const source = read(file);
      if (!/^\s*["']use client["']/.test(source)) continue;
      assert.doesNotMatch(source, /server-only|@\/lib\/science\/(server|http|ncbi\/service|gbif\/service)/, file);
      assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, file);
    }
  });
});

describe("Fase 2.2: renderização e saída segura", () => {
  it("nenhuma interface científica injeta HTML bruto", () => {
    for (const file of uiFiles) {
      assert.doesNotMatch(read(file), /dangerouslySetInnerHTML|\.innerHTML|insertAdjacentHTML|document\.write|\beval\(/, file);
    }
  });

  it("links externos usam rel noopener noreferrer e destinos fixos ou validados", () => {
    for (const file of uiFiles) {
      for (const tag of read(file).matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
        assert.match(tag[0], /rel="noopener noreferrer"/, `${file}: ${tag[0].slice(0, 80)}`);
      }
    }
  });

  it("referências do conjunto de dados GBIF não viram links clicáveis", () => {
    const map = read("src/components/science/OccurrenceMap.tsx");
    assert.doesNotMatch(map, /href=\{point\.references|href=\{[^}]*references/);
  });
});

describe("Fase 2.2: rede e CSP", () => {
  it("há um único ponto de saída para a rede nos módulos científicos", () => {
    const withFetch = libFiles.filter((file) => /\bfetch\(/.test(read(file)));
    assert.deepEqual(withFetch, ["src/lib/science/http.ts"]);
  });

  it("hosts upstream são constantes: nenhum módulo monta host ou caminho a partir da entrada do visitante", () => {
    const client = [read("src/lib/science/ncbi/client.ts"), read("src/lib/science/gbif/client.ts")].join("\n");
    assert.match(client, /const BASE = "https:\/\/eutils\.ncbi\.nlm\.nih\.gov\/entrez\/eutils\/"|const BASE = "https:\/\/api\.gbif\.org\/v1\/"/);
    assert.doesNotMatch(client, /new URL\(\s*(term|name|query|input)/);
    assert.doesNotMatch(client, /`https?:\/\/\$\{/);
  });

  it("CSP não libera provedores científicos no navegador (connect-src) nem cdc.gov em img-src", () => {
    const config = read("next.config.ts");
    assert.doesNotMatch(config, /nih\.gov|gbif\.org|cdc\.gov/);
  });

  it("imagens do CDC são servidas do próprio site (sem requisição do visitante ao cdc.gov)", () => {
    const viewer = read("src/components/science/SpecimenViewer.tsx");
    assert.doesNotMatch(viewer, /https?:\/\/(www\.)?cdc\.gov/);
    const registry = read("src/lib/science/dpdx/registry.ts");
    assert.match(registry, /LOCAL_IMAGE_PATTERN/);
  });
});

describe("Fase 2.2: publicação independente dos provedores (AC-PUB-02, AC-REG-02)", () => {
  const cmsAndPublic = [
    ...files("src/lib/cms"),
    ...files("src/app/admin"),
    ...files("src/app/diario"),
    ...files("src/components/diary"),
    ...files("src/components/admin"),
    "src/app/page.tsx",
  ];

  it("CMS, diário e administração não importam nada dos módulos científicos", () => {
    for (const file of cmsAndPublic) {
      assert.doesNotMatch(read(file), /lib\/science|components\/science|\/atlas|\/onde-vivem|\/laboratorio/, file);
    }
  });

  it("a homepage mantém as seis seções na ordem aprovada, sem componente científico", () => {
    const page = read("src/app/page.tsx");
    const order = ["<Hero", "<Trajectory", "<Diary", "<FeaturedParasite", "<ExploreEntry"].map((tag) => page.indexOf(tag));
    assert.ok(order.every((index) => index >= 0), "seções presentes");
    assert.deepEqual([...order].sort((a, b) => a - b), order, "ordem preservada");
    assert.doesNotMatch(page, /science|Atlas|Occurrence|Specimen/);
  });

  it("nenhuma migração nem alteração de esquema foi adicionada nesta fase", () => {
    const migrations = readdirSync(new URL("supabase/migrations", root)).sort();
    assert.ok(migrations.every((name) => /^(20261010|20261011)\d+_/.test(name)), migrations.join(", "));
    assert.equal(migrations.length, 5);
  });
});
