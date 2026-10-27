// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../examples'
import { mintermExpression } from '../expression'
import { circuitTruthTable } from '../truthTable'
import type { CircuitComponent, Wire } from '../types'

function tableOf(name: string) {
  const ex = EXAMPLES.find((e) => e.name === name)!
  return circuitTruthTable(ex.components, ex.wires)
}

describe('mintermExpression (RF-06.4)', () => {
  it('meio-somador: S = soma de mintermos do XOR; Cout = A·B', () => {
    const t = tableOf('Meio-somador')
    expect(mintermExpression(t, 0)).toBe("A'·B + A·B'")
    expect(mintermExpression(t, 1)).toBe('A·B')
  })

  it('porta NOT: S = A negado', () => {
    const t = tableOf('Porta NOT')
    expect(mintermExpression(t, 0)).toBe("A'")
  })

  it('comparador: dois mintermos (A=B)', () => {
    const t = tableOf('Comparador (A = B)')
    expect(mintermExpression(t, 0)).toBe("A'·B' + A·B")
  })

  it('coluna de DISPLAY não gera expressão', () => {
    const t = tableOf('BCD → Display')
    expect(mintermExpression(t, 0)).toBeNull()
  })

  it('saída com X (entrada flutuante) → null; saída constante → 0/1', () => {
    const comp = (id: string, type: CircuitComponent['type'], extra = {}): CircuitComponent => ({
      id,
      type,
      x: 0,
      y: 0,
      ...extra,
    })
    const wire = (id: string, from: string, to: string, toPin: string): Wire => ({
      id,
      from: { comp: from, pin: 'out' },
      to: { comp: to, pin: toPin },
    })
    // LED sem fio → X em todas as linhas
    const t1 = circuitTruthTable(
      [comp('a', 'SWITCH', { label: 'A' }), comp('l', 'LED', { label: 'S' })],
      [],
    )
    expect(mintermExpression(t1, 0)).toBeNull()

    // LED ligado direto em NÍVEL ALTO → constante 1
    const t2 = circuitTruthTable(
      [
        comp('a', 'SWITCH', { label: 'A' }),
        comp('h', 'LEVEL_HIGH'),
        comp('l', 'LED', { label: 'S' }),
      ],
      [wire('w1', 'h', 'l', 'in')],
    )
    expect(mintermExpression(t2, 0)).toBe('1')
  })
})
