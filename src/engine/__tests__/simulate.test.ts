// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { simulate } from '../simulate'
import { circuitTruthTable } from '../truthTable'
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

describe('simulate — propagação combinacional', () => {
  it('SWITCH → NOT → LED inverte o sinal', () => {
    const comps = [comp('s', 'SWITCH', { state: 1 }), comp('n', 'NOT'), comp('l', 'LED')]
    const ws = [wire('w1', 's', 'out', 'n', 'in0'), wire('w2', 'n', 'out', 'l', 'in')]
    const r = simulate(comps, ws)
    expect(r.pins.get(pinKey('l', 'in'))).toBe(0)

    comps[0].state = 0
    expect(simulate(comps, ws).pins.get(pinKey('l', 'in'))).toBe(1)
  })

  it('fan-out: uma saída alimenta duas entradas', () => {
    const comps = [
      comp('s', 'SWITCH', { state: 1 }),
      comp('l1', 'LED'),
      comp('l2', 'LED'),
    ]
    const ws = [wire('w1', 's', 'out', 'l1', 'in'), wire('w2', 's', 'out', 'l2', 'in')]
    const r = simulate(comps, ws)
    expect(r.pins.get(pinKey('l1', 'in'))).toBe(1)
    expect(r.pins.get(pinKey('l2', 'in'))).toBe(1)
  })

  it('entrada não conectada é X; AND com 0 conhecido ainda decide', () => {
    const comps = [comp('s', 'SWITCH', { state: 0 }), comp('g', 'AND'), comp('l', 'LED')]
    const ws = [wire('w1', 's', 'out', 'g', 'in0'), wire('w2', 'g', 'out', 'l', 'in')]
    // in1 do AND fica flutuando (X), mas in0=0 determina saída 0
    const r = simulate(comps, ws)
    expect(r.pins.get(pinKey('g', 'in1'))).toBe('X')
    expect(r.pins.get(pinKey('l', 'in'))).toBe(0)
  })

  it('LEVEL_HIGH e LEVEL_LOW são constantes', () => {
    const comps = [comp('h', 'LEVEL_HIGH'), comp('lo', 'LEVEL_LOW'), comp('g', 'OR'), comp('l', 'LED')]
    const ws = [
      wire('w1', 'h', 'out', 'g', 'in0'),
      wire('w2', 'lo', 'out', 'g', 'in1'),
      wire('w3', 'g', 'out', 'l', 'in'),
    ]
    expect(simulate(comps, ws).pins.get(pinKey('l', 'in'))).toBe(1)
  })

  it('conflito: dois drivers na mesma entrada → E', () => {
    const comps = [
      comp('a', 'SWITCH', { state: 1 }),
      comp('b', 'SWITCH', { state: 0 }),
      comp('l', 'LED'),
    ]
    const ws = [wire('w1', 'a', 'out', 'l', 'in'), wire('w2', 'b', 'out', 'l', 'in')]
    const r = simulate(comps, ws)
    expect(r.pins.get(pinKey('l', 'in'))).toBe('E')
    expect(r.conflictPins.has(pinKey('l', 'in'))).toBe(true)
    expect(r.wires.get('w1')).toBe('E')
    expect(r.wires.get('w2')).toBe('E')
  })

  it('conflito é detectado mesmo quando o pino alvo está em laço', () => {
    // a e b dirigem n.in0, que também é realimentado pelo próprio NOT
    const comps = [
      comp('a', 'SWITCH', { state: 1 }),
      comp('b', 'SWITCH', { state: 0 }),
      comp('n', 'NOT'),
    ]
    const ws = [
      wire('w1', 'a', 'out', 'n', 'in0'),
      wire('w2', 'b', 'out', 'n', 'in0'),
      wire('w3', 'n', 'out', 'n', 'in0'),
    ]
    const r = simulate(comps, ws)
    expect(r.conflictPins.has(pinKey('n', 'in0'))).toBe(true)
    expect(r.wires.get('w1')).toBe('E')
    expect(r.wires.get('w2')).toBe('E')
    expect(r.wires.get('w3')).toBe('E')
  })

  it('laço combinacional → E sem travar', () => {
    // NOT realimentado nele mesmo
    const comps = [comp('n', 'NOT'), comp('l', 'LED')]
    const ws = [wire('w1', 'n', 'out', 'n', 'in0'), wire('w2', 'n', 'out', 'l', 'in')]
    const r = simulate(comps, ws)
    expect(r.cycleComps.has('n')).toBe(true)
    expect(r.pins.get(pinKey('n', 'out'))).toBe('E')
    expect(r.wires.get('w2')).toBe('E')
  })
})

describe('circuitTruthTable — meio-somador (UC-03)', () => {
  it('gera as 4 linhas corretas de soma e vai-um', () => {
    const comps = [
      comp('a', 'SWITCH', { state: 0, label: 'A' }),
      comp('b', 'SWITCH', { state: 0, label: 'B' }),
      comp('x', 'XOR'),
      comp('g', 'AND'),
      comp('s', 'LED', { label: 'S' }),
      comp('c', 'LED', { label: 'Cout' }),
    ]
    const ws = [
      wire('w1', 'a', 'out', 'x', 'in0'),
      wire('w2', 'a', 'out', 'g', 'in0'),
      wire('w3', 'b', 'out', 'x', 'in1'),
      wire('w4', 'b', 'out', 'g', 'in1'),
      wire('w5', 'x', 'out', 's', 'in'),
      wire('w6', 'g', 'out', 'c', 'in'),
    ]
    const t = circuitTruthTable(comps, ws)
    expect(t.tooBig).toBe(false)
    expect(t.rows).toEqual([
      { inputs: [0, 0], outputs: [0, 0] },
      { inputs: [0, 1], outputs: [1, 0] },
      { inputs: [1, 0], outputs: [1, 0] },
      { inputs: [1, 1], outputs: [0, 1] },
    ])
    // a geração não pode mutar o estado real do circuito
    expect(comps[0].state).toBe(0)
    expect(comps[1].state).toBe(0)
  })

  it('respeita o limite de entradas (tooBig)', () => {
    const comps = [
      comp('a', 'SWITCH'),
      comp('b', 'SWITCH'),
      comp('c', 'SWITCH'),
      comp('l', 'LED'),
    ]
    const t = circuitTruthTable(comps, [], 2)
    expect(t.tooBig).toBe(true)
    expect(t.rows).toHaveLength(0)
  })
})
