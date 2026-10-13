import * as THREE from "three";
import { sampleJourney, type JourneyPath, type JourneySample } from "./choreography";

/**
 * Visualização espacial TEMPORÁRIA da entrada óptica. Só é criada pelo motor fora de
 * produção e quando `enableOpticsDebug()` é chamado explicitamente (QA).
 *
 * Verde: normal externa da abertura · Amarelo: eixo óptico · Vermelho: curva da câmera
 * Azul: direção de visão em amostras · Ciano: centro do vidro · Branco: pontos de passagem
 */
export interface OpticsDebugOverlay {
  group: THREE.Group;
  update: (sample: JourneySample) => void;
}

function sphere(color: number, radius: number, position: readonly number[]) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }),
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.renderOrder = 999;
  return mesh;
}

function line(points: THREE.Vector3[], color: number) {
  const object = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }),
  );
  object.renderOrder = 998;
  return object;
}

export function createOpticsDebugOverlay(path: JourneyPath): OpticsDebugOverlay {
  const group = new THREE.Group();
  group.name = "optics-debug-overlay";
  const center = new THREE.Vector3(...path.entry.center);
  const normal = new THREE.Vector3(...path.entry.normal).normalize();

  group.add(sphere(0x00ffff, 0.07, path.entry.center));
  group.add(line([center.clone(), center.clone().addScaledVector(normal, 3.5)], 0x00ff44));
  group.add(line([center.clone().addScaledVector(normal, 12), center.clone().addScaledVector(normal, -12)], 0xffe600));

  const curve: THREE.Vector3[] = [];
  for (let i = 0; i <= 300; i += 1) {
    curve.push(new THREE.Vector3(...sampleJourney(i / 300, path).camera));
  }
  group.add(line(curve, 0xff2222));

  for (let i = 0; i <= 20; i += 1) {
    const sample = sampleJourney(i / 20, path);
    const position = new THREE.Vector3(...sample.camera);
    const direction = new THREE.Vector3(...sample.target).sub(position).normalize();
    group.add(new THREE.ArrowHelper(direction, position, 0.9, 0x3a7bff, 0.25, 0.14));
  }
  path.waypoints.forEach((waypoint) => group.add(sphere(0xffffff, 0.09, waypoint.position)));

  // Marcador da posição atual da câmera (visível em vistas de inspeção externas).
  const current = sphere(0xff00ff, 0.12, [0, 0, 0]);
  group.add(current);
  return { group, update: (sample) => current.position.set(...sample.camera) };
}
