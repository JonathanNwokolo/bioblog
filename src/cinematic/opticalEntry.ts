/**
 * Geometria da ocular de entrada — módulo puro (sem three, sem DOM).
 *
 * Referencial: o do microscópio (`+z` aponta da platina para a BASE, `-z` para o
 * topo do cabeçote, `+y` para o visitante). É também o referencial óptico do motor.
 *
 * A ocular é posicionada a partir de `EYEPIECE_SPEC`. O motor NÃO confia nesta
 * especificação para guiar a câmera: ele mede o centro e a normal do vidro
 * (`ocular-glass`) nos transforms efetivos da malha e compara com `nominalEntry`.
 * A especificação existe para que o asset, os testes e a medição falem do mesmo modelo.
 */

export type Vec3 = readonly [number, number, number];
export type EyepieceId = "left" | "right";

/** Inclinação do tubo em direção ao observador (rad, a partir da vertical). */
export const EYEPIECE_TILT = 0.42;
/** Posição Z do vidro no referencial do grupo da ocular (+z = extremidade do olho). */
export const EYEPIECE_GLASS_Z = 1.08;
/** Ocular escolhida como ponto de entrada e mantida em toda a jornada. */
export const PRIMARY_EYEPIECE: EyepieceId = "right";

/**
 * A extremidade do olho de cada ocular (`+z` do grupo) deve apontar para CIMA
 * (`-z` do microscópio) e para o observador (`+y`). Por isso a rotação X é π + inclinação.
 */
export const EYEPIECE_SPEC: Record<
  EyepieceId,
  { position: Vec3; rotation: Vec3 }
> = {
  left: { position: [-0.75, 1.18, -3.85], rotation: [Math.PI + EYEPIECE_TILT, 0.08, -0.08] },
  right: { position: [0.75, 1.18, -3.85], rotation: [Math.PI + EYEPIECE_TILT, -0.08, 0.08] },
};

export interface OpticalEntry {
  eyepiece: EyepieceId;
  /** Centro do vidro da ocular. */
  center: Vec3;
  /** Normal externa (aponta para o olho do observador). Unitária. */
  normal: Vec3;
}

/** Terceira coluna de R = Rx(a)·Ry(b)·Rz(c) (ordem XYZ do three): direção do `+z` do grupo. */
export function eulerXYZForward(rotation: Vec3): [number, number, number] {
  const [a, b] = rotation;
  return [Math.sin(b), -Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b)];
}

export function nominalEntry(eyepiece: EyepieceId = PRIMARY_EYEPIECE): OpticalEntry {
  const { position, rotation } = EYEPIECE_SPEC[eyepiece];
  const normal = eulerXYZForward(rotation);
  return {
    eyepiece,
    normal,
    center: [
      position[0] + normal[0] * EYEPIECE_GLASS_Z,
      position[1] + normal[1] * EYEPIECE_GLASS_Z,
      position[2] + normal[2] * EYEPIECE_GLASS_Z,
    ],
  };
}
