import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHOREOGRAPHY_KEYS, CUT, DEFAULT_PATH, EYE_RELIEF, sampleJourney } from "../src/cinematic/choreography.ts";
import {
  FIELD_STOP_RADIUS,
  HOTSPOT_MIN_REVEAL,
  OPTICAL_TIMELINE,
  ORGANISM_TIMELINE,
  hotspotActive,
  opticalPhaseAt,
  organismReveal,
  sampleOptics,
  type OrganismId,
} from "../src/cinematic/opticalTransition.ts";
import {
  BEAT_VISIBILITY,
  JOURNEY_STAGES,
  JOURNEY_TRACK_VH,
  PROGRESS_EPSILON,
  adjacentStageStart,
  clamp01,
  computeScrollProgress,
  scrollOffsetForProgress,
  scrollTravel,
  smoothstep,
  stageIndexAt,
} from "../src/cinematic/scrollProgress.ts";
import { SPECIMEN_TIMELINE, specimenWorldWeights } from "../src/cinematic/specimenTimeline.ts";

const VIEWPORT = 900;
const TRACK = 9900; // 1100vh em 900px
const geometry = (scrollIntoTrack: number) => ({
  trackTop: -scrollIntoTrack,
  trackHeight: TRACK,
  viewportHeight: VIEWPORT,
});

describe("progresso de rolagem (Fase 2.3.2)", () => {
  it("calcula progresso a partir da posição real, nos extremos e no meio", () => {
    const travel = TRACK - VIEWPORT;
    assert.equal(scrollTravel({ trackHeight: TRACK, viewportHeight: VIEWPORT }), travel);
    assert.equal(computeScrollProgress(geometry(0)), 0);
    assert.equal(computeScrollProgress(geometry(travel)), 1);
    assert.ok(Math.abs(computeScrollProgress(geometry(travel / 2)) - 0.5) < 1e-12);
  });

  it("limita o progresso antes e depois da trilha (entrada/saída do sticky)", () => {
    assert.equal(computeScrollProgress({ trackTop: 600, trackHeight: TRACK, viewportHeight: VIEWPORT }), 0);
    assert.equal(computeScrollProgress({ trackTop: -9999, trackHeight: TRACK, viewportHeight: VIEWPORT }), 1);
  });

  it("é robusto a geometria degenerada e valores inválidos", () => {
    assert.equal(computeScrollProgress({ trackTop: -10, trackHeight: 500, viewportHeight: 900 }), 0);
    assert.equal(computeScrollProgress({ trackTop: Number.NaN, trackHeight: TRACK, viewportHeight: VIEWPORT }), 0);
    assert.equal(clamp01(Number.POSITIVE_INFINITY), 0);
    assert.equal(clamp01(-3), 0);
    assert.equal(clamp01(7), 1);
  });

  it("é uma função pura: o mesmo scroll devolve o mesmo progresso, sem relógio", () => {
    const first = computeScrollProgress(geometry(1234));
    const second = computeScrollProgress(geometry(1234));
    assert.equal(first, second);
  });

  it("scrollOffsetForProgress é a inversa de computeScrollProgress", () => {
    const trackDocumentTop = 0;
    for (const target of [0, 0.1, 0.35, 0.5, 0.8, 0.97, 1]) {
      const offset = scrollOffsetForProgress(
        { trackDocumentTop, trackHeight: TRACK, viewportHeight: VIEWPORT },
        target,
      );
      const recovered = computeScrollProgress({
        trackTop: trackDocumentTop - offset,
        trackHeight: TRACK,
        viewportHeight: VIEWPORT,
      });
      assert.ok(Math.abs(recovered - target) < 1e-12, `${target} → ${recovered}`);
    }
  });

  it("as etapas cobrem [0, 1] sem lacunas e em ordem", () => {
    assert.equal(JOURNEY_STAGES[0].start, 0);
    assert.equal(JOURNEY_STAGES[JOURNEY_STAGES.length - 1].end, 1);
    for (let i = 1; i < JOURNEY_STAGES.length; i += 1) {
      assert.equal(JOURNEY_STAGES[i].start, JOURNEY_STAGES[i - 1].end);
    }
    assert.equal(stageIndexAt(0), 0);
    assert.equal(stageIndexAt(0.11), 1);
    assert.equal(stageIndexAt(0.219), 1);
    assert.equal(stageIndexAt(0.22), 2);
    assert.equal(stageIndexAt(0.339), 2);
    assert.equal(stageIndexAt(0.34), 3);
    assert.equal(stageIndexAt(0.56), 4);
    assert.equal(stageIndexAt(0.75), 5);
    assert.equal(stageIndexAt(0.92), 6);
    assert.equal(stageIndexAt(1), 6);
  });

  it("controles de passo apontam para posições de rolagem (sem animação própria)", () => {
    assert.equal(adjacentStageStart(0.1, 1), 0.11);
    assert.equal(adjacentStageStart(0.18, -1), 0.11);
    assert.equal(adjacentStageStart(0.11, -1), 0);
    assert.equal(adjacentStageStart(1, 1), 0.92);
    assert.equal(adjacentStageStart(0, -1), 0);
  });

  it("elementos narrativos dependem só do progresso e revertem ao voltar", () => {
    assert.equal(BEAT_VISIBILITY.invitation(0), 1);
    assert.equal(BEAT_VISIBILITY.invitation(0.3), 0);
    assert.equal(BEAT_VISIBILITY.discovery(0.5), 0);
    assert.equal(BEAT_VISIBILITY.discovery(1), 1);
    const forward = BEAT_VISIBILITY.discovery(0.92);
    BEAT_VISIBILITY.discovery(1);
    BEAT_VISIBILITY.discovery(0.2);
    assert.equal(BEAT_VISIBILITY.discovery(0.92), forward);
    assert.equal(smoothstep(0.2, 0.4, 0.2), 0);
    assert.equal(smoothstep(0.2, 0.4, 0.4), 1);
  });
});

