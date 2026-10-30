// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { beforeEach, expect, it } from 'vitest'
import { useCircuit } from '../store'

const componente = (id: string, type = 'LED', x = 0) => ({ id, type, x, y: 0 })
beforeEach(() => useCircuit.setState({ components: [], wires: [], past: [], future: [], selectedId: null }))

it.each([
  { components: [componente('shared', 'LABEL'), componente('a', 'SWITCH'), componente('b')],
    wires: [{ id: 'shared', from: { comp: 'a', pin: 'out' }, to: { comp: 'b', pin: 'in' } }] },
  { components: [componente('entrada:α', 'SWITCH'), componente('led-β')], wires: [] },
  { components: [componente('a', 'SWITCH'), componente('b')],
    wires: [{ id: 'fio:1', from: { comp: 'a', pin: 'out' }, to: { comp: 'b', pin: 'in' } }] },
  { components: [componente('left', 'LED', -Number.MAX_VALUE), componente('right', 'LED', Number.MAX_VALUE)], wires: [] },
])('importação inválida preserva circuito e histórico: %j', (circuito) => {
  useCircuit.getState().addComponent('LED', 10, 10)
  const antes = useCircuit.getState().toJSON()
  const past = useCircuit.getState().past
  const future = useCircuit.getState().future
  expect(useCircuit.getState().loadJSON(JSON.stringify({ version: 1, ...circuito }))).not.toBeNull()
  expect(useCircuit.getState().toJSON()).toBe(antes)
  expect(useCircuit.getState().past).toBe(past)
  expect(useCircuit.getState().future).toBe(future)
})
