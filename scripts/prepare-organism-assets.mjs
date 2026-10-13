/**
 * Fase 2.3.9 — prepara os ativos dos organismos para deformação por GPU.
 *
 * Entrada (somente leitura): `public/images/explore/organisms/*-editorial-v2.png`
 * (reconstruções editoriais geradas para o projeto; ver docs/phase235-optical-morphology-redesign-report.md).
 *
 * Saída em `public/images/explore/organisms/v3/`:
 *   giardia.webp / t-cruzi.webp   textura RGBA (a mesma imagem aprovada, convertida)
 *   giardia-field-{a,b}.png       campos de deformação em baixa resolução
 *   t-cruzi-field-{a,b}.png
 *   trichuris-egg.webp            ovo desrotacionado e recortado (textura planar do sólido de revolução)
 * e `src/cinematic/organismManifest.ts` (dimensões, âncoras derivadas, perfil do ovo).
 *
 * Os campos são DERIVADOS do canal alfa das próprias imagens (nenhum dado biológico é inventado):
 *   - Giardia: corpo = abertura morfológica da máscara; flagelos = resto. `w` (envelope: 0 na inserção
 *     e crescente com a distância ao corpo), `d` (coordenada de fase), direção normal ao raio.
 *   - T. cruzi: flagelo livre = maior componente fino; `s` = comprimento de arco a partir da raiz;
 *     banda de membrana ondulante na margem inferior do corpo.
 *   - Relevo (`T`): distância à borda, em raiz quadrada, usada só para dar profundidade ao corpo.
 *
 * Uso: node scripts/prepare-organism-assets.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SRC = "public/images/explore/organisms";
const OUT = `${SRC}/v3`;
const DEBUG = process.env.ORGANISM_DEBUG_DIR;
await mkdir(OUT, { recursive: true });
if (DEBUG) await mkdir(DEBUG, { recursive: true });

// ---------------------------------------------------------------- utilidades

const INF = 1e20;

/** Transformada de distância euclidiana (Felzenszwalb–Huttenlocher). `feature[i] = 1` → distância 0. */
function edt(feature, w, h) {
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i += 1) f[i] = feature[i] ? 0 : INF;
  const n = Math.max(w, h);
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  const d = new Float32Array(n);
  const pass = (get, set, len) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q += 1) {
      let s;
      for (;;) {
        const p = v[k];
        s = (get(q) + q * q - (get(p) + p * p)) / (2 * q - 2 * p);
        if (s <= z[k] && k > 0) k -= 1;
        else break;
      }
      k += 1;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q += 1) {
      while (z[k + 1] < q) k += 1;
      const p = v[k];
      d[q] = (q - p) * (q - p) + get(p);
    }
    for (let q = 0; q < len; q += 1) set(q, d[q]);
  };
  for (let x = 0; x < w; x += 1) {
    pass((y) => f[y * w + x], (y, val) => { f[y * w + x] = val; }, h);
  }
  for (let y = 0; y < h; y += 1) {
    pass((x) => f[y * w + x], (x, val) => { f[y * w + x] = val; }, w);
  }
  for (let i = 0; i < f.length; i += 1) f[i] = Math.sqrt(f[i]);
  return f;
}

function boxBlur(src, w, h, radius, passes = 2) {
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let p = 0; p < passes; p += 1) {
    for (let y = 0; y < h; y += 1) {
      let acc = 0;
      const row = y * w;
      for (let x = -radius; x <= radius; x += 1) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x += 1) {
        b[row + x] = acc / (2 * radius + 1);
        acc += a[row + Math.min(w - 1, x + radius + 1)] - a[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < w; x += 1) {
      let acc = 0;
      for (let y = -radius; y <= radius; y += 1) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y += 1) {
        a[y * w + x] = acc / (2 * radius + 1);
        acc += b[Math.min(h - 1, y + radius + 1) * w + x] - b[Math.max(0, y - radius) * w + x];
      }
    }
  }
  return a;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

async function loadAlpha(file, width, height) {
  const { data } = await sharp(file)
    .ensureAlpha()
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Float32Array.from(data, (v) => v / 255);
}

