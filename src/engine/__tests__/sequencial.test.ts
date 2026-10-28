// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Flip-flops e trava D: tabela de cada tipo, borda de subida, PR/CLR, realimentação e oscilação.
import { describe, expect, it } from 'vitest'
import { assentar, proximoEstado, saidasDe } from '../sequencial'
import { simulate } from '../simulate'
import { pinKey, type CircuitComponent, type Wire } from '../types'

const comp = (id: string, type: CircuitComponent['type'], extra: Partial<CircuitComponent> = {}): CircuitComponent => ({
  id,
  type,
  x: 0,
  y: 0,
  ...extra,
})

const wire = (id: string, from: string, fromPin: string, to: string, toPin: string): Wire => ({
  id,
  from: { comp: from, pin: fromPin },
  to: { comp: to, pin: toPin },
})

/** Troca o estado de uma chave e deixa o circuito assentar, como o programa faz a cada mudança. */
function mudar(cs: CircuitComponent[], ws: Wire[], id: string, state: 0 | 1): CircuitComponent[] {
  return assentar(
    cs.map((c) => (c.id === id ? { ...c, state } : c)),
    ws,
  ).components
}

const q = (cs: CircuitComponent[], ws: Wire[], id: string) => simulate(cs, ws).pins.get(pinKey(id, 'q'))

describe('próximo estado de cada tipo', () => {
  it('D copia a entrada', () => {
    expect(proximoEstado('FF_D', 0, { d: 1 })).toBe(1)
    expect(proximoEstado('FF_D', 1, { d: 0 })).toBe(0)
    expect(proximoEstado('FF_D', 1, { d: 'X' })).toBe('X')
  })

  it('JK: mantém, zera, liga e inverte', () => {
    expect(proximoEstado('FF_JK', 1, { j: 0, k: 0 })).toBe(1)
    expect(proximoEstado('FF_JK', 1, { j: 0, k: 1 })).toBe(0)
    expect(proximoEstado('FF_JK', 0, { j: 1, k: 0 })).toBe(1)
    expect(proximoEstado('FF_JK', 0, { j: 1, k: 1 })).toBe(1)
    expect(proximoEstado('FF_JK', 1, { j: 1, k: 1 })).toBe(0)
  })

  it('T inverte com T = 1 e mantém com T = 0', () => {
    expect(proximoEstado('FF_T', 0, { t: 1 })).toBe(1)
    expect(proximoEstado('FF_T', 1, { t: 1 })).toBe(0)
    expect(proximoEstado('FF_T', 1, { t: 0 })).toBe(1)
  })

  it('SR: S = R = 1 é proibido e fica indefinido', () => {
    expect(proximoEstado('FF_SR', 0, { s: 1, r: 0 })).toBe(1)
    expect(proximoEstado('FF_SR', 1, { s: 0, r: 1 })).toBe(0)
    expect(proximoEstado('FF_SR', 1, { s: 0, r: 0 })).toBe(1)
    expect(proximoEstado('FF_SR', 1, { s: 1, r: 1 })).toBe('X')
  })

  it('PR e CLR forçam a saída; os dois juntos são proibidos', () => {
    expect(saidasDe(0, 1, 0)).toEqual([1, 0])
    expect(saidasDe(1, 0, 1)).toEqual([0, 1])
    expect(saidasDe(1, 1, 1)).toEqual(['X', 'X'])
    expect(saidasDe(1, 'X', 'X')).toEqual([1, 0])
  })
})

