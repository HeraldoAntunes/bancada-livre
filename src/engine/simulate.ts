// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Motor de simulação combinacional.
// A ordenação topológica trabalha sobre UNIDADES: componentes comuns são uma
// unidade; cada porta interna de um CI é uma unidade própria — encadear portas
// do mesmo chip não dispara falso laço. Elementos de memória também viram duas unidades: uma só lê as entradas
// que esperam o clock (não produz nada) e a outra produz Q e Q̄ a partir do estado guardado e de PR/CLR; assim a
// realimentação através de um flip-flop não é laço.

import { evalGate } from './gates'
import { chipOf, type ChipFunc, type ChipGate } from './ics'
import { allOutputPins } from './pins'
import { saidasDe } from './sequencial'
import {
  bitsDe,
  entradasAssincronas,
  entradasSincronas,
  inputPins,
  isGate,
  isSeq,
  isSink,
  isSource,
  pinKey,
  type CircuitComponent,
  type Signal,
  type Wire,
} from './types'

export interface SimResult {
  /** Valor de cada pino relevante (`comp:pin`). */
  pins: Map<string, Signal>
  /** Valor de cada fio (id do fio → sinal). */
  wires: Map<string, Signal>
  /** Componentes envolvidos em (ou a jusante de) laço combinacional. */
  cycleComps: Set<string>
  /** Pinos de entrada com mais de um driver (conflito). */
  conflictPins: Set<string>
  /** Entradas assíncronas cujo laço com a própria saída foi cortado (ver `UnitGraph`). */
  atrasadas: Set<string>
}

export interface UnitGraph {
  /** Todas as unidades ('compId' ou 'compId#índiceDaPorta' para CIs). */
  units: string[]
  /** unidade → id do componente dono. */
  unitComp: Map<string, string>
  /** unidade → porta interna do CI (ausente para componentes comuns). */
  icGate: Map<string, ChipGate>
  /** unidade → bloco de função do CI (chips como o 7448). */
  icFunc: Map<string, ChipFunc>
  /** Unidades que produzem Q e Q̄ de um elemento de memória (`compId#q`). */
  seqSaida: Set<string>
  /**
   * Entradas assíncronas (`comp:pino`) que fecham um laço com a própria saída (ex.: contador que se limpa ao chegar
   * em N). O fio delas sai do grafo: a saída vem do estado guardado e o reset age na rodada seguinte do assentamento.
   */
  assincronasAtrasadas: Set<string>
  adj: Map<string, string[]>
  indeg: Map<string, number>
  preds: Map<string, string[]>
}