/** Abertura morfológica via EDT: remove estruturas mais finas que `2·r`. */
function open(mask, w, h, r) {
  const inverse = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) inverse[i] = mask[i] ? 0 : 1;
  const depth = edt(inverse, w, h); // distância ao fundo, dentro da máscara
  const eroded = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) eroded[i] = depth[i] > r ? 1 : 0;
  const reach = edt(eroded, w, h);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) out[i] = mask[i] && reach[i] <= r + 1.2 ? 1 : 0;
  return { body: out, depth };
}

function gradient(field, w, h) {
  const gx = new Float32Array(field.length);
  const gy = new Float32Array(field.length);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      gx[i] = (field[i + 1] - field[i - 1]) * 0.5;
      gy[i] = (field[i + w] - field[i - w]) * 0.5;
    }
  }
  return { gx, gy };
}

function toByte(v) {
  return Math.round(clamp01(v) * 255);
}

async function writeField(path, channels, w, h) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    for (let c = 0; c < 4; c += 1) buf[i * 4 + c] = toByte(channels[c][i]);
  }
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path);
}

async function writeGray(path, arr, w, h) {
  const buf = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i += 1) buf[i] = toByte(arr[i]);
  await sharp(buf, { raw: { width: w, height: h, channels: 1 } }).png().toFile(path);
}

async function convertColor(from, to, width) {
  await sharp(from)
    .resize({ width, kernel: "lanczos3" })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toFile(to);
}

const manifest = {};

// ------------------------------------------------------------------ Giardia

async function prepareGiardia() {
  const file = `${SRC}/giardia-editorial-v2.png`;
  const meta = await sharp(file).metadata();
  const colorW = 1000;
  const colorH = Math.round((colorW * meta.height) / meta.width);
  await convertColor(file, `${OUT}/giardia.webp`, colorW);

  const w = 400;
  const h = Math.round((w * meta.height) / meta.width);
  const alpha = await loadAlpha(file, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i += 1) mask[i] = alpha[i] > 0.35 ? 1 : 0;
  const { body, depth } = open(mask, w, h, 7);

  // Distância ao corpo (fora dele) → envelope e fase da onda flagelar.
  const dBody = edt(body, w, h);
  const wEnv = new Float32Array(w * h);
  const phaseD = new Float32Array(w * h);
  const smoothD = boxBlur(dBody, w, h, 2, 2);
  const { gx, gy } = gradient(smoothD, w, h);
  const nx = new Float32Array(w * h);
  const ny = new Float32Array(w * h);
  const REACH = 150; // px a 400 de largura
  for (let i = 0; i < w * h; i += 1) {
    const d = dBody[i];
    // 0 na inserção, crescimento ~linear até a ponta: flagelo preso ao corpo, ponta mais livre.
    wEnv[i] = body[i] ? 0 : Math.pow(clamp01((d - 1) / 62), 1.1);
    phaseD[i] = clamp01(d / REACH);
    const len = Math.hypot(gx[i], gy[i]) || 1;
    // Normal à direção radial: perpendicular ao eixo aproximado do flagelo.
    nx[i] = -gy[i] / len;
    ny[i] = gx[i] / len;
  }

  // Relevo do corpo: profundidade da borda (raiz quadrada) → cúpula.
  let maxDepth = 0;
  for (let i = 0; i < w * h; i += 1) if (body[i] && depth[i] > maxDepth) maxDepth = depth[i];
  const dome = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) dome[i] = body[i] ? Math.sqrt(clamp01(depth[i] / maxDepth)) : 0;
  const domeSoft = boxBlur(dome, w, h, 3, 2);
  const bodySoft = boxBlur(Float32Array.from(body), w, h, 2, 2);

  await writeField(
    `${OUT}/giardia-field-a.png`,
    [wEnv, phaseD, Float32Array.from(nx, (v) => v * 0.5 + 0.5), Float32Array.from(ny, (v) => v * 0.5 + 0.5)],
    w,
    h,
  );
  // A = 1 constante: o canal alfa não pode ser pré-multiplicado ao ler os valores na CPU.
  const ones = new Float32Array(w * h).fill(1);
  await writeField(`${OUT}/giardia-field-b.png`, [domeSoft, bodySoft, new Float32Array(w * h), ones], w, h);

  // Centroide do corpo e extensão (âncoras derivadas, não digitadas à mão).
  let cx = 0;
  let cy = 0;
  let count = 0;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!body[y * w + x]) continue;
      cx += x;
      cy += y;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  manifest.giardia = {
    color: "/images/explore/organisms/v3/giardia.webp",
    fieldA: "/images/explore/organisms/v3/giardia-field-a.png",
    fieldB: "/images/explore/organisms/v3/giardia-field-b.png",
    aspect: Number((meta.height / meta.width).toFixed(5)),
    colorSize: [colorW, colorH],
    fieldSize: [w, h],
    bodyCentroid: [Number((cx / count / w).toFixed(4)), Number((cy / count / h).toFixed(4))],
    bodyBounds: [minX / w, minY / h, maxX / w, maxY / h].map((v) => Number(v.toFixed(4))),
  };
  if (DEBUG) {
    await writeGray(`${DEBUG}/giardia-body.png`, Float32Array.from(body), w, h);
    await writeGray(`${DEBUG}/giardia-w.png`, wEnv, w, h);
    await writeGray(`${DEBUG}/giardia-dome.png`, domeSoft, w, h);
  }
}

