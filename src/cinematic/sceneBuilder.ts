import * as THREE from "three";
import { createSpecimenFieldSystem, type SpecimenFieldSystem } from "./specimenFieldSystem";
import { SPECIMEN_TIMELINE, specimenWorldWeights, type SpecimenWorldId } from "./specimenTimeline";

const GRAPHITE = 0x22292b;
const BLACKENED_STEEL = 0x343b3d;
const CHAMPAGNE = 0x6f7778;
const MINT = 0x80f9c7;
const LILAC = 0xe5cbff;

type Quality = "high" | "medium" | "low";

function seededRandom(seed = 23) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function metal(color: number, roughness: number, envMapIntensity = 1.1) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.92,
    roughness,
    envMapIntensity,
    clearcoat: 0.16,
    clearcoatRoughness: Math.min(0.42, roughness + 0.08),
  });
}

function addAnnulus(root: THREE.Group, radius: number, tube: number, z: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 72), material);
  mesh.position.z = z;
  root.add(mesh);
  return mesh;
}

function createObjectiveMarkings() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(226, 235, 232, 0.92)";
  context.font = "600 58px 'Segoe UI', sans-serif";
  context.letterSpacing = "3px";
  context.fillText("100×  OIL  ·  1.25 NA", 58, 105);
  context.font = "500 37px 'Segoe UI', sans-serif";
  context.letterSpacing = "8px";
  context.fillStyle = "rgba(175, 211, 201, 0.82)";
  context.fillText("∞ / 0.17  ·  PLAN ACHROMAT", 58, 174);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Ruído de valor tileable, gerado em canvas — dá granulação de superfície às membranas. */
function createNoiseCanvas(
  seed: number,
  size = 192,
  octaves: readonly number[] = [6, 12, 24, 48],
): HTMLCanvasElement | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const random = seededRandom(seed);
  const grids = octaves.map((n) => Float32Array.from({ length: n * n }, () => random()));
  const image = context.createImageData(size, size);
  const fade = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0;
      let amplitude = 0.55;
      let total = 0;
      octaves.forEach((n, octave) => {
        const gx = (x / size) * n;
        const gy = (y / size) * n;
        const x0 = Math.floor(gx) % n;
        const y0 = Math.floor(gy) % n;
        const x1 = (x0 + 1) % n;
        const y1 = (y0 + 1) % n;
        const fx = fade(gx - Math.floor(gx));
        const fy = fade(gy - Math.floor(gy));
        const grid = grids[octave];
        const top = grid[y0 * n + x0] * (1 - fx) + grid[y0 * n + x1] * fx;
        const bottom = grid[y1 * n + x0] * (1 - fx) + grid[y1 * n + x1] * fx;
        value += (top * (1 - fy) + bottom * fy) * amplitude;
        total += amplitude;
        amplitude *= 0.55;
      });
      const channel = Math.round((value / total) * 255);
      const offset = (y * size + x) * 4;
      image.data[offset] = channel;
      image.data[offset + 1] = channel;
      image.data[offset + 2] = channel;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly radius: number,
    private readonly z0: number,
    private readonly z1: number,
    private readonly turns: number,
  ) {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2;
    return optionalTarget.set(
      Math.cos(angle) * this.radius,
      Math.sin(angle) * this.radius,
      this.z0 + (this.z1 - this.z0) * t,
    );
  }
}

/**
 * Pilha óptica interna: elementos de lente, anteparos, rosca helicoidal e trilhos.
 * É o que o visitante atravessa entre ~20% e ~45% do progresso.
 * Assimetrias (rosca, trilhos, parafusos) evitam o aspecto de túnel radial genérico.
 */
function createOpticalInterior(quality: Quality) {
  const group = new THREE.Group();
  group.name = "optical-interior";
  const radialSegments = quality === "high" ? 64 : quality === "medium" ? 48 : 32;

  const wallMetal = new THREE.MeshStandardMaterial({
    color: 0x252f32,
    metalness: 0.8,
    roughness: 0.4,
    side: THREE.BackSide,
    envMapIntensity: 0.55,
  });
  const steel = metal(BLACKENED_STEEL, 0.2, 0.6);
  const champagne = metal(CHAMPAGNE, 0.28, 0.6);
  const black = new THREE.MeshStandardMaterial({
    color: 0x2a3335,
    roughness: 0.38,
    metalness: 0.82,
    envMapIntensity: 0.7,
    side: THREE.DoubleSide,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x2f4a43,
    metalness: 0,
    roughness: 0.03,
    transparent: true,
    opacity: 0.05,
    ior: 1.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coating = new THREE.MeshBasicMaterial({
    color: MINT,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const lilacCoating = new THREE.MeshBasicMaterial({
    color: LILAC,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.19, 1.19, 4.6, radialSegments, 1, true), wallMetal);
  wall.rotation.x = Math.PI / 2;
  wall.position.z = -0.8;
  group.add(wall);

  // Rosca helicoidal ao longo da parede.
  const threadSegments = quality === "low" ? 120 : 220;
  const thread = new THREE.Mesh(
    new THREE.TubeGeometry(new HelixCurve(1.155, -3.0, 1.45, 9), threadSegments, 0.032, 6, false),
    steel,
  );
  thread.name = "interior-thread";
  group.add(thread);

  // Trilhos longitudinais (ângulos irregulares, de propósito).
  const railGeometry = new THREE.BoxGeometry(0.09, 0.15, 4.3);
  [0.55, 2.35, 4.45].forEach((angle) => {
    const rail = new THREE.Mesh(railGeometry, champagne);
    rail.position.set(Math.cos(angle) * 1.12, Math.sin(angle) * 1.12, -0.8);
    rail.rotation.z = angle;
    group.add(rail);
  });

  // Elementos de lente: z, raio, espessura relativa.
  const elements: Array<[number, number, number]> = [
    [1.0, 1.02, 0.17],
    [0.2, 0.96, 0.22],
    [-0.62, 0.9, 0.16],
    [-1.4, 0.98, 0.24],
    [-2.25, 0.88, 0.18],
  ];
  elements.forEach(([z, radius, thickness], index) => {
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(radius, radialSegments, quality === "high" ? 24 : 16),
      glass,
    );
    lens.scale.z = thickness;
    lens.position.z = z;
    group.add(lens);

    const seat = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.04, 0.075, 12, radialSegments), index % 2 ? champagne : steel);
    seat.position.z = z;
    group.add(seat);

    const bevel = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.97, 0.01, 6, radialSegments),
      index % 2 ? lilacCoating : coating,
    );
    bevel.position.z = z + thickness * radius * 0.12;
    group.add(bevel);
  });

  // Anteparos (diafragmas) entre os elementos.
  [0.6, -0.2, -1.0, -1.82, -2.72].forEach((z, index) => {
    const innerRadius = 0.58 + (index % 3) * 0.05;
    const baffle = new THREE.Mesh(new THREE.RingGeometry(innerRadius, 1.17, radialSegments), black);
    baffle.position.z = z;
    group.add(baffle);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(innerRadius, 0.012, 6, radialSegments), coating);
    rim.position.z = z + 0.002;
    group.add(rim);
  });

  // Parafusos de fixação em dois anéis.
  const screwGeometry = new THREE.CylinderGeometry(0.036, 0.036, 0.07, 10);
  const screwMatrix = new THREE.Matrix4();
  const screwCount = 14;
  const screws = new THREE.InstancedMesh(screwGeometry, champagne, screwCount);
  for (let index = 0; index < screwCount; index += 1) {
    const ringIndex = index % 2;
    const angle = (index / screwCount) * Math.PI * 2 + ringIndex * 0.22;
    const z = ringIndex ? -0.2 : -1.82;
    screwMatrix.makeRotationX(Math.PI / 2);
    screwMatrix.setPosition(Math.cos(angle) * 1.06, Math.sin(angle) * 1.06, z + 0.02);
    screws.setMatrixAt(index, screwMatrix);
  }
  group.add(screws);

  return group;
}

