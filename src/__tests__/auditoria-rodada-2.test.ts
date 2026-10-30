// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Auditoria independente, rodada 2 (29/10/2026): o que sobrou das correções da rodada 1, cada caso com o teste que
// falhava antes da correção (rodado no Windows).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as gabarito from '../engine/gabarito'
import type { CircuitTable } from '../engine/truthTable'

// relógio falso: a gravação agendada ao abrir (a migração das cópias sem envelope) não pode disparar depois que a
// janela de teste foi desfeita (auditoria da rc.6: "window is not defined" fora do teste)
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('auditoria rodada 2', () => {
  it('ids c999999999 e c1000000000 num arquivo: a peça nova não repete nenhum', async () => {
    const { useCircuit } = await import('../state/store')
    const arquivo = {
      version: 1,
      components: [
        { id: 'c999999999', type: 'SWITCH', x: 0, y: 0, state: 0 },
        { id: 'c1000000000', type: 'SWITCH', x: 0, y: 80, state: 0 },
      ],
      wires: [],
    }
    expect(useCircuit.getState().loadJSON(JSON.stringify(arquivo))).toBeNull()
    for (let i = 0; i < 3; i++) useCircuit.getState().addComponent('LED', 100 + i * 40, 100)
    const ids = useCircuit.getState().components.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('rótulo com quebra de linha: o CSV exportado reabre como gabarito', () => {
    const t = {
      inputs: [{ name: 'A\nB' }],
      outputs: [{ name: 'S' }],
      rows: [
        { inputs: [0], outputs: [1] },
        { inputs: [1], outputs: [0] },
      ],
    } as unknown as CircuitTable
    expect(gabarito.lerGabarito(gabarito.tabelaParaCsv(t))).toEqual({
      colunas: ['A\nB', 'S'],
      linhas: [['0', '1'], ['1', '0']],
    })
  })

  it('arquivo com peça inválida não impede a recuperação da cópia boa do localStorage', async () => {
    const ruim = { version: 1, components: [{ id: 'x', type: 'NAO_EXISTE', x: 0, y: 0 }], wires: [] }
    const bom = { version: 1, components: [{ id: 'bom', type: 'LED', x: 0, y: 0 }], wires: [] }
    const guardado = new Map<string, string>([['simulador-portas:autosave', JSON.stringify(bom)]])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    })
    vi.stubGlobal('window', {
      __BANCADA_CIRCUITO__: JSON.stringify(ruim),
      __BANCADA_CIRCUITO_HORA__: 9e12,
      setTimeout,
      clearTimeout,
      addEventListener: () => {},
    })
    const { useCircuit } = await import('../state/store')
    expect(useCircuit.getState().components.map((c) => c.id)).toEqual(['bom'])
    expect(guardado.get('simulador-portas:autosave-recusado')).toContain('NAO_EXISTE')
  })

  it('a reserva do arquivo vem junto e é usada quando a cópia principal não abre', async () => {
    const ruim = { version: 1, components: [{ id: 'x', type: 'NAO_EXISTE', x: 0, y: 0 }], wires: [] }
    const reserva = { version: 1, components: [{ id: 'reserva', type: 'LED', x: 0, y: 0 }], wires: [] }
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    vi.stubGlobal('window', {
      __BANCADA_CIRCUITO__: JSON.stringify(ruim),
      __BANCADA_CIRCUITO_HORA__: 2000,
      __BANCADA_RESERVAS__: [{ texto: JSON.stringify(reserva), hora: 1000 }],
      setTimeout,
      clearTimeout,
      addEventListener: () => {},
    })
    const { useCircuit } = await import('../state/store')
    expect(useCircuit.getState().components.map((c) => c.id)).toEqual(['reserva'])
  })
})

describe('auditoria rodada 1, relatório completo: atalhos com janela aberta (BL-05)', () => {
  const doc = (tag: string, modal: boolean) =>
    ({ activeElement: { tagName: tag }, querySelector: (s: string) => (s === '.modal' && modal ? {} : null) }) as unknown as Pick<
      Document,
      'activeElement' | 'querySelector'
    >

  it('com uma janela modal aberta, Delete, Ctrl+Z, E e R não mexem no circuito por trás dela', async () => {
    const { ignorarAtalho } = await import('../ui/atalhos')
    expect(ignorarAtalho(doc('BUTTON', true))).toBe(true)
    expect(ignorarAtalho(doc('BODY', true))).toBe(true)
  })

  it('sem janela modal, os atalhos valem na bancada (e não ao digitar num campo)', async () => {
    const { ignorarAtalho } = await import('../ui/atalhos')
    expect(ignorarAtalho(doc('BODY', false))).toBe(false)
    expect(ignorarAtalho(doc('INPUT', false))).toBe(true)
  })
})

describe('auditoria rodada 1, relatório completo: abrir JSON enorme (BL-08)', () => {
  it('a tela lê no máximo o limite de um circuito, e o excesso é recusado', async () => {
    const fonte = (await import('../ui/TopBar.tsx?raw')).default as string
    expect(fonte).toContain('file.slice(0, MAX_JSON_CHARS * 4 + 1).text()')
    expect(fonte).not.toContain('await file.text()')
    const { useCircuit, MAX_JSON_CHARS } = await import('../state/store')
    expect(useCircuit.getState().loadJSON('x'.repeat(MAX_JSON_CHARS + 1))).toMatch(/grande demais/)
  })
})
