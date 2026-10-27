// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { propagationLevels, stepFilteredSim } from '../propagation'
import { simulate } from '../simulate'
import { pinKey, type CircuitComponent, type Wire } from '../types'

const comp = (
  id: string,
  type: CircuitComponent['type'],
  extra: Partial<CircuitComponent> = {},
): CircuitComponent => ({ id, type, x: 0, y: 0, ...extra })

const wire = (id: string, from: string, fromPin: string, to: string, toPin: string): Wire => ({
  id,
  from: { comp: from, pin: fromPin },
  to: { comp: to, pin: toPin },
})

// meio-somador: A,B → XOR→S / AND→Cout
const comps = [
  comp('a', 'SWITCH', { state: 1 }),
  comp('b', 'SWITCH', { state: 1 }),
  comp('x', 'XOR'),
  comp('g', 'AND'),
  comp('s', 'LED'),
  comp('c', 'LED'),
]
const ws = [
  wire('w1', 'a', 'out', 'x', 'in0'),
  wire('w2', 'b', 'out', 'x', 'in1'),
  wire('w3', 'a', 'out', 'g', 'in0'),
  wire('w4', 'b', 'out', 'g', 'in1'),
  wire('w5', 'x', 'out', 's', 'in'),
  wire('w6', 'g', 'out', 'c', 'in'),
]

describe('propagationLevels (RF-05.5)', () => {
  it('fontes = 0, portas = 1, saídas = 2', () => {
    const { levels, maxLevel } = propagationLevels(comps, ws)
    expect(levels.get('a')).toBe(0)
    expect(levels.get('b')).toBe(0)
    expect(levels.get('x')).toBe(1)
    expect(levels.get('g')).toBe(1)
    expect(levels.get('s')).toBe(2)
    expect(levels.get('c')).toBe(2)
    expect(maxLevel).toBe(2)
  })

  it('cascata soma níveis; porta solta fica no nível 1', () => {
    const cs = [comp('a', 'SWITCH'), comp('n1', 'NOT'), comp('n2', 'NOT'), comp('solo', 'AND')]
    const w2 = [wire('w1', 'a', 'out', 'n1', 'in0'), wire('w2', 'n1', 'out', 'n2', 'in0')]
    const { levels, maxLevel } = propagationLevels(cs, w2)
    expect(levels.get('n1')).toBe(1)
    expect(levels.get('n2')).toBe(2)
    expect(levels.get('solo')).toBe(1)
    expect(maxLevel).toBe(2)
  })

  it('laço combinacional → nível infinito, fora do maxLevel', () => {
    const cs = [comp('n', 'NOT'), comp('a', 'SWITCH')]
    const w2 = [wire('w1', 'n', 'out', 'n', 'in0')]
    const { levels, maxLevel } = propagationLevels(cs, w2)
    expect(levels.get('n')).toBe(Number.POSITIVE_INFINITY)
    expect(maxLevel).toBe(0)
  })
})

describe('stepFilteredSim', () => {
  it('passo 0: fontes visíveis, resto indefinido; passo 2: tudo visível', () => {
    const sim = simulate(comps, ws)
    const { levels } = propagationLevels(comps, ws)

    const s0 = stepFilteredSim(sim, comps, ws, levels, 0)
    expect(s0.pins.get(pinKey('a', 'out'))).toBe(1)
    expect(s0.pins.get(pinKey('x', 'out'))).toBe('X')
    expect(s0.pins.get(pinKey('s', 'in'))).toBe('X')
    expect(s0.wires.get('w1')).toBe(1) // fio saindo da fonte já mostra o valor
    expect(s0.wires.get('w5')).toBe('X') // fio saindo da porta ainda não

    const s1 = stepFilteredSim(sim, comps, ws, levels, 1)
    expect(s1.pins.get(pinKey('x', 'out'))).toBe(0) // XOR(1,1)=0 visível no passo 1
    expect(s1.pins.get(pinKey('s', 'in'))).toBe('X') // LED só no passo 2

    const s2 = stepFilteredSim(sim, comps, ws, levels, 2)
    expect(s2.pins.get(pinKey('s', 'in'))).toBe(0)
    expect(s2.pins.get(pinKey('c', 'in'))).toBe(1)
    expect(s2.wires.get('w6')).toBe(1)
  })

  it('não altera o SimResult original', () => {
    const sim = simulate(comps, ws)
    const { levels } = propagationLevels(comps, ws)
    stepFilteredSim(sim, comps, ws, levels, 0)
    expect(sim.pins.get(pinKey('s', 'in'))).toBe(0)
    expect(sim.wires.get('w5')).toBe(0)
  })
})