/** Multi-part microscope objective, composed to read as an instrument rather than a portal. */
export function createMicroscopeObjective(quality: Quality = "high") {
  const root = new THREE.Group();
  root.name = "microscope-assembly";

  const radialSegments = quality === "high" ? 72 : quality === "medium" ? 52 : 36;
  const graphite = metal(GRAPHITE, 0.23);
  const steel = metal(BLACKENED_STEEL, 0.16);
  const champagne = metal(CHAMPAGNE, 0.3);
  const matte = new THREE.MeshStandardMaterial({ color: 0x050709, roughness: 0.82, metalness: 0.35 });
  const innerBlack = new THREE.MeshStandardMaterial({ color: 0x010203, roughness: 0.94, metalness: 0.05 });

  const profile = [
    new THREE.Vector2(1.1, -4.45),
    new THREE.Vector2(1.32, -4.45),
    new THREE.Vector2(1.56, -4.12),
    new THREE.Vector2(1.64, -3.0),
    new THREE.Vector2(1.57, -2.8),
    new THREE.Vector2(1.57, -1.18),
    new THREE.Vector2(1.43, -0.96),
    new THREE.Vector2(1.24, -0.18),
    new THREE.Vector2(1.04, 0.42),
    new THREE.Vector2(0.9, 1.38),
    new THREE.Vector2(0.8, 2.05),
    new THREE.Vector2(0.74, 2.34),
  ];
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(profile, radialSegments), graphite);
  barrel.rotation.x = Math.PI / 2;
  root.add(barrel);

  // Frisos usinados quebram a leitura de um único cone plástico no macro close.
  [-4.2, -3.96, -3.72, -3.48, -3.24, -0.92, 0.34, 1.34].forEach((z, index) => {
    addAnnulus(root, index < 5 ? 1.59 : index < 7 ? 1.05 : 0.86, 0.018, z, index % 2 ? steel : champagne);
  });

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.62, 1.62, 0.78, radialSegments, 1, true),
    champagne,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.z = -2.36;
  root.add(collar);

  const markingsTexture = createObjectiveMarkings();
  if (markingsTexture) {
    const markings = new THREE.Mesh(
      new THREE.CylinderGeometry(1.635, 1.635, 1.08, radialSegments, 1, true),
      new THREE.MeshBasicMaterial({
        map: markingsTexture,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    markings.rotation.x = Math.PI / 2;
    markings.position.z = -1.62;
    markings.rotation.z = -0.42;
    markings.name = "objective-technical-markings";
    root.add(markings);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 0.48),
      new THREE.MeshBasicMaterial({ map: markingsTexture, transparent: true, opacity: 0.88, depthWrite: false }),
    );
    label.position.set(-1.3, -0.68, -1.58);
    label.lookAt(new THREE.Vector3(-8, -4.2, 9));
    label.name = "objective-readable-engraving";
    root.add(label);
  }

  const mountingStem = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.19, 1.7, radialSegments, 1, true),
    steel,
  );
  mountingStem.rotation.x = Math.PI / 2;
  mountingStem.position.z = -5.16;
  root.add(mountingStem);
  addAnnulus(root, 1.06, 0.045, -6.0, graphite);

  addAnnulus(root, 1.55, 0.055, -2.78, steel);
  addAnnulus(root, 1.55, 0.055, -1.94, steel);
  addAnnulus(root, 0.89, 0.075, 2.16, steel);
  addAnnulus(root, 0.79, 0.045, 2.26, champagne);

  const knurlGeometry = new THREE.BoxGeometry(0.045, 0.16, 0.46);
  const knurlCount = quality === "low" ? 36 : 60;
  const knurl = new THREE.InstancedMesh(knurlGeometry, steel, knurlCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < knurlCount; index += 1) {
    const angle = (index / knurlCount) * Math.PI * 2;
    const position = new THREE.Vector3(Math.cos(angle) * 1.67, Math.sin(angle) * 1.67, -3.48);
    quaternion.setFromEuler(new THREE.Euler(0, 0, angle));
    matrix.compose(position, quaternion, scale);
    knurl.setMatrixAt(index, matrix);
  }
  root.add(knurl);

  const retainingTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.88, 0.72, radialSegments, 1, true),
    matte,
  );
  retainingTube.rotation.x = Math.PI / 2;
  retainingTube.position.z = 1.92;
  root.add(retainingTube);

  const frontGlass = new THREE.MeshPhysicalMaterial({
    color: 0x6f948b,
    metalness: 0,
    roughness: 0.08,
    transmission: 0,
    transparent: true,
    opacity: 0.54,
    ior: 1.52,
    thickness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color(0x759d95),
    attenuationDistance: 3.4,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
  });
  const rearGlass = new THREE.MeshPhysicalMaterial({
    color: 0x7f6e8c,
    metalness: 0,
    roughness: 0.12,
    transmission: 0,
    transparent: true,
    opacity: 0.34,
    ior: 1.61,
    thickness: 0.38,
    clearcoat: 0.9,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  });

  const frontLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, radialSegments, quality === "high" ? 32 : 20),
    frontGlass,
  );
  frontLens.name = "front-optical-element";
  frontLens.position.z = 2.2;
  frontLens.scale.z = 0.2;
  root.add(frontLens);

  const rearLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, radialSegments, quality === "high" ? 28 : 18),
    rearGlass,
  );
  rearLens.scale.z = 0.15;
  rearLens.position.z = 1.58;
  root.add(rearLens);

  const aperture = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.75, radialSegments), innerBlack);
  aperture.position.z = 1.48;
  root.add(aperture);

  // A abertura permanece vazada: a câmera atravessa o diafragma sem um disco opaco no caminho.

  const coating = new THREE.MeshBasicMaterial({
    color: MINT,
    transparent: true,
    opacity: 0.28,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });
  const coatingArc = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.01, 6, 42, Math.PI * 0.62), coating);
  coatingArc.position.z = 2.43;
  coatingArc.rotation.z = 0.72;
  root.add(coatingArc);

  const interior = createOpticalInterior(quality);
  interior.scale.set(0.7, 0.7, 1);
  root.add(interior);

  return root;
}

