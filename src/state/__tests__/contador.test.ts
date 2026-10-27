// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Contador automático (COUNTER, desde a 1.0): conta 00, 01, 10, 11... no ritmo da própria frequência,
// com o mesmo Rodar, Pausar e Avançar do CLOCK. Saídas q0 (bit menos significativo) a q3.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { allOutputPins } from '../../engine/pins'
import { simulate } from '../../engine/simulate'
import { circuitTruthTable } from '../../engine/truthTable'
import { pinKey } from '../../engine/types'
import { EXAMPLES } from '../../examples'
import { CounterBody } from '../../ui/symbols'
import { useCircuit } from '../store'

const st = () => useCircuit.getState()
const contador = () => st().components.find((c) => c.type === 'COUNTER')!

beforeEach(() => {
  useCircuit.setState({ components: [], wires: [], selectedId: null, past: [], future: [], clockMs: 0 })
})

describe('contador automático', () => {
  it('entra com 2 bits, 1 Hz, contando de 0; saídas do bit mais alto para o mais baixo', () => {
    st().addComponent('COUNTER', 0, 0)
    expect(contador()).toMatchObject({ bits: 2, freq: 1, contagem: 0 })
    expect(allOutputPins(contador())).toEqual(['q1', 'q0'])
  })

  it('soma 1 a cada período e volta a 0 depois do último valor', () => {
    st().addComponent('COUNTER', 0, 0)
    const vistos: number[] = []
    for (let i = 0; i < 5; i++) {
      vistos.push(contador().contagem ?? 0)
      st().tickClocks(1000)
    }
    expect(vistos).toEqual([0, 1, 2, 3, 0])
  })

  it('as saídas mostram a contagem em binário', () => {
    st().addComponent('COUNTER', 0, 0)
    st().tickClocks(2000) // conta 2 = 10
    const c = contador()
    const sim = simulate(st().components, st().wires)
    expect(sim.pins.get(pinKey(c.id, 'q1'))).toBe(1)
    expect(sim.pins.get(pinKey(c.id, 'q0'))).toBe(0)
  })

  it('segue a própria frequência e anda um passo no Avançar', () => {
    st().addComponent('COUNTER', 0, 0)
    st().setClockFreq(contador().id, 2)
    st().tickClocks(1000)
    expect(contador().contagem).toBe(2)
    st().stepClock()
    expect(contador().contagem).toBe(3)
  })

  it('com 3 bits conta até 7; ao voltar para 2 bits, a contagem cabe e o fio do q2 sai', () => {
    st().addComponent('COUNTER', 0, 0)
    st().addComponent('LED', 100, 0)
    const [c, l] = st().components
    st().setBits(c.id, 3)
    st().connect({ comp: c.id, pin: 'q2' }, { comp: l.id, pin: 'in' })
    st().tickClocks(7000)
    expect(contador().contagem).toBe(7)
    st().setBits(c.id, 2)
    expect(contador().contagem).toBe(3)
    expect(st().wires).toHaveLength(0)
  })

  it('cada bit vira coluna de entrada da tabela-verdade, e as linhas seguem a contagem', () => {
    st().addComponent('COUNTER', 0, 0)
    st().addComponent('LED', 100, 0)
    const [c, l] = st().components
    st().connect({ comp: c.id, pin: 'q1' }, { comp: l.id, pin: 'in' })
    const t = circuitTruthTable(st().components, st().wires)
    expect(t.inputs.map((col) => col.name)).toEqual(['CT1.Q1', 'CT1.Q0'])
    expect(t.rows.map((r) => r.outputs[0])).toEqual([0, 0, 1, 1])
    // aplicar uma linha põe o contador naquela contagem
    st().applyInputs(new Map(t.inputs.map((col, i) => [col.key, t.rows[3].inputs[i]])))
    expect(contador().contagem).toBe(3)
  })

  it('o semáforo do exemplo tem uma luz acesa por contagem', () => {
    const ex = EXAMPLES.find((e) => e.name === 'Semáforo com contador')!
    const t = circuitTruthTable(ex.components, ex.wires)
    expect(t.outputs.map((o) => o.name)).toEqual(['Vermelho', 'Amarelo', 'Verde'])
    expect(t.rows.map((r) => r.outputs)).toEqual([
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
      [1, 0, 0],
    ])
  })

  it('recusa no arquivo bits ou contagem fora da faixa', () => {
    const com = (extra: object) =>
      JSON.stringify({ version: 1, components: [{ id: 'c', type: 'COUNTER', x: 0, y: 0, ...extra }], wires: [] })
    expect(st().loadJSON(com({ bits: 3, contagem: 7 }))).toBeNull()
    expect(st().loadJSON(com({ bits: 8 }))).toMatch(/inválido/)
    expect(st().loadJSON(com({ bits: 2, contagem: 4 }))).toMatch(/inválido/)
    expect(st().loadJSON(com({ contagem: 1.5 }))).toMatch(/inválido/)
  })

  it('o corpo mostra a contagem em binário', () => {
    const svg = renderToStaticMarkup(createElement('svg', null, createElement(CounterBody, { bits: 3, contagem: 5 })))
    expect(svg).toContain('>101<')
  })
})
