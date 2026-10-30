// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  return { ...actual, useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => [initial, vi.fn()] }
})
vi.mock('../../state/store', async (original) => {
  const actual = await original<typeof import('../../state/store')>()
  return { ...actual, useCircuit: Object.assign(
    (selector: (s: ReturnType<typeof actual.useCircuit.getState>) => unknown) => selector(actual.useCircuit.getState()),
    actual.useCircuit) }
})
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn(), alert: vi.fn(), confirm: vi.fn(() => false) })
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const circuito = (id: string) => JSON.stringify({ version: 1, components: [{ id, type: 'LED', x: 0, y: 0 }], wires: [] })
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
const nodes = (node: ReactNode): ReactElement<{ children?: ReactNode; type?: string }>[] =>
  isValidElement<{ children?: ReactNode; type?: string }>(node)
    ? [node, ...Children.toArray(node.props.children).flatMap(nodes)] : []

async function ambiente() {
  const { TopBar } = await import('../TopBar')
  const { useCircuit } = await import('../../state/store')
  const { executar } = await import('../../comandos')
  useCircuit.setState({ components: [], wires: [], past: [], future: [], selectedId: null })
  const elements = nodes(TopBar({ tab: 'ENTRADAS', stepMode: false, onToggleStep: vi.fn() }))
  const node = elements.find(n => n.type === 'input' && n.props.type === 'file')!
  const abrir = elements.find(n => n.type === 'button' &&
    (n.props as { title?: string }).title === 'Abrir um circuito salvo (.json)')!
  const abrirProps = abrir.props as { onClick: () => void }
  const props = node.props as { onChange: (e: { target: { files: File[]; value: string } }) => void }
  const escolher = (texto?: Promise<string>) => props.onChange({ target: { files: texto ?
    [{ name: 'circuito.json', slice: () => ({ text: () => texto }) } as File] : [], value: 'circuito.json' } })
  return { useCircuit, executar, escolher, cancelar: abrirProps.onClick }
}

it('a escolha mais nova vence mesmo quando a leitura antiga termina depois', async () => {
  const { useCircuit, escolher } = await ambiente()
  let old!: (v: string) => void, latest!: (v: string) => void
  escolher(new Promise(r => { old = r }))
  escolher(new Promise(r => { latest = r }))
  latest(circuito('latest-choice')); await settle()
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['latest-choice'])
  old(circuito('stale-choice')); await settle()
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['latest-choice'])
})

it('segunda edição agrupada invalida a leitura mesmo conservando o checkpoint', async () => {
  const { useCircuit, escolher } = await ambiente()
  useCircuit.getState().addComponent('LED', 0, 0)
  const id = useCircuit.getState().components[0].id
  useCircuit.getState().setLabel(id, 'A')
  const { past, future } = useCircuit.getState()
  let fim!: (v: string) => void
  escolher(new Promise(r => { fim = r }))
  await vi.advanceTimersByTimeAsync(100)
  useCircuit.getState().setLabel(id, 'B')
  expect(useCircuit.getState().past).toBe(past)
  expect(useCircuit.getState().future).toBe(future)
  const antes = useCircuit.getState().toJSON()
  fim(circuito('obsoleto')); await settle()
  expect(useCircuit.getState().toJSON()).toBe(antes)
})

it.each(['editar', 'desfazer', 'refazer', 'mover'])('leitura pendente não substitui o resultado de %s', async (acao) => {
  const { useCircuit, escolher } = await ambiente()
  useCircuit.getState().addComponent('LED', 0, 0)
  const id = useCircuit.getState().components[0].id
  useCircuit.getState().girar(id)
  if (acao === 'refazer') useCircuit.getState().undo()
  let fim!: (v: string) => void
  escolher(new Promise(r => { fim = r }))
  if (acao === 'editar') useCircuit.getState().setLabel(id, 'Novo')
  if (acao === 'desfazer') useCircuit.getState().undo()
  if (acao === 'refazer') useCircuit.getState().redo()
  if (acao === 'mover') useCircuit.getState().moveComponent(id, 100, 50)
  const antes = useCircuit.getState().toJSON()
  fim(circuito('obsoleto')); await settle()
  expect(useCircuit.getState().toJSON()).toBe(antes)
})

it('ticks da simulação não invalidam a escolha pendente', async () => {
  const { useCircuit, escolher } = await ambiente()
  useCircuit.getState().loadCircuit([
    { id: 'ck', type: 'CLOCK', x: 0, y: 0, freq: 1, state: 0 },
    { id: 's', type: 'SWITCH', x: 0, y: 0, state: 1 },
    { id: 'f', type: 'FF_D', x: 0, y: 0, q: 0, clkVisto: 0 },
  ], [
    { id: 'w1', from: { comp: 'ck', pin: 'out' }, to: { comp: 'f', pin: 'clk' } },
    { id: 'w2', from: { comp: 's', pin: 'out' }, to: { comp: 'f', pin: 'd' } },
  ])
  expect(useCircuit.getState().components.find(c => c.id === 'f')!.q).toBe(0)
  const antes = useCircuit.getState().components
  let fim!: (v: string) => void
  escolher(new Promise(r => { fim = r }))
  useCircuit.getState().tickClocks(500)
  expect(useCircuit.getState().components).not.toBe(antes)
  expect(useCircuit.getState().components.find(c => c.id === 'f')!.q).toBe(1)
  fim(circuito('escolhido')); await settle()
  expect(useCircuit.getState().components.map(c => c.id)).toEqual(['escolhido'])
})

it.each(['cancelar', 'limpar'])('leitura pendente não reaparece depois de %s', async (acao) => {
  const { useCircuit, executar, escolher, cancelar } = await ambiente()
  let fim!: (v: string) => void
  escolher(new Promise(r => { fim = r }))
  if (acao === 'cancelar') cancelar()
  else executar('circuito.limpar')
  fim(circuito('antigo')); await settle()
  expect(useCircuit.getState().components).toHaveLength(0)
})