interface WorldRig {
  worlds: Record<SpecimenWorldId, SpecimenWorldRig>;
  weights: Record<SpecimenWorldId, number>;
}

interface SpecimenMaterialEntry {
  material: THREE.Material;
  baseOpacity: number;
  baseColor?: THREE.Color;
}

interface SpecimenWorldRig {
  group: THREE.Group;
  materials: SpecimenMaterialEntry[];
  backdrop: THREE.Mesh;
  ecology: SpecimenFieldSystem | null;
}

function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, tubularSegments = 72) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), tubularSegments, radius, 8, false),
    material,
  );
}

/**
 * Plano de fundo do campo microscópico: iluminação (poça de luz de Köhler), granulação de
 * preparação e estruturas fantasma fora do plano focal. Não é um cinza chapado: o centro
 * é luminoso (verde-azulado claro) e a borda cai para o verde profundo do meio.
 * `toneMapped = false`: a cor é a do projeto, não a do tone mapping do estúdio.
 */
function createFieldBackdrop(quality: Quality) {
  const width = quality === "low" ? 640 : 1024;
  const height = Math.round(width * 0.625);
  let map: THREE.CanvasTexture | undefined;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#04100f";
      context.fillRect(0, 0, width, height);
      const pool = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.58);
      pool.addColorStop(0, "rgb(138, 226, 202)");
      pool.addColorStop(0.18, "rgb(92, 184, 162)");
      pool.addColorStop(0.42, "rgb(40, 112, 102)");
      pool.addColorStop(0.72, "rgb(11, 42, 40)");
      pool.addColorStop(1, "rgb(4, 16, 16)");
      context.fillStyle = pool;
      context.fillRect(0, 0, width, height);

      // Granulação da preparação: só frequências altas (grão fino), em sobreposição suave e de
      // baixo contraste. Frequências baixas formariam manchas largas, de aspecto "quadro-negro".
      const grain = createNoiseCanvas(41, 256, [64, 128]);
      if (grain) {
        context.globalCompositeOperation = "soft-light";
        context.globalAlpha = 0.16;
        const pattern = context.createPattern(grain, "repeat");
        if (pattern) {
          context.fillStyle = pattern;
          context.fillRect(0, 0, width, height);
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
      }
      // Partículas finas da preparação (poeira de lâmina), em pontos de 1–2 px.
      const specks = seededRandom(97);
      for (let index = 0; index < (quality === "low" ? 160 : 420); index += 1) {
        context.fillStyle = `rgba(190, 232, 218, ${0.05 + specks() * 0.16})`;
        const size = 0.7 + specks() * 1.5;
        context.fillRect(specks() * width, specks() * height, size, size);
      }

      // Estruturas fora do plano focal: bolhas e células de borda suave (centro claro, aro mais
      // escuro e um halo de refração), em vários tamanhos para sugerir profundidade.
      const random = seededRandom(613);
      const bubbles = quality === "low" ? 14 : 26;
      for (let index = 0; index < bubbles; index += 1) {
        const x = random() * width;
        const y = random() * height;
        const radius = 9 + Math.pow(random(), 1.7) * 78;
        const soft = 0.5 + random() * 0.45;
        const strength = 0.1 + random() * 0.12;
        const body = context.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        body.addColorStop(0, `rgba(176, 230, 212, ${strength * 0.5})`);
        body.addColorStop(0.72, `rgba(120, 190, 172, ${strength * 0.35})`);
        body.addColorStop(0.9, `rgba(8, 26, 26, ${strength * (1.4 - soft)})`);
        body.addColorStop(0.97, `rgba(214, 246, 232, ${strength * soft * 1.3})`);
        body.addColorStop(1, "rgba(214, 246, 232, 0)");
        context.fillStyle = body;
        context.beginPath();
        context.ellipse(x, y, radius, radius * (0.8 + random() * 0.2), random() * Math.PI, 0, Math.PI * 2);
        context.fill();
      }
      map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 2;
      map.wrapS = THREE.ClampToEdgeWrapping;
    }
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 27.5),
    new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      toneMapped: false,
      fog: false,
      depthWrite: false,
    }),
  );
  mesh.name = "field-backdrop";
  mesh.renderOrder = -10;
  mesh.userData.noFade = true;
  mesh.position.set(1.1, 0.2, -9);
  return mesh;
}