// ----------------------------------------------------------------- T. cruzi

async function prepareTcruzi() {
  const file = `${SRC}/t-cruzi-editorial-v2.png`;
  const meta = await sharp(file).metadata();
  const colorW = 1400;
  const colorH = Math.round((colorW * meta.height) / meta.width);
  await convertColor(file, `${OUT}/t-cruzi.webp`, colorW);

  const w = 640;
  const h = Math.round((w * meta.height) / meta.width);
  const alpha = await loadAlpha(file, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i += 1) mask[i] = alpha[i] > 0.3 ? 1 : 0;
  const { body, depth } = open(mask, w, h, 5);

  // Componentes finos (candidatos a flagelo) por rotulagem conexa.
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let start = 0; start < w * h; start += 1) {
    if (!mask[start] || body[start] || label[start] !== -1) continue;
    const id = comps.length;
    const stack = [start];
    label[start] = id;
    const pixels = [];
    while (stack.length) {
      const p = stack.pop();
      pixels.push(p);
      const px = p % w;
      const py = (p / w) | 0;
      for (const [dx, dy] of neighbours) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const q = qy * w + qx;
        if (mask[q] && !body[q] && label[q] === -1) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    comps.push(pixels);
  }
  comps.sort((a, b) => b.length - a.length);
  const flagellum = comps[0];
  const inFlag = new Uint8Array(w * h);
  flagellum.forEach((p) => { inFlag[p] = 1; });

  // Raiz: pixels do flagelo mais próximos do corpo.
  const dBody = edt(body, w, h);
  let rootDist = INF;
  flagellum.forEach((p) => { rootDist = Math.min(rootDist, dBody[p]); });
  const roots = flagellum.filter((p) => dBody[p] <= rootDist + 2.5);

  // Comprimento de arco: Dijkstra (8 vizinhos) restrito ao componente.
  const dist = new Float64Array(w * h).fill(INF);
  const queue = [];
  roots.forEach((p) => { dist[p] = 0; queue.push(p); });
  // Fila simples por varredura (componente pequeno): relaxação repetida até convergir.
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of flagellum) {
      const px = p % w;
      const py = (p / w) | 0;
      for (const [dx, dy] of neighbours) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const q = qy * w + qx;
        if (!inFlag[q] || dist[q] === INF) continue;
        const cand = dist[q] + (dx && dy ? Math.SQRT2 : 1);
        if (cand + 1e-4 < dist[p]) {
          dist[p] = cand;
          changed = true;
        }
      }
    }
  }
  let sMax = 0;
  flagellum.forEach((p) => { if (dist[p] < INF) sMax = Math.max(sMax, dist[p]); });

  // Tangente por PCA local (raio 6) → normal.
  const tx = new Float32Array(w * h);
  const ty = new Float32Array(w * h);
  const R = 6;
  flagellum.forEach((p) => {
    const px = p % w;
    const py = (p / w) | 0;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let dy = -R; dy <= R; dy += 1) {
      for (let dx = -R; dx <= R; dx += 1) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        if (!inFlag[qy * w + qx]) continue;
        sxx += dx * dx;
        sxy += dx * dy;
        syy += dy * dy;
      }
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let ax = Math.cos(angle);
    let ay = Math.sin(angle);
    // O eixo principal tem ambiguidade de 180°: orienta pelo crescimento do comprimento de arco
    // para que a normal seja contínua ao longo do flagelo (sem inversões de sinal).
    let along = 0;
    for (let dy = -R; dy <= R; dy += 1) {
      for (let dx = -R; dx <= R; dx += 1) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const q = qy * w + qx;
        if (!inFlag[q] || dist[q] === INF) continue;
        along += (dx * ax + dy * ay) * (dist[q] - dist[p]);
      }
    }
    if (along < 0) {
      ax = -ax;
      ay = -ay;
    }
    tx[p] = ax;
    ty[p] = ay;
  });

  // Propaga (s, normal) do flagelo para a vizinhança (suporte da deformação).
  const SUPPORT = 16;
  const sField = new Float32Array(w * h);
  const nxField = new Float32Array(w * h);
  const nyField = new Float32Array(w * h);
  const supportW = new Float32Array(w * h);
  const owner = new Int32Array(w * h).fill(-1);
  let frontier = [];
  flagellum.forEach((p) => {
    owner[p] = p;
    frontier.push(p);
  });
  for (let ring = 0; ring < SUPPORT; ring += 1) {
    const next = [];
    for (const p of frontier) {
      const px = p % w;
      const py = (p / w) | 0;
      for (const [dx, dy] of neighbours) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const q = qy * w + qx;
        if (owner[q] === -1) {
          owner[q] = owner[p];
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  for (let i = 0; i < w * h; i += 1) {
    const o = owner[i];
    if (o === -1) continue;
    const ox = o % w;
    const oy = (o / w) | 0;
    const d = Math.hypot((i % w) - ox, ((i / w) | 0) - oy);
    sField[i] = dist[o] === INF ? 0 : dist[o] / sMax;
    nxField[i] = -ty[o];
    nyField[i] = tx[o];
    supportW[i] = 1 - smooth(5, SUPPORT, d);
  }

  // Corpo: relevo, e banda da membrana ondulante (margem inferior).
  let maxDepth = 0;
  for (let i = 0; i < w * h; i += 1) if (body[i] && depth[i] > maxDepth) maxDepth = depth[i];
  const dome = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) dome[i] = body[i] ? Math.sqrt(clamp01(depth[i] / maxDepth)) : 0;
  const domeSoft = boxBlur(dome, w, h, 2, 2);
  const smoothDepth = boxBlur(Float32Array.from(depth, (v, i) => (body[i] ? v : 0)), w, h, 2, 2);
  const { gx, gy } = gradient(smoothDepth, w, h);
  const membrane = new Float32Array(w * h);
  const mnx = new Float32Array(w * h);
  const mny = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    if (!body[i]) continue;
    const len = Math.hypot(gx[i], gy[i]) || 1;
    const ox = -gx[i] / len; // normal externa (para fora do corpo)
    const oy = -gy[i] / len;
    mnx[i] = ox * 0.5 + 0.5;
    mny[i] = oy * 0.5 + 0.5;
    const band = 1 - smooth(2.5, 15, depth[i]);
    const lower = smooth(0.18, 0.7, oy); // y para baixo na imagem: margem inferior
    membrane[i] = band * lower;
  }
  const membraneSoft = boxBlur(membrane, w, h, 2, 2);
  const mnxSoft = boxBlur(mnx, w, h, 2, 2);
  const mnySoft = boxBlur(mny, w, h, 2, 2);

  await writeField(`${OUT}/t-cruzi-field-a.png`, [sField, supportW, Float32Array.from(nxField, (v) => v * 0.5 + 0.5), Float32Array.from(nyField, (v) => v * 0.5 + 0.5)], w, h);
  await writeField(`${OUT}/t-cruzi-field-b.png`, [membraneSoft, mnxSoft, mnySoft, domeSoft], w, h);

  // Extremos do corpo: raiz do flagelo (anterior) e ponta oposta (posterior).
  let rx = 0;
  let ry = 0;
  roots.forEach((p) => { rx += p % w; ry += (p / w) | 0; });
  rx /= roots.length;
  ry /= roots.length;
  let farD = 0;
  let farX = rx;
  let farY = ry;
  for (let i = 0; i < w * h; i += 1) {
    if (!body[i]) continue;
    const d = Math.hypot((i % w) - rx, ((i / w) | 0) - ry);
    if (d > farD) { farD = d; farX = i % w; farY = (i / w) | 0; }
  }
  // Posterior: o corpo se afila; o ponto mais distante da raiz é a extremidade fina à esquerda.
  manifest.tcruzi = {
    color: "/images/explore/organisms/v3/t-cruzi.webp",
    fieldA: "/images/explore/organisms/v3/t-cruzi-field-a.png",
    fieldB: "/images/explore/organisms/v3/t-cruzi-field-b.png",
    aspect: Number((meta.height / meta.width).toFixed(5)),
    colorSize: [colorW, colorH],
    fieldSize: [w, h],
    flagellumRoot: [Number((rx / w).toFixed(4)), Number((ry / h).toFixed(4))],
    bodyPosterior: [Number((farX / w).toFixed(4)), Number((farY / h).toFixed(4))],
    flagellumArcPx: Number(sMax.toFixed(1)),
    flagellumPixels: flagellum.length,
  };
  if (DEBUG) {
    await writeGray(`${DEBUG}/tcruzi-body.png`, Float32Array.from(body), w, h);
    await writeGray(`${DEBUG}/tcruzi-s.png`, sField, w, h);
    await writeGray(`${DEBUG}/tcruzi-support.png`, supportW, w, h);
    await writeGray(`${DEBUG}/tcruzi-membrane.png`, membraneSoft, w, h);
  }
}

