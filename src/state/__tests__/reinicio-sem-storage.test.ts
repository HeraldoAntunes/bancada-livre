// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// BL-RC6-D01 (auditoria da rc.6): revisão no teto com o armazenamento do navegador ausente ou ilegível. O preparo do
// reinício lia o storage sem guarda, lançava, e `migrar_circuitos` nunca era chamado. Storage ilegível conta como fonte
// ausente; a falha real de preservação (comando ausente, backend recusando) continua impedindo a confirmação.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const circuito = (id: string, revisao?: number, hora = 0) => JSON.stringify({
  version: 1, components: [{ id, type: 'LED', x: 0, y: 0 }], wires: [],
  ...(revisao === undefined ? {} : { salvamento: { revisao, hora } }),
})
const janela = () => ({ setTimeout, clearTimeout, addEventListener: vi.fn() })
type Invoke = (comando: string, args?: Record<string, unknown>) => Promise<unknown>
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(10000)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
})
const ilegivel = () => ({
  getItem: () => { throw new DOMException('acesso negado', 'SecurityError') },
  setItem: () => { throw new DOMException('acesso negado', 'SecurityError') },
})
async function ambiente(storage: unknown, nativo: string, invoke: Invoke = async () => ({ ok: true })) {
  vi.stubGlobal('localStorage', storage)
  const espiao = vi.fn(invoke)
  vi.stubGlobal('window', { ...janela(), __BANCADA_CIRCUITO__: nativo, __TAURI__: { core: { invoke: espiao } } })
  const { useCircuit } = await import('../store')
  return { useCircuit, invoke: espiao }
}
const plano = (invoke: ReturnType<typeof vi.fn>) => invoke.mock.calls.find(c => c[0] === 'migrar_circuitos')?.[1] as
  { texto: string; copias: { original: string; envelope: string }[]; reiniciarRevisao: boolean } | undefined

it('storage ausente: o reinício chama migrar_circuitos com a cópia nativa e confirma', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, invoke } = await ambiente(undefined, old)
  await vi.advanceTimersByTimeAsync(401)
  const p = plano(invoke)
  expect(p?.reiniciarRevisao).toBe(true)
  expect(p?.copias.map(c => c.original)).toContain(old)
  expect(JSON.parse(p!.texto).salvamento.revisao).toBe(1)
  expect(useCircuit.getState().falhaSalvamento).toBe('')
})

it('storage ilegível: o reinício ainda chama migrar_circuitos com a cópia nativa', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { invoke } = await ambiente(ilegivel(), old)
  await vi.advanceTimersByTimeAsync(401)
  const p = plano(invoke)
  expect(p?.reiniciarRevisao).toBe(true)
  expect(p?.copias.map(c => c.original)).toContain(old)
  expect(p?.copias.every(c => JSON.parse(c.envelope).salvamento.revisao === 0)).toBe(true)
})

it('controle: revisão normal com storage ausente grava pelo salvar_circuito, sem migração', async () => {
  const { useCircuit, invoke } = await ambiente(undefined, circuito('normal', 3, 5))
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(plano(invoke)).toBeUndefined()
  const gravado = invoke.mock.calls.find(c => c[0] === 'salvar_circuito')?.[1] as { texto: string }
  expect(JSON.parse(gravado.texto).salvamento.revisao).toBe(4)
  expect(useCircuit.getState().falhaSalvamento).toBe('')
})

it('controle: quota só na escrita não impede a migração nativa, e a falha local continua avisada', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, invoke } = await ambiente({ getItem: () => null, setItem: () => { throw Error('quota') } }, old)
  await vi.advanceTimersByTimeAsync(401)
  expect(plano(invoke)?.copias.map(c => c.original)).toContain(old)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
})

it('controle: comando ausente não confirma nem publica pelo salvar_circuito', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, invoke } = await ambiente(undefined, old, async (comando) => {
    if (comando === 'migrar_circuitos') throw Error('command migrar_circuitos not found')
    return { ok: true }
  })
  await vi.advanceTimersByTimeAsync(401)
  expect(plano(invoke)).toBeDefined()
  expect(invoke.mock.calls.some(c => c[0] === 'salvar_circuito')).toBe(false)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
})

it('controle: backend recusando (sem ok: true) não confirma nem publica', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, invoke } = await ambiente(ilegivel(), old, async () => ({ ok: false }))
  await vi.advanceTimersByTimeAsync(401)
  expect(plano(invoke)).toBeDefined()
  expect(invoke.mock.calls.some(c => c[0] === 'salvar_circuito')).toBe(false)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
})