function createFocalField(quality: Quality) {
  const field = new THREE.Group();
  field.name = "prepared-slide-focal-field";
  const fiberMaterial = new THREE.MeshStandardMaterial({
    color: 0x76988d,
    emissive: 0x0b211b,
    emissiveIntensity: 0.16,
    roughness: 0.74,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const random = seededRandom(503);
  const fiberCount = quality === "low" ? 7 : quality === "medium" ? 11 : 15;
  for (let index = 0; index < fiberCount; index += 1) {
    const y = (random() - 0.5) * 7;
    const z = -2 - random() * 6;
    const points = Array.from({ length: 5 }, (_, pointIndex) => {
      const x = -7 + pointIndex * 3.5;
      return new THREE.Vector3(x, y + Math.sin(pointIndex * 1.4 + index) * (0.2 + random() * 0.45), z + (random() - 0.5) * 0.5);
    });
    const fiber = tube(points, 0.009 + random() * 0.018, fiberMaterial, quality === "low" ? 28 : 52);
    fiber.rotation.z = (random() - 0.5) * 0.32;
    field.add(fiber);
  }
  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0x94b2a9,
    transparent: true,
    opacity: 0.035,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let index = 0; index < (quality === "low" ? 5 : 9); index += 1) {
    const ghost = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 48), ghostMaterial);
    ghost.position.set((random() - 0.5) * 12, (random() - 0.5) * 7, -4 - random() * 5);
    ghost.scale.setScalar(0.7 + random() * 1.4);
    field.add(ghost);
  }
  return field;
}

const WORLD_IDS: readonly SpecimenWorldId[] = ["giardia", "blood", "stool"];

function registerMaterial(
  entries: SpecimenMaterialEntry[],
  material: THREE.Material,
  baseOpacity = material.opacity,
) {
  material.transparent = true;
  material.opacity = 0;
  entries.push({
    material,
    baseOpacity,
    ...(material instanceof THREE.MeshBasicMaterial ? { baseColor: material.color.clone() } : {}),
  });
  return material;
}