// ----------------------------------------------------------------- Trichuris

async function prepareTrichuris() {
  const file = `${SRC}/trichuris-editorial-v2.png`;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  // Orientação do eixo maior por PCA da máscara sólida.
  let n = 0;
  let mx = 0;
  let my = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * 4 + 3] > 140) { n += 1; mx += x; my += y; }
    }
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * 4 + 3] > 140) {
        const dx = x - mx;
        const dy = y - my;
        sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
      }
    }
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy); // radianos, eixo maior
  const degrees = (angle * 180) / Math.PI;

  // Gira o ovo para horizontal e recorta.
  const rotated = await sharp(file)
    .ensureAlpha()
    .rotate(-degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const rmeta = await sharp(rotated).metadata();
  const raw = await sharp(rotated).ensureAlpha().raw().toBuffer();
  const RW = rmeta.width;
  const RH = rmeta.height;
  let minX = RW, maxX = 0, minY = RH, maxY = 0;
  for (let y = 0; y < RH; y += 1) {
    for (let x = 0; x < RW; x += 1) {
      if (raw[(y * RW + x) * 4 + 3] > 140) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  const pad = 6;
  const crop = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(RW, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(RH, maxY + pad) - Math.max(0, minY - pad),
  };
  await sharp(rotated)
    .extract(crop)
    .resize({ width: 1100, kernel: "lanczos3" })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`${OUT}/trichuris-egg.webp`);

  // Perfil de revolução a partir da silhueta sólida (semi-altura por coluna).
  const cropRaw = await sharp(rotated).extract(crop).ensureAlpha().raw().toBuffer();
  const cw = crop.width;
  const ch = crop.height;
  const samples = 72;
  const profile = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = Math.min(cw - 1, Math.round((i / samples) * (cw - 1)));
    let top = ch;
    let bottom = -1;
    for (let y = 0; y < ch; y += 1) {
      if (cropRaw[(y * cw + x) * 4 + 3] > 140) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    profile.push(bottom < 0 ? 0 : (bottom - top) / 2 / cw);
  }
  // Suaviza ruído de 1 px e fecha as extremidades.
  const smoothProfile = profile.map((v, i) => {
    const a = profile[Math.max(0, i - 1)];
    const b = profile[Math.min(samples, i + 1)];
    return (a + 2 * v + b) / 4;
  });
  manifest.trichuris = {
    color: "/images/explore/organisms/v3/trichuris-egg.webp",
    aspect: Number((ch / cw).toFixed(5)),
    rotationDegrees: Number(degrees.toFixed(2)),
    /** Semi-diâmetro por posição ao longo do eixo longo, em unidades do comprimento total (=1). */
    profile: smoothProfile.map((v) => Number(v.toFixed(5))),
    measuredLengthWidthRatio: Number((cw / ch).toFixed(3)),
  };
}

await prepareGiardia();
await prepareTcruzi();
await prepareTrichuris();

const source = `/**
 * GERADO por scripts/prepare-organism-assets.mjs — não editar à mão.
 * Dimensões, âncoras derivadas do canal alfa e perfil de revolução do ovo.
 */
export const ORGANISM_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;
`;
await writeFile("src/cinematic/organismManifest.ts", source);
console.log(JSON.stringify(manifest, null, 1));
