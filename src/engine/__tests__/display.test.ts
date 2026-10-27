// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { decodeDisplay, DIGIT_SEGMENTS } from '../display'
import { simulate } from '../simulate'
import { circuitTruthTable } from '../truthTable'
import { pinKey, type CircuitComponent, type Signal, type Wire } from '../types'

const seg = (s: string) => [...s].map((c) => c === '1')

describe('decodeDisplay — modo BCD/hex (pesos 8-4-2-1)', () => {
  it('decodifica 0, 5 e 9', () => {
    expect(decodeDisplay('bcd', [0, 0, 0, 0])).toMatchObject({ value: 0, segments: seg('1111110') })
    expect(decodeDisplay('bcd', [0, 1, 0, 1])).toMatchObject({ value: 5, segments: seg('1011011') })
    expect(decodeDisplay('bcd', [1, 0, 0, 1])).toMatchObject({ value: 9, segments: seg('1111011') })
  })

  it('in0 é o MSB (peso 8)', () => {
    expect(decodeDisplay('bcd', [1, 0, 0, 0]).value).toBe(8)
    expect(decodeDisplay('bcd', [0, 0, 0, 1]).value).toBe(1)
  })

  it('BCD inválido (10–15) apaga o display; hex mostra A–F', () => {
    const bcd = decodeDisplay('bcd', [1, 0, 1, 0]) // 10
    expect(bcd.value).toBeNull()
    expect(bcd.segments.every((s) => !s)).toBe(true)

    const hex = decodeDisplay('hex', [1, 0, 1, 0]) // A
    expect(hex.value).toBe(10)
    expect(hex.segments).toEqual(seg('1110111'))
    expect(decodeDisplay('hex', [1, 1, 1, 1]).value).toBe(15)
  })

  it('entrada flutuante (X) apaga; erro (E) marca error', () => {
    const x = decodeDisplay('bcd', [0, 'X', 0, 1])
    expect(x.floating).toBe(true)
    expect(x.value).toBeNull()
    expect(x.segments.every((s) => !s)).toBe(true)

    const e = decodeDisplay('hex', ['E', 0, 0, 0])
    expect(e.error).toBe(true)
    expect(e.value).toBeNull()
  })
})

describe('decodeDisplay — modo raw (a–g direto)', () => {
  it('cada pino aciona seu segmento; X/E não acendem', () => {
    const ins: Signal[] = [1, 0, 1, 'X', 0, 'E', 1]
    const d = decodeDisplay('raw', ins)
    expect(d.segments).toEqual([true, false, true, false, false, false, true])
    expect(d.value).toBeNull()
    expect(d.floating).toBe(true)
    expect(d.error).toBe(true)
  })
})

describe('DIGIT_SEGMENTS', () => {
  it('cobre 0–15 com 7 segmentos cada', () => {
    expect(DIGIT_SEGMENTS).toHaveLength(16)
    for (const s of DIGIT_SEGMENTS) expect(s).toMatch(/^[01]{7}$/)
  })
})

describe('DISPLAY no circuito (UC-04)', () => {
  const comp = (
    id: string,
    type: CircuitComponent['type'],
    extra: Partial<CircuitComponent> = {},
  ): CircuitComponent => ({ id, type, x: 0, y: 0, ...extra })

  const wire = (id: string, from: string, to: string, toPin: string): Wire => ({
    id,
    from: { comp: from, pin: 'out' },
    to: { comp: to, pin: toPin },
  })

  const comps = [
    comp('s8', 'SWITCH', { state: 0, label: 'D8' }),
    comp('s4', 'SWITCH', { state: 1, label: 'D4' }),
    comp('s2', 'SWITCH', { state: 0, label: 'D2' }),
    comp('s1', 'SWITCH', { state: 1, label: 'D1' }),
    comp('d', 'DISPLAY', { mode: 'bcd', label: 'D1' }),
  ]
  const ws = [
    wire('w1', 's8', 'd', 'in0'),
    wire('w2', 's4', 'd', 'in1'),
    wire('w3', 's2', 'd', 'in2'),
    wire('w4', 's1', 'd', 'in3'),
  ]

  it('simulate registra os 4 pinos do display', () => {
    const r = simulate(comps, ws)
    expect(r.pins.get(pinKey('d', 'in0'))).toBe(0)
    expect(r.pins.get(pinKey('d', 'in1'))).toBe(1)
    expect(r.pins.get(pinKey('d', 'in2'))).toBe(0)
    expect(r.pins.get(pinKey('d', 'in3'))).toBe(1)
  })

  it('tabela-verdade do circuito traz a coluna do dígito', () => {
    const t = circuitTruthTable(comps, ws)
    expect(t.outputs.map((o) => o.comp.id)).toEqual(['d'])
    expect(t.rows[0].outputs).toEqual(['0'])   // 0000 → 0
    expect(t.rows[5].outputs).toEqual(['5'])   // 0101 → 5
    expect(t.rows[9].outputs).toEqual(['9'])   // 1001 → 9
    expect(t.rows[10].outputs).toEqual(['—'])  // 1010 → BCD inválido, apagado
  })
})
