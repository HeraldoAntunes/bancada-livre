// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Revisão independente da 2.1.2 (Codex, Ordem 23, achado grave): duas abas abertas do mesmo circuito salvo. A primeira
// acrescenta uma chave e grava; a segunda, ainda com a base antiga, acrescenta um LED e grava por cima. Ao reabrir, só
// sobrava o LED, sem aviso. Agora a aba que acha a cópia mudada por outra não sobrescreve: guarda a própria versão à
// parte, avisa, e ao reabrir a Bancada pergunta qual versão continuar.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const AUTOSAVE = 'simulador-portas:autosave'
const base = JSON.stringify({ version: 1, components: [{ id: 'c1', type: 'LED', x: 0, y: 0 }], wires: [],
  salvamento: { revisao: 3, hora: 5 } })
let dados: Map<string, string>
const armazenamento = {
  getItem: (k: string) => dados.get(k) ?? null,
  setItem: (k: string, v: string) => void dados.set(k, String(v)),
  removeItem: (k: string) => void dados.delete(k),
  key: (i: number) => [...dados.keys()][i] ?? null,
  get length() { return dados.size },
  clear: () => dados.clear(),
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(10000)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  dados = new Map([[AUTOSAVE, base]])
  vi.stubGlobal('localStorage', armazenamento)
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn() })
})
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
})

/** Cada aba é um store independente, com o mesmo armazenamento do navegador. */
async function abrirAba() {
  vi.resetModules()
  return (await import('../store')).useCircuit
}
const tipos = (texto: string | undefined) =>
  texto ? (JSON.parse(texto) as { components: { type: string }[] }).components.map(c => c.type).sort() : []

it('a segunda aba não apaga o que a primeira gravou, avisa, e a pergunta mostra as duas versões', async () => {
  const aba1 = await abrirAba()
  const aba2 = await abrirAba()
  aba1.getState().addComponent('SWITCH', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(tipos(dados.get(AUTOSAVE))).toEqual(['LED', 'SWITCH'])

  aba2.getState().addComponent('LED', 200, 0)
  await vi.advanceTimersByTimeAsync(401)
  // o que a primeira aba gravou continua na cópia automática
  expect(tipos(dados.get(AUTOSAVE))).toEqual(['LED', 'SWITCH'])
  // e o que a segunda fez foi guardado à parte, com aviso
  const daAba2 = [...dados.entries()].filter(([k]) => k.startsWith('simulador-portas:autosave-aba:'))
  expect(daAba2.map(([, v]) => tipos(v))).toEqual([['LED', 'LED']])
  expect(aba2.getState().avisoRecuperacao).toMatch(/outra aba/i)
  expect(aba2.getState().falhaSalvamento).toBe('')

  // a segunda aba continua guardando as próprias mudanças à parte, sem mexer na da primeira
  aba2.getState().addComponent('LED', 300, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(tipos(dados.get(AUTOSAVE))).toEqual(['LED', 'SWITCH'])
  expect([...dados.entries()].filter(([k]) => k.startsWith('simulador-portas:autosave-aba:')).map(([, v]) => tipos(v)))
    .toEqual([['LED', 'LED', 'LED']])

  // ao reabrir, a pergunta traz as duas versões, e nenhuma se perde
  const reaberta = await abrirAba()
  const opcoes = reaberta.getState().recuperacao
  expect(opcoes?.map(o => o.componentes).sort()).toEqual([2, 3])
  expect(reaberta.getState().components).toEqual([])
})

it('escolher na pergunta grava a escolhida e tira a cópia à parte', async () => {
  const aba1 = await abrirAba()
  const aba2 = await abrirAba()
  aba1.getState().addComponent('SWITCH', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  aba2.getState().addComponent('LED', 200, 0)
  await vi.advanceTimersByTimeAsync(401)

  const reaberta = await abrirAba()
  const opcoes = reaberta.getState().recuperacao!
  reaberta.getState().escolherRecuperacao(opcoes.findIndex(o => o.origem.includes('outra aba')))
  await vi.advanceTimersByTimeAsync(401)
  expect(tipos(dados.get(AUTOSAVE))).toEqual(['LED', 'LED'])
  expect([...dados.keys()].filter(k => k.startsWith('simulador-portas:autosave-aba:'))).toEqual([])
  expect(reaberta.getState().avisoRecuperacao).toBe('')
})

it('uma aba só continua gravando normalmente, sem cópia à parte nem aviso', async () => {
  const aba = await abrirAba()
  aba.getState().addComponent('SWITCH', 100, 0)
  await vi.advanceTimersByTimeAsync(401)
  aba.getState().addComponent('LED', 200, 0)
  await vi.advanceTimersByTimeAsync(401)
  expect(tipos(dados.get(AUTOSAVE))).toEqual(['LED', 'LED', 'SWITCH'])
  expect(JSON.parse(dados.get(AUTOSAVE)!).salvamento.revisao).toBe(5)
  expect([...dados.keys()].filter(k => k.startsWith('simulador-portas:autosave-aba:'))).toEqual([])
  expect(aba.getState().avisoRecuperacao).toBe('')
})

it('a cópia à parte igual à automática não faz perguntar', async () => {
  dados.set('simulador-portas:autosave-aba:x', base)
  const aba = await abrirAba()
  expect(aba.getState().recuperacao).toBeNull()
  expect(aba.getState().components.map(c => c.id)).toEqual(['c1'])
})
