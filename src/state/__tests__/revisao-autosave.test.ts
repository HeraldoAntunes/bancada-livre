// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const KEY = 'simulador-portas:autosave'
const circuito = (id: string, revisao?: number, hora = 0) => JSON.stringify({
  version: 1, components: [{ id, type: 'LED', x: 0, y: 0 }], wires: [],
  ...(revisao === undefined ? {} : { salvamento: { revisao, hora } }),
})
const janela = () => ({ setTimeout, clearTimeout, addEventListener: vi.fn() })
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(10000)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
})
async function ambiente(local: string | null, nativos: { texto: string; hora: number }[]) {
  const data = new Map(local ? [[KEY, local]] : [])
  const invoke = vi.fn<(comando: string, args?: Record<string, unknown>) => Promise<unknown>>(async () => ({ ok: true }))
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v) })
  vi.stubGlobal('window', { ...janela(), __BANCADA_RESERVAS__: nativos, __TAURI__: { core: { invoke } } })
  const { useCircuit } = await import('../store')
  return { data, invoke, useCircuit }
}
it('reserva com data de arquivo nova e conteúdo velho perde para a maior revisão', async () => {
  const { useCircuit } = await ambiente(circuito('local', 4, 99999), [
    { texto: circuito('atual', 8, 20), hora: 1 },
    { texto: circuito('reserva-velha', 7, 99999), hora: 999999 },
    { texto: circuito('temporario', 6, 999999), hora: 9999999 },
  ])
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['atual'])
})
it('empate de revisão usa a hora do envelope, ignorando mtime e posição da cópia', async () => {
  const { useCircuit } = await ambiente(circuito('local', 8, 30), [
    { texto: circuito('antigo', 8, 20), hora: 999999 },
    { texto: circuito('novo', 8, 40), hora: 1 },
  ])
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['novo'])
})
it('legado divergente exige escolha mesmo com revisão maior no envelope', async () => {
  const { useCircuit } = await ambiente(circuito('local', 1, 0), [
    { texto: circuito('legado'), hora: 99999999 },
  ])
  expect(useCircuit.getState().recuperacao).toHaveLength(2)
  expect(useCircuit.getState().components).toEqual([])
  useCircuit.getState().escolherRecuperacao(1)
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['local'])
})
it('só inclui revisões de cópias completamente válidas no máximo da próxima gravação', async () => {
  const ruim = JSON.parse(circuito('invalido', 90, 99999))
  ruim.components[0].type = 'TIPO_INEXISTENTE'
  const { useCircuit, data, invoke } = await ambiente(circuito('local', 2, 1000), [
    { texto: JSON.stringify(ruim), hora: 999999 },
    { texto: circuito('integro', 7, 20), hora: 1 },
  ])
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['integro'])
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  const texto = data.get(KEY)!
  expect(JSON.parse(texto).salvamento).toEqual({ hora: 10400, revisao: 8 })
  expect(invoke).toHaveBeenCalledWith('salvar_circuito', { texto })
})
it.each(['tipo', 'id', 'coordenada', 'rotulo', 'fio'])('revisão saturada em cópia inválida (%s) não bloqueia a gravação', async (erro) => {
  const ruim = JSON.parse(circuito('invalido', Number.MAX_SAFE_INTEGER, 99999))
  if (erro === 'tipo') ruim.components[0].type = 'TIPO_INEXISTENTE'
  if (erro === 'id') ruim.components[0].id = 'id:invalido'
  if (erro === 'coordenada') ruim.components[0].x = null
  if (erro === 'rotulo') ruim.components[0].label = { texto: 'não é rótulo' }
  if (erro === 'fio') ruim.wires = [{ id: 'w', from: { comp: 'invalido', pin: 'out' }, to: { comp: 'ausente', pin: 'in' } }]
  const { useCircuit, data, invoke } = await ambiente(circuito('integro', 7, 20), [{ texto: JSON.stringify(ruim), hora: 99 }])
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['integro'])
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(JSON.parse(data.get(KEY)!).salvamento.revisao).toBe(8)
  expect(invoke).toHaveBeenCalledWith('salvar_circuito', { texto: data.get(KEY) })
  expect(useCircuit.getState().falhaSalvamento).toBe('')
})

