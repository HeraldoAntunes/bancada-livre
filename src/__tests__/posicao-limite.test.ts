// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Revisão independente da 2.1.2 (Codex, Ordem 23, achado médio): componente.adicionar com x 1000001 dava sucesso, mas o
// circuito salvo era recusado inteiro ao reabrir ("componente malformado"). Os comandos agora recusam a posição fora do
// limite do importador, e a bancada nunca guarda uma posição que ela mesma não reabre.
import { beforeEach, expect, it } from 'vitest'
import { executar } from '../comandos'
import { LIMITE_POSICAO, useCircuit } from '../state/store'

const st = () => useCircuit.getState()
/** Abre de novo o que a bancada salvaria: null quando o importador aceita. */
const reabre = () => st().loadJSON(st().toJSON())

beforeEach(() => {
  useCircuit.setState({ components: [], wires: [], selectedId: null, past: [], future: [], recuperacao: null })
})

it('componente.adicionar fora do limite falha e não acrescenta nada', () => {
  const r = executar('componente.adicionar', { tipo: 'SWITCH', x: LIMITE_POSICAO + 1, y: 100 })
  expect(r.ok).toBe(false)
  expect(st().components).toHaveLength(0)
  expect(reabre()).toBeNull()
})

it('componente.adicionar no limite exato dá certo e o circuito reabre', () => {
  const r = executar('componente.adicionar', { tipo: 'SWITCH', x: LIMITE_POSICAO, y: -LIMITE_POSICAO })
  expect(r.ok).toBe(true)
  expect(reabre()).toBeNull()
})

it('componente.mover fora do limite falha e deixa a peça onde estava', () => {
  const r = executar('componente.adicionar', { tipo: 'LED', x: 10, y: 20 })
  const id = (r.ok ? r.resultado : {} as { id: string }) as { id: string }
  const m = executar('componente.mover', { id: id.id, x: 0, y: -(LIMITE_POSICAO + 1) })
  expect(m.ok).toBe(false)
  expect(st().components[0]).toMatchObject({ x: 10, y: 20 })
  expect(reabre()).toBeNull()
})

it('arrastar até longe demais para no limite, e o circuito reabre', () => {
  st().addComponent('LED', 5_000_000, 0)
  const c = st().components[0]
  st().moveComponent(c.id, -9_000_000, 3_000_000)
  expect(st().components[0]).toMatchObject({ x: -LIMITE_POSICAO, y: LIMITE_POSICAO })
  expect(reabre()).toBeNull()
})
