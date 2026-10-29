// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Pontos da auditoria independente de 29/10/2026 (seção 2), cada um com o caso que falhava antes da correção.
import { describe, expect, it } from 'vitest'
import { useCircuit } from '../state/store'
import * as gabarito from '../engine/gabarito'
import type { CircuitTable } from '../engine/truthTable'

describe('auditoria de 29/10/2026', () => {
  it('um id enorme num arquivo aberto não faz o simulador repetir ids depois', () => {
    const arquivo = {
      version: 1,
      components: [{ id: 'c9007199254740992', type: 'SWITCH', x: 0, y: 0, state: 0 }],
      wires: [],
    }
    expect(useCircuit.getState().loadJSON(JSON.stringify(arquivo))).toBeNull()
    for (let i = 0; i < 3; i++) useCircuit.getState().addComponent('LED', 100 + i * 40, 100)
    const ids = useCircuit.getState().components.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('o CSV exportado com um rótulo "A;B" reabre como gabarito, com a mesma coluna', () => {
    const t = {
      inputs: [{ name: 'A;B' }, { name: 'C "x"' }],
      outputs: [{ name: 'S' }],
      rows: [
        { inputs: [0, 0], outputs: [0] },
        { inputs: [1, 1], outputs: [1] },
      ],
    } as unknown as CircuitTable
    const csv = gabarito.tabelaParaCsv(t)
    const lido = gabarito.lerGabarito(csv)
    expect(lido).toEqual({ colunas: ['A;B', 'C "x"', 'S'], linhas: [['0', '0', '0'], ['1', '1', '1']] })
  })

  it('o gabarito escrito à mão com vírgula e aspas também abre', () => {
    expect(gabarito.lerGabarito('"A,1",S\n0,1\n1,0')).toEqual({ colunas: ['A,1', 'S'], linhas: [['0', '1'], ['1', '0']] })
  })
})

describe('auditoria de 29/10/2026: atraso do relógio', () => {
  // CLOCK de 1 Hz no clk de um FF_T com T = 1: cada borda de subida inverte Q
  const montar = () =>
    useCircuit.getState().loadCircuit(
      [
        { id: 'k', type: 'CLOCK', x: 0, y: 0, freq: 1, state: 0 },
        { id: 'um', type: 'LEVEL_HIGH', x: 0, y: 80 },
        { id: 'ff', type: 'FF_T', x: 200, y: 0, q: 0 },
      ],
      [
        { id: 'w1', from: { comp: 'k', pin: 'out' }, to: { comp: 'ff', pin: 'clk' } },
        { id: 'w2', from: { comp: 'um', pin: 'out' }, to: { comp: 'ff', pin: 't' } },
      ],
    )
  const q = () => useCircuit.getState().components.find((c) => c.id === 'ff')?.q

  it('3 s de atraso de uma vez dão o mesmo Q que 60 passos de 50 ms', () => {
    montar()
    for (let i = 0; i < 60; i++) useCircuit.getState().tickClocks(50)
    const emPassos = q()
    montar()
    useCircuit.getState().tickClocks(3000)
    expect(q()).toBe(emPassos)
  })

  it('um atraso enorme (computador suspenso) não trava e deixa um aviso visível', () => {
    montar()
    const inicio = performance.now()
    useCircuit.getState().tickClocks(3_600_000)
    expect(performance.now() - inicio).toBeLessThan(2000)
    expect(useCircuit.getState().avisoRelogio).toMatch(/relógio/)
  })
})

describe('auditoria de 29/10/2026: textos', () => {
  const textos = import.meta.glob(['../../README.md', '../../docs/GUIA-DE-USO.md'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  it('todo texto que diz quantos exemplos há diz o número certo', async () => {
    const { EXAMPLES } = await import('../examples')
    for (const [arquivo, texto] of Object.entries(textos)) {
      for (const m of texto.matchAll(/(\d+) (?:circuitos(?: prontos| de exemplo)?|exemplos)\b/g)) {
        expect(`${arquivo}: ${m[0]}`).toBe(`${arquivo}: ${EXAMPLES.length} ${m[0].replace(/^\d+ /, '')}`)
      }
    }
  })
})
