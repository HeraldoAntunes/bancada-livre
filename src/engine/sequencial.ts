// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Elementos de memória: flip-flops D, JK, T e SR (borda de subida do clock) e trava D (transparente com EN = 1).
// A simulação combinacional trata a saída de cada um como uma fonte; depois de cada mudança, `assentar` procura
// as bordas, atualiza os estados guardados e simula de novo, até nada mais mudar.

import { chipOf } from './ics'
import { simulate, type SimResult } from './simulate'
import { isSeq, pinKey, type CircuitComponent, type SeqType, type Signal, type Wire } from './types'

/** Estado guardado de um elemento de memória. */
export type Estado = 0 | 1 | 'X'

/** Repetições máximas do assentamento: passar disso é oscilação (ex.: trava ligada à própria saída invertida). */
export const MAX_ASSENTAR = 64

function inverso(v: Estado): Estado {
  return v === 'X' ? 'X' : v === 1 ? 0 : 1
}

/** Lê um nível como 0, 1 ou X: erro e entrada solta não definem estado. */
function nivel(s: Signal | undefined): Estado {
  return s === 0 || s === 1 ? s : 'X'
}

/**
 * Saídas Q e Q̄ a partir do estado guardado e das entradas assíncronas. PR e CLR em 1 forçam Q na hora; os dois
 * juntos são combinação proibida (Q indefinido). Entrada solta não age.
 */
export function saidasDe(q: Estado, pr: Signal | undefined, clr: Signal | undefined): [Estado, Estado] {
  const p = pr === 1
  const c = clr === 1
  if (p && c) return ['X', 'X']
  if (p) return [1, 0]
  if (c) return [0, 1]
  return [q, inverso(q)]
}

/** Próximo estado na borda de subida (ou, na trava, enquanto EN = 1). */
export function proximoEstado(tipo: SeqType, q: Estado, ent: Record<string, Signal | undefined>): Estado {
  switch (tipo) {
    case 'FF_D':
    case 'LATCH_D':
      return nivel(ent.d)
    case 'FF_T': {
      const t = nivel(ent.t)
      return t === 'X' ? 'X' : t === 1 ? inverso(q) : q
    }
    case 'FF_JK': {
      const j = nivel(ent.j)
      const k = nivel(ent.k)
      if (j === 'X' || k === 'X') return 'X'
      if (j === 1 && k === 1) return inverso(q)
      if (j === 1) return 1
      if (k === 1) return 0
      return q
    }
    case 'FF_SR': {
      const s = nivel(ent.s)
      const r = nivel(ent.r)
      if (s === 'X' || r === 'X') return 'X'
      // S = R = 1 é a combinação proibida do SR: o estado fica indefinido
      if (s === 1 && r === 1) return 'X'
      if (s === 1) return 1
      if (r === 1) return 0
      return q
    }
  }
}

/** CI com parte sequencial (7474, 7476, 74161, 74164). */
export function temMemoria(c: CircuitComponent): boolean {
  return isSeq(c.type) || (c.type === 'IC' && chipOf(c).seq !== undefined)
}

/** Um passo de um CI sequencial: bordas de cada clock, próximo estado, ou o mesmo objeto se nada mudou. */
function passoCi(c: CircuitComponent, sim: SimResult): CircuitComponent {
  const def = chipOf(c)
  const seq = def.seq!
  const ler = (n: number) => sim.pins.get(pinKey(c.id, `p${n}`)) ?? 'X'
  const niveis = seq.clocks.map((n) => (ler(n) === 1 ? 1 : 0) as 0 | 1)
  const ativo = seq.bordaDescida ? 0 : 1
  // sem leitura anterior não há borda (mesma regra dos flip-flops soltos)
  const bordas = niveis.map((v, i) => c.clksVistos !== undefined && c.clksVistos[i] !== v && v === ativo)
  const estado = c.estadoCi ?? Array<0>(seq.bits).fill(0)
  const ligado = ler(def.vcc) === 1 && ler(def.gnd) === 0
  const novo = ligado ? seq.proximo(estado, seq.sincronas.map(ler), seq.assincronas.map(ler), bordas) : estado
  const igual = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
    a !== undefined && a.length === b.length && a.every((v, i) => v === b[i])
  if (igual(c.estadoCi, novo) && igual(c.clksVistos, niveis)) return c
  return { ...c, estadoCi: novo, clksVistos: niveis }
}

