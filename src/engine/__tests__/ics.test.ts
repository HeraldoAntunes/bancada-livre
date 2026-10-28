// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { DIGIT_SEGMENTS } from '../display'
import { CHIP_IDS, CHIPS, icPowered } from '../ics'
import { simulate } from '../simulate'
import { propagationLevels } from '../propagation'
import { pinKey, type CircuitComponent, type Signal, type Wire } from '../types'

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

/** Alimentação padrão: hi→VCC, lo→GND. */
function powerWires(ic: string, chipId: keyof typeof CHIPS): Wire[] {
  const def = CHIPS[chipId]
  return [
    wire('wp1', 'hi', 'out', ic, `p${def.vcc}`),
    wire('wp2', 'lo', 'out', ic, `p${def.gnd}`),
  ]
}

describe('definições dos chips', () => {
  it('14 chips; pinos sem sobreposição e todos com papel definido', () => {
    expect(CHIP_IDS).toHaveLength(14)
    for (const id of CHIP_IDS) {
      const def = CHIPS[id]
      const used = [
        def.vcc,
        def.gnd,
        ...def.gates.flatMap((g) => [...g.inputs, g.output]),
        ...(def.func ? [...def.func.inputs, ...def.func.outputs] : []),
        ...(def.seq ? [...def.seq.sincronas, ...def.seq.assincronas, ...def.seq.saidas] : []),
      ]
      expect(new Set(used).size).toBe(def.pins) // cada pino com exatamente um papel
      for (const n of used) expect(n).toBeGreaterThanOrEqual(1)
      for (const n of used) expect(n).toBeLessThanOrEqual(def.pins)
      expect(Object.keys(def.pinLabels)).toHaveLength(def.pins)
    }
  })

  it('7404 tem 6 inversores; quádruplas têm 4 portas de 2 entradas; 7448 e os de 3 dígitos são blocos de função', () => {
    expect(CHIPS['7404'].gates).toHaveLength(6)
    expect(CHIPS['7448'].gates).toHaveLength(0)
    expect(CHIPS['7448'].func).toBeDefined()
    expect(CHIPS['7448'].pins).toBe(16)
    for (const id of ['74138', '74151', '74283'] as const) expect(CHIPS[id].func).toBeDefined()
    for (const id of ['7474', '7476', '74161', '74164'] as const) expect(CHIPS[id].seq).toBeDefined()
    for (const id of CHIP_IDS.filter((c) => c !== '7404' && !CHIPS[c].func && !CHIPS[c].seq)) {
      expect(CHIPS[id].gates).toHaveLength(4)
      for (const g of CHIPS[id].gates) expect(g.inputs).toHaveLength(2)
    }
  })

  it('pinagem do 7402 é invertida (Y antes de A/B)', () => {
    expect(CHIPS['7402'].gates[0]).toEqual({ type: 'NOR', inputs: [2, 3], output: 1 })
    expect(CHIPS['7402'].pinLabels[1]).toBe('1Y')
  })
})

