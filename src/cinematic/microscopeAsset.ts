import * as THREE from "three";
import { createMicroscopeObjective } from "./sceneBuilder";
import { EYEPIECE_GLASS_Z, EYEPIECE_SPEC } from "./opticalEntry";

type Quality = "high" | "medium" | "low";

const GRAPHITE = 0x171c1e;
const ENAMEL = 0x262d2f;
const SILVER = 0xaab0ae;
const DARK_SILVER = 0x626a69;
const MINT = 0x9fcfc0;

function material(color: number, metalness: number, roughness: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 1.25,
    clearcoat: metalness > 0.7 ? 0.2 : 0.42,
    clearcoatRoughness: Math.min(0.46, roughness + 0.12),
  });
}

function roundedRectGeometry(width: number, height: number, depth: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: Math.min(radius * 0.55, depth * 0.22),
    bevelThickness: Math.min(radius * 0.45, depth * 0.18),
    curveSegments: 10,
  }).center();
}

function addMesh(
  root: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  meshMaterial: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function createArm(enamel: THREE.Material) {
  const shape = new THREE.Shape();
  shape.moveTo(-2.1, 4.55);
  shape.bezierCurveTo(-2.85, 3.25, -2.95, 0.2, -1.9, -2.7);
  shape.bezierCurveTo(-1.45, -3.95, -0.35, -4.2, 0.45, -3.55);
  shape.lineTo(0.03, -2.65);
  shape.bezierCurveTo(-0.35, -2.92, -0.7, -2.66, -0.92, -1.95);
  shape.bezierCurveTo(-1.58, 0.35, -1.45, 2.35, -0.76, 3.45);
  shape.lineTo(-2.1, 4.55);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1.2,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.14,
    bevelThickness: 0.12,
    curveSegments: 20,
  });
  geometry.center();
  geometry.rotateX(Math.PI / 2);
  const arm = new THREE.Mesh(geometry, enamel);
  arm.name = "cast-arm";
  arm.position.set(2.15, -2.25, 1.12);
  arm.castShadow = true;
  arm.receiveShadow = true;
  return arm;
}

function createEyepiece(segments: number, silver: THREE.Material, rubber: THREE.Material) {
  const group = new THREE.Group();
  const profile = [
    new THREE.Vector2(0.25, -0.9),
    new THREE.Vector2(0.31, -0.76),
    new THREE.Vector2(0.32, 0.35),
    new THREE.Vector2(0.39, 0.45),
    new THREE.Vector2(0.4, 0.72),
    new THREE.Vector2(0.34, 0.87),
  ];
  addMesh(group, new THREE.LatheGeometry(profile, segments), silver, [0, 0, 0], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.43, 0.39, 0.34, segments), rubber, [0, 0, 0.9], [Math.PI / 2, 0, 0]);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x48645d,
    roughness: 0.08,
    transmission: 0.5,
    transparent: true,
    opacity: 0.78,
    thickness: 0.12,
    clearcoat: 1,
  });
  const lens = addMesh(group, new THREE.CircleGeometry(0.31, segments), glass, [0, 0, EYEPIECE_GLASS_Z]);
  lens.name = "ocular-glass";
  return group;
}

function createSecondaryObjective(
  segments: number,
  length: number,
  radius: number,
  bandColor: number,
  silver: THREE.Material,
  black: THREE.Material,
) {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(radius * 0.72, radius, length, segments), silver, [0, 0, 0], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.18, segments), black, [0, 0, -length * 0.34], [Math.PI / 2, 0, 0]);
  addMesh(
    group,
    new THREE.CylinderGeometry(radius * 1.055, radius * 1.055, 0.08, segments),
    new THREE.MeshStandardMaterial({ color: bandColor, metalness: 0.45, roughness: 0.32 }),
    [0, 0, length * 0.28],
    [Math.PI / 2, 0, 0],
  );
  return group;
}

