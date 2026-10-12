// Captura respostas REAIS dos provedores para tests/fixtures/science (uso: node scripts/capture-science-fixtures.mjs).
// Diagnóstico/atualização manual: os testes automatizados leem só os arquivos gravados, sem rede.
import { mkdir, writeFile } from "node:fs/promises";

const E = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const G = "https://api.gbif.org/v1";
const out = new URL("../tests/fixtures/science/", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function save(dir, name, url, { json = true } = {}) {
  const res = await fetch(url, { headers: { "user-agent": "Microcosmos/2.2 fixture-capture" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  await mkdir(new URL(`${dir}/`, out), { recursive: true });
  const body = json ? JSON.stringify(JSON.parse(text), null, 2) : text;
  await writeFile(new URL(`${dir}/${name}`, out), body + "\n");
  console.log("saved", dir, name, text.length);
  return text;
}
const enc = encodeURIComponent;
const ncbi = async (name, path, json = true) => { const t = await save("ncbi", name, `${E}/${path}`, { json }); await sleep(450); return t; };

await ncbi("esearch-giardia-lamblia.json", `esearch.fcgi?db=taxonomy&retmode=json&retmax=10&term=${enc('"Giardia lamblia"[All Names]')}`);
await ncbi("esearch-giardia-genus.json", `esearch.fcgi?db=taxonomy&retmode=json&retmax=10&term=${enc('"Giardia"[All Names]')}`);
await ncbi("esummary-giardia-genus.json", `esummary.fcgi?db=taxonomy&retmode=json&id=2876047,5740`);
await ncbi("esearch-morganella.json", `esearch.fcgi?db=taxonomy&retmode=json&retmax=10&term=${enc('"Morganella"[All Names]')}`);
await ncbi("esummary-morganella.json", `esummary.fcgi?db=taxonomy&retmode=json&id=108061,90690,581`);
await ncbi("esearch-notfound.json", `esearch.fcgi?db=taxonomy&retmode=json&retmax=10&term=${enc('"Xyzzyfoo bar"[All Names]')}`);
await ncbi("esearch-prefix-giardia-lam.json", `esearch.fcgi?db=taxonomy&retmode=json&retmax=8&term=${enc("Giardia lam*[All Names]")}`);
await ncbi("esummary-5741.json", `esummary.fcgi?db=taxonomy&retmode=json&id=5741`);
await ncbi("efetch-5741.xml", `efetch.fcgi?db=taxonomy&retmode=xml&id=5741`, false);
await ncbi("efetch-5833.xml", `efetch.fcgi?db=taxonomy&retmode=xml&id=5833`, false);
await ncbi("esummary-error.json", `esummary.fcgi?db=taxonomy&retmode=json&id=99999999999`);
await ncbi("efetch-empty.xml", `efetch.fcgi?db=taxonomy&retmode=xml&id=99999999999`, false);
const sub = JSON.parse(await ncbi("esearch-subtree-5740-species.json", `esearch.fcgi?db=taxonomy&retmode=json&retmax=40&term=${enc("txid5740[Subtree] AND species[Rank]")}`));
await ncbi("esummary-subtree-5740.json", `esummary.fcgi?db=taxonomy&retmode=json&id=${sub.esearchresult.idlist.join(",")}`);

const gbif = async (name, path) => save("gbif", name, `${G}/${path}`);
await gbif("match-giardia-lamblia.json", `species/match?name=${enc("Giardia lamblia")}`);
await gbif("match-giardia-duodenalis.json", `species/match?name=${enc("Giardia duodenalis")}`);
await gbif("match-plasmodium-falciparum.json", `species/match?name=${enc("Plasmodium falciparum")}`);
await gbif("match-plasmodium-vivax.json", `species/match?name=${enc("Plasmodium vivax")}`);
await gbif("match-trichomonas-vaginalis.json", `species/match?name=${enc("Trichomonas vaginalis")}`);
await gbif("match-morganella.json", `species/match?name=${enc("Morganella")}`);
await gbif("match-fuzzy.json", `species/match?name=${enc("Giardia duodenallis")}`);
await gbif("match-family.json", `species/match?name=${enc("Hexamitidae")}`);
await gbif("occurrence-tcruzi-head.json", `occurrence/search?taxonKey=8205154&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&limit=0&facet=COUNTRY&facet=LICENSE&facet=BASIS_OF_RECORD&facet=DATASET_KEY&facetLimit=12`);
await gbif("occurrence-tcruzi-40.json", `occurrence/search?taxonKey=8205154&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&limit=40&offset=700`);
await gbif("occurrence-naegleria-fowleri.json", `occurrence/search?taxonKey=3210448&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&limit=300`);
await gbif("dataset-insdc-host.json", `dataset/393b8c26-e4e0-4dd0-a218-93fc074ebf4e`);
console.log("done", new Date().toISOString());