describe('simulação de CIs', () => {
  const base = [
    comp('hi', 'LEVEL_HIGH'),
    comp('lo', 'LEVEL_LOW'),
    comp('a', 'SWITCH', { state: 1 }),
    comp('b', 'SWITCH', { state: 1 }),
    comp('ic', 'IC', { chip: '7408' }),
  ]

  it('7408 alimentado: porta 1 (pinos 1,2→3) faz AND', () => {
    const ws = [
      ...powerWires('ic', '7408'),
      wire('w1', 'a', 'out', 'ic', 'p1'),
      wire('w2', 'b', 'out', 'ic', 'p2'),
    ]
    const r = simulate(base, ws)
    expect(icPowered(base[4], r.pins)).toBe(true)
    expect(r.pins.get(pinKey('ic', 'p3'))).toBe(1)

    // porta não usada fica indefinida, como no chip real
    expect(r.pins.get(pinKey('ic', 'p6'))).toBe('X')
  })

  it('sem alimentação: saídas X mesmo com entradas válidas', () => {
    const ws = [wire('w1', 'a', 'out', 'ic', 'p1'), wire('w2', 'b', 'out', 'ic', 'p2')]
    const r = simulate(base, ws)
    expect(icPowered(base[4], r.pins)).toBe(false)
    expect(r.pins.get(pinKey('ic', 'p3'))).toBe('X')
  })

  it('GND ligado em nível 1 também é "sem alimentação"', () => {
    const def = CHIPS['7408']
    const ws = [
      wire('wp1', 'hi', 'out', 'ic', `p${def.vcc}`),
      wire('wp2', 'hi', 'out', 'ic', `p${def.gnd}`), // erro clássico
      wire('w1', 'a', 'out', 'ic', 'p1'),
      wire('w2', 'b', 'out', 'ic', 'p2'),
    ]
    const r = simulate(base, ws)
    expect(r.pins.get(pinKey('ic', 'p3'))).toBe('X')
  })

  it('7402: NOR nos pinos certos (2,3→1)', () => {
    const comps = [
      comp('hi', 'LEVEL_HIGH'),
      comp('lo', 'LEVEL_LOW'),
      comp('a', 'SWITCH', { state: 0 }),
      comp('b', 'SWITCH', { state: 0 }),
      comp('ic', 'IC', { chip: '7402' }),
    ]
    const ws = [
      ...powerWires('ic', '7402'),
      wire('w1', 'a', 'out', 'ic', 'p2'),
      wire('w2', 'b', 'out', 'ic', 'p3'),
    ]
    expect(simulate(comps, ws).pins.get(pinKey('ic', 'p1'))).toBe(1) // NOR(0,0)=1
  })

  it('encadear portas do MESMO chip não gera falso laço', () => {
    // ¬A na porta 1 → entrada da porta 3 (NAND(¬A,¬A) = A)
    const comps = [
      comp('hi', 'LEVEL_HIGH'),
      comp('lo', 'LEVEL_LOW'),
      comp('a', 'SWITCH', { state: 1 }),
      comp('ic', 'IC', { chip: '7400' }),
    ]
    const ws = [
      ...powerWires('ic', '7400'),
      wire('w1', 'a', 'out', 'ic', 'p1'),
      wire('w2', 'a', 'out', 'ic', 'p2'),
      wire('w3', 'ic', 'p3', 'ic', 'p9'),
      wire('w4', 'ic', 'p3', 'ic', 'p10'),
    ]
    const r = simulate(comps, ws)
    expect(r.cycleComps.size).toBe(0)
    expect(r.pins.get(pinKey('ic', 'p3'))).toBe(0) // ¬1
    expect(r.pins.get(pinKey('ic', 'p8'))).toBe(1) // ¬¬1

    const { levels } = propagationLevels(comps, ws)
    expect(Number.isFinite(levels.get('ic'))).toBe(true)
  })

  it('7448: decodifica BCD nos pinos reais (A=7 B=1 C=2 D=6 → a..g)', () => {
    const comps = [
      comp('hi', 'LEVEL_HIGH'),
      comp('lo', 'LEVEL_LOW'),
      comp('d8', 'SWITCH', { state: 0 }),
      comp('d4', 'SWITCH', { state: 1 }),
      comp('d2', 'SWITCH', { state: 0 }),
      comp('d1', 'SWITCH', { state: 1 }),
      comp('ic', 'IC', { chip: '7448' }),
    ]
    const ws = [
      wire('wp1', 'hi', 'out', 'ic', 'p16'),
      wire('wp2', 'lo', 'out', 'ic', 'p8'),
      wire('w1', 'd8', 'out', 'ic', 'p6'), // D
      wire('w2', 'd4', 'out', 'ic', 'p2'), // C
      wire('w3', 'd2', 'out', 'ic', 'p1'), // B
      wire('w4', 'd1', 'out', 'ic', 'p7'), // A
    ]
    const r = simulate(comps, ws)
    // 0101 = 5 → segmentos a,f,g,c,d (padrão '1011011' na ordem a..g)
    const segPins = [13, 12, 11, 10, 9, 15, 14]
    const got = segPins.map((n) => r.pins.get(pinKey('ic', `p${n}`)))
    expect(got.join('')).toBe(
      [...DIGIT_SEGMENTS[5]].map((ch) => ch).join(''),
    )
  })

  it('7448: LT/RBI/BI desconectados flutuam em 1 (operação normal); LT=0 acende tudo; BI=0 apaga', () => {
    const mk = (extra: Wire[]) => {
      const comps = [
        comp('hi', 'LEVEL_HIGH'),
        comp('lo', 'LEVEL_LOW'),
        comp('ic', 'IC', { chip: '7448' }),
      ]
      const ws = [
        wire('wp1', 'hi', 'out', 'ic', 'p16'),
        wire('wp2', 'lo', 'out', 'ic', 'p8'),
        // ABCD todos em 0 → dígito 0
        wire('w1', 'lo', 'out', 'ic', 'p7'),
        wire('w2', 'lo', 'out', 'ic', 'p1'),
        wire('w3', 'lo', 'out', 'ic', 'p2'),
        wire('w4', 'lo', 'out', 'ic', 'p6'),
        ...extra,
      ]
      return simulate(comps, ws)
    }
    const segPins = [13, 12, 11, 10, 9, 15, 14]
    const segs = (r: ReturnType<typeof simulate>): Signal[] =>
      segPins.map((n) => r.pins.get(pinKey('ic', `p${n}`))!)

    // controles soltos: mostra o 0 normalmente
    expect(segs(mk([])).join('')).toBe(DIGIT_SEGMENTS[0])
    // LT=0: teste de lâmpada, tudo aceso
    expect(segs(mk([wire('wl', 'lo', 'out', 'ic', 'p3')])).every((s) => s === 1)).toBe(true)
    // BI=0: tudo apagado
    expect(segs(mk([wire('wb', 'lo', 'out', 'ic', 'p4')])).every((s) => s === 0)).toBe(true)
    // RBI=0 com valor 0: apaga o zero
    expect(segs(mk([wire('wr', 'lo', 'out', 'ic', 'p5')])).every((s) => s === 0)).toBe(true)
  })

  it('7448 sem alimentação: saídas X', () => {
    const comps = [comp('lo', 'LEVEL_LOW'), comp('ic', 'IC', { chip: '7448' })]
    const ws = [wire('w1', 'lo', 'out', 'ic', 'p7')]
    const r = simulate(comps, ws)
    expect(r.pins.get(pinKey('ic', 'p13'))).toBe('X')
  })

  it('realimentação verdadeira dentro do chip ainda é laço', () => {
    const comps = [comp('hi', 'LEVEL_HIGH'), comp('lo', 'LEVEL_LOW'), comp('ic', 'IC', { chip: '7400' })]
    const ws = [
      ...powerWires('ic', '7400'),
      wire('w1', 'ic', 'p3', 'ic', 'p1'), // porta 1 realimentada nela mesma
    ]
    const r = simulate(comps, ws)
    expect(r.cycleComps.has('ic')).toBe(true)
    expect(r.pins.get(pinKey('ic', 'p3'))).toBe('E')
  })
})
