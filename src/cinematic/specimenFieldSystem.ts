import * as THREE from "three";
import { smoothstep } from "./scrollProgress";
import { SPECIMEN_TIMELINE, type SpecimenWorldId } from "./specimenTimeline";

type Quality = "high" | "medium" | "low";

export interface FieldMaterialBinding {
  material: THREE.Material;
  baseOpacity: number;
}

export interface SpecimenFieldSystem {
  root: THREE.Group;
  materials: FieldMaterialBinding[];
  ready: Promise<void>;
  update: (progress: number) => void;
}

interface AtlasZone {
  name: "deep" | "background" | "active" | "subject" | "near";
  count: readonly [number, number, number];
  z: readonly [number, number];
  scale: readonly [number, number];
  opacity: number;
  blur: number;
  spread: readonly [number, number];
  renderOrder: number;
}

const STOOL_ATLAS = "/images/explore/specimens/trichuris-stool-atlas-v1.png";
const SALINE_ATLAS = "/images/explore/specimens/giardia-saline-atlas-v1.png";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function countFor(quality: Quality, values: readonly [number, number, number]) {
  return quality === "low" ? values[0] : quality === "medium" ? values[1] : values[2];
}

function atlasMaterial(map: THREE.Texture, opacity: number, blur: number) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    premultipliedAlpha: true,
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: 0 },
      uLayerOpacity: { value: opacity },
      uBlur: { value: blur },
      uTint: { value: new THREE.Color(0xd3b66f) },
    },
    vertexShader: /* glsl */ `
      attribute float instanceTile;
      attribute float instanceAlpha;
      varying vec2 vAtlasUv;
      varying float vInstanceAlpha;
      void main() {
        float column = mod(instanceTile, 4.0);
        float row = floor(instanceTile / 4.0);
        vAtlasUv = vec2(
          (column + uv.x) / 4.0,
          1.0 - (row + (1.0 - uv.y)) / 3.0
        );
        vInstanceAlpha = instanceAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform float uLayerOpacity;
      uniform float uBlur;
      uniform vec3 uTint;
      varying vec2 vAtlasUv;
      varying float vInstanceAlpha;
      void main() {
        vec2 texel = vec2(1.0 / 1536.0, 1.0 / 1024.0) * (1.0 + uBlur * 4.0);
        vec4 center = texture2D(uMap, vAtlasUv);
        vec4 softened = center * 0.46;
        softened += texture2D(uMap, vAtlasUv + vec2(texel.x, 0.0)) * 0.135;
        softened += texture2D(uMap, vAtlasUv - vec2(texel.x, 0.0)) * 0.135;
        softened += texture2D(uMap, vAtlasUv + vec2(0.0, texel.y)) * 0.135;
        softened += texture2D(uMap, vAtlasUv - vec2(0.0, texel.y)) * 0.135;
        vec4 sampleColor = mix(center, softened, clamp(uBlur, 0.0, 1.0));
        if (sampleColor.a < 0.012) discard;
        float alpha = sampleColor.a * uOpacity * uLayerOpacity * vInstanceAlpha;
        vec3 color = mix(sampleColor.rgb, sampleColor.rgb * uTint, 0.08);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
  });
  material.userData.baseBlur = blur;
  return material;
}

function createAtlasZone(
  zone: AtlasZone,
  quality: Quality,
  map: THREE.Texture,
  seed: number,
  materials: FieldMaterialBinding[],
) {
  const count = countFor(quality, zone.count);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const tiles = new Float32Array(count);
  const alpha = new Float32Array(count);
  geometry.setAttribute("instanceTile", new THREE.InstancedBufferAttribute(tiles, 1));
  geometry.setAttribute("instanceAlpha", new THREE.InstancedBufferAttribute(alpha, 1));
  const material = atlasMaterial(map, zone.opacity, zone.blur);
  materials.push({ material, baseOpacity: 1 });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = `specimen-stool-${zone.name}`;
  mesh.renderOrder = zone.renderOrder;
  mesh.frustumCulled = false;
  mesh.userData.noFade = true;

  const random = seededRandom(seed);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const clusterCenters = [
    [-11.2, 4.4], [-8.8, -3.9], [-6.1, 3.4], [-2.9, -2.4], [0.8, 3.8],
    [3.8, -2.9], [6.5, 3.6], [8.9, -1.8], [11.6, 2.5],
  ] as const;

  for (let index = 0; index < count; index += 1) {
    const center = clusterCenters[(index * 3 + Math.floor(random() * clusterCenters.length)) % clusterCenters.length];
    const clustered = random() < 0.65;
    const x = clustered
      ? center[0] + (random() - 0.5) * zone.spread[0]
      : (random() - 0.5) * 30;
    const y = clustered
      ? center[1] + (random() - 0.5) * zone.spread[1]
      : (random() - 0.5) * 18;
    position.set(x, y, zone.z[0] + random() * (zone.z[1] - zone.z[0]));
    quaternion.setFromEuler(new THREE.Euler(0, 0, (random() - 0.5) * Math.PI * 1.8));
    const base = zone.scale[0] + Math.pow(random(), 1.7) * (zone.scale[1] - zone.scale[0]);
    scale.set(base * (0.7 + random() * 1.05), base * (0.58 + random() * 0.82), 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    tiles[index] = Math.floor(random() * 12);
    alpha[index] = 0.52 + random() * 0.48;
  }
  mesh.instanceMatrix.needsUpdate = true;
  geometry.getAttribute("instanceTile").needsUpdate = true;
  geometry.getAttribute("instanceAlpha").needsUpdate = true;
  return mesh;
}

function loadAtlas(path: string, quality: Quality) {
  let settleTexture: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    settleTexture = resolve;
  });
  const map = new THREE.TextureLoader().load(
    path,
    () => settleTexture(),
    undefined,
    (error) => {
      console.warn(`O atlas do espécime não pôde ser carregado: ${path}`, error);
      settleTexture();
    },
  );
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.anisotropy = quality === "high" ? 4 : 2;
  return { map, ready };
}

function createSalineField(quality: Quality): SpecimenFieldSystem {
  const root = new THREE.Group();
  root.name = "specimen-field-system-saline";
  const scanRoot = new THREE.Group();
  scanRoot.name = "specimen-saline-scan-root";
  root.add(scanRoot);
  const materials: FieldMaterialBinding[] = [];
  const { map, ready } = loadAtlas(SALINE_ATLAS, quality);
  const zones: readonly AtlasZone[] = [
    { name: "deep", count: [10, 18, 26], z: [-8.35, -7.45], scale: [2.5, 5.2], opacity: 0.16, blur: 1, spread: [9.8, 6.5], renderOrder: -8 },
    { name: "background", count: [14, 24, 36], z: [-7.2, -5.9], scale: [0.95, 2.5], opacity: 0.22, blur: 0.68, spread: [8.4, 5.5], renderOrder: -2 },
    { name: "active", count: [18, 32, 48], z: [-5.75, -4.5], scale: [0.34, 1.28], opacity: 0.32, blur: 0.18, spread: [6.2, 4.2], renderOrder: 7 },
    { name: "subject", count: [10, 16, 24], z: [-4.38, -3.75], scale: [0.2, 0.76], opacity: 0.28, blur: 0.08, spread: [4.8, 3.2], renderOrder: 22 },
    { name: "near", count: [4, 7, 10], z: [-3.58, -2.88], scale: [1.8, 3.9], opacity: 0.12, blur: 0.94, spread: [10.4, 6.8], renderOrder: 42 },
  ];
  zones.forEach((zone, index) => scanRoot.add(createAtlasZone(zone, quality, map, 1311 + index * 149, materials)));

  const chapter = SPECIMEN_TIMELINE.chapters.giardia;
  const start = chapter.environment[0];
  const end = chapter.transitionBuffer[1];
  return {
    root,
    materials,
    ready,
    update(progress) {
      const local = Math.max(0, Math.min(1, (progress - start) / Math.max(0.0001, end - start)));
      const search = smoothstep(0, 0.34, local);
      const settle = smoothstep(0.34, 0.54, local);
      const depart = smoothstep(0.82, 1, local);
      scanRoot.position.x = THREE.MathUtils.lerp(2.25, -0.4, search) - depart * 1.5;
      scanRoot.position.y = THREE.MathUtils.lerp(0.42, -0.18, search) + Math.sin(local * Math.PI) * 0.11;
      scanRoot.rotation.z = THREE.MathUtils.lerp(0.014, -0.009, settle) + depart * 0.008;
      materials.forEach(({ material }) => {
        if (!(material instanceof THREE.ShaderMaterial)) return;
        const baseBlur = Number(material.userData.baseBlur ?? 0);
        material.uniforms.uBlur.value = baseBlur > 0.8
          ? baseBlur
          : Math.max(0.045, baseBlur * (1 - settle * 0.25));
      });
    },
  };
}

function createStoolField(quality: Quality): SpecimenFieldSystem {
  const root = new THREE.Group();
  root.name = "specimen-field-system-stool";
  const scanRoot = new THREE.Group();
  scanRoot.name = "specimen-stool-scan-root";
  root.add(scanRoot);
  const materials: FieldMaterialBinding[] = [];

  const { map, ready } = loadAtlas(STOOL_ATLAS, quality);

  const zones: readonly AtlasZone[] = [
    { name: "deep", count: [16, 26, 38], z: [-8.45, -7.35], scale: [2.2, 4.8], opacity: 0.3, blur: 1, spread: [9.4, 6.2], renderOrder: -8 },
    { name: "background", count: [24, 38, 56], z: [-7.1, -5.85], scale: [0.8, 2.25], opacity: 0.38, blur: 0.62, spread: [7.5, 4.8], renderOrder: -2 },
    { name: "active", count: [34, 56, 82], z: [-5.7, -4.45], scale: [0.32, 1.28], opacity: 0.52, blur: 0.12, spread: [5.6, 3.8], renderOrder: 6 },
    { name: "subject", count: [16, 24, 36], z: [-4.35, -3.72], scale: [0.22, 0.9], opacity: 0.48, blur: 0.06, spread: [4.4, 2.8], renderOrder: 22 },
    { name: "near", count: [8, 12, 18], z: [-3.55, -2.8], scale: [1.7, 3.7], opacity: 0.22, blur: 0.92, spread: [10.2, 6.5], renderOrder: 42 },
  ];
  zones.forEach((zone, index) => scanRoot.add(createAtlasZone(zone, quality, map, 2303 + index * 137, materials)));

  const chapter = SPECIMEN_TIMELINE.chapters.trichuris;
  const start = chapter.environment[0];
  const end = chapter.transitionBuffer[1];
  return {
    root,
    materials,
    ready,
    update(progress) {
      const local = Math.max(0, Math.min(1, (progress - start) / Math.max(0.0001, end - start)));
      const search = smoothstep(0, 0.34, local);
      const settle = smoothstep(0.34, 0.54, local);
      const depart = smoothstep(0.82, 1, local);
      scanRoot.position.x = THREE.MathUtils.lerp(2.65, -0.25, search) - depart * 1.75;
      scanRoot.position.y = THREE.MathUtils.lerp(-0.55, 0.28, search) + Math.sin(local * Math.PI) * 0.16;
      scanRoot.rotation.z = THREE.MathUtils.lerp(-0.018, 0.012, settle) - depart * 0.01;
      materials.forEach(({ material }) => {
        if (!(material instanceof THREE.ShaderMaterial)) return;
        const baseBlur = Number(material.userData.baseBlur ?? 0);
        const near = baseBlur > 0.8;
        material.uniforms.uBlur.value = near
          ? 0.92
          : Math.max(0.04, baseBlur * (1 - settle * 0.28));
      });
    },
  };
}

export function createSpecimenFieldSystem(id: SpecimenWorldId, quality: Quality): SpecimenFieldSystem | null {
  if (id === "giardia") return createSalineField(quality);
  if (id === "stool") return createStoolField(quality);
  return null;
}