describe("Fase 2.3.10: capítulos físicos e preparações", () => {
  it("mantém dwell e buffers mensuráveis nos cinco viewports", () => {
    for (const height of [900, 800, 1024, 844, 700]) {
      const travel = height * (JOURNEY_TRACK_VH / 100 - 1);
      for (const chapter of Object.values(SPECIMEN_TIMELINE.chapters)) {
        const reveal = (chapter.reveal[1] - chapter.reveal[0]) * travel;
        const dwell = (chapter.contemplation[1] - chapter.contemplation[0]) * travel;
        const buffer = (chapter.transitionBuffer[1] - chapter.transitionBuffer[0]) * travel;
        assert.ok(reveal >= 209.9, `${chapter.id}: reveal curto em ${height}px`);
        assert.ok(dwell >= 559.9, `${chapter.id}: dwell curto em ${height}px`);
        assert.ok(buffer >= 139.9, `${chapter.id}: buffer curto em ${height}px`);
      }
    }
  });

  it("nunca mantém dois mundos dominantes nem deixa um vazio durante a troca", () => {
    for (let p = SPECIMEN_TIMELINE.opticalEnd; p <= 1; p += 0.001) {
      const weights = Object.values(specimenWorldWeights(p));
      assert.ok(Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
      assert.equal(weights.filter((value) => value > 0.001).length <= 2, true);
    }
  });

  it("separa completamente as janelas dos três organismos", () => {
    assert.ok(ORGANISM_TIMELINE.giardia.out[1] < ORGANISM_TIMELINE["t-cruzi"].in[0]);
    assert.ok(ORGANISM_TIMELINE["t-cruzi"].out[1] < ORGANISM_TIMELINE.trichuris.in[0]);
  });
});

describe("coreografia determinística e reversível", () => {
  const same = (a: ReturnType<typeof sampleJourney>, b: ReturnType<typeof sampleJourney>) =>
    assert.deepEqual(a, b);

  it("o estado em 0,42 é idêntico avançando, retrocedendo ou saltando", () => {
    const direct = sampleJourney(0.42);
    // 0 → 25 → 70 → 40 → 90 → 10 → 100 → 0, visitando 0,42 a cada passagem.
    const route = [0, 0.25, 0.42, 0.7, 0.42, 0.4, 0.9, 0.42, 0.1, 1, 0.42, 0];
    route.forEach((p) => {
      const sample = sampleJourney(p);
      if (p === 0.42) same(sample, direct);
    });
  });

  it("não há memória entre chamadas: ordem de visita não altera nenhum ponto", () => {
    const points = [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1];
    const forward = points.map((p) => sampleJourney(p));
    const backward = [...points].reverse().map((p) => sampleJourney(p)).reverse();
    forward.forEach((sample, index) => same(sample, backward[index]));
  });

  it("passa exatamente pelas chaves de câmera (sem deriva)", () => {
    for (const key of [...CHOREOGRAPHY_KEYS.camera, ...CHOREOGRAPHY_KEYS.sampleCamera]) {
      const sample = sampleJourney(key.p);
      key.v.forEach((value, axis) => assert.ok(Math.abs(sample.camera[axis] - value) < 1e-9));
    }
    for (const key of CHOREOGRAPHY_KEYS.fov) {
      assert.ok(Math.abs(sampleJourney(key.p).fov - key.v) < 1e-9);
    }
  });

  it("é contínua: saltos pequenos de progresso geram saltos pequenos de câmera", () => {
    let previous = sampleJourney(0);
    let largest = 0;
    for (let step = 1; step <= 1000; step += 1) {
      const sample = sampleJourney(step / 1000);
      const delta = Math.hypot(
        sample.camera[0] - previous.camera[0],
        sample.camera[1] - previous.camera[1],
        sample.camera[2] - previous.camera[2],
      );
      largest = Math.max(largest, delta);
      assert.ok(Math.abs(sample.fov - previous.fov) < 0.5, `salto de FOV em ${step / 1000}`);
      previous = sample;
    }
    assert.ok(largest < 0.24, `maior passo de câmera por 0,1%: ${largest}`);
  });

  it("a câmera entra pela ocular: aproxima-se pelo eixo da abertura e atravessa o vidro no sentido -normal", () => {
    const { center, normal } = DEFAULT_PATH.entry;
    const along = (p: number) => {
      const { camera } = sampleJourney(p);
      const d = [camera[0] - center[0], camera[1] - center[1], camera[2] - center[2]];
      const s = d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2];
      const lateral = Math.hypot(d[0] - s * normal[0], d[1] - s * normal[1], d[2] - s * normal[2]);
      return { s, lateral };
    };
    // Antes do corte a câmera fica sempre do lado do observador e NUNCA entra no vidro.
    for (let p = OPTICAL_TIMELINE.coupling; p < CUT; p += 0.002) assert.ok(along(p).s >= EYE_RELIEF - 1e-9, `câmera dentro do vidro em ${p.toFixed(3)}`);
    // Depois do corte, a câmera segue o eixo no sentido de observação.
    assert.ok(along(0.62).s < 0 && along(0.7).s < along(0.62).s);
    // Distância ao vidro diminui de forma monotônica da aproximação até o corte.
    let previous = Infinity;
    for (let p = OPTICAL_TIMELINE.coupling; p <= CUT + 1e-9; p += 0.002) {
      const { s } = along(p);
      assert.ok(s <= previous + 1e-9, `distância cresceu em ${p.toFixed(3)}`);
      previous = s;
    }
    // Alinhamento: deslocamento lateral pequeno e olhar paralelo a -normal diante da abertura.
    for (const p of [OPTICAL_TIMELINE.coupling, OPTICAL_TIMELINE.eyecup[1], OPTICAL_TIMELINE.glowHold[0], CUT]) {
      assert.ok(along(p).lateral < 0.18, `deslocamento lateral em ${p}: ${along(p).lateral}`);
      const sample = sampleJourney(p);
      const v = [sample.target[0] - sample.camera[0], sample.target[1] - sample.camera[1], sample.target[2] - sample.camera[2]];
      const len = Math.hypot(v[0], v[1], v[2]);
      const cos = -(v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2]) / len;
      assert.ok(cos > 0.97, `olhar desalinhado em ${p}: cos=${cos}`);
    }
  });

  it("a câmera nunca se dirige à objetiva inferior durante a aproximação", () => {
    // Elemento frontal da objetiva selecionada, no referencial do microscópio.
    const front = [0, 0, 0.72];
    for (let p = 0.25; p < CUT; p += 0.01) {
      const { camera, target } = sampleJourney(p);
      const distance = Math.hypot(camera[0] - front[0], camera[1] - front[1], camera[2] - front[2]);
      assert.ok(distance > 3, `câmera perto da objetiva em ${p.toFixed(2)}: ${distance}`);
      // O alvo permanece na região da ocular, bem acima do cabeçote (z < -3).
      assert.ok(target[2] < -3, `alvo abaixo do cabeçote em ${p.toFixed(2)}: z=${target[2]}`);
    }
  });

  it("os valores da trajetória são finitos e a câmera termina no campo de observação", () => {
    for (const p of [0, 0.4, 0.7, 1]) {
      const sample = sampleJourney(p);
      assert.ok([...sample.camera, ...sample.target, ...sample.up, sample.fov].every(Number.isFinite));
    }
  });

  it("fatores de cena ficam em [0, 1] e revertem ao retroceder", () => {
    for (let step = 0; step <= 400; step += 1) {
      const sample = sampleJourney(step / 400);
      const o = sample.optics;
      for (const value of [sample.discoveryReveal, o.fieldStop, o.glow, o.formation, o.focus, o.eyecup]) {
        assert.ok(value >= 0 && value <= 1, `fora de [0,1] em ${step / 400}`);
      }
    }
    assert.equal(sampleJourney(0).optics.formation, 0);
    assert.equal(sampleJourney(1).optics.formation, 1);
    assert.equal(sampleJourney(0.2).discoveryReveal, 0);
    assert.equal(sampleJourney(1).discoveryReveal, 1);
  });

  it("clamp: progresso fora do intervalo equivale às extremidades", () => {
    same(sampleJourney(-4), sampleJourney(0));
    same(sampleJourney(9), sampleJourney(1));
  });

  it("PROGRESS_EPSILON é menor que 1 px de rolagem em percursos de até 8 000 px", () => {
    assert.ok(PROGRESS_EPSILON * 8_000 < 1);
  });
});

