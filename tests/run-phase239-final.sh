#!/usr/bin/env bash
# Fase 2.3.9 — suíte final de evidências contra um servidor de produção (QA_BASE_URL).
# Uso: QA_BASE_URL=http://localhost:3100 bash tests/run-phase239-final.sh
set -u
cd "$(dirname "$0")/.."
LOG=docs/evidence/phase23/round-9-scientific-motion/final-run.log
mkdir -p "$(dirname "$LOG")"
: > "$LOG"
run() {
  echo "=== $* ===" | tee -a "$LOG"
  "$@" >> "$LOG" 2>&1 || echo "FALHOU: $*" | tee -a "$LOG"
}
run env QA_OUT=contract QA_VP=1440 node tests/visual-qa-phase239.mjs
run env QA_OUT=contract-mobile QA_VP=390 node tests/visual-qa-phase239.mjs
run env QA_OUT=hotspots QA_VP=1440 node tests/visual-qa-phase239-inspect.mjs
run env QA_OUT=hotspots QA_VP=390 node tests/visual-qa-phase239-inspect.mjs
run env QA_OUT=hotspots QA_VP=768 node tests/visual-qa-phase239-inspect.mjs
run env QA_OUT=hotspots node tests/visual-qa-phase239-drag.mjs
run env QA_OUT=viewports node tests/visual-qa-phase239-viewports.mjs
run env QA_OUT=optical-regression node tests/visual-qa-phase239-optical-regression.mjs
run env QA_OUT=lifecycle node tests/visual-qa-phase239-lifecycle.mjs
run env QA_OUT=perf node tests/visual-qa-phase239-perf.mjs
run env QA_OUT=motion QA_ID=giardia QA_STEP=0.3 QA_N=8 node tests/visual-qa-phase239-sheet.mjs
run env QA_OUT=motion QA_ID=t-cruzi QA_STEP=0.3 QA_N=8 node tests/visual-qa-phase239-sheet.mjs
run env QA_OUT=motion QA_ID=giardia QA_VP=390 QA_STEP=0.3 QA_N=8 node tests/visual-qa-phase239-sheet.mjs
run env QA_OUT=motion QA_ID=t-cruzi QA_VP=390 QA_STEP=0.3 QA_N=8 node tests/visual-qa-phase239-sheet.mjs
run env QA_OUT=video node tests/visual-qa-phase239-video.mjs
echo "=== concluído ===" | tee -a "$LOG"