/** Monta o grafo de dependências em nível de unidade (usado também pelo passo a passo). */
export function buildUnitGraph(components: CircuitComponent[], wires: Wire[]): UnitGraph {
  const byId = new Map(components.map((c) => [c.id, c]))
  const units: string[] = []
  const unitComp = new Map<string, string>()
  const icGate = new Map<string, ChipGate>()
  const icFunc = new Map<string, ChipFunc>()
  const seqSaida = new Set<string>()
  /** pino de saída → unidade que o produz */
  const outPinUnit = new Map<string, string>()
  /** pino de entrada → unidades que o consomem */
  const inPinUnits = new Map<string, string[]>()

  for (const c of components) {
    if (c.type === 'IC') {
      const def = chipOf(c)
      const chipUnits: string[] = []
      def.gates.forEach((g, i) => {
        const u = `${c.id}#${i}`
        units.push(u)
        unitComp.set(u, c.id)
        icGate.set(u, g)
        chipUnits.push(u)
        outPinUnit.set(pinKey(c.id, `p${g.output}`), u)
        for (const n of g.inputs) inPinUnits.set(pinKey(c.id, `p${n}`), [u])
      })
      if (def.seq) {
        // como nos flip-flops soltos: uma unidade só lê as entradas do clock, a outra produz as saídas
        const ler = `${c.id}#s`
        const saida = `${c.id}#o`
        units.push(ler, saida)
        unitComp.set(ler, c.id)
        unitComp.set(saida, c.id)
        seqSaida.add(saida)
        chipUnits.push(ler, saida)
        for (const n of def.seq.sincronas) inPinUnits.set(pinKey(c.id, `p${n}`), [ler])
        for (const n of def.seq.assincronas) inPinUnits.set(pinKey(c.id, `p${n}`), [saida])
        for (const n of def.seq.saidas) outPinUnit.set(pinKey(c.id, `p${n}`), saida)
      }
      if (def.func) {
        const u = `${c.id}#f`
        units.push(u)
        unitComp.set(u, c.id)
        icFunc.set(u, def.func)
        chipUnits.push(u)
        for (const n of def.func.outputs) outPinUnit.set(pinKey(c.id, `p${n}`), u)
        for (const n of def.func.inputs) inPinUnits.set(pinKey(c.id, `p${n}`), [u])
      }
      // VCC/GND alimentam todas as unidades do chip
      inPinUnits.set(pinKey(c.id, `p${def.vcc}`), chipUnits)
      inPinUnits.set(pinKey(c.id, `p${def.gnd}`), chipUnits)
    } else if (isSeq(c.type)) {
      const saida = `${c.id}#q`
      units.push(c.id, saida)
      unitComp.set(c.id, c.id)
      unitComp.set(saida, c.id)
      seqSaida.add(saida)
      for (const p of entradasSincronas(c.type)) inPinUnits.set(pinKey(c.id, p), [c.id])
      for (const p of entradasAssincronas(c.type)) inPinUnits.set(pinKey(c.id, p), [saida])
      for (const p of allOutputPins(c)) outPinUnit.set(pinKey(c.id, p), saida)
    } else {
      units.push(c.id)
      unitComp.set(c.id, c.id)
      for (const p of allOutputPins(c)) outPinUnit.set(pinKey(c.id, p), c.id)
      for (const p of inputPins(c)) inPinUnits.set(pinKey(c.id, p), [c.id])
    }
  }

  const adj = new Map<string, string[]>(units.map((u) => [u, []]))
  const indeg = new Map<string, number>(units.map((u) => [u, 0]))
  const preds = new Map<string, string[]>(units.map((u) => [u, []]))
  /** ligações que chegam a uma entrada assíncrona: candidatas a atraso se fecharem laço */
  const assincronas: { src: string; dst: string; pino: string }[] = []
  for (const w of wires) {
    if (!byId.has(w.from.comp) || !byId.has(w.to.comp)) continue
    const src = outPinUnit.get(pinKey(w.from.comp, w.from.pin))
    const dsts = inPinUnits.get(pinKey(w.to.comp, w.to.pin)) ?? []
    if (!src) continue
    for (const dst of dsts) {
      adj.get(src)!.push(dst)
      indeg.set(dst, (indeg.get(dst) ?? 0) + 1)
      preds.get(dst)!.push(src)
      if (seqSaida.has(dst) && dsts.length === 1) assincronas.push({ src, dst, pino: pinKey(w.to.comp, w.to.pin) })
    }
  }
  const assincronasAtrasadas = new Set<string>()
  if (assincronas.length > 0) {
    const grupo = componentesFortes(units, adj)
    for (const a of assincronas) {
      if (grupo.get(a.src) !== grupo.get(a.dst)) continue
      const saem = adj.get(a.src)!
      saem.splice(saem.indexOf(a.dst), 1)
      const chegam = preds.get(a.dst)!
      chegam.splice(chegam.indexOf(a.src), 1)
      indeg.set(a.dst, indeg.get(a.dst)! - 1)
      assincronasAtrasadas.add(a.pino)
    }
  }
  return { units, unitComp, icGate, icFunc, seqSaida, assincronasAtrasadas, adj, indeg, preds }
}

