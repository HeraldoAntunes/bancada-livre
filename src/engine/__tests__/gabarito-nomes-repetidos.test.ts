// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Revisão independente da 2.1.2 (Codex, Ordem 23, achado leve): duas chaves com o mesmo rótulo davam o cabeçalho A;A;S1,
// e o gabarito recusava o CSV que a própria bancada exportou. Agora a tabela dá um nome só a cada coluna (a segunda A
// vira A_2), e o CSV exportado volta como gabarito.
import { expect, it } from 'vitest'
import type { CircuitComponent, Wire } from '../types'
import { conferir, lerGabarito, tabelaParaCsv, type Gabarito } from '../gabarito'
import { circuitTruthTable } from '../truthTable'

const componentes: CircuitComponent[] = [
  { id: 'a', type: 'SWITCH', x: 0, y: 0, label: 'A', state: 0 },
  { id: 'b', type: 'SWITCH', x: 0, y: 60, label: 'A', state: 0 },
  { id: 'g', type: 'AND', x: 100, y: 30, inputs: 2 },
  { id: 's', type: 'LED', x: 200, y: 30, label: 'S1' },
]
const fios: Wire[] = [
  { id: 'w1', from: { comp: 'a', pin: 'out' }, to: { comp: 'g', pin: 'in0' } },
  { id: 'w2', from: { comp: 'b', pin: 'out' }, to: { comp: 'g', pin: 'in1' } },
  { id: 'w3', from: { comp: 'g', pin: 'out' }, to: { comp: 's', pin: 'in' } },
]

it('o CSV exportado com rótulos repetidos volta como gabarito e confere tudo', () => {
  const tabela = circuitTruthTable(componentes, fios)
  const g = lerGabarito(tabelaParaCsv(tabela))
  expect(typeof g).not.toBe('string')
  const r = conferir(g as Gabarito, tabela)
  expect(r.faltam).toEqual([])
  expect(r.acertos).toBe(4)
})

it('cada coluna tem um nome só, sem trocar o nome que não se repete', () => {
  const tabela = circuitTruthTable(componentes, fios)
  const nomes = [...tabela.inputs, ...tabela.outputs].map(c => c.name)
  expect(nomes).toEqual(['A', 'A_2', 'S1'])
})

it('o nome novo não colide com um rótulo que já existe', () => {
  const comOutro: CircuitComponent[] = [...componentes, { id: 'c', type: 'SWITCH', x: 0, y: 120, label: 'A_2', state: 0 }]
  const nomes = circuitTruthTable(comOutro, fios).inputs.map(c => c.name)
  expect(new Set(nomes).size).toBe(nomes.length)
  expect(nomes).toContain('A_2')
})