function createPreparationTexture(id: SpecimenWorldId, quality: Quality) {
  if (typeof document === "undefined") return undefined;
  const width = quality === "low" ? 640 : 1024;
  const height = Math.round(width * 0.625);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const palette = {
    giardia: ["#111811", "#52624b", "#879773"],
    blood: ["#211b28", "#665967", "#9e8990"],
    stool: ["#1d170e", "#76613a", "#b59b62"],
  } as const;
  const [edge, middle, center] = palette[id];
  context.fillStyle = edge;
  context.fillRect(0, 0, width, height);
  const pool = context.createRadialGradient(width * 0.48, height * 0.47, 0, width * 0.5, height * 0.5, width * 0.62);
  pool.addColorStop(0, center);
  pool.addColorStop(0.38, middle);
  pool.addColorStop(1, edge);
  context.fillStyle = pool;
  context.fillRect(0, 0, width, height);

  const noise = createNoiseCanvas(id === "giardia" ? 171 : id === "blood" ? 271 : 371, 256, [24, 48, 96]);
  if (noise) {
    context.globalCompositeOperation = id === "blood" ? "soft-light" : "multiply";
    context.globalAlpha = id === "stool" ? 0.28 : 0.16;
    const pattern = context.createPattern(noise, "repeat");
    if (pattern) {
      context.fillStyle = pattern;
      context.fillRect(0, 0, width, height);
    }
  }
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;

  const random = seededRandom(id === "giardia" ? 713 : id === "blood" ? 811 : 919);
  const flecks = quality === "low" ? 120 : id === "stool" ? 420 : 260;
  for (let index = 0; index < flecks; index += 1) {
    const clustered = index % 3 === 0;
    const x = (clustered ? 0.2 + random() * 0.36 : random()) * width;
    const y = (clustered ? 0.38 + random() * 0.48 : random()) * height;
    const radius = 0.45 + Math.pow(random(), 2.1) * (id === "stool" ? 3.4 : 2.1);
    context.fillStyle = id === "blood"
      ? `rgba(92,55,86,${0.035 + random() * 0.09})`
      : id === "stool"
        ? `rgba(44,30,11,${0.07 + random() * 0.16})`
        : `rgba(48,57,31,${0.04 + random() * 0.12})`;
    context.beginPath();
    context.ellipse(x, y, radius * (0.6 + random()), radius * (0.4 + random() * 0.7), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  if (id === "stool") {
    // Sedimento fecal distribuído no próprio substrato: massas amorfas, microfragmentos,
    // raros artefatos angulares e impurezas circulares. A baixa opacidade impede que o
    // fundo concorra com o ovo, mas evita a leitura de um palco vazio.
    context.save();
    context.globalCompositeOperation = "multiply";
    const masses = quality === "low" ? 24 : 44;
    for (let index = 0; index < masses; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const rx = width * (0.012 + random() * 0.045);
      const ry = height * (0.01 + random() * 0.04);
      const points = 7 + Math.floor(random() * 5);
      context.beginPath();
      for (let point = 0; point < points; point += 1) {
        const angle = (point / points) * Math.PI * 2;
        const jitter = 0.62 + random() * 0.55;
        const px = x + Math.cos(angle) * rx * jitter;
        const py = y + Math.sin(angle) * ry * jitter;
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fillStyle = `rgba(${34 + Math.floor(random() * 25)},${25 + Math.floor(random() * 20)},${10 + Math.floor(random() * 12)},${0.05 + random() * 0.09})`;
      context.fill();
    }
    const fragments = quality === "low" ? 45 : 95;
    context.lineCap = "round";
    for (let index = 0; index < fragments; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const length = 2 + random() * 11;
      const angle = random() * Math.PI;
      context.strokeStyle = `rgba(52,39,18,${0.055 + random() * 0.1})`;
      context.lineWidth = 0.5 + random() * 1.8;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(
        x + Math.cos(angle + 0.55) * length * 0.5,
        y + Math.sin(angle + 0.55) * length * 0.5,
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length,
      );
      context.stroke();
    }
    context.globalCompositeOperation = "screen";
    const artifacts = quality === "low" ? 10 : 18;
    for (let index = 0; index < artifacts; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const size = 1.5 + random() * 5;
      context.strokeStyle = `rgba(215,192,126,${0.035 + random() * 0.055})`;
      context.lineWidth = 0.6 + random();
      context.beginPath();
      context.moveTo(x, y - size);
      context.lineTo(x + size * 0.55, y);
      context.lineTo(x, y + size);
      context.lineTo(x - size * 0.55, y);
      context.closePath();
      context.stroke();
    }
    context.restore();
  } else if (id === "giardia") {
    context.save();
    context.globalCompositeOperation = "screen";
    const haze = quality === "low" ? 8 : 14;
    for (let index = 0; index < haze; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 7 + random() * 24;
      const veil = context.createRadialGradient(x, y, 0, x, y, radius);
      veil.addColorStop(0, `rgba(195,210,174,${0.025 + random() * 0.025})`);
      veil.addColorStop(1, "rgba(195,210,174,0)");
      context.fillStyle = veil;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function createSpecimenBackdrop(id: SpecimenWorldId, quality: Quality, entries: SpecimenMaterialEntry[]) {
  const material = registerMaterial(entries, new THREE.MeshBasicMaterial({
    map: createPreparationTexture(id, quality),
    color: 0xffffff,
    toneMapped: false,
    fog: false,
    depthWrite: false,
  }), 1);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), material);
  mesh.name = `specimen-${id}-backdrop`;
  mesh.position.set(0, 0, -14);
  mesh.renderOrder = -20;
  mesh.userData.noFade = true;
  return mesh;
}

function createSoftParticleTexture() {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const gradient = context.createRadialGradient(24, 24, 2, 24, 24, 23);
  gradient.addColorStop(0, "rgba(255,255,255,.72)");
  gradient.addColorStop(0.5, "rgba(255,255,255,.3)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 48, 48);
  return new THREE.CanvasTexture(canvas);
}

function createGranularLayer(
  seed: number,
  count: number,
  color: number,
  size: number,
  opacity: number,
  z: readonly [number, number],
  entries: SpecimenMaterialEntry[],
) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const cluster = index % 4;
    const cx = [-4.8, -1.2, 3.6, 5.2][cluster];
    const cy = [2.2, -2.1, 1.4, -1.6][cluster];
    const clustered = random() < 0.68;
    positions[index * 3] = clustered ? cx + (random() - 0.5) * 3.1 : (random() - 0.5) * 15;
    positions[index * 3 + 1] = clustered ? cy + (random() - 0.5) * 2.2 : (random() - 0.5) * 8.5;
    positions[index * 3 + 2] = z[0] + random() * (z[1] - z[0]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = registerMaterial(entries, new THREE.PointsMaterial({
    color,
    map: createSoftParticleTexture(),
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
  }), opacity);
  const points = new THREE.Points(geometry, material);
  points.userData.noFade = true;
  return points;
}

function irregularShape(seed: number, radius = 1, vertices = 9) {
  const random = seededRandom(seed);
  const shape = new THREE.Shape();
  const points: Array<[number, number]> = [];
  for (let index = 0; index < vertices; index += 1) {
    const angle = (index / vertices) * Math.PI * 2;
    const r = radius * (0.58 + random() * 0.5);
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  const last = points[points.length - 1];
  const first = points[0];
  shape.moveTo((last[0] + first[0]) * 0.5, (last[1] + first[1]) * 0.5);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    shape.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) * 0.5, (point[1] + next[1]) * 0.5);
  });
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function createOrganicFragments(
  seed: number,
  count: number,
  palette: readonly number[],
  entries: SpecimenMaterialEntry[],
  quality: Quality,
  options: {
    opacity?: number;
    scale?: readonly [number, number];
    z?: readonly [number, number];
    spread?: number;
    uniform?: boolean;
    renderOrder?: number;
  } = {},
) {
  const group = new THREE.Group();
  const random = seededRandom(seed);
  const variants = quality === "low" ? 2 : 4;
  for (let variant = 0; variant < variants; variant += 1) {
    const baseOpacity = (options.opacity ?? 0.16) + variant * 0.018;
    const material = registerMaterial(entries, new THREE.MeshStandardMaterial({
      color: palette[variant % palette.length],
      emissive: palette[variant % palette.length],
      emissiveIntensity: 0.07,
      roughness: 0.95,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
    }), baseOpacity);
    const amount = Math.ceil(count / variants);
    const mesh = new THREE.InstancedMesh(irregularShape(seed + variant * 17, 1, 7 + variant), material, amount);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    for (let index = 0; index < amount; index += 1) {
      const pocket = (index + variant) % 5;
      const centers = [[-5, 2.5], [-3, -2.4], [2.8, 2.1], [5.5, -1.5], [0.5, -3.1]];
      const center = centers[pocket];
      const z = options.z ?? [-5.7, -3.3];
      const spread = options.spread ?? 1;
      position.set(
        options.uniform ? (random() - 0.5) * 15.5 : center[0] + (random() - 0.5) * 3.3 * spread,
        options.uniform ? (random() - 0.5) * 8.4 : center[1] + (random() - 0.5) * 2.2 * spread,
        z[0] + random() * (z[1] - z[0]),
      );
      quaternion.setFromEuler(new THREE.Euler(0, 0, random() * Math.PI));
      const scaleRange = options.scale ?? [0.07, 0.53];
      const s = scaleRange[0] + Math.pow(random(), 1.9) * (scaleRange[1] - scaleRange[0]);
      scale.set(s * (0.72 + random() * 1.15), s * (0.48 + random() * 0.78), 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = options.renderOrder ?? 0;
    mesh.userData.noFade = true;
    group.add(mesh);
  }
  return group;
}

function createRbcLayer(
  quality: Quality,
  entries: SpecimenMaterialEntry[],
  options: {
    seed: number;
    count: readonly [number, number, number];
    z: readonly [number, number];
    opacity: number;
    diameter: number;
    softness: number;
    renderOrder?: number;
  },
) {
  const count = quality === "high" ? options.count[2] : quality === "medium" ? options.count[1] : options.count[0];
  const material = registerMaterial(entries, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uSoftness: { value: options.softness } },
    vertexShader: `
      attribute vec3 instanceShape;
      varying vec2 vUv;
      varying vec3 vShape;
      void main(){ vUv=uv; vShape=instanceShape; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vShape;
      uniform float uOpacity;
      uniform float uSoftness;
      void main(){
        vec2 p=(vUv-.5)*2.;
        float angle=atan(p.y,p.x);
        float contour=1.+.026*sin(angle*3.+vShape.x*6.283)+.018*sin(angle*5.+vShape.y*6.283);
        float r=length(p)/contour;
        float edge=1.-smoothstep(.78-uSoftness*.16,1.,r);
        float rim=smoothstep(.40-uSoftness*.10,.73,r)*(1.-smoothstep(.71,1.,r));
        float center=1.-smoothstep(.18,.55,r);
        vec3 pale=vec3(.72,.58,.63); vec3 stained=vec3(.42,.22,.34);
        vec3 color=mix(pale,stained,rim*(.64+.16*vShape.z)); color=mix(color,vec3(.80,.71,.72),center*(.64+.12*vShape.y));
        gl_FragColor=vec4(color,edge*(.34+rim*.26)*uOpacity);
      }
    `,
  }), options.opacity);
  const geometry = new THREE.PlaneGeometry(options.diameter, options.diameter, 1, 1);
  const shapes = new Float32Array(count * 3);
  geometry.setAttribute("instanceShape", new THREE.InstancedBufferAttribute(shapes, 3));
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = seededRandom(options.seed);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    const centers = [
      [-11.5, 4.2], [-8.4, -3.8], [-6.2, 2.5], [-3.1, -1.8],
      [-0.8, 3.6], [1.8, -3.2], [4.5, 2.1], [7.2, -2.4],
      [9.8, 3.8], [12.4, -1.2],
    ];
    const center = centers[(index * 7 + Math.floor(random() * centers.length)) % centers.length];
    // 55% monocamada distribuída cobrindo todas as bordas e 45% em cadeias/rouleaux
    const inChain = random() < 0.45;
    const x = inChain
      ? center[0] + (random() - 0.5) * 3.8
      : (random() - 0.5) * 32;
    const y = inChain
      ? center[1] + (random() - 0.5) * 3.0
      : (random() - 0.5) * 20;
    position.set(x, y, options.z[0] + random() * (options.z[1] - options.z[0]));
    quaternion.setFromEuler(new THREE.Euler(
      (random() - 0.5) * 0.35,
      (random() - 0.5) * 0.35,
      random() * Math.PI * 2,
    ));
    const s = 0.48 + random() * 0.28;
    scale.set(s * (0.92 + random() * 0.16), s * (0.84 + random() * 0.2), 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    shapes[index * 3] = random();
    shapes[index * 3 + 1] = random();
    shapes[index * 3 + 2] = random();
  }
  mesh.instanceMatrix.needsUpdate = true;
  geometry.getAttribute("instanceShape").needsUpdate = true;
  mesh.renderOrder = options.renderOrder ?? 0;
  mesh.userData.noFade = true;
  return mesh;
}

function createPlateletLayer(entries: SpecimenMaterialEntry[], quality: Quality) {
  const count = quality === "low" ? 18 : quality === "medium" ? 34 : 52;
  const material = registerMaterial(entries, new THREE.MeshBasicMaterial({
    color: 0x6e4368,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), 0.52);
  const geometry = new THREE.CircleGeometry(0.12, 7);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = seededRandom(2487);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const clumps = [
    [-6.5, 1.8], [-2.8, -2.4], [1.2, 2.2], [5.8, -1.9], [-9.2, -1.5], [8.4, 2.7],
  ];
  for (let index = 0; index < count; index += 1) {
    const clump = clumps[index % clumps.length];
    const clustered = random() < 0.72;
    const x = clustered ? clump[0] + (random() - 0.5) * 1.8 : (random() - 0.5) * 28;
    const y = clustered ? clump[1] + (random() - 0.5) * 1.4 : (random() - 0.5) * 18;
    position.set(x, y, -6.4 + random() * 1.8);
    quaternion.setFromEuler(new THREE.Euler(0, 0, random() * Math.PI));
    const s = 0.55 + random() * 0.95;
    scale.set(s, s * (0.65 + random() * 0.5), 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = 14;
  mesh.userData.noFade = true;
  return mesh;
}

function createVesicleLayer(entries: SpecimenMaterialEntry[], quality: Quality) {
  const count = quality === "low" ? 9 : quality === "medium" ? 14 : 18;
  const material = registerMaterial(entries, new THREE.MeshBasicMaterial({
    color: 0xb7c5a2,
    transparent: true,
    opacity: 0.085,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), 0.085);
  const mesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.46, 0.52, 38), material, count);
  const random = seededRandom(1327);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    position.set((random() - 0.5) * 15.5, (random() - 0.5) * 8.2, -7.2 + random() * 3.5);
    quaternion.setFromEuler(new THREE.Euler(0, 0, random() * Math.PI));
    const size = 0.18 + Math.pow(random(), 2) * 0.48;
    scale.set(size * (0.72 + random() * 0.5), size, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.noFade = true;
  return mesh;
}

function createShortFibers(
  seed: number,
  count: number,
  color: number,
  opacity: number,
  entries: SpecimenMaterialEntry[],
  z: readonly [number, number],
) {
  const group = new THREE.Group();
  const random = seededRandom(seed);
  const material = registerMaterial(entries, new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  }), opacity);
  for (let index = 0; index < count; index += 1) {
    const x = (random() - 0.5) * 15;
    const y = (random() - 0.5) * 8;
    const depth = z[0] + random() * (z[1] - z[0]);
    const length = 0.45 + random() * 1.15;
    const bend = (random() - 0.5) * 0.48;
    const points = [
      new THREE.Vector3(x - length * 0.5, y, depth),
      new THREE.Vector3(x, y + bend, depth + 0.03),
      new THREE.Vector3(x + length * 0.5, y + bend * 0.2, depth),
    ];
    const strand = tube(points, 0.009 + random() * 0.012, material, 10);
    strand.userData.noFade = true;
    group.add(strand);
  }
  return group;
}

function createCrystalArtifacts(entries: SpecimenMaterialEntry[], quality: Quality) {
  const count = quality === "low" ? 6 : quality === "medium" ? 10 : 14;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.72);
  shape.lineTo(0.42, 0);
  shape.lineTo(0, -0.72);
  shape.lineTo(-0.42, 0);
  shape.closePath();
  const material = registerMaterial(entries, new THREE.MeshBasicMaterial({
    color: 0xcab477,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), 0.1);
  const mesh = new THREE.InstancedMesh(new THREE.ShapeGeometry(shape), material, count);
  const random = seededRandom(2089);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    position.set((random() - 0.5) * 15, (random() - 0.5) * 8, -7 + random() * 3.2);
    quaternion.setFromEuler(new THREE.Euler(0, 0, random() * Math.PI));
    const size = 0.1 + random() * 0.25;
    scale.set(size * (0.65 + random() * 0.65), size, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.noFade = true;
  return mesh;
}

function createBubbleLayer(entries: SpecimenMaterialEntry[], quality: Quality) {
  const material = registerMaterial(entries, new THREE.MeshBasicMaterial({
    color: 0xd8c68b,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), 0.1);
  const count = quality === "low" ? 7 : quality === "medium" ? 11 : 15;
  const mesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.72, 0.79, 52), material, count);
  const random = seededRandom(2011);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    position.set((random() - 0.5) * 14.5, (random() - 0.5) * 7.8, -6.8 + random() * 2.2);
    quaternion.setFromEuler(new THREE.Euler(0, 0, random() * Math.PI));
    const size = 0.18 + Math.pow(random(), 1.7) * 0.72;
    scale.set(size, size * (0.8 + random() * 0.25), 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.noFade = true;
  return mesh;
}

function createSpecimenWorld(id: SpecimenWorldId, quality: Quality): SpecimenWorldRig {
  const group = new THREE.Group();
  group.name = `specimen-world-${id}`;
  const materials: SpecimenMaterialEntry[] = [];
  const backdrop = createSpecimenBackdrop(id, quality, materials);
  group.add(backdrop);
  const ecology = createSpecimenFieldSystem(id, quality);
  if (ecology) {
    ecology.materials.forEach((entry) => materials.push(entry));
    group.add(ecology.root);
  }

  if (id === "giardia") {
    group.add(createOrganicFragments(
      1171,
      quality === "low" ? 12 : 22,
      [0x405044, 0x73806a, 0x56664e],
      materials,
      quality,
      { opacity: 0.075, scale: [0.55, 1.8], z: [-8.3, -7.1], spread: 1.5 },
    ));
    group.add(createGranularLayer(1193, quality === "low" ? 24 : 46, 0x9ba58b, 0.48, 0.065, [-7.8, -5.9], materials));
    group.add(createGranularLayer(1201, quality === "low" ? 220 : 440, 0xb5c39a, 0.045, 0.28, [-7.5, -4.1], materials));
    group.add(createOrganicFragments(
      1223,
      quality === "low" ? 42 : 76,
      [0x65705b, 0x8b8c68, 0x4e6350],
      materials,
      quality,
      { opacity: 0.105, scale: [0.045, 0.34], z: [-7.2, -4.1], spread: 1.15 },
    ));
    group.add(createOrganicFragments(
      1259,
      quality === "low" ? 14 : 26,
      [0x71816b, 0x9a9a77, 0x52645a],
      materials,
      quality,
      { opacity: 0.075, scale: [0.16, 0.66], z: [-6.8, -4.2], spread: 1.25, uniform: true },
    ));
    group.add(createShortFibers(1283, quality === "low" ? 5 : 9, 0xb1bea0, 0.075, materials, [-6.9, -4.3]));
    const mucous = registerMaterial(materials, new THREE.MeshBasicMaterial({ color: 0xc3cfaa, transparent: true, opacity: 0.11, depthWrite: false }), 0.11);
    [
      [[-6, 2.8, -5.4], [-4.9, 2.5, -5.2], [-4.0, 2.9, -5.5]],
      [[2.6, -2.5, -5.1], [3.5, -2.1, -5.4], [4.6, -2.4, -5.2]],
      [[4.3, 2.5, -6.1], [5.2, 2.0, -5.8], [6.0, 2.2, -6.0]],
    ].forEach((points) => {
      const strand = tube(points.map((point) => new THREE.Vector3(point[0], point[1], point[2])), 0.018, mucous, 24);
      strand.userData.noFade = true;
      group.add(strand);
    });
    group.add(createOrganicFragments(
      1307,
      quality === "low" ? 4 : 7,
      [0x87967a, 0x566957, 0x9da185],
      materials,
      quality,
      { opacity: 0.055, scale: [0.7, 1.65], z: [-3.75, -3.15], spread: 1.55, uniform: true, renderOrder: 42 },
    ));
  } else if (id === "blood") {
    group.add(createRbcLayer(quality, materials, {
      seed: 1471,
      count: [36, 64, 96],
      z: [-8.3, -7.15],
      opacity: 0.38,
      diameter: 2.1,
      softness: 0.95,
      renderOrder: -3,
    }));
    group.add(createRbcLayer(quality, materials, {
      seed: 1493,
      count: [80, 140, 220],
      z: [-6.7, -4.9],
      opacity: 0.68,
      diameter: 1.52,
      softness: 0.16,
      renderOrder: 10,
    }));
    group.add(createRbcLayer(quality, materials, {
      seed: 1511,
      count: [12, 20, 30],
      z: [-4.6, -3.3],
      opacity: 0.28,
      diameter: 2.4,
      softness: 0.82,
      renderOrder: 42,
    }));
    group.add(createPlateletLayer(materials, quality));
    group.add(createGranularLayer(1531, quality === "low" ? 180 : 360, 0x765d75, 0.035, 0.18, [-7.5, -4.1], materials));
    group.add(createGranularLayer(1553, quality === "low" ? 35 : 70, 0xc0aeb7, 0.18, 0.07, [-7.8, -4.4], materials));
  } else if (id === "stool") {
    group.add(createGranularLayer(1793, quality === "low" ? 34 : 72, 0x806b45, 0.48, 0.095, [-8.2, -6.1], materials));
    group.add(createGranularLayer(1811, quality === "low" ? 340 : 720, 0xc3a66b, 0.047, 0.34, [-7.8, -4.0], materials));
    group.add(createGranularLayer(1829, quality === "low" ? 75 : 150, 0x4c3b20, 0.095, 0.22, [-6.9, -3.9], materials));
    group.add(createOrganicFragments(
      1847,
      quality === "low" ? 58 : 112,
      [0x68532e, 0x8b7444, 0x4d4228, 0xa08d58],
      materials,
      quality,
      { opacity: 0.19, scale: [0.035, 0.38], z: [-7.2, -4.0], spread: 1.18, uniform: true },
    ));
    group.add(createOrganicFragments(
      1871,
      quality === "low" ? 16 : 30,
      [0x3e321d, 0x756039, 0x91764a],
      materials,
      quality,
      { opacity: 0.12, scale: [0.24, 0.68], z: [-8.0, -6.2], spread: 1.35, uniform: true },
    ));
    group.add(createOrganicFragments(
      1889,
      quality === "low" ? 10 : 18,
      [0x5a4729, 0x7c6338, 0x41351f],
      materials,
      quality,
      { opacity: 0.095, scale: [0.18, 0.52], z: [-4.0, -3.35], spread: 1.42, uniform: true },
    ));
    group.add(createShortFibers(1931, quality === "low" ? 8 : 16, 0x927b4c, 0.105, materials, [-7.0, -4.2]));
    group.add(createCrystalArtifacts(materials, quality));
    group.add(createBubbleLayer(materials, quality));
  }

  group.traverse((object) => {
    if ((object as THREE.Mesh).material) object.userData.noFade = true;
  });
  return { group, materials, backdrop, ecology };
}

/**
 * Ambiente biológico artístico: membranas, volumes suaves e profundidade fluida.
 * Translucidez por alpha com PBR padrão (sem `transmission`, clearcoat nem iridescência): a passagem de
 * transmissão do three.js re-renderiza a cena opaca e custava segundos por quadro em GL por software.
 */
export function createMicroscopicWorld(quality: Quality = "high") {
  const world = new THREE.Group();
  world.name = "microscopic-world";
  const worlds = {
    giardia: createSpecimenWorld("giardia", quality),
    blood: createSpecimenWorld("blood", quality),
    stool: createSpecimenWorld("stool", quality),
  } satisfies Record<SpecimenWorldId, SpecimenWorldRig>;
  WORLD_IDS.forEach((id) => world.add(worlds[id].group));
  const rig: WorldRig = { worlds, weights: specimenWorldWeights(0) };
  world.userData.rig = rig;
  world.userData.ready = Promise.all(
    WORLD_IDS.map((id) => worlds[id].ecology?.ready ?? Promise.resolve()),
  ).then(() => undefined);

  return world;
}

export async function waitForMicroscopicWorld(world: THREE.Group) {
  const ready = world.userData.ready as Promise<void> | undefined;
  await (ready ?? Promise.resolve());
}

/**
 * Posiciona o micromundo como função PURA do progresso.
 * Substitui o antigo `updateSceneMotion(elapsedTime)`: nada aqui depende de relógio.
 */
export function updateMicroscopicWorld(
  world: THREE.Group,
  progress: number,
  detail = 1,
  exposure = 1,
) {
  const rig = world.userData.rig as WorldRig | undefined;
  if (!rig) return;
  const weights = specimenWorldWeights(progress);
  rig.weights = weights;
  WORLD_IDS.forEach((id, index) => {
    const specimen = rig.worlds[id];
    const weight = weights[id];
    specimen.ecology?.update(progress);
    specimen.group.visible = weight > 0.002;
    const chapter = id === "giardia"
      ? SPECIMEN_TIMELINE.chapters.giardia
      : id === "blood"
        ? SPECIMEN_TIMELINE.chapters["t-cruzi"]
        : SPECIMEN_TIMELINE.chapters.trichuris;
    const local = THREE.MathUtils.clamp(
      (progress - chapter.environment[0]) / Math.max(0.0001, chapter.transitionBuffer[1] - chapter.environment[0]),
      0,
      1,
    );
    const search = THREE.MathUtils.smoothstep(local, 0, 0.42);
    const depart = THREE.MathUtils.smoothstep(local, 0.78, 1);
    specimen.group.position.x = 0;
    specimen.group.position.y = 0;
    // O trajeto óptico atravessa o eixo z do micromundo. No início do esfregaço,
    // acompanha o campo sanguíneo até a objetiva assentar; sem esta compensação
    // as hemácias ficavam atrás da câmera justamente durante a etapa de busca.
    specimen.group.position.z = id === "blood"
      ? THREE.MathUtils.lerp(-2.65, 0, THREE.MathUtils.smoothstep(local, 0.02, 0.38))
      : 0;
    specimen.materials.forEach((entry) => {
      entry.material.opacity = entry.baseOpacity * detail * weight;
      if (entry.baseColor && entry.material instanceof THREE.MeshBasicMaterial) {
        entry.material.color.copy(entry.baseColor).multiplyScalar(0.52 + exposure * 0.48);
      }
      if (entry.material instanceof THREE.ShaderMaterial && entry.material.uniforms.uOpacity) {
        entry.material.uniforms.uOpacity.value = detail * weight;
      }
    });
  });
}

export function getSpecimenWorldWeights(world: THREE.Group) {
  const rig = world.userData.rig as WorldRig | undefined;
  return rig ? { ...rig.weights } : specimenWorldWeights(0);
}

/** Matéria suspensa, com aglomerados determinísticos. Posições no referencial óptico. */
export function createMicroscopicDust(count = 420) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = seededRandom(101);
  const mint = new THREE.Color(0x82aa9e);
  const lilac = new THREE.Color(0xa997b1);
  const neutral = new THREE.Color(0x9fa7a5);

  for (let index = 0; index < count; index += 1) {
    const cluster = Math.floor(random() * 5);
    const depth = -3.4 - random() * 13;
    const spread = 1.2 + Math.abs(depth + 10) * 0.3;
    positions[index * 3] = (random() - 0.5) * spread * 2 + (cluster - 2) * 0.42;
    positions[index * 3 + 1] = (random() - 0.5) * spread * 1.35;
    positions[index * 3 + 2] = depth;
    const color = random() > 0.72 ? lilac : random() > 0.45 ? mint : neutral;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  let texture: THREE.CanvasTexture | undefined;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 15);
      gradient.addColorStop(0, "rgba(255,255,255,.78)");
      gradient.addColorStop(0.22, "rgba(255,255,255,.42)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 32);
      texture = new THREE.CanvasTexture(canvas);
    }
  }

  const material = new THREE.PointsMaterial({
    size: 0.056,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.32,
    blending: THREE.NormalBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  // Limita o tamanho do ponto: partículas muito próximas da câmera viravam discos enormes
  // (overdraw alto) sem acrescentar informação visual.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <logdepthbuf_vertex>",
      "gl_PointSize = min(gl_PointSize, 22.0);\n#include <logdepthbuf_vertex>",
    );
  };
  const dust = new THREE.Points(geometry, material);
  dust.name = "microscopic-dust";
  return dust;
}

/**
 * Âncora (invisível) de destino ancorada ao espécime: o motor posiciona-a sobre o organismo e a
 * linha-guia da interface parte dela. Desde a Fase 2.3.9 os organismos próprios ocupam o lugar
 * dos anéis; nenhum anel ou ponto é desenhado sobre a anatomia.
 */
export function createHotspotMarker(id: string) {
  const marker = new THREE.Group();
  marker.name = `marker-${id}`;
  const anchor = new THREE.Mesh(
    new THREE.CircleGeometry(0.01, 6),
    new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  );
  marker.add(anchor);
  marker.renderOrder = 10;
  return marker;
}