/** Um passo: novo estado de um elemento de memória, ou o mesmo objeto se nada mudou. */
function passo(c: CircuitComponent, sim: SimResult): CircuitComponent {
  if (c.type === 'IC') return passoCi(c, sim)
  const tipo = c.type as SeqType
  const ler = (p: string) => sim.pins.get(pinKey(c.id, p))
  const q: Estado = c.q ?? 0
  let novoQ: Estado = q
  let clkVisto = c.clkVisto
  if (tipo === 'LATCH_D') {
    if (ler('en') === 1) novoQ = proximoEstado(tipo, q, { d: ler('d') })
  } else {
    const clk = ler('clk')
    const agora = clk === 1 ? 1 : 0
    // borda de subida: o clock estava em 0 e agora está em 1. Sem leitura anterior (flip-flop recém-posto ou
    // arquivo antigo), só registra o nível: ligar um flip-flop com o clock já em 1 não é borda
    if (agora === 1 && c.clkVisto === 0) {
      novoQ = proximoEstado(tipo, q, { d: ler('d'), j: ler('j'), k: ler('k'), t: ler('t'), s: ler('s'), r: ler('r') })
    }
    clkVisto = agora
    // PR e CLR também ficam guardados: ao soltar, o flip-flop continua no valor forçado
    const [forcado] = saidasDe(novoQ, ler('pr'), ler('clr'))
    if (ler('pr') === 1 || ler('clr') === 1) novoQ = forcado
  }
  if (novoQ === q && clkVisto === c.clkVisto) return c
  return { ...c, q: novoQ, ...(tipo === 'LATCH_D' ? {} : { clkVisto }) }
}

/**
 * Entrada assíncrona atrasada (reset pela própria saída): ao soltar, ela continua valendo por mais uma rodada. É o
 * que acontece no chip real, onde o CLR ainda está ativo enquanto as saídas que ele limpou descem; sem isso, a
 * descida limpa pareceria uma borda de clock para o flip-flop seguinte.
 */
function comSoltura(sim: SimResult, anterior: SimResult | null, porId: Map<string, CircuitComponent>): SimResult {
  if (!anterior || sim.atrasadas.size === 0) return sim
  const pins = new Map(sim.pins)
  for (const k of sim.atrasadas) {
    const ativo = porId.get(k.slice(0, k.lastIndexOf(':')))?.type === 'IC' ? 0 : 1
    if (anterior.pins.get(k) === ativo) pins.set(k, ativo)
  }
  return { ...sim, pins }
}

export interface Assentado {
  components: CircuitComponent[]
  /** Elementos que não pararam de mudar dentro do limite (oscilação): ficam com estado indefinido. */
  oscilando: Set<string>
}

/**
 * Atualiza o estado de todos os elementos de memória até o circuito parar de mudar. Devolve o mesmo array quando
 * nada muda, para o estado do programa não disparar outra rodada à toa.
 */
export function assentar(components: CircuitComponent[], wires: Wire[]): Assentado {
  const oscilando = new Set<string>()
  if (!components.some(temMemoria)) return { components, oscilando }
  let atual = components
  let anterior: SimResult | null = null
  const porId = new Map(components.map((c) => [c.id, c]))
  for (let i = 0; i < MAX_ASSENTAR; i++) {
    const simulado = simulate(atual, wires)
    const sim = comSoltura(simulado, anterior, porId)
    anterior = simulado
    let mudou = false
    const prox = atual.map((c) => {
      if (!temMemoria(c)) return c
      const n = passo(c, sim)
      if (n !== c) mudou = true
      return n
    })
    if (!mudou) return { components: atual, oscilando }
    if (i === MAX_ASSENTAR - 1) {
      prox.forEach((c, j) => {
        if (c !== atual[j]) oscilando.add(c.id)
      })
    }
    atual = prox
  }
  return {
    components: atual.map((c) => {
      if (!oscilando.has(c.id)) return c
      if (c.type === 'IC') return { ...c, estadoCi: (c.estadoCi ?? []).map(() => 'X' as const) }
      return { ...c, q: 'X' as const }
    }),
    oscilando,
  }
}