describe('flip-flop D no circuito', () => {
  const cs0 = [comp('d', 'SWITCH'), comp('c', 'SWITCH'), comp('f', 'FF_D'), comp('l', 'LED')]
  const ws = [wire('w1', 'd', 'out', 'f', 'd'), wire('w2', 'c', 'out', 'f', 'clk'), wire('w3', 'f', 'q', 'l', 'in')]

  it('só muda na borda de subida do clock', () => {
    let cs = assentar(cs0, ws).components
    cs = mudar(cs, ws, 'd', 1)
    expect(q(cs, ws, 'f')).toBe(0) // D mudou, mas o clock não subiu
    cs = mudar(cs, ws, 'c', 1)
    expect(q(cs, ws, 'f')).toBe(1) // borda de subida: copia D
    cs = mudar(cs, ws, 'd', 0)
    expect(q(cs, ws, 'f')).toBe(1) // clock parado em 1: guarda
    cs = mudar(cs, ws, 'c', 0)
    expect(q(cs, ws, 'f')).toBe(1) // borda de descida não conta
    expect(simulate(cs, ws).pins.get(pinKey('l', 'in'))).toBe(1)
  })

  it('PR liga e CLR zera sem esperar o clock, e o valor fica guardado', () => {
    const ws2 = [...ws, wire('w4', 'p', 'out', 'f', 'pr'), wire('w5', 'z', 'out', 'f', 'clr')]
    let cs = assentar([...cs0, comp('p', 'SWITCH'), comp('z', 'SWITCH')], ws2).components
    cs = mudar(cs, ws2, 'p', 1)
    expect(q(cs, ws2, 'f')).toBe(1)
    cs = mudar(cs, ws2, 'p', 0)
    expect(q(cs, ws2, 'f')).toBe(1)
    cs = mudar(cs, ws2, 'z', 1)
    expect(q(cs, ws2, 'f')).toBe(0)
    expect(simulate(cs, ws2).pins.get(pinKey('f', 'qn'))).toBe(1)
  })
})

describe('realimentação e contadores', () => {
  it('D ligado ao próprio Q̄ divide a frequência por 2, sem virar laço', () => {
    const cs0 = [comp('c', 'SWITCH'), comp('f', 'FF_D')]
    const ws = [wire('w1', 'c', 'out', 'f', 'clk'), wire('w2', 'f', 'qn', 'f', 'd')]
    expect(simulate(cs0, ws).cycleComps.size).toBe(0)
    let cs = assentar(cs0, ws).components
    const visto: unknown[] = []
    for (let i = 0; i < 4; i++) {
      cs = mudar(cs, ws, 'c', 1)
      visto.push(q(cs, ws, 'f'))
      cs = mudar(cs, ws, 'c', 0)
    }
    expect(visto).toEqual([1, 0, 1, 0])
  })

  it('contador assíncrono de 2 bits com flip-flops T: 0, 1, 2, 3, 0', () => {
    // o Q̄ do primeiro serve de clock do segundo: o segundo sobe quando o primeiro desce
    const cs0 = [comp('c', 'SWITCH'), comp('um', 'LEVEL_HIGH'), comp('a', 'FF_T'), comp('b', 'FF_T')]
    const ws = [
      wire('w1', 'c', 'out', 'a', 'clk'),
      wire('w2', 'um', 'out', 'a', 't'),
      wire('w3', 'um', 'out', 'b', 't'),
      wire('w4', 'a', 'qn', 'b', 'clk'),
    ]
    let cs = assentar(cs0, ws).components
    const valor = () => Number(q(cs, ws, 'b')) * 2 + Number(q(cs, ws, 'a'))
    const contagem: number[] = []
    for (let i = 0; i < 5; i++) {
      cs = mudar(cs, ws, 'c', 1)
      contagem.push(valor())
      cs = mudar(cs, ws, 'c', 0)
    }
    expect(contagem).toEqual([1, 2, 3, 0, 1])
  })
})

describe('trava D', () => {
  it('segue D com EN = 1 e guarda com EN = 0', () => {
    const cs0 = [comp('d', 'SWITCH'), comp('e', 'SWITCH'), comp('t', 'LATCH_D')]
    const ws = [wire('w1', 'd', 'out', 't', 'd'), wire('w2', 'e', 'out', 't', 'en')]
    let cs = assentar(cs0, ws).components
    cs = mudar(cs, ws, 'e', 1)
    cs = mudar(cs, ws, 'd', 1)
    expect(q(cs, ws, 't')).toBe(1)
    cs = mudar(cs, ws, 'e', 0)
    cs = mudar(cs, ws, 'd', 0)
    expect(q(cs, ws, 't')).toBe(1)
  })

  it('ligada à própria saída invertida com EN = 1 oscila e fica indefinida, sem travar o programa', () => {
    const cs0 = [comp('um', 'LEVEL_HIGH'), comp('t', 'LATCH_D')]
    const ws = [wire('w1', 'um', 'out', 't', 'en'), wire('w2', 't', 'qn', 't', 'd')]
    const r = assentar(cs0, ws)
    expect(r.oscilando.has('t')).toBe(true)
    expect(q(r.components, ws, 't')).toBe('X')
  })
})

describe('circuito sem memória', () => {
  it('assentar devolve o mesmo array, sem trabalho', () => {
    const cs = [comp('s', 'SWITCH'), comp('l', 'LED')]
    expect(assentar(cs, []).components).toBe(cs)
  })
})
