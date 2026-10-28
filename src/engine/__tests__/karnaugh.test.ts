// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Mapa de Karnaugh: disposição em código Gray, grupos e expressão mínima conferida contra a tabela.
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../examples'
import { coberturaMinima, implicantesPrimos, mapaKarnaugh, termo } from '../karnaugh'
import { circuitTruthTable, type CircuitTable } from '../truthTable'
import type { CircuitComponent } from '../types'

/** Tabela feita à mão: entradas A, B, C... e uma saída S dada pela lista de 0/1 de cada linha. */
function tabela(n: number, saida: (0 | 1)[]): CircuitTable {
  const nomes = 'ABCD'.slice(0, n).split('')
  const comp = (id: string, type: CircuitComponent['type']): CircuitComponent => ({ id, type, x: 0, y: 0 })
  return {
    inputs: nomes.map((nome) => ({ comp: comp(nome, 'SWITCH'), pin: 'out', name: nome, key: nome })),
    outputs: [{ comp: comp('s', 'LED'), pin: 'in', name: 'S', key: 's' }],
    rows: saida.map((v, m) => ({ inputs: nomes.map((_, i) => ((m >> (n - 1 - i)) & 1) as 0 | 1), outputs: [v] })),
    tooBig: false,
  }
}

/** Avalia uma expressão na notação do programa (A' negado, · E, + OU) para uma combinação. */
function avaliar(expr: string, nomes: string[], bits: (0 | 1)[]): 0 | 1 {
  if (expr === '0' || expr === '1') return Number(expr) as 0 | 1
  return expr.split(' + ').some((t) =>
    t.split('·').every((lit) => {
      const neg = lit.endsWith("'")
      const v = bits[nomes.indexOf(neg ? lit.slice(0, -1) : lit)]
      return neg ? v === 0 : v === 1
    }),
  )
    ? 1
    : 0
}

describe('implicantes e cobertura', () => {
  it('maioria de 3: três grupos de dois', () => {
    const uns = [3, 5, 6, 7]
    const primos = implicantesPrimos(uns, 3)
    expect(primos).toHaveLength(3)
    const cobertura = coberturaMinima(primos, uns, 3)
    expect(cobertura.map((i) => termo(i, ['A', 'B', 'C'])).sort()).toEqual(['A·B', 'A·C', 'B·C'])
  })

  it('termo some com a variável que muda dentro do grupo', () => {
    expect(termo({ valor: 0b10, mascara: 0b01 }, ['A', 'B'])).toBe('A')
    expect(termo({ valor: 0, mascara: 0b11 }, ['A', 'B'])).toBe('1')
  })
})

describe('mapa de Karnaugh', () => {
  it('3 variáveis: linhas A, colunas BC em Gray (00, 01, 11, 10)', () => {
    const m = mapaKarnaugh(tabela(3, [0, 0, 0, 1, 0, 1, 1, 1]), 0)!
    expect(m.varsLinha).toEqual(['A'])
    expect(m.varsColuna).toEqual(['B', 'C'])
    expect(m.rotulosColuna).toEqual(['00', '01', '11', '10'])
    expect(m.mintermo[1]).toEqual([4, 5, 7, 6])
    expect(m.valor[1]).toEqual([0, 1, 1, 1])
  })

  it('4 variáveis: os cantos são vizinhos e viram um grupo só', () => {
    const saida = Array<0 | 1>(16).fill(0)
    for (const m of [0, 2, 8, 10]) saida[m] = 1
    const k = mapaKarnaugh(tabela(4, saida), 0)!
    expect(k.expressao).toBe("B'·D'")
    expect(k.rotulosLinha).toEqual(['00', '01', '11', '10'])
  })

  it('a expressão mínima bate com a tabela em todas as combinações (todas as funções de 3 variáveis)', () => {
    for (let f = 0; f < 256; f++) {
      const saida = Array.from({ length: 8 }, (_, m) => ((f >> m) & 1) as 0 | 1)
      const t = tabela(3, saida)
      const k = mapaKarnaugh(t, 0)!
      t.rows.forEach((r, m) => expect(avaliar(k.expressao, ['A', 'B', 'C'], r.inputs), `f=${f} m=${m}`).toBe(saida[m]))
    }
  })

  it('0 e 1 constantes, e fora de 2 a 4 entradas não há mapa', () => {
    expect(mapaKarnaugh(tabela(2, [0, 0, 0, 0]), 0)!.expressao).toBe('0')
    expect(mapaKarnaugh(tabela(2, [1, 1, 1, 1]), 0)!.expressao).toBe('1')
    expect(mapaKarnaugh(tabela(1, [0, 1]), 0)).toBeNull()
  })

  it('no exemplo do somador completo, Cout simplifica para a maioria', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Somador completo')!
    const t = circuitTruthTable(ex.components, ex.wires)
    const i = t.outputs.findIndex((o) => o.name === 'Cout')
    const termos = mapaKarnaugh(t, i)!.expressao.split(' + ')
    expect(termos).toHaveLength(3)
  })
})