describe("travessia óptica (Fase 2.3.8): contrato de visibilidade por fase", () => {
  const ids: OrganismId[] = ["giardia", "t-cruzi", "trichuris"];
  const steps = Array.from({ length: 1001 }, (_, i) => i / 1000);

  it("o instrumento e a cena da amostra nunca são desenhados juntos nem ficam ambos ocultos", () => {
    for (const p of steps) {
      const o = sampleOptics(p);
      assert.notEqual(o.instrumentVisible, o.sampleVisible, `sobreposição/vazio em ${p}`);
    }
    assert.equal(sampleOptics(0).instrumentVisible, true);
    assert.equal(sampleOptics(CUT - 1e-6).instrumentVisible, true);
    assert.equal(sampleOptics(CUT).sampleVisible, true);
    assert.equal(sampleOptics(1).instrumentVisible, false);
  });

  it("o corte acontece com o campo totalmente luminoso e o exterior já fechado", () => {
    const o = sampleOptics(CUT);
    assert.ok(o.glow > 0.95, `campo luminoso no corte: ${o.glow}`);
    assert.ok(o.fieldStop < 0.02, `limitador de campo no corte: ${o.fieldStop}`);
    // O platô cobre o corte com folga nos dois lados.
    for (const p of [CUT - 0.01, CUT + 0.01]) assert.ok(sampleOptics(p).glow > 0.95);
  });

  it("antes do campo existir não há nada biológico: sem formação, sem organismo, sem marcador", () => {
    for (const p of steps.filter((value) => value < OPTICAL_TIMELINE.organismsFrom)) {
      for (const id of ids) {
        assert.equal(organismReveal(id, p), 0, `${id} visível em ${p}`);
        assert.equal(hotspotActive(id, p), false);
      }
    }
    // O campo (D) termina antes de o primeiro organismo começar a se revelar (E).
    assert.ok(sampleOptics(OPTICAL_TIMELINE.formation[1]).formation >= 0.999);
    assert.ok(OPTICAL_TIMELINE.formation[1] < ORGANISM_TIMELINE.giardia.in[0]);
    assert.ok(sampleOptics(OPTICAL_TIMELINE.organismsFrom).formation >= 0.999);
  });

  it("o primeiro organismo é a Giardia, e o marcador só aparece com o organismo revelado", () => {
    const first = steps.find((p) => ids.some((id) => organismReveal(id, p) > 0));
    assert.ok(first !== undefined && first >= OPTICAL_TIMELINE.organismsFrom);
    assert.ok(organismReveal("giardia", first) > 0 && organismReveal("t-cruzi", first) === 0);
    for (const id of ids) {
      for (const p of steps) {
        if (hotspotActive(id, p)) assert.ok(organismReveal(id, p) >= HOTSPOT_MIN_REVEAL);
      }
      const firstHotspot = steps.find((p) => hotspotActive(id, p));
      assert.ok(firstHotspot !== undefined, `marcador de ${id} nunca ativo`);
      assert.ok(firstHotspot > ORGANISM_TIMELINE[id].in[0], `marcador de ${id} antes da revelação`);
    }
  });

  it("as janelas dos organismos são ordenadas e terminam antes da composição final", () => {
    assert.ok(ORGANISM_TIMELINE.giardia.in[0] < ORGANISM_TIMELINE["t-cruzi"].in[0]);
    assert.ok(ORGANISM_TIMELINE["t-cruzi"].in[0] < ORGANISM_TIMELINE.trichuris.in[0]);
    for (const id of ids) {
      const w = ORGANISM_TIMELINE[id];
      assert.ok(w.in[0] < w.in[1] && w.in[1] < w.out[0] && w.out[0] < w.out[1]);
      assert.ok(w.out[1] <= 0.9);
    }
  });

  it("o desfoque só existe depois do corte e se resolve antes da revelação plena", () => {
    for (const p of steps.filter((value) => value < CUT)) assert.equal(sampleOptics(p).blurPx, 0);
    assert.ok(sampleOptics(CUT).blurPx > 10);
    assert.ok(sampleOptics(ORGANISM_TIMELINE.giardia.in[1]).blurPx < 0.2);
    // A nitidez nunca regride com o avanço (monotônica).
    let previous = Infinity;
    for (const p of steps.filter((value) => value >= CUT)) {
      const { blurPx } = sampleOptics(p);
      assert.ok(blurPx <= previous + 1e-9);
      previous = blurPx;
    }
  });

  it("as fases ficam em ordem e cobrem [0, 1]", () => {
    const order = ["approach", "coupling", "optical", "formation", "observation"];
    let last = 0;
    for (const p of steps) {
      const index = order.indexOf(opticalPhaseAt(p));
      assert.ok(index >= last, `fase regrediu em ${p}`);
      last = index;
    }
    assert.equal(opticalPhaseAt(0), "approach");
    assert.equal(opticalPhaseAt(0.28), "optical");
    assert.equal(opticalPhaseAt(0.32), "formation");
    assert.equal(opticalPhaseAt(0.36), "observation");
  });

  it("o limitador de campo fecha na ocular, abre depois do corte e termina totalmente aberto", () => {
    assert.equal(sampleOptics(0).fieldStop, 1);
    assert.equal(sampleOptics(0.21).fieldStop, 1);
    assert.equal(sampleOptics(0.26).fieldStop, 0);
    assert.equal(sampleOptics(0.28).fieldStop, 0);
    assert.equal(sampleOptics(0.34).fieldStop, 1);
    assert.ok(FIELD_STOP_RADIUS > 0.4 && FIELD_STOP_RADIUS < 0.7);
    // Nunca abre antes do corte: não há exterior à vista enquanto o instrumento é desenhado.
    for (const p of steps.filter((value) => value >= 0.26 && value <= CUT)) assert.equal(sampleOptics(p).fieldStop, 0);
  });

  it("reversibilidade: o estado óptico independe da direção de chegada", () => {
    const routes: Array<[number, number]> = [
      [0.45, 0.6],
      [0.5, 0.75],
      [0.55, 0.95],
      [0.7, 0.3],
      [0, 1],
    ];
    for (const [a, b] of routes) {
      const at = (p: number) => ({ journey: sampleJourney(p), reveals: ids.map((id) => organismReveal(id, p)) });
      const first = at(a);
      at(b);
      assert.deepEqual(at(a), first, `${a}→${b}→${a}`);
      const second = at(b);
      at(a);
      assert.deepEqual(at(b), second, `${b}→${a}→${b}`);
    }
  });

  it("a câmera pós-corte é contínua com a câmera do acoplamento (sem salto de posição nem de olhar)", () => {
    const before = sampleJourney(CUT - 1e-9);
    const after = sampleJourney(CUT);
    before.camera.forEach((value, axis) => assert.ok(Math.abs(value - after.camera[axis]) < 1e-6));
    before.target.forEach((value, axis) => assert.ok(Math.abs(value - after.target[axis]) < 1e-6));
    assert.ok(Math.abs(before.fov - after.fov) < 1e-6);
    void EYE_RELIEF;
  });
});
