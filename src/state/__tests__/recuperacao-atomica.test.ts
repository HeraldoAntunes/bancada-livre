// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const KEY = 'simulador-portas:autosave'
const HORA = KEY + '-hora'
// relógio falso em todos: nenhuma gravação agendada dispara depois que a janela de teste foi desfeita
beforeEach(() => { vi.useFakeTimers() })
it('snapshot local e metadados são gravados juntos e vencem o arquivo antigo ao reabrir', async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(10000)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const old = JSON.stringify({ ...JSON.parse(circuito('old-file')), salvamento: { hora: 1000, revisao: 0 } })
  const data = new Map([[KEY, old], [HORA, '1000']])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === HORA) throw new Error('timestamp quota failure')
      data.set(k, v)
    },
  })
  vi.stubGlobal('window', { ...janelaBase(), __BANCADA_CIRCUITO__: old, __BANCADA_CIRCUITO_HORA__: 2000,
    __TAURI__: { core: { invoke: vi.fn().mockRejectedValue(new Error('disk full')) } } })
  const { useCircuit } = await import('../store')
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(JSON.parse(data.get(KEY)!).components).toHaveLength(2)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
  vi.resetModules()
  vi.clearAllTimers()
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) })
  vi.stubGlobal('window', { ...janelaBase(), __BANCADA_CIRCUITO__: old, __BANCADA_CIRCUITO_HORA__: 2000 })
  const reopened = await import('../store')
  expect(reopened.useCircuit.getState().components).toHaveLength(2)
  expect(JSON.parse(data.get(KEY)!).salvamento).toEqual({ hora: 10400, revisao: 1 })
  expect(data.get(HORA)).toBe('1000')
})

it('quota não substitui a cópia recuperável e revisão cresce em cada gravação confirmada', async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(10000)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const old = circuito('legado')
  const data = new Map([[KEY, old], [HORA, '9000']])
  let quota = true
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { if (quota) throw new Error('quota'); data.set(k, v) },
  })
  vi.stubGlobal('window', janelaBase())
  const { useCircuit } = await import('../store')
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['legado'])
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(data.get(KEY)).toBe(old)
  quota = false
  await (window as unknown as { __bancadaAoFechar: () => Promise<boolean> }).__bancadaAoFechar()
  expect(JSON.parse(data.get(KEY)!).salvamento).toEqual({ hora: 10400, revisao: 1 })
  useCircuit.getState().addComponent('LED', 200, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(JSON.parse(data.get(KEY)!).salvamento.revisao).toBe(2)
})

const circuito = (id: string) => JSON.stringify({
  version: 1, components: [{ id, type: 'LED', x: 0, y: 0 }], wires: [],
})
const janelaBase = () => ({ setTimeout, clearTimeout, addEventListener: vi.fn() })

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

it('recupera arquivo nativo válido mesmo quando a leitura do storage falha', async () => {
  vi.resetModules()
  vi.stubGlobal('window', { ...janelaBase(), __BANCADA_CIRCUITO__: circuito('native-good'), __BANCADA_CIRCUITO_HORA__: 1000 })
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('storage access denied') }, setItem: vi.fn() })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { useCircuit } = await import('../store')
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['native-good'])
  expect(warn).toHaveBeenCalled()
})

it('recupera reserva nativa mesmo quando o storage não existe', async () => {
  vi.resetModules()
  vi.stubGlobal('window', { ...janelaBase(), __BANCADA_RESERVAS__: [{ texto: circuito('reserva'), hora: 1000 }] })
  vi.stubGlobal('localStorage', undefined)
  const { useCircuit } = await import('../store')
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['reserva'])
})

it('autosave respeita o teto da importação antes de analisar JSON e preserva a cópia recusada', async () => {
  vi.resetModules()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const grande = circuito('sentinel') + ' '.repeat(2_000_001)
  const data = new Map([[KEY, grande]])
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v) })
  const parse = vi.spyOn(JSON, 'parse')
  const { useCircuit, AUTOSAVE_RECUSADO_KEY } = await import('../store')
  expect(useCircuit.getState().loadJSON(grande)).toMatch(/grande demais/)
  expect(useCircuit.getState().components).toHaveLength(0)
  expect([data.get(KEY), data.get(AUTOSAVE_RECUSADO_KEY)]).toContain(grande)
  expect(parse.mock.calls.some(([texto]) => texto === grande)).toBe(false)
})
