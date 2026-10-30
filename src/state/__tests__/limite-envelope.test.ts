// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const KEY = 'simulador-portas:autosave'
const MAX = 2_000_000
function circuito(tamanho: number) {
  const base = { version: 1, components: [{ id: '', type: 'LED', x: 0, y: 0 }], wires: [] }
  base.components[0].id = 'a'.repeat(tamanho - JSON.stringify(base).length)
  return JSON.stringify(base)
}
const janela = () => ({ setTimeout, clearTimeout, addEventListener: vi.fn() })
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(10000)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function ambiente(local?: string) {
  const data = new Map(local ? [[KEY, local]] : [])
  const invoke = vi.fn(() => Promise.resolve())
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v) })
  vi.stubGlobal('window', { ...janela(), __TAURI__: { core: { invoke } } })
  return { data, invoke }
}
it.each([-1, 0])('circuito de limite %s salva envelope maior e reabre inteiro', async (delta) => {
  const texto = circuito(MAX + delta)
  expect(texto.length).toBe(MAX + delta)
  const { data, invoke } = ambiente()
  const { useCircuit } = await import('../store')
  expect(useCircuit.getState().loadJSON(texto)).toBeNull()
  await vi.advanceTimersByTimeAsync(401)
  const salvo = data.get(KEY)!
  expect(salvo.length).toBeGreaterThan(MAX)
  expect(invoke).toHaveBeenCalledWith('salvar_circuito', { texto: salvo })
  expect(useCircuit.getState().loadJSON(salvo)).toBeNull()
  vi.resetModules(); vi.clearAllTimers()
  vi.stubGlobal('window', { ...janela(), __BANCADA_CIRCUITO__: salvo })
  const reopened = await import('../store')
  expect(reopened.useCircuit.getState().components).toHaveLength(1)
  expect(reopened.useCircuit.getState().components[0].id.length).toBe(JSON.parse(texto).components[0].id.length)
})
it('circuito acima do teto é recusado e autosave preserva a cópia boa sem enviar ao disco', async () => {
  const old = JSON.stringify({ version: 1, components: [], wires: [] })
  const { data, invoke } = ambiente(old)
  const { useCircuit } = await import('../store')
  const texto = circuito(MAX + 1)
  expect(useCircuit.getState().loadJSON(texto)).toMatch(/grande demais/)
  useCircuit.setState({ components: JSON.parse(texto).components, wires: [] })
  await vi.advanceTimersByTimeAsync(401)
  expect(data.get(KEY) === old).toBe(true)
  expect(invoke).not.toHaveBeenCalled()
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
})
it('envelope acima do teto do circuito é recusado na recuperação sem perder a fonte', async () => {
  const data = JSON.parse(circuito(MAX + 1))
  const raw = JSON.stringify({ ...data, salvamento: { hora: 100, revisao: 9 } })
  const { data: storage } = ambiente(raw)
  const { useCircuit, AUTOSAVE_RECUSADO_KEY } = await import('../store')
  expect(useCircuit.getState().components).toHaveLength(0)
  expect([storage.get(KEY), storage.get(AUTOSAVE_RECUSADO_KEY)].includes(raw)).toBe(true)
})
