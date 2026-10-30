// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Salvamento automático no Windows: entre envelopes válidos vence a maior revisão; cada mudança vai às duas fontes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const CIRCUITO = { version: 1, components: [{ id: 'arquivo', type: 'SWITCH', x: 0, y: 0, state: 0 }], wires: [], salvamento: { hora: 200, revisao: 1 } }
const OUTRO = { version: 1, components: [{ id: 'local', type: 'SWITCH', x: 0, y: 0, state: 0 }], wires: [], salvamento: { hora: 100, revisao: 0 } }

function ambiente(janela: Record<string, unknown>) {
  const guardado = new Map<string, string>([['simulador-portas:autosave', JSON.stringify(OUTRO)]])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  })
  const ouvintes = new Map<string, () => void>()
  vi.stubGlobal('window', {
    ...janela,
    setTimeout,
    clearTimeout,
    open: vi.fn(),
    addEventListener: (nome: string, f: () => void) => void ouvintes.set(nome, f),
  })
  return Object.assign(guardado, { ouvintes })
}

// relógio falso em todos: nenhuma gravação agendada dispara depois que a janela de teste foi desfeita
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('salvamento no programa do Windows', () => {
  it('abre o envelope do arquivo com maior revisão que o localStorage', async () => {
    ambiente({ __BANCADA_CIRCUITO__: JSON.stringify(CIRCUITO) })
    const { useCircuit } = await import('../state/store')
    expect(useCircuit.getState().components.map((c) => c.id)).toEqual(['arquivo'])
  })

  it('sem o arquivo, usa o localStorage como no navegador', async () => {
    ambiente({ __BANCADA_CIRCUITO__: '' })
    const { useCircuit } = await import('../state/store')
    expect(useCircuit.getState().components.map((c) => c.id)).toEqual(['local'])
  })

  it('cada mudança vai para o arquivo e para o localStorage', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn(() => Promise.resolve())
    const guardado = ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [], wires: [] })
    vi.advanceTimersByTime(500)
    expect(invoke).toHaveBeenCalledWith('salvar_circuito', { texto: guardado.get('simulador-portas:autosave') })
    expect(JSON.parse(guardado.get('simulador-portas:autosave')!)).toEqual({
      version: 1, components: [], wires: [], salvamento: { hora: Date.now() - 100, revisao: 1 },
    })
  })

  it('com um clock rápido rodando, a mudança do aluno é gravada mesmo assim', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn(() => Promise.resolve())
    const guardado = ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'k', type: 'CLOCK', x: 0, y: 0, freq: 10, state: 0 }], wires: [] })
    await vi.advanceTimersByTimeAsync(500)
    invoke.mockClear()
    // (avanço assíncrono: desde a 2.1.1 a gravação em arquivo espera a anterior terminar, uma promessa)
    // o clock bate a cada 50 ms; no meio, o aluno põe um LED
    for (let t = 0; t < 20; t++) {
      useCircuit.getState().tickClocks(50)
      if (t === 2) useCircuit.setState((s) => ({ components: [...s.components, { id: 'led', type: 'LED', x: 9, y: 9 }] }))
      await vi.advanceTimersByTimeAsync(50)
    }
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(guardado.get('simulador-portas:autosave')).toContain('"led"')
  })

  it('o clock sozinho não grava nada: o nível dele fica fora do salvamento', async () => {
    const { textoDoAutosave } = await import('../state/store')
    const a = textoDoAutosave({ components: [{ id: 'k', type: 'CLOCK', x: 0, y: 0, freq: 1, state: 0 }], wires: [] })
    const b = textoDoAutosave({ components: [{ id: 'k', type: 'CLOCK', x: 0, y: 0, freq: 1, state: 1 }], wires: [] })
    expect(a).toBe(b)
    expect(a).toContain('"freq":1')
  })

  it('o botão de versão nova pede ao programa para abrir a página', async () => {
    const invoke = vi.fn(() => Promise.resolve())
    ambiente({ __TAURI__: { core: { invoke } } })
    const { executar } = await import('../comandos')
    await executar('versao.ver_nova', {})
    expect(invoke).toHaveBeenCalledWith('ver_versao_nova')
  })

  // auditoria de 29/10/2026: fechar logo depois de uma mudança não pode perder a mudança
  it('ao sair da página antes da espera, a mudança é gravada na hora', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn(() => Promise.resolve())
    const guardado = ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'ultimo', type: 'LED', x: 0, y: 0 }], wires: [] })
    vi.advanceTimersByTime(100)
    guardado.ouvintes.get('pagehide')?.()
    expect(guardado.get('simulador-portas:autosave')).toContain('"ultimo"')
    const circuito = { version: 1, components: [{ id: 'ultimo', type: 'LED', x: 0, y: 0 }], wires: [] }
    expect(invoke).toHaveBeenCalledWith('salvar_circuito', { texto: guardado.get('simulador-portas:autosave') })
    expect(JSON.parse(guardado.get('simulador-portas:autosave')!)).toEqual({
      ...circuito, salvamento: { hora: Date.now(), revisao: 1 },
    })
  })

  it('o programa, ao fechar a janela, espera o arquivo ser gravado', async () => {
    vi.useFakeTimers()
    let gravou = false
    const invoke = vi.fn(() => new Promise<void>((r) => setTimeout(() => ((gravou = true), r()), 50)))
    const guardado = ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'ultimo', type: 'LED', x: 0, y: 0 }], wires: [] })
    const fechar = (window as unknown as { __bancadaAoFechar?: () => Promise<void> }).__bancadaAoFechar
    expect(fechar).toBeTypeOf('function')
    const fim = fechar!()
    await vi.advanceTimersByTimeAsync(60)
    await fim
    expect(gravou).toBe(true)
    expect(guardado.get('simulador-portas:autosave')).toContain('"ultimo"')
  })

  it('se a gravação em arquivo falhar, o aviso fica visível no estado (e some quando volta a gravar)', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn((): Promise<void> => Promise.reject(new Error('disco cheio')))
    ambiente({ __TAURI__: { core: { invoke } } })
    const { useCircuit } = await import('../state/store')
    useCircuit.setState({ components: [{ id: 'a', type: 'LED', x: 0, y: 0 }], wires: [] })
    await vi.advanceTimersByTimeAsync(500)
    expect(useCircuit.getState().falhaSalvamento).toMatch(/Salvar/)
    invoke.mockImplementation(() => Promise.resolve())
    useCircuit.setState({ components: [{ id: 'b', type: 'LED', x: 0, y: 0 }], wires: [] })
    await vi.advanceTimersByTimeAsync(500)
    expect(useCircuit.getState().falhaSalvamento).toBe('')
  })
})
