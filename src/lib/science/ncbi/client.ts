import { z } from "zod";
import { buildProviderUrl, providerGetJson, providerGetText } from "../http.ts";
import { ProviderError } from "../types.ts";
import { child, childrenNamed, parseXml, textOf, XmlParseError, type XmlNode } from "./xml.ts";
import type { LineageNode, TaxonRecord, TaxonSummary } from "./types.ts";

/**
 * Cliente das E-utilities do NCBI (db=taxonomy). Endpoints reais usados:
 *   esearch.fcgi  → lista de TaxIDs (JSON)
 *   esummary.fcgi → resumo por TaxID (JSON)
 *   efetch.fcgi   → registro completo com linhagem e sinônimos (XML; o único formato disponível)
 * Sem chave de API: o limite é 3 req/s (cabeçalho X-RateLimit-Limit observado). Chave e e-mail de
 * contato, se configurados no servidor, são anexados aqui e nunca chegam ao navegador.
 */
const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
const TAXID = /^[1-9]\d{0,9}$/;

export function isTaxId(value: string): boolean {
  return TAXID.test(value);
}

function common(): Record<string, string | undefined> {
  const apiKey = process.env.NCBI_API_KEY?.trim();
  const email = process.env.NCBI_CONTACT_EMAIL?.trim();
  return {
    db: "taxonomy",
    tool: "microcosmos-site",
    email: email || undefined,
    api_key: apiKey || undefined,
  };
}

const esearchSchema = z.object({
  esearchresult: z.object({
    count: z.string().regex(/^\d+$/),
    idlist: z.array(z.string().regex(TAXID)).max(500),
    errorlist: z.unknown().optional(),
  }),
});

export interface ESearchResult {
  count: number;
  ids: string[];
}

export async function esearchTaxonomy(term: string, retmax: number): Promise<ESearchResult> {
  const url = buildProviderUrl("ncbi-taxonomy", `${BASE}esearch.fcgi`, {
    ...common(),
    term,
    retmode: "json",
    retmax: Math.min(Math.max(retmax, 1), 100),
  });
  const parsed = esearchSchema.safeParse(await providerGetJson("ncbi-taxonomy", url));
  if (!parsed.success) throw new ProviderError("ncbi-taxonomy", "UPSTREAM_MALFORMED_RESPONSE");
  return { count: Number(parsed.data.esearchresult.count), ids: parsed.data.esearchresult.idlist };
}

const summaryEntrySchema = z.object({
  uid: z.string(),
  status: z.string().optional(),
  rank: z.string().optional(),
  division: z.string().optional(),
  scientificname: z.string().optional(),
  taxid: z.number().optional(),
  akataxid: z.union([z.string(), z.number()]).optional(),
  error: z.string().optional(),
});

const esummarySchema = z.object({
  result: z.object({ uids: z.array(z.string()) }).catchall(z.unknown()),
});

export async function esummaryTaxonomy(ids: string[]): Promise<TaxonSummary[]> {
  const clean = ids.filter(isTaxId).slice(0, 100);
  if (clean.length === 0) return [];
  const url = buildProviderUrl("ncbi-taxonomy", `${BASE}esummary.fcgi`, {
    ...common(),
    id: clean.join(","),
    retmode: "json",
  });
  const parsed = esummarySchema.safeParse(await providerGetJson("ncbi-taxonomy", url));
  if (!parsed.success) throw new ProviderError("ncbi-taxonomy", "UPSTREAM_MALFORMED_RESPONSE");

  const summaries: TaxonSummary[] = [];
  for (const uid of parsed.data.result.uids) {
    const entry = summaryEntrySchema.safeParse(parsed.data.result[uid]);
    if (!entry.success || entry.data.error || !entry.data.scientificname || !isTaxId(uid)) continue;
    const aka = entry.data.akataxid === undefined ? "" : String(entry.data.akataxid);
    summaries.push({
      taxId: uid,
      scientificName: sanitizeName(entry.data.scientificname),
      rank: emptyToNull(entry.data.rank),
      division: emptyToNull(entry.data.division),
      recordStatus: emptyToNull(entry.data.status),
      mergedInto: isTaxId(aka) ? aka : null,
    });
  }
  return summaries;
}

