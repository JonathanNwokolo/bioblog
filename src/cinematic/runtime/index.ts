import type {
  CinematicMountOptions,
  CinematicDispose,
  CinematicRuntime,
} from "@/cinematic/contract";
import { CinematicEngine } from "@/cinematic/engine";

/**
 * Implementação do contrato `CinematicRuntime` para pontos de montagem que não
 * possuem uma trilha de rolagem própria (por exemplo o campo de visão da homepage).
 *
 * O motor é guiado por progresso: aqui ele desenha um único quadro estático em
 * progresso 0 e permanece ocioso. A jornada completa vive em `/explorar`, onde a
 * rolagem real da página governa `renderSceneAt(progress)`.
 */
class ExperienceCinematicRuntime implements CinematicRuntime {
  async mount(options: CinematicMountOptions): Promise<CinematicDispose> {
    const { element, onStatus } = options;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
      onStatus?.("unsupported");
      return () => {};
    }

    onStatus?.("loading");
    element.appendChild(canvas);

    let qualityTier: "high" | "medium" | "low" = "high";
    const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
    if (nav.deviceMemory && nav.deviceMemory < 4) {
      qualityTier = "low";
    } else if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) {
      qualityTier = "medium";
    }

    const engine = new CinematicEngine({ canvas, qualityTier });
    onStatus?.("ready");

    return () => {
      engine.dispose();
      canvas.parentElement?.removeChild(canvas);
    };
  }
}

export const runtime: CinematicRuntime = new ExperienceCinematicRuntime();
export default runtime;