/** Componentes fortemente conexos (Tarjan, sem recursão): unidade → número do grupo. */
function componentesFortes(units: string[], adj: Map<string, string[]>): Map<string, number> {
  const indice = new Map<string, number>()
  const menor = new Map<string, number>()
  const grupo = new Map<string, number>()
  const pilha: string[] = []
  const naPilha = new Set<string>()
  let proximo = 0
  let grupos = 0
  for (const raiz of units) {
    if (indice.has(raiz)) continue
    const quadros: { u: string; i: number }[] = [{ u: raiz, i: 0 }]
    indice.set(raiz, proximo)
    menor.set(raiz, proximo++)
    pilha.push(raiz)
    naPilha.add(raiz)
    while (quadros.length > 0) {
      const q = quadros[quadros.length - 1]
      const viz = adj.get(q.u) ?? []
      if (q.i < viz.length) {
        const v = viz[q.i++]
        if (!indice.has(v)) {
          indice.set(v, proximo)
          menor.set(v, proximo++)
          pilha.push(v)
          naPilha.add(v)
          quadros.push({ u: v, i: 0 })
        } else if (naPilha.has(v)) menor.set(q.u, Math.min(menor.get(q.u)!, indice.get(v)!))
        continue
      }
      quadros.pop()
      if (quadros.length > 0) {
        const pai = quadros[quadros.length - 1].u
        menor.set(pai, Math.min(menor.get(pai)!, menor.get(q.u)!))
      }
      if (menor.get(q.u) === indice.get(q.u)) {
        let w: string
        do {
          w = pilha.pop()!
          naPilha.delete(w)
          grupo.set(w, grupos)
        } while (w !== q.u)
        grupos++
      }
    }
  }
  return grupo
}

/**
 * Simula o circuito. `overrides` substitui o estado de fontes interativas
 * (usado pela geração de tabela-verdade sem mutar o circuito): chave pelo id do
 * componente; posição do banco de chaves pelo pino (`id:out2`).
 */