/** EFetch XML → registros. Entradas sem TaxId ou nome válidos são descartadas, não inventadas. */
export async function efetchTaxonomy(ids: string[]): Promise<TaxonRecord[]> {
  const clean = ids.filter(isTaxId).slice(0, 20);
  if (clean.length === 0) return [];
  const url = buildProviderUrl("ncbi-taxonomy", `${BASE}efetch.fcgi`, {
    ...common(),
    id: clean.join(","),
    retmode: "xml",
  });
  const text = await providerGetText("ncbi-taxonomy", url, { accept: "xml" });
  return parseTaxaSet(text);
}

export function parseTaxaSet(xml: string): TaxonRecord[] {
  let root: XmlNode;
  try {
    root = parseXml(xml);
  } catch (error) {
    if (error instanceof XmlParseError) throw new ProviderError("ncbi-taxonomy", "UPSTREAM_MALFORMED_RESPONSE");
    throw error;
  }
  if (root.name !== "TaxaSet") throw new ProviderError("ncbi-taxonomy", "UPSTREAM_MALFORMED_RESPONSE");
  const records: TaxonRecord[] = [];
  for (const node of childrenNamed(root, "Taxon")) {
    const record = toTaxonRecord(node);
    if (record) records.push(record);
  }
  return records;
}

const MAX_NAME = 200;
const MAX_LIST = 60;

export function sanitizeName(value: string): string {
  // Remove caracteres de controle e limita o tamanho; a renderização é sempre texto escapado.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

function emptyToNull(value: string | undefined): string | null {
  const cleaned = value ? sanitizeName(value) : "";
  return cleaned.length > 0 ? cleaned : null;
}

function toTaxonRecord(node: XmlNode): TaxonRecord | null {
  const taxId = textOf(child(node, "TaxId"));
  const scientificName = textOf(child(node, "ScientificName"));
  if (!taxId || !isTaxId(taxId) || !scientificName) return null;

  const lineage: LineageNode[] = [];
  const lineageEx = child(node, "LineageEx");
  for (const item of lineageEx ? childrenNamed(lineageEx, "Taxon") : []) {
    const id = textOf(child(item, "TaxId"));
    const name = textOf(child(item, "ScientificName"));
    if (!id || !isTaxId(id) || !name) continue;
    lineage.push({ taxId: id, name: sanitizeName(name), rank: emptyToNull(textOf(child(item, "Rank")) ?? undefined) });
  }

  const synonyms: string[] = [];
  const commonNames: string[] = [];
  const authorities: string[] = [];
  const otherNames: Array<{ kind: string; name: string }> = [];
  const other = child(node, "OtherNames");
  for (const item of other?.children ?? []) {
    if (otherNames.length >= MAX_LIST) break;
    if (item.name === "Name") {
      const kind = textOf(child(item, "ClassCDE")) ?? "other";
      const display = textOf(child(item, "DispName"));
      if (!display) continue;
      const name = sanitizeName(display);
      if (kind === "authority") authorities.push(name);
      else otherNames.push({ kind, name });
      continue;
    }
    const value = textOf(item);
    if (!value) continue;
    const name = sanitizeName(value);
    if (item.name === "Synonym") synonyms.push(name);
    else if (item.name === "CommonName" || item.name === "GenbankCommonName") commonNames.push(name);
    else otherNames.push({ kind: item.name, name });
  }

  const parentTaxId = textOf(child(node, "ParentTaxId"));
  const geneticCodeNode = child(node, "GeneticCode");
  return {
    taxId,
    scientificName: sanitizeName(scientificName),
    rank: emptyToNull(textOf(child(node, "Rank")) ?? undefined),
    division: emptyToNull(textOf(child(node, "Division")) ?? undefined),
    recordStatus: "active",
    mergedInto: null,
    parentTaxId: parentTaxId && isTaxId(parentTaxId) ? parentTaxId : null,
    lineage,
    synonyms: synonyms.slice(0, MAX_LIST),
    commonNames: commonNames.slice(0, MAX_LIST),
    authorities: authorities.slice(0, MAX_LIST),
    otherNames: otherNames.slice(0, MAX_LIST),
    geneticCode: geneticCodeNode ? emptyToNull(textOf(child(geneticCodeNode, "GCName")) ?? undefined) : null,
    createDate: emptyToNull(textOf(child(node, "CreateDate")) ?? undefined),
    updateDate: emptyToNull(textOf(child(node, "UpdateDate")) ?? undefined),
  };
}
