// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Salvamento na 2.1.1: o que o auditor independente achou na 2.1.0 publicada (29/10/2026) e foi reproduzido no
// programa real: o fechamento não esperava a gravação que já tinha saído; depois de uma falha não havia nova tentativa;
// e a abertura voltava ao arquivo velho mesmo com o localStorage mais novo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ARQUIVO = { version: 1, components: [{ id: 'arquivo', type: 'SWITCH', x: 0, y: 0, state: 0 }], wires: [] }
const LOCAL = { version: 1, components: [{ id: 'local', type: 'SWITCH', x: 0, y: 0, state: 0 }], wires: [] }
type Fechar = () => Promise<boolean>

function ambiente(janela: Record<string, unknown>, local: Record<string, string> = {}) {
  const guardado = new Map<string, string>(Object.entries(local))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  })
  vi.stubGlobal('window', { ...janela, setTimeout, clearTimeout, open: vi.fn(), addEventListener: () => {} })
  return guardado
}
const aoFechar = () => (window as unknown as { __bancadaAoFechar: Fechar }).__bancadaAoFechar

// relógio falso em todos: a gravação agendada ao abrir (migração de cópia sem envelope) não pode disparar depois que a
// janela de teste foi desfeita ("window is not defined" fora do teste, rc.7)
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('salvamento 2.1.1', () => {
  it('fechar com a gravação já em andamento espera ela terminar', async () => {
    vi.useFakeTimers()
    let terminou = false
    const invoke = vi.fn(() => new Promise<void>((r) => setTimeout(() => ((terminou = true), r()), 300)))
    ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'novo', type: 'LED', x: 0, y: 0 }], wires: [] })
    await vi.advanceTimersByTimeAsync(450)          // a gravação saiu aos 400 ms e ainda não terminou
    expect(invoke).toHaveBeenCalledTimes(1)
    let fechou = false
    const fim = aoFechar()().then(() => (fechou = true))
    await vi.advanceTimersByTimeAsync(100)
    expect(fechou).toBe(false)                      // não libera o fechamento no meio da gravação
    await vi.advanceTimersByTimeAsync(300)
    await fim
    expect(terminou && fechou).toBe(true)
  })

  it('depois de uma falha, tenta de novo sozinho, e o aviso só sai quando grava de verdade', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn((): Promise<void> => Promise.reject(new Error('disco cheio')))
    ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'novo', type: 'LED', x: 0, y: 0 }], wires: [] })
    await vi.advanceTimersByTimeAsync(500)
    expect(useCircuit.getState().falhaSalvamento).toMatch(/Salvar/)
    invoke.mockImplementation(() => Promise.resolve())
    await vi.advanceTimersByTimeAsync(6000)         // sem nenhuma mudança nova
    expect(invoke).toHaveBeenCalledTimes(2)
    expect((invoke.mock.calls[1] as unknown[])[1]).toEqual((invoke.mock.calls[0] as unknown[])[1])
    expect(useCircuit.getState().falhaSalvamento).toBe('')
  })

  it('ao fechar depois de uma falha, tenta gravar de novo e diz se conseguiu', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn((): Promise<void> => Promise.reject(new Error('disco cheio')))
    ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'novo', type: 'LED', x: 0, y: 0 }], wires: [] })
    await vi.advanceTimersByTimeAsync(500)
    expect(await aoFechar()()).toBe(false)          // ainda falhando: o programa pergunta antes de fechar
    invoke.mockImplementation(() => Promise.resolve())
    expect(await aoFechar()()).toBe(true)
    expect(invoke).toHaveBeenCalledTimes(3)
  })

  it('pede escolha entre envelope local e arquivo legado divergentes', async () => {
    ambiente(
      { __BANCADA_CIRCUITO__: JSON.stringify(ARQUIVO), __BANCADA_CIRCUITO_HORA__: 1000 },
      { 'simulador-portas:autosave': JSON.stringify({ ...LOCAL, salvamento: { hora: 2000, revisao: 1 } }) },
    )
    const { useCircuit } = await import('../state/store')
    expect(useCircuit.getState().recuperacao).toHaveLength(2)
    expect(useCircuit.getState().components).toEqual([])
    useCircuit.getState().escolherRecuperacao(1)
    expect(useCircuit.getState().components.map((c) => c.id)).toEqual(['local'])
  })

  it('legados divergentes pedem escolha com ou sem data externa', async () => {
    ambiente(
      { __BANCADA_CIRCUITO__: JSON.stringify(ARQUIVO), __BANCADA_CIRCUITO_HORA__: 3000 },
      { 'simulador-portas:autosave': JSON.stringify(LOCAL), 'simulador-portas:autosave-hora': '2000' },
    )
    let { useCircuit } = await import('../state/store')
    expect(useCircuit.getState().recuperacao).toHaveLength(2)
    useCircuit.getState().escolherRecuperacao(0)
    expect(useCircuit.getState().components.map((c) => c.id)).toEqual(['arquivo'])
    vi.resetModules()
    ambiente(
      { __BANCADA_CIRCUITO__: JSON.stringify(ARQUIVO), __BANCADA_CIRCUITO_HORA__: 3000 },
      { 'simulador-portas:autosave': JSON.stringify(LOCAL) },
    )
    ;({ useCircuit } = await import('../state/store'))
    expect(useCircuit.getState().recuperacao).toHaveLength(2)
    useCircuit.getState().escolherRecuperacao(0)
    expect(useCircuit.getState().components.map((c) => c.id)).toEqual(['arquivo'])
  })

  it('cada gravação no localStorage guarda a hora', async () => {
    vi.useFakeTimers()
    const guardado = ambiente({})
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'novo', type: 'LED', x: 0, y: 0 }], wires: [] })
    await vi.advanceTimersByTimeAsync(500)
    const salvo = JSON.parse(guardado.get('simulador-portas:autosave')!)
    expect(salvo.salvamento.hora).toBeGreaterThan(0)
    expect(salvo.salvamento.revisao).toBeGreaterThan(0)
    expect(salvo.components[0].id).toBe('novo')
  })
})
