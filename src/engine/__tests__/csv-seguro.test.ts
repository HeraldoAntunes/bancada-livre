// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { expect, it } from 'vitest'
import { conferir, lerGabarito, tabelaParaCsv } from '../gabarito'
import type { CircuitTable } from '../truthTable'

it.each([' A ', 'A ', ' A', '  =1+1 ', " '@literal ", ' A;B ', ' A" B ', ' A\r\nB ', '\tA\t'])(
  'CSV conserva os espaços do nome %j e confere as mesmas colunas', (nome) => {
    const tabela = { inputs: [{ name: nome }], outputs: [{ name: ' S ' }],
      rows: [{ inputs: [0], outputs: [1] }, { inputs: [1], outputs: [0] }] } as CircuitTable
    const g = lerGabarito(tabelaParaCsv(tabela))
    if (typeof g === 'string') throw new Error(g)
    expect(g.colunas).toEqual([nome, ' S '])
    const resultado = conferir(g, tabela)
    expect(resultado.faltam).toEqual([])
    expect(resultado.sobram).toEqual([])
    expect(resultado.acertos).toBe(2)
  })

it.each(['=1+1', '+soma', '-valor', '@soma', '  =1', "'@literal", "''literal"])(
  'CSV neutraliza fórmulas e preserva o nome %s na leitura', (nome) => {
    const tabela = { inputs: [{ name: nome }], outputs: [{ name: 'Saída' }],
      rows: [{ inputs: [0], outputs: [1] }, { inputs: [1], outputs: [0] }] } as CircuitTable
    const csv = tabelaParaCsv(tabela)
    const primeira = csv.split('\r\n')[0].split(';')[0]
    expect(primeira.replace(/^"|"$/g, '').trimStart()).not.toMatch(/^[=+@-]/)
    expect(primeira.startsWith("'")).toBe(true)
    const g = lerGabarito(csv)
    expect(typeof g).not.toBe('string')
    if (typeof g === 'string') throw new Error(g)
    expect(g.colunas).toEqual([nome, 'Saída'])
    const comparacao = conferir(g, tabela)
    expect(comparacao.faltam).toEqual([])
    expect(comparacao.acertos).toBe(2)
  })
