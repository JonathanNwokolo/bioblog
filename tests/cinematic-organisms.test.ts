import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUB_WINDOW,
  MOTILE_ORGANISMS,
  MOTION_EVIDENCE,
  MOTION_PARAMS,
  ORGANISM_ASPECT,
  bodyPoseAt,
  combinedPresence,
  motionAmount,
  organismPlacement,
  organismPresence,
  shouldRunMotion,
  trypanosomaFlexOffset,
  windowPlacement,
  type MotionSchedulerInput,
} from "../src/cinematic/organismMotion.ts";
import { HOTSPOT_MIN_REVEAL, ORGANISM_TIMELINE, organismReveal, type OrganismId } from "../src/cinematic/opticalTransition.ts";

const ids: OrganismId[] = ["giardia", "t-cruzi", "trichuris"];

const idle: MotionSchedulerInput = {
  organismObservable: false,
  userPaused: false,
  reducedMotion: false,
  documentHidden: false,
  interacting: false,
  disposed: false,
  contextLost: false,
};

describe("movimento local dos organismos (Fase 2.3.9)", () => {
  it("a pose é função pura de (organismo, tempo, amplitude): mesmo tempo, mesma pose", () => {
    for (const id of ids) {
      const a = bodyPoseAt(id, 3.7, 1);
      const b = bodyPoseAt(id, 3.7, 1);
      assert.deepEqual(a, b);
    }
  });

  it("o movimento é limitado: nenhuma amplitude ultrapassa o orçamento autorado, em qualquer instante", () => {
    for (const id of ["giardia", "t-cruzi"] as const) {
      const p = MOTION_PARAMS[id];
      for (let t = 0; t < 600; t += 0.37) {
        const pose = bodyPoseAt(id, t, 1);
        assert.ok(Math.abs(pose.yaw) <= p.yawAmplitude + 1e-9, `${id} yaw em t=${t}`);
        assert.ok(Math.abs(pose.roll) <= p.rollAmplitude + 1e-9);
        assert.ok(Math.abs(pose.shift[0]) <= p.shiftAmplitude[0] + 1e-9);
        assert.ok(Math.abs(pose.shift[1]) <= p.shiftAmplitude[1] + 1e-9);
      }
    }
    // Sem deriva: depois de muito tempo continua dentro do mesmo orçamento.
    assert.ok(Math.abs(bodyPoseAt("giardia", 1e5, 1).yaw) <= MOTION_PARAMS.giardia.yawAmplitude + 1e-9);
  });

  it("o corpo nunca gira continuamente (sem hélice): a rotação total é bem menor que meia volta", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t < 2000; t += 0.5) {
      const { yaw } = bodyPoseAt("giardia", t, 1);
      min = Math.min(min, yaw);
      max = Math.max(max, yaw);
    }
    assert.ok(max - min < 0.5, `excursão de rotação ${max - min}`);
  });

  it("o ovo de Trichuris não tem motilidade autônoma em nenhum instante", () => {
    assert.ok(!MOTILE_ORGANISMS.includes("trichuris"));
    for (let t = 0; t < 120; t += 1.3) {
      const pose = bodyPoseAt("trichuris", t, 1);
      assert.equal(pose.yaw, 0);
      assert.equal(pose.roll, 0);
      assert.deepEqual([...pose.shift], [0, 0]);
      assert.equal(pose.amount, 0);
    }
    assert.equal(MOTION_PARAMS.trichuris.flagellarHz, 0);
  });

  it("amplitude zero congela o corpo (pose de repouso)", () => {
    const pose = bodyPoseAt("t-cruzi", 12.3, 0);
    assert.equal(pose.yaw + 0, 0);
    assert.equal(pose.roll + 0, 0);
    assert.deepEqual(pose.shift.map((v) => v + 0), [0, 0]);
    assert.equal(trypanosomaFlexOffset(0.5, pose) + 0, 0);
  });

  it("a flexão do corpo é pinada nas extremidades (a raiz do flagelo não se desloca)", () => {
    for (let t = 0; t < 40; t += 0.7) {
      const pose = bodyPoseAt("t-cruzi", t, 1);
      assert.equal(trypanosomaFlexOffset(0, pose) + 0, 0);
      assert.equal(trypanosomaFlexOffset(1, pose) + 0, 0);
      for (let u = 0; u <= 1; u += 0.1) {
        assert.ok(Math.abs(trypanosomaFlexOffset(u, pose)) <= MOTION_PARAMS["t-cruzi"].flexAmplitude + 1e-9);
      }
    }
  });

  it("a amplitude nasce com a revelação e some fora da janela e na composição final", () => {
    for (const id of ids) {
      const w = ORGANISM_TIMELINE[id];
      assert.equal(motionAmount(id, w.in[0] - 0.01), 0);
      assert.equal(motionAmount(id, w.out[1] + 0.01), 0);
      const mid = (w.in[1] + w.out[0]) / 2;
      assert.equal(motionAmount(id, mid), 1);
    }
    assert.equal(motionAmount("giardia", 0.97), 0);
    assert.equal(motionAmount("t-cruzi", 1), 0);
  });
});

