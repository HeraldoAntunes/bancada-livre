// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function ambiente(revisao = 10) {
  const legado = JSON.stringify({ version: 1, components: [{ id: 'novo', type: 'LED', x: 0, y: 0 }], wires: [] })
  const data = new Map([['simulador-portas:autosave', JSON.stringify({
    ...JSON.parse(legado), components: [{ id: 'velho', type: 'LED', x: 0, y: 0 }],
    salvamento: { hora: 9000, revisao },
  })]])
  const invoke = vi.fn(async () => ({ ok: true }))
  const setItem = vi.fn((k: string, v: string) => data.set(k, v))
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem })
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn(), close: vi.fn(),
    __BANCADA_CIRCUITO__: legado, __BANCADA_CIRCUITO_HORA__: 9500, __TAURI__: { core: { invoke } } })
  const ui = await import('../JanelaRecuperacao')
  const comandos = await import('../../comandos')
  const { useCircuit } = await import('../../state/store')
  const retirar = ui.registrarComandosRecuperacao()
  return { ...ui, ...comandos, useCircuit, invoke, setItem, retirar }
}
it('mostra o aviso do contador na barra da tela', async () => {
  const { retirar } = await ambiente(Number.MAX_SAFE_INTEGER)
  const { default: App } = await import('../App')
  const html = renderToStaticMarkup(createElement(App))
  expect(html).toContain('role="status"')
  expect(html).toContain('O contador de salvamentos atingiu o limite.')
  retirar()
}, 30_000)   // a 1ª importação do App inteiro passa de 5 s com a suíte toda rodando em paralelo
it('pergunta uma vez e apresenta origem, hora, peças e fios numa janela modal', async () => {
  const { JanelaRecuperacao, horaDaCopia, retirar } = await ambiente()
  const html = renderToStaticMarkup(createElement(JanelaRecuperacao))
  expect(html).toContain('role="dialog"')
  expect(html).toContain('aria-modal="true"')
  expect(html).toContain('Encontrei duas versões do seu circuito. Qual quer continuar?')
  expect(html).toContain('Arquivo principal do programa')
  expect(html).toContain('Armazenamento do navegador')
  expect(html).toContain(horaDaCopia(9500))
  expect(html).toContain('1 peça e 0 fios')
  expect(html).toContain('Fechar sem escolher')
  expect((html.match(/id="pergunta-recuperacao"/g) ?? []).length).toBe(1)
  retirar()
})
it('escolha por comando abre a versão indicada e recusa índices e parâmetros inválidos', async () => {
  const { executar, useCircuit, retirar } = await ambiente()
  expect(executar('recuperacao.escolher', { indice: 99 }).ok).toBe(false)
  expect(executar('recuperacao.escolher', { indice: 0, constructor: 'x' }).ok).toBe(false)
  expect(useCircuit.getState().components).toHaveLength(0)
  expect(executar('recuperacao.escolher', { indice: 0 }).ok).toBe(true)
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['novo'])
  retirar()
})
// validação da 2.1.1 publicada (30/10/2026): fechar_sem_gravar faz o programa perguntar "O circuito não pôde ser
// gravado... Fechar assim mesmo?", embora nada se perca ao adiar a escolha. Adiar fecha direto.
it('adiar fecha direto, sem a pergunta de gravação falha, e não escolhe nem grava circuitos', async () => {
  const { executar, useCircuit, invoke, setItem, retirar } = await ambiente()
  expect(executar('recuperacao.adiar').ok).toBe(true)
  await vi.advanceTimersByTimeAsync(6000)
  expect(invoke).toHaveBeenCalledExactlyOnceWith('fechar')
  expect(setItem).not.toHaveBeenCalled()
  expect(useCircuit.getState().recuperacao).toHaveLength(2)
  retirar()
})
it('datas inválidas ou indisponíveis são mostradas sem quebrar a janela', async () => {
  const { horaDaCopia, retirar } = await ambiente()
  expect(horaDaCopia(0)).toBe('Hora não disponível')
  expect(horaDaCopia(Number.MAX_SAFE_INTEGER)).toBe('Hora não disponível')
  retirar()
})
