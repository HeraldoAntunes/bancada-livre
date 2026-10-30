// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Validação da 2.1.1 publicada (30/10/2026): PC de escola com os dados de site bloqueados por política. No Chromium,
// até ler `localStorage` (inclusive com typeof) lança. A migração e o arquivo ficavam certos, mas a gravação era marcada
// como falha: aviso falso na barra, nova tentativa a cada 5 s sem parar, sem o aviso de contagem reiniciada e com a
// pergunta "Fechar assim mesmo?" ao fechar. No programa, o arquivo é a fonte: storage bloqueado conta como ausente.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const circuito = (id: string, revisao?: number, hora = 0) => JSON.stringify({
  version: 1, components: [{ id, type: 'LED', x: 0, y: 0 }], wires: [],
  ...(revisao === undefined ? {} : { salvamento: { revisao, hora } }),
})
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(10000)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, get: () => { throw new DOMException('acesso negado pela política', 'SecurityError') },
  })
})
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  if (original) Object.defineProperty(globalThis, 'localStorage', original)
  else delete (globalThis as { localStorage?: unknown }).localStorage
})
async function ambiente(nativo: string) {
  const invoke = vi.fn<(comando: string, args?: Record<string, unknown>) => Promise<unknown>>(async () => ({ ok: true }))
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn(),
    __BANCADA_CIRCUITO__: nativo, __TAURI__: { core: { invoke } } })
  const { useCircuit } = await import('../store')
  const aoFechar = () => (window as unknown as { __bancadaAoFechar: () => Promise<boolean> }).__bancadaAoFechar()
  return { useCircuit, invoke, aoFechar }
}

it('migração da 2.1.0 com storage bloqueado: grava uma vez, sem aviso de falha nem novas tentativas', async () => {
  const { useCircuit, invoke, aoFechar } = await ambiente(circuito('legado'))
  await vi.advanceTimersByTimeAsync(401)
  expect(invoke.mock.calls.filter(c => c[0] === 'migrar_circuitos')).toHaveLength(1)
  expect(useCircuit.getState().falhaSalvamento).toBe('')
  await vi.advanceTimersByTimeAsync(20_000)
  expect(invoke).toHaveBeenCalledTimes(1)
  expect(await aoFechar()).toBe(true)
})

it('reinício da contagem com storage bloqueado mostra o aviso de contagem reiniciada', async () => {
  const { useCircuit, invoke } = await ambiente(circuito('limite', Number.MAX_SAFE_INTEGER, 5))
  await vi.advanceTimersByTimeAsync(401)
  expect(invoke.mock.calls.some(c => c[0] === 'migrar_circuitos')).toBe(true)
  expect(useCircuit.getState().falhaSalvamento).toBe('')
  expect(useCircuit.getState().avisoRecuperacao).toContain('Contagem de salvamentos reiniciada')
})

it('edição comum com storage bloqueado vai ao arquivo sem aviso de falha', async () => {
  const { useCircuit, invoke, aoFechar } = await ambiente(circuito('normal', 3, 5))
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  const gravado = invoke.mock.calls.find(c => c[0] === 'salvar_circuito')?.[1] as { texto: string }
  expect(JSON.parse(gravado.texto).salvamento.revisao).toBe(4)
  expect(useCircuit.getState().falhaSalvamento).toBe('')
  expect(await aoFechar()).toBe(true)
})