it('envia o mesmo envelope ao disco mesmo quando o storage falha; a tentativa seguinte reutiliza a revisão', async () => {
  const { useCircuit, data, invoke } = await ambiente(circuito('local', 3, 5), [])
  let quota = true
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { if (quota) throw Error('quota'); data.set(k, v) } })
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  const texto = (invoke.mock.calls[0] as unknown as [string, { texto: string }])[1].texto
  expect(JSON.parse(texto).salvamento).toEqual({ hora: 10400, revisao: 4 })
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
  quota = false
  await (window as unknown as { __bancadaAoFechar: () => Promise<boolean> }).__bancadaAoFechar()
  expect(data.get(KEY)).toBe(texto)
  expect(invoke).toHaveBeenCalledTimes(1)
})
it.each(['disco', 'storage'])('voltar ao conteúdo antigo após falha de %s confirma o novo envelope nas duas fontes', async (falha) => {
  const old = circuito('original', 5, 100)
  const { useCircuit, data, invoke } = await ambiente(old, [{ texto: old, hora: 999 }])
  let quota = falha === 'storage'
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { if (quota) throw Error('quota'); data.set(k, v) } })
  if (falha === 'disco') invoke.mockRejectedValueOnce(Error('disco'))
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
  quota = false
  useCircuit.getState().undo()
  await vi.advanceTimersByTimeAsync(401)
  expect(invoke).toHaveBeenCalledTimes(2)
  const texto = (invoke.mock.calls[1] as unknown as [string, { texto: string }])[1].texto
  expect(data.get(KEY)).toBe(texto)
  expect(JSON.parse(texto).salvamento.revisao).toBe(7)
  expect(JSON.parse(texto).components.map((c: { id: string }) => c.id)).toEqual(['original'])
})

it('revisão válida saturada avisa, preserva as versões e reinicia as fontes antes de publicar revisão 1', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const reserva = circuito('reserva', 8, 3)
  const { useCircuit, data, invoke } = await ambiente(old, [{ texto: reserva, hora: 3 }])
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['limite'])
  expect(useCircuit.getState().avisoRecuperacao).toMatch(/contador.*limite/i)
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(invoke).toHaveBeenCalledTimes(1)
  expect(invoke.mock.calls[0][0]).toBe('migrar_circuitos')
  const plano = invoke.mock.calls[0][1] as { texto: string; copias: { original: string; envelope: string }[]; reiniciarRevisao: boolean }
  expect(plano.reiniciarRevisao).toBe(true)
  expect(plano.copias.map(c => c.original)).toEqual([reserva, old])
  for (const copia of plano.copias) {
    expect(JSON.parse(copia.envelope).components).toEqual(JSON.parse(copia.original).components)
    expect(JSON.parse(copia.envelope).salvamento.revisao).toBe(0)
  }
  expect(data.get(KEY)).toBe(plano.texto)
  expect(JSON.parse(plano.texto).components).toHaveLength(2)
  expect(JSON.parse(plano.texto).salvamento.revisao).toBe(1)
  expect(useCircuit.getState().falhaSalvamento).toBe('')
  expect(useCircuit.getState().avisoRecuperacao).toMatch(/reiniciada.*preservadas/i)
  vi.clearAllTimers(); vi.resetModules()
  const reaberto = await ambiente(plano.texto, plano.copias.map(c => ({ texto: c.envelope, hora: 999999 })))
  expect(reaberto.useCircuit.getState().components).toHaveLength(2)
  expect(reaberto.useCircuit.getState().recuperacao).toBeNull()
  expect(reaberto.useCircuit.getState().avisoRecuperacao).toBe('')
})


it('registro nativo do reinício impede que o storage antigo saturado vença após falha local', async () => {
  const old = circuito('velho', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, data, invoke } = await ambiente(old, [])
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: () => { throw Error('quota após o Rust confirmar') } })
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(data.get(KEY)).toBe(old)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
  const plano = invoke.mock.calls[0][1] as { texto: string; copias: { original: string; envelope: string }[] }
  expect(JSON.parse(plano.texto).components).toHaveLength(2)
  vi.resetModules(); vi.clearAllTimers()
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v) })
  vi.stubGlobal('window', { ...janela(), __BANCADA_CIRCUITO__: plano.texto,
    __BANCADA_REVISOES_REINICIADAS__: plano.copias,
    __TAURI__: { core: { invoke: vi.fn(async () => ({ ok: true })) } } })
  const reaberto = (await import('../store')).useCircuit
  expect(reaberto.getState().components).toHaveLength(2)
  expect(reaberto.getState().recuperacao).toBeNull()
  await vi.advanceTimersByTimeAsync(401)
  expect(JSON.parse(data.get(KEY)!).components).toHaveLength(2)
  expect(JSON.parse(data.get(KEY)!).salvamento.revisao).toBe(2)
})
it('registro de reinício com conteúdo diferente não substitui o candidato local', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const data = new Map([[KEY, old]])
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: vi.fn() })
  vi.stubGlobal('window', { ...janela(), __BANCADA_CIRCUITO__: circuito('outro', 1, 6),
    __BANCADA_REVISOES_REINICIADAS__: [{ original: old, envelope: circuito('trocado', 0, 5) }] })
  const { useCircuit } = await import('../store')
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['limite'])
  expect(useCircuit.getState().avisoRecuperacao).toMatch(/contador.*limite/i)
})

