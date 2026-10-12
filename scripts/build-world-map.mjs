// Gera src/content/world-map.ts a partir do Natural Earth (domínio público) via world-atlas.
// Projeção equiretangular 2000×1000, coordenadas inteiras e comandos relativos para ficar compacto.
// Anéis e linhas que cruzam o antimeridiano são "desenrolados" e desenhados em cópias deslocadas
// de ±360° (o quadro recorta o excedente), o que evita as linhas horizontais falsas.
// Uso: node scripts/build-world-map.mjs   (depende de world-atlas e topojson-client, só em desenvolvimento)
import { readFileSync, writeFileSync } from "node:fs";
import { feature, mesh } from "topojson-client";

const topo = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/countries-110m.json", import.meta.url), "utf8"));
const W = 2000;
const H = 1000;

/** Torna as longitudes contínuas: um salto maior que 180° é o cruzamento do antimeridiano. */
function unwrap(coords) {
  const out = [];
  let offset = 0;
  let prev = null;
  for (const [lon, lat] of coords) {
    let x = lon + offset;
    if (prev !== null) {
      const d = x - prev;
      if (d > 180) {
        offset -= 360;
        x -= 360;
      } else if (d < -180) {
        offset += 360;
        x += 360;
      }
    }
    out.push([x, lat]);
    prev = x;
  }
  return out;
}

const toPx = ([lon, lat]) => [Math.round(((lon + 180) / 360) * W), Math.round(((90 - lat) / 180) * H)];

function pathOf(points, close) {
  let out = `M${points[0][0]} ${points[0][1]}`;
  let [x0, y0] = points[0];
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i];
    if (x === x0 && y === y0) continue;
    out += `l${x - x0} ${y - y0}`;
    x0 = x;
    y0 = y;
  }
  return close ? out + "z" : out;
}

/** Emite o traçado e as cópias deslocadas de ±W que intersectam o quadro. */
function wrapped(points, close) {
  const xs = points.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let out = "";
  for (const shift of [-W, 0, W]) {
    if (maxX + shift <= 0 || minX + shift >= W) continue;
    out += pathOf(
      points.map(([x, y]) => [x + shift, y]),
      close,
    );
  }
  return out;
}

function ringPath(ring) {
  const unwrapped = unwrap(ring);
  const first = unwrapped[0];
  const last = unwrapped[unwrapped.length - 1];
  // Anel que dá a volta no polo (Antártida): o fim fica uma volta (±360°) afastado do início.
  if (Math.abs(last[0] - first[0]) > 180) {
    const pole = unwrapped.reduce((sum, p) => sum + p[1], 0) / unwrapped.length < 0 ? -90 : 90;
    unwrapped.push([last[0], pole], [first[0], pole]);
  }
  return wrapped(unwrapped.map(toPx), true);
}

function linePath(line) {
  return wrapped(unwrap(line).map(toPx), false);
}

const land = feature(topo, topo.objects.land);
const landPath = land.features
  .flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates))
  .flatMap((polygon) => polygon.map(ringPath))
  .join("");

const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
const bordersPath = borders.coordinates.map(linePath).join("");

const source = `// GERADO por scripts/build-world-map.mjs. Não edite à mão.
// Fonte: Natural Earth 1:110m (domínio público, naturalearthdata.com) via pacote world-atlas (ISC).
// Projeção equiretangular; x = (lon + 180) / 360 * ${W}, y = (90 - lat) / 180 * ${H}.
export const WORLD_MAP = {
  width: ${W},
  height: ${H},
  land: ${JSON.stringify(landPath)},
  borders: ${JSON.stringify(bordersPath)},
  attribution: "Mapa-múndi simplificado: Natural Earth 1:110m, domínio público.",
} as const;
`;
writeFileSync(new URL("../src/content/world-map.ts", import.meta.url), source);
console.log("land", landPath.length, "borders", bordersPath.length);
