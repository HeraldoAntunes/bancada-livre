// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Modo passo a passo: a "onda" de propagação avança nível a nível.
// Nível 0 = fontes; cada componente seguinte fica em 1 + máx(nível dos que o
// alimentam). CIs usam o grafo de unidades (uma por porta interna) e o nível
// do chip é o maior nível finito entre suas portas.

import { allInputPins, allOutputPins } from './pins'
import { buildUnitGraph, type SimResult } from './simulate'
import { isSource, pinKey, type CircuitComponent, type Signal, type Wire } from './types'

export interface PropagationInfo {
  /** Nível de cada componente; Infinity para quem está em laço combinacional. */
  levels: Map<string, number>
  /** Maior nível finito (0 quando o circuito está vazio). */
  maxLevel: number
}

export function propagationLevels(components: CircuitComponent[], wires: Wire[]): PropagationInfo {
  const byId = new Map(components.map((c) => [c.id, c]))
  const graph = buildUnitGraph(components, wires)
  const indeg = new Map(graph.indeg)
  const queue = graph.units.filter((u) => (indeg.get(u) ?? 0) === 0)
  const unitLevel = new Map<string, number>()

  while (queue.length > 0) {
    const u = queue.shift()!
    const c = byId.get(graph.unitComp.get(u)!)!
    // saída de flip-flop sem PR/CLR ligados é estado guardado: nasce pronta, como uma fonte
    if (isSource(c.type) || (graph.seqSaida.has(u) && (graph.preds.get(u) ?? []).length === 0)) {
      unitLevel.set(u, 0)
    } else {
      const ps = graph.preds.get(u) ?? []
      unitLevel.set(u, ps.length > 0 ? 1 + Math.max(...ps.map((p) => unitLevel.get(p) ?? 0)) : 1)
    }
    for (const next of graph.adj.get(u) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1
      indeg.set(next, d)
      if (d === 0) queue.push(next)
    }
  }

  // Nível do componente = maior nível finito entre suas unidades;
  // sem nenhuma unidade fora de laço → infinito.
  const levels = new Map<string, number>()
  for (const u of graph.units) {
    const compId = graph.unitComp.get(u)!
    const lv = unitLevel.has(u) ? unitLevel.get(u)! : Number.POSITIVE_INFINITY
    const prev = levels.get(compId)
    if (prev === undefined) levels.set(compId, lv)
    else if (Number.isFinite(lv) && (!Number.isFinite(prev) || lv > prev)) levels.set(compId, lv)
  }
  let maxLevel = 0
  for (const lv of levels.values()) {
    if (Number.isFinite(lv) && lv > maxLevel) maxLevel = lv
  }
  return { levels, maxLevel }
}

/**
 * Versão da simulação vista no passo `step`: pinos e fios de componentes que a
 * onda ainda não alcançou (nível > step) aparecem como indefinidos (X).
 */
export function stepFilteredSim(
  sim: SimResult,
  components: CircuitComponent[],
  wires: Wire[],
  levels: Map<string, number>,
  step: number,
): SimResult {
  const pins = new Map(sim.pins)
  for (const c of components) {
    const lv = levels.get(c.id) ?? 0
    if (lv <= step) continue
    for (const p of allInputPins(c)) pins.set(pinKey(c.id, p), 'X')
    for (const p of allOutputPins(c)) pins.set(pinKey(c.id, p), 'X')
  }
  const wireVals = new Map<string, Signal>()
  for (const [wid, v] of sim.wires) {
    const w = wires.find((x) => x.id === wid)
    const lv = w ? (levels.get(w.from.comp) ?? 0) : 0
    wireVals.set(wid, lv > step ? 'X' : v)
  }
  return { ...sim, pins, wires: wireVals }
}