describe("agendador de quadros: renderização contínua só com motilidade visível", () => {
  it("em repouso (nada observável) não corre", () => {
    assert.equal(shouldRunMotion(idle), false);
  });

  it("corre com organismo móvel observável", () => {
    assert.equal(shouldRunMotion({ ...idle, organismObservable: true }), true);
  });

  it("para com pausa do visitante, aba oculta, movimento reduzido, descarte ou perda de contexto", () => {
    const base = { ...idle, organismObservable: true };
    assert.equal(shouldRunMotion({ ...base, userPaused: true }), false);
    assert.equal(shouldRunMotion({ ...base, documentHidden: true }), false);
    assert.equal(shouldRunMotion({ ...base, reducedMotion: true }), false);
    assert.equal(shouldRunMotion({ ...base, disposed: true }), false);
    assert.equal(shouldRunMotion({ ...base, contextLost: true }), false);
  });

  it("uma interação de inspeção em curso renderiza mesmo pausado, exceto aba oculta ou movimento reduzido", () => {
    assert.equal(shouldRunMotion({ ...idle, interacting: true, userPaused: true }), true);
    assert.equal(shouldRunMotion({ ...idle, interacting: true, documentHidden: true }), false);
    assert.equal(shouldRunMotion({ ...idle, interacting: true, reducedMotion: true }), false);
  });
});

describe("composição dos organismos (enquadramento)", () => {
  const viewports: Array<[number, number]> = [[1440, 900], [1280, 800], [768, 1024], [390, 844], [320, 568]];

  it("o organismo inteiro permanece dentro do quadro durante toda a janela, em todas as larguras", () => {
    for (const [w, h] of viewports) {
      for (const id of ids) {
        const win = ORGANISM_TIMELINE[id];
        for (let p = win.in[0]; p <= win.out[1]; p += 0.002) {
          const place = windowPlacement(id, p, w, h);
          const cx = ((place.ndcX + 1) / 2) * w;
          const half = (place.widthPx * place.scale) / 2;
          // Só vale enquanto o organismo é legível (reveal alto); entrada/saída percorrem a borda.
          if (organismReveal(id, p) < 0.5) continue;
          assert.ok(cx - half >= -0.5, `${id}@${p.toFixed(3)} ${w}px corta à esquerda: ${(cx - half).toFixed(1)}`);
          assert.ok(cx + half <= w + 0.5, `${id}@${p.toFixed(3)} ${w}px corta à direita: ${(cx + half).toFixed(1)}`);
          const cy = ((1 - place.ndcY) / 2) * h;
          const halfH = half * ORGANISM_ASPECT[id];
          assert.ok(cy - halfH >= 0 && cy + halfH <= h, `${id}@${p.toFixed(3)} ${w}x${h} corta na vertical`);
        }
      }
    }
  });

  it("T. cruzi: a saída não encosta na borda esquerda (defeito da rodada anterior)", () => {
    for (const [w, h] of viewports) {
      const win = ORGANISM_TIMELINE["t-cruzi"];
      for (let p = win.out[0]; p <= win.out[1]; p += 0.001) {
        const place = windowPlacement("t-cruzi", p, w, h);
        const left = ((place.ndcX + 1) / 2) * w - (place.widthPx * place.scale) / 2;
        assert.ok(left >= 0, `${w}px: borda esquerda ${left.toFixed(1)} em ${p.toFixed(3)}`);
      }
    }
  });

  it("o hub não desliza os organismos cuja janela já terminou", () => {
    for (const id of ["giardia", "t-cruzi"] as const) {
      const target = { x: 600, y: 300, widthPx: 120 };
      const a = organismPlacement(id, HUB_WINDOW[id][0] + 0.001, 1440, 900, target);
      const b = organismPlacement(id, HUB_WINDOW[id][1], 1440, 900, target);
      assert.equal(a.ndcX, b.ndcX);
      assert.equal(a.widthPx, b.widthPx);
    }
  });

  it("o buffer editorial separa a saída do ovo e sua reaparição no hub", () => {
    const target = { x: 600, y: 540, widthPx: 120 };
    const beforeHub = organismPresence("trichuris", 0.915);
    assert.equal(combinedPresence(beforeHub.reveal, beforeHub.hub), 0);
    const atHub = organismPlacement("trichuris", HUB_WINDOW.trichuris[0], 1440, 900, target);
    assert.equal(atHub.widthPx, target.widthPx);
  });

  it("a presença permanece legível durante a contemplação e o hub", () => {
    for (let p = ORGANISM_TIMELINE.trichuris.in[1]; p <= ORGANISM_TIMELINE.trichuris.out[0]; p += 0.002) {
      const { reveal, hub } = organismPresence("trichuris", p);
      assert.ok(combinedPresence(reveal, hub) > 0.99, `ovo perde legibilidade em ${p.toFixed(3)}`);
    }
    // Nenhum organismo aparece como fantasma durante a janela de outro (antes da descoberta).
    for (let p = 0; p < 0.92; p += 0.002) {
      for (const id of ["giardia", "t-cruzi"] as const) {
        const { reveal, hub } = organismPresence(id, p);
        if (reveal === 0) assert.equal(hub, 0, `${id} fantasma em ${p.toFixed(3)}`);
      }
    }
  });
});

describe("matriz de evidência do movimento", () => {
  it("cada organismo móvel distingue o que é documentado do que é interpretação artística", () => {
    for (const id of ids) {
      const entries = MOTION_EVIDENCE.filter((entry) => entry.organism === id);
      assert.ok(entries.length > 0, `${id} sem entradas`);
      assert.ok(entries.some((entry) => entry.basis === "interpolacao-artistica"), `${id} sem marca de interpolação`);
    }
    // Frequências de exibição nunca são apresentadas como medidas biológicas.
    for (const entry of MOTION_EVIDENCE.filter((e) => /frequência/.test(e.parameter))) {
      assert.equal(entry.basis, "interpolacao-artistica");
    }
  });

  it("o marcador ainda exige revelação suficiente", () => {
    assert.ok(HOTSPOT_MIN_REVEAL >= 0.9);
  });
});
