// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Linha do tempo: quais sinais entram, em que ordem, e como as amostras se acumulam.
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../examples'
import { acrescentar, amostrar, MAX_AMOSTRAS, MAX_SINAIS, sinaisObservados } from '../linhaDoTempo'
import type { CircuitComponent } from '../types'

const C = (id: string, type: CircuitComponent['type'], extra: Partial<CircuitComponent> = {}): CircuitComponent => ({
  id,
  type,
  x: 0,
  y: 0,
  ...extra,
})

describe('sinais acompanhados', () => {
  it('clock primeiro, depois chaves, flip-flops e saídas; CIs e portas ficam de fora', () => {
    const cs = [
      C('l', 'LED', { label: 'S' }),
      C('f', 'FF_D', { label: 'FF1' }),
      C('a', 'SWITCH', { label: 'D' }),
      C('k', 'CLOCK', { label: 'CLK1' }),
      C('g', 'AND'),
      C('i', 'IC', { chip: '7474' }),
    ]
    expect(sinaisObservados(cs).map((s) => s.nome)).toEqual(['CLK1', 'D', 'FF1.Q', 'S'])
  })

  it('limita o número de linhas', () => {
    const cs = Array.from({ length: 30 }, (_, i) => C(`s${i}`, 'SWITCH', { label: `A${i}` }))
    expect(sinaisObservados(cs)).toHaveLength(MAX_SINAIS)
  })
})

describe('amostras', () => {
  it('só acrescenta quando algum sinal muda e guarda as mais novas', () => {
    let lista = acrescentar([], { a: 0 })
    expect(acrescentar(lista, { a: 0 })).toBe(lista)
    lista = acrescentar(lista, { a: 1 })
    expect(lista).toHaveLength(2)
    for (let i = 0; i < 100; i++) lista = acrescentar(lista, { a: (i % 2) as 0 | 1 })
    expect(lista).toHaveLength(MAX_AMOSTRAS)
  })

  it('lê o valor de cada sinal no circuito', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Flip-flop D: guardar um bit')!
    const a = amostrar(ex.components, ex.wires)
    expect(Object.values(a)).toEqual([0, 0, 0, 0])
  })
})