it('reinício recusado preserva MAX_SAFE_INTEGER e repete o mesmo plano até confirmar', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, data, invoke } = await ambiente(old, [])
  invoke.mockRejectedValueOnce(Error('comando ainda não implementado'))
  await vi.advanceTimersByTimeAsync(401)
  expect(data.get(KEY)).toBe(old)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
  const primeira = invoke.mock.calls[0]
  await vi.advanceTimersByTimeAsync(5001)
  expect(invoke.mock.calls[1]).toEqual(primeira)
  expect(JSON.parse(data.get(KEY)!).salvamento.revisao).toBe(1)
  expect(useCircuit.getState().falhaSalvamento).toBe('')
})
it('quota durante reinício no navegador mantém o original e só publica depois de arquivá-lo', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, data } = await ambiente(old, [])
  delete (window as unknown as { __TAURI__?: unknown }).__TAURI__
  // A ponte é consultada a cada gravação; não há cópias nativas neste caso.
  let quota = true
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { if (quota) throw Error('quota'); data.set(k, v) } })
  await vi.advanceTimersByTimeAsync(401)
  expect(data.get(KEY)).toBe(old)
  expect(useCircuit.getState().falhaSalvamento).not.toBe('')
  quota = false
  await (window as unknown as { __bancadaAoFechar: () => Promise<boolean> }).__bancadaAoFechar()
  const { COPIAS_RECUPERADAS_KEY } = await import('../store')
  expect(JSON.parse(data.get(COPIAS_RECUPERADAS_KEY)!)).toContain(old)
  expect(JSON.parse(data.get(KEY)!).salvamento.revisao).toBe(1)
})
it('atingir o limite na sessão arquiva também o último envelope antes de reiniciar', async () => {
  const old = circuito('penultimo', Number.MAX_SAFE_INTEGER - 1, 5)
  const { useCircuit, data, invoke } = await ambiente(old, [])
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  const ultimo = data.get(KEY)!
  expect(JSON.parse(ultimo).salvamento.revisao).toBe(Number.MAX_SAFE_INTEGER)
  useCircuit.getState().addComponent('LED', 200, 0)
  await vi.advanceTimersByTimeAsync(401)
  const plano = invoke.mock.calls[1][1] as { copias: { original: string }[]; reiniciarRevisao: boolean }
  expect(invoke.mock.calls[1][0]).toBe('migrar_circuitos')
  expect(plano.reiniciarRevisao).toBe(true)
  expect(plano.copias.map(c => c.original)).toContain(ultimo)
  expect(JSON.parse(data.get(KEY)!).components).toHaveLength(3)
  expect(JSON.parse(data.get(KEY)!).salvamento.revisao).toBe(1)
})
it('nova edição após falha do reinício avança para revisão 2 sem mudar os originais', async () => {
  const old = circuito('limite', Number.MAX_SAFE_INTEGER, 5)
  const { useCircuit, data, invoke } = await ambiente(old, [])
  invoke.mockRejectedValueOnce(Error('disco'))
  await vi.advanceTimersByTimeAsync(401)
  useCircuit.getState().addComponent('LED', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  const a = invoke.mock.calls[0][1] as { copias: unknown[] }
  const b = invoke.mock.calls[1][1] as { copias: unknown[] }
  expect(a.copias).toEqual(b.copias)
  expect(JSON.parse(data.get(KEY)!).salvamento.revisao).toBe(2)
  expect(JSON.parse(data.get(KEY)!).components).toHaveLength(2)
})
