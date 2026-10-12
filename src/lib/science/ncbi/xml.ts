/**
 * Leitor XML mínimo e defensivo para a resposta `TaxaSet` do NCBI (EFetch db=taxonomy só devolve XML).
 *
 * Não resolve entidades externas nem DTD: o DOCTYPE é descartado e qualquer declaração de entidade
 * (`<!ENTITY`) invalida o documento. Só entidades predefinidas e numéricas são decodificadas.
 * Limites de profundidade e de nós evitam exaustão de recursos com respostas hostis.
 */
export interface XmlNode {
  name: string;
  children: XmlNode[];
  text: string;
}

const MAX_DEPTH = 32;
const MAX_NODES = 40_000;

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlParseError";
  }
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]{2,5});/g, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0x20 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return "";
      return String.fromCodePoint(code);
    }
    return NAMED[body] ?? match;
  });
}

export function parseXml(source: string): XmlNode {
  if (/<!ENTITY/i.test(source)) throw new XmlParseError("entity declarations are not allowed");
  let pos = 0;
  let nodes = 0;
  const root: XmlNode = { name: "#document", children: [], text: "" };
  const stack: XmlNode[] = [root];

  while (pos < source.length) {
    const lt = source.indexOf("<", pos);
    if (lt === -1) {
      stack[stack.length - 1].text += decodeEntities(source.slice(pos));
      break;
    }
    if (lt > pos) stack[stack.length - 1].text += decodeEntities(source.slice(pos, lt));

    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      if (end === -1) throw new XmlParseError("unterminated comment");
      pos = end + 3;
    } else if (source.startsWith("<![CDATA[", lt)) {
      const end = source.indexOf("]]>", lt + 9);
      if (end === -1) throw new XmlParseError("unterminated CDATA");
      stack[stack.length - 1].text += source.slice(lt + 9, end);
      pos = end + 3;
    } else if (source.startsWith("<?", lt)) {
      const end = source.indexOf("?>", lt + 2);
      if (end === -1) throw new XmlParseError("unterminated processing instruction");
      pos = end + 2;
    } else if (source.startsWith("<!", lt)) {
      // DOCTYPE: pulado inteiro. Subconjunto interno [...] só é aceito sem declarações (checado acima).
      let depth = 0;
      let i = lt + 2;
      for (; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === "[") depth += 1;
        else if (ch === "]") depth -= 1;
        else if (ch === ">" && depth <= 0) break;
      }
      if (i >= source.length) throw new XmlParseError("unterminated declaration");
      pos = i + 1;
    } else if (source[lt + 1] === "/") {
      const end = source.indexOf(">", lt + 2);
      if (end === -1) throw new XmlParseError("unterminated closing tag");
      const name = source.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (!open || open.name !== name || stack.length === 0) throw new XmlParseError("mismatched closing tag");
      pos = end + 1;
    } else {
      const end = findTagEnd(source, lt + 1);
      if (end === -1) throw new XmlParseError("unterminated tag");
      let inner = source.slice(lt + 1, end);
      const selfClosing = inner.endsWith("/");
      if (selfClosing) inner = inner.slice(0, -1);
      const name = inner.split(/\s/, 1)[0];
      if (!/^[A-Za-z_][\w.:-]*$/.test(name)) throw new XmlParseError("invalid element name");
      nodes += 1;
      if (nodes > MAX_NODES) throw new XmlParseError("too many nodes");
      const node: XmlNode = { name, children: [], text: "" };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) {
        if (stack.length > MAX_DEPTH) throw new XmlParseError("document too deep");
        stack.push(node);
      }
      pos = end + 1;
    }
  }
  if (stack.length !== 1) throw new XmlParseError("unclosed elements");
  const top = root.children[0];
  if (!top) throw new XmlParseError("empty document");
  return top;
}

/** Procura o `>` que fecha a tag, ignorando `>` dentro de atributos entre aspas. */
function findTagEnd(source: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

export function child(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((c) => c.name === name);
}

export function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

export function textOf(node: XmlNode | undefined): string | null {
  if (!node) return null;
  const value = node.text.replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : null;
}