function addKnurledDial(
  root: THREE.Object3D,
  segments: number,
  radius: number,
  position: [number, number, number],
  rotation: [number, number, number],
  metal: THREE.Material,
  rubber: THREE.Material,
) {
  const dial = new THREE.Group();
  addMesh(dial, new THREE.CylinderGeometry(radius, radius, 0.46, segments), metal, [0, 0, 0], [0, 0, Math.PI / 2]);
  const toothGeometry = new THREE.BoxGeometry(0.12, 0.055, 0.5);
  const teeth = new THREE.InstancedMesh(toothGeometry, rubber, qualityForTeeth(segments));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const count = qualityForTeeth(segments);
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, angle, 0));
    matrix.compose(new THREE.Vector3(0, Math.cos(angle) * (radius + 0.025), Math.sin(angle) * (radius + 0.025)), quaternion, scale);
    teeth.setMatrixAt(index, matrix);
  }
  dial.add(teeth);
  dial.position.set(...position);
  dial.rotation.set(...rotation);
  root.add(dial);
}

function qualityForTeeth(segments: number) {
  return segments >= 48 ? 40 : segments >= 36 ? 30 : 22;
}

/**
 * Microscópio composto autoral, construído como um ativo hierárquico único.
 * O eixo óptico selecionado permanece em +Z para a câmera determinística.
 */
