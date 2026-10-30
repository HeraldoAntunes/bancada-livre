// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { beforeEach, expect, it } from 'vitest'
import { executar } from '../comandos'
import { useCircuit } from '../state/store'

beforeEach(() => useCircuit.setState({ components: [], wires: [], past: [], future: [] }))
it.each(['constructor', 'toString', 'hasOwnProperty'])('parâmetro %s não declarado não altera o circuito', (nome) => {
  useCircuit.getState().addComponent('LED', 0, 0)
  const antes = useCircuit.getState().toJSON()
  const past = useCircuit.getState().past
  const resultado = executar('circuito.limpar', { [nome]: 'não suportado' })
  expect({ ok: resultado.ok, components: useCircuit.getState().components.map(c => c.id),
    history_length: useCircuit.getState().past.length }).toEqual({
    ok: false, components: JSON.parse(antes).components.map((c: { id: string }) => c.id), history_length: past.length,
  })
  expect(useCircuit.getState().past).toBe(past)
})