export function simulate(
  components: CircuitComponent[],
  wires: Wire[],
  overrides?: Map<string, 0 | 1>,
): SimResult {
  const byId = new Map(components.map((c) => [c.id, c]))

  // Fios agrupados por pino de destino (para detectar conflito de drivers).
  const driversByTarget = new Map<string, Wire[]>()
  for (const w of wires) {
    if (!byId.has(w.from.comp) || !byId.has(w.to.comp)) continue
    const k = pinKey(w.to.comp, w.to.pin)
    const list = driversByTarget.get(k)
    if (list) list.push(w)
    else driversByTarget.set(k, [w])
  }

  // Conflito é detectado aqui, direto da topologia — não durante a avaliação,
  // que nunca visita pinos de componentes presos em laço combinacional.
  const conflictPins = new Set<string>()
  for (const [k, drivers] of driversByTarget) {
    if (drivers.length > 1) conflictPins.add(k)
  }

  const graph = buildUnitGraph(components, wires)
  const indeg = new Map(graph.indeg)
  const queue = graph.units.filter((u) => (indeg.get(u) ?? 0) === 0)
  const order: string[] = []
  while (queue.length > 0) {
    const u = queue.shift()!
    order.push(u)
    for (const next of graph.adj.get(u) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1
      indeg.set(next, d)
      if (d === 0) queue.push(next)
    }
  }
  const inOrder = new Set(order)

  const pins = new Map<string, Signal>()

  const readInput = (compId: string, pin: string): Signal => {
    const k = pinKey(compId, pin)
    const drivers = driversByTarget.get(k) ?? []
    if (drivers.length === 0) return 'X'
    if (conflictPins.has(k)) return 'E'
    const d = drivers[0]
    return pins.get(pinKey(d.from.comp, d.from.pin)) ?? 'X'
  }

  for (const u of order) {
    const c = byId.get(graph.unitComp.get(u)!)!
    const gate = graph.icGate.get(u)
    const func = graph.icFunc.get(u)
    if (c.type === 'IC' && chipOf(c).seq && !gate) {
      const def = chipOf(c)
      const seq = def.seq!
      const vcc = readInput(c.id, `p${def.vcc}`)
      const gnd = readInput(c.id, `p${def.gnd}`)
      pins.set(pinKey(c.id, `p${def.vcc}`), vcc)
      pins.set(pinKey(c.id, `p${def.gnd}`), gnd)
      if (graph.seqSaida.has(u)) {
        const asinc = seq.assincronas.map((n) => {
          // entrada atrasada: a saída vem do estado guardado (1 é o nível de repouso das entradas ativas em 0)
          if (graph.assincronasAtrasadas.has(pinKey(c.id, `p${n}`))) return 1
          const v = readInput(c.id, `p${n}`)
          pins.set(pinKey(c.id, `p${n}`), v)
          return v
        })
        const estado = c.estadoCi ?? Array<0>(seq.bits).fill(0)
        const outs = vcc === 1 && gnd === 0 ? seq.saida(estado, asinc) : seq.saidas.map(() => 'X' as Signal)
        seq.saidas.forEach((n, i) => pins.set(pinKey(c.id, `p${n}`), outs[i]))
      } else {
        for (const n of seq.sincronas) pins.set(pinKey(c.id, `p${n}`), readInput(c.id, `p${n}`))
      }
    } else if (func) {
      // bloco de função (ex.: decodificador 7448) — avaliado inteiro de uma vez
      const def = chipOf(c)
      const vcc = readInput(c.id, `p${def.vcc}`)
      const gnd = readInput(c.id, `p${def.gnd}`)
      pins.set(pinKey(c.id, `p${def.vcc}`), vcc)
      pins.set(pinKey(c.id, `p${def.gnd}`), gnd)
      const ins = func.inputs.map((n) => {
        const v = readInput(c.id, `p${n}`)
        pins.set(pinKey(c.id, `p${n}`), v)
        return v
      })
      const powered = vcc === 1 && gnd === 0
      const outs = powered ? func.evaluate(ins) : func.outputs.map(() => 'X' as Signal)
      func.outputs.forEach((n, i) => pins.set(pinKey(c.id, `p${n}`), outs[i]))
    } else if (gate) {
      // porta interna de CI: só funciona com o chip alimentado
      const def = chipOf(c)
      const vcc = readInput(c.id, `p${def.vcc}`)
      const gnd = readInput(c.id, `p${def.gnd}`)
      pins.set(pinKey(c.id, `p${def.vcc}`), vcc)
      pins.set(pinKey(c.id, `p${def.gnd}`), gnd)
      const ins = gate.inputs.map((n) => {
        const v = readInput(c.id, `p${n}`)
        pins.set(pinKey(c.id, `p${n}`), v)
        return v
      })
      const powered = vcc === 1 && gnd === 0
      pins.set(pinKey(c.id, `p${gate.output}`), powered ? evalGate(gate.type, ins) : 'X')
    } else if (isSeq(c.type)) {
      if (graph.seqSaida.has(u)) {
        const lidos = entradasAssincronas(c.type).map((p) => {
          if (graph.assincronasAtrasadas.has(pinKey(c.id, p))) return undefined
          const v = readInput(c.id, p)
          pins.set(pinKey(c.id, p), v)
          return v
        })
        const [q, qn] = saidasDe(c.q ?? 0, lidos[0], lidos[1])
        pins.set(pinKey(c.id, 'q'), q)
        pins.set(pinKey(c.id, 'qn'), qn)
      } else {
        for (const p of entradasSincronas(c.type)) pins.set(pinKey(c.id, p), readInput(c.id, p))
      }
    } else if (c.type === 'DIP_SWITCH') {
      allOutputPins(c).forEach((p, i) => {
        pins.set(pinKey(c.id, p), overrides?.get(pinKey(c.id, p)) ?? c.estados?.[i] ?? 0)
      })
    } else if (c.type === 'COUNTER') {
      for (let b = 0; b < bitsDe(c); b++) {
        const k = pinKey(c.id, `q${b}`)
        pins.set(k, overrides?.get(k) ?? ((((c.contagem ?? 0) >> b) & 1) as 0 | 1))
      }
    } else if (isSource(c.type)) {
      let v: Signal
      if (c.type === 'LEVEL_HIGH') v = 1
      else if (c.type === 'LEVEL_LOW') v = 0
      else v = overrides?.get(c.id) ?? c.state ?? 0
      pins.set(pinKey(c.id, 'out'), v)
    } else if (isGate(c.type)) {
      const ins = inputPins(c).map((p) => {
        const v = readInput(c.id, p)
        pins.set(pinKey(c.id, p), v)
        return v
      })
      pins.set(pinKey(c.id, 'out'), evalGate(c.type, ins))
    } else if (isSink(c.type)) {
      for (const p of inputPins(c)) pins.set(pinKey(c.id, p), readInput(c.id, p))
    }
  }

  // Entradas assíncronas atrasadas: o valor delas só existe depois que o laço todo foi avaliado
  for (const k of graph.assincronasAtrasadas) {
    const i = k.lastIndexOf(':')
    pins.set(k, readInput(k.slice(0, i), k.slice(i + 1)))
  }

  // Unidades em laço: pinos viram 'E'; o componente dono entra no aviso.
  const cycleComps = new Set<string>()
  for (const u of graph.units) {
    if (inOrder.has(u)) continue
    const compId = graph.unitComp.get(u)!
    const c = byId.get(compId)!
    cycleComps.add(compId)
    const gate = graph.icGate.get(u)
    const func = graph.icFunc.get(u)
    if (func) {
      for (const n of func.outputs) pins.set(pinKey(compId, `p${n}`), 'E')
      for (const n of func.inputs) pins.set(pinKey(compId, `p${n}`), 'E')
    } else if (gate) {
      pins.set(pinKey(compId, `p${gate.output}`), 'E')
      for (const n of gate.inputs) pins.set(pinKey(compId, `p${n}`), 'E')
    } else if (c.type === 'IC' && chipOf(c).seq) {
      const seq = chipOf(c).seq!
      const nomes = graph.seqSaida.has(u) ? [...seq.assincronas, ...seq.saidas] : seq.sincronas
      for (const n of nomes) pins.set(pinKey(compId, `p${n}`), 'E')
    } else if (isSeq(c.type)) {
      const nomes = graph.seqSaida.has(u) ? [...entradasAssincronas(c.type), 'q', 'qn'] : entradasSincronas(c.type)
      for (const p of nomes) pins.set(pinKey(compId, p), 'E')
    } else {
      for (const p of allOutputPins(c)) pins.set(pinKey(compId, p), 'E')
      for (const p of inputPins(c)) pins.set(pinKey(compId, p), 'E')
    }
  }

  // Pinos VCC/GND de CIs sem nenhuma porta avaliada (ex.: chip todo em laço):
  // registra mesmo assim, para o indicador de alimentação da UI.
  for (const c of components) {
    if (c.type !== 'IC') continue
    const def = chipOf(c)
    const vk = pinKey(c.id, `p${def.vcc}`)
    const gk = pinKey(c.id, `p${def.gnd}`)
    if (!pins.has(vk)) pins.set(vk, readInput(c.id, `p${def.vcc}`))
    if (!pins.has(gk)) pins.set(gk, readInput(c.id, `p${def.gnd}`))
  }

  // Valor dos fios = valor do pino de origem; conflito marca todos os fios do pino.
  const wireVals = new Map<string, Signal>()
  for (const w of wires) {
    if (!byId.has(w.from.comp) || !byId.has(w.to.comp)) continue
    wireVals.set(w.id, pins.get(pinKey(w.from.comp, w.from.pin)) ?? 'X')
  }
  for (const k of conflictPins) {
    for (const w of driversByTarget.get(k) ?? []) wireVals.set(w.id, 'E')
  }

  return { pins, wires: wireVals, cycleComps, conflictPins, atrasadas: graph.assincronasAtrasadas }
}