export function createCompleteMicroscope(quality: Quality = "high") {
  const root = new THREE.Group();
  root.name = "compound-laboratory-microscope";
  const segments = quality === "high" ? 48 : quality === "medium" ? 36 : 24;
  const enamel = material(ENAMEL, 0.72, 0.27);
  const graphite = material(GRAPHITE, 0.82, 0.2);
  const silver = material(SILVER, 0.94, 0.16);
  const darkSilver = material(DARK_SILVER, 0.9, 0.27);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x080b0c, metalness: 0.08, roughness: 0.78 });
  const stageMat = material(0x303739, 0.88, 0.22);

  const base = addMesh(root, roundedRectGeometry(7.4, 5.35, 1.02, 0.72), enamel, [0.45, -0.45, 5.35]);
  base.name = "weighted-base";
  base.castShadow = true;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(13, quality === "low" ? 48 : 96),
    new THREE.ShadowMaterial({ color: 0x6f716d, opacity: 0.22 }),
  );
  floor.position.z = 5.94;
  floor.receiveShadow = true;
  floor.name = "studio-shadow-plane";
  root.add(floor);
  addMesh(root, roundedRectGeometry(4.9, 3.45, 0.16, 0.34), graphite, [-0.65, 0.35, 4.78]);
  addMesh(root, roundedRectGeometry(6.5, 4.35, 0.08, 0.5), material(0x8e9693, 0.88, 0.24), [0.42, -0.44, 5.84]);
  addMesh(root, new THREE.CylinderGeometry(1.04, 1.28, 0.42, segments), darkSilver, [-0.2, 0.15, 4.62]);
  addMesh(root, new THREE.CylinderGeometry(0.72, 0.88, 0.2, segments), new THREE.MeshStandardMaterial({ color: MINT, emissive: 0x26443b, emissiveIntensity: 0.24, roughness: 0.18 }), [-0.2, 0.15, 4.38]);

  const arm = createArm(enamel);
  arm.castShadow = true;
  root.add(arm);

  // Platina mecânica feita de quatro quadrantes: o vazio central é uma abertura real.
  const stageZ = 1.38;
  addMesh(root, roundedRectGeometry(3.25, 2.1, 0.28, 0.16), stageMat, [-2.05, 0, stageZ]).name = "mechanical-stage-left";
  addMesh(root, roundedRectGeometry(3.25, 2.1, 0.28, 0.16), stageMat, [2.05, 0, stageZ]).name = "mechanical-stage-right";
  addMesh(root, roundedRectGeometry(0.9, 1.55, 0.28, 0.14), stageMat, [0, -1.83, stageZ]);
  addMesh(root, roundedRectGeometry(0.9, 1.55, 0.28, 0.14), stageMat, [0, 1.83, stageZ]);
  addMesh(root, roundedRectGeometry(2.75, 0.16, 0.12, 0.06), silver, [0.65, 1.05, 1.15], [0, 0, -0.05]);
  addMesh(root, roundedRectGeometry(2.45, 0.12, 0.1, 0.05), silver, [-0.6, -1.02, 1.12], [0, 0, 0.04]);
  addMesh(root, new THREE.CylinderGeometry(0.38, 0.44, 0.34, segments), darkSilver, [0, 0, 1.78]);
  addMesh(root, new THREE.CylinderGeometry(0.24, 0.31, 0.18, segments), silver, [0, 0, 2.02]);

  // Cabeça binocular e caixa prismática.
  const head = addMesh(root, roundedRectGeometry(3.3, 2.4, 2.0, 0.4), enamel, [0.7, -0.55, -3.05], [0.03, 0.02, -0.08]);
  head.castShadow = true;
  head.name = "binocular-head";
  addMesh(root, new THREE.CylinderGeometry(1.38, 1.16, 1.25, segments), graphite, [0.1, -0.05, -1.9], [Math.PI / 2, 0, 0]).name = "prism-housing";
  // Oculares: a extremidade do olho (vidro) aponta para cima e para o observador.
  (["left", "right"] as const).forEach((side) => {
    const ocular = createEyepiece(segments, silver, rubber);
    ocular.name = `eyepiece-${side}`;
    ocular.position.set(...EYEPIECE_SPEC[side].position);
    ocular.rotation.set(...EYEPIECE_SPEC[side].rotation);
    root.add(ocular);
  });
  addMesh(root, new THREE.CylinderGeometry(0.28, 0.28, 1.68, segments), darkSilver, [0, 0.17, -3.8], [0, 0, Math.PI / 2]);

  const turret = addMesh(root, new THREE.CylinderGeometry(1.23, 1.38, 0.48, segments), darkSilver, [-0.55, -0.16, -1.25], [Math.PI / 2, 0.08, 0]);
  turret.name = "objective-turret";
  const selected = createMicroscopeObjective(quality);
  selected.name = "selected-objective-100x";
  selected.scale.setScalar(0.3);
  selected.position.set(0, 0, 0.02);
  root.add(selected);

  const secondarySpecs = [
    { p: [-1.22, 0.45, -0.25] as [number, number, number], r: [0.06, -0.2, 0.1] as [number, number, number], length: 1.45, radius: 0.29, color: 0xe7d75c },
    { p: [-1.35, -0.5, -0.45] as [number, number, number], r: [-0.04, 0.22, -0.12] as [number, number, number], length: 1.2, radius: 0.34, color: 0x72a9d8 },
    { p: [0.28, -1.0, -0.6] as [number, number, number], r: [-0.18, -0.02, -0.2] as [number, number, number], length: 1.02, radius: 0.39, color: 0xd76066 },
  ];
  secondarySpecs.forEach((spec) => {
    const objective = createSecondaryObjective(segments, spec.length, spec.radius, spec.color, silver, graphite);
    objective.position.set(...spec.p);
    objective.rotation.set(...spec.r);
    root.add(objective);
  });

  // Controles coaxiais de foco e comandos X/Y da platina.
  [-1, 1].forEach((side) => {
    addKnurledDial(root, segments, 0.72, [side * 2.58, -1.9, 1.35], [0, 0, side < 0 ? Math.PI : 0], graphite, rubber);
    addMesh(root, new THREE.CylinderGeometry(0.38, 0.38, 0.6, segments), silver, [side * 2.86, -1.9, 1.35], [0, 0, Math.PI / 2]);
  });
  addMesh(root, new THREE.CylinderGeometry(0.22, 0.22, 1.0, segments), silver, [3.15, 0.85, 1.7], [Math.PI / 2, 0, 0.1]);
  addMesh(root, new THREE.CylinderGeometry(0.3, 0.3, 0.65, segments), graphite, [3.18, 1.25, 1.72], [Math.PI / 2, 0, 0.1]);
  addMesh(root, new THREE.CylinderGeometry(0.2, 0.2, 0.9, segments), silver, [3.45, 0.5, 2.05], [Math.PI / 2, 0, 0.1]);

  // Etiqueta sem marca e pequenos parafusos funcionais.
  addMesh(root, roundedRectGeometry(1.45, 0.52, 0.05, 0.09), material(0x88908e, 0.8, 0.3), [0.15, 2.28, 5.25], [Math.PI / 2, 0, 0]);
  const screwGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
  [[-2.8, -2.05, 5.77], [3.1, -2.05, 5.77], [-2.8, 1.3, 5.77], [3.1, 1.3, 5.77]].forEach((position) => {
    addMesh(root, screwGeometry, darkSilver, position as [number, number, number]);
  });

  root.userData.selectedObjectiveFront = new THREE.Vector3(0, 0, 0.72);
  return root;
}
