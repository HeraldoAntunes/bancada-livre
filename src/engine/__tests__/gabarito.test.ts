// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Gabarito em CSV: leitura (separadores, BOM, recusas) e comparação com o circuito montado.
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../examples'
import { conferir, lerGabarito, type Gabarito } from '../gabarito'
import { circuitTruthTable } from '../truthTable'

const tabelaDe = (nome: string) => {
  const ex = EXAMPLES.find((e) => e.name === nome)!
  return circuitTruthTable(ex.components, ex.wires)
}

describe('leitura do CSV', () => {
  it('aceita o formato que o programa exporta (ponto e vírgula e BOM)', () => {
    const g = lerGabarito('\uFEFFA;B;S\r\n0;0;0\r\n0;1;1\r\n') as Gabarito
    expect(g.colunas).toEqual(['A', 'B', 'S'])
    expect(g.linhas).toEqual([
      ['0', '0', '0'],
      ['0', '1', '1'],
    ])
  })

  it('aceita vírgula e tabulação', () => {
    expect((lerGabarito('A,S\n0,1') as Gabarito).colunas).toEqual(['A', 'S'])
    expect((lerGabarito('A\tS\n0\t1') as Gabarito).colunas).toEqual(['A', 'S'])
  })

  it('recusa arquivo sem linhas, com colunas repetidas ou com linha torta', () => {
    expect(lerGabarito('A;S')).toMatch(/pelo menos uma linha/)
    expect(lerGabarito('A;A\n0;1')).toMatch(/sem repetir/)
    expect(lerGabarito('A;B;S\n0;1')).toMatch(/linha 2/)
    expect(lerGabarito('x'.repeat(300_000))).toMatch(/grande demais/)
  })
})

describe('comparação com o circuito', () => {
  const meio = 'A;B;S;Cout\n0;0;0;0\n0;1;1;0\n1;0;1;0\n1;1;0;1'

  it('o meio-somador certo bate nas 4 linhas', () => {
    const c = conferir(lerGabarito(meio) as Gabarito, tabelaDe('Meio-somador'))
    expect(c.acertos).toBe(4)
    expect(c.linhas).toHaveLength(4)
    expect(c.saidas).toEqual(['S', 'Cout'])
  })

  it('um gabarito errado aponta a linha e a saída que não batem', () => {
    const errado = meio.replace('1;1;0;1', '1;1;0;0')
    const c = conferir(lerGabarito(errado) as Gabarito, tabelaDe('Meio-somador'))
    expect(c.acertos).toBe(3)
    const ruim = c.linhas.find((l) => l.erros.length > 0)!
    expect(ruim.entradas).toEqual([1, 1])
    expect(ruim.erros).toEqual([{ saida: 'Cout', esperado: '0', obtido: '1' }])
  })

  it('X no gabarito aceita qualquer valor; a ordem das colunas e das linhas não importa', () => {
    const g = lerGabarito('Cout;B;A\n1;1;1\nX;0;0') as Gabarito
    const c = conferir(g, tabelaDe('Meio-somador'))
    expect(c.acertos).toBe(2)
  })

  it('diz que entrada falta e que coluna sobra', () => {
    const c = conferir(lerGabarito('A;Z;S\n0;0;0') as Gabarito, tabelaDe('Meio-somador'))
    expect(c.faltam).toEqual(['B'])
    expect(c.sobram).toEqual(['Z'])
    expect(c.linhas).toHaveLength(0)
  })
})
