// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Banco de chaves (DIP_SWITCH, 4 ou 8 posições) e barra de LEDs (LED_BAR, 4 ou 8), desde a 1.0.
// Cada posição do banco vira uma coluna de entrada da tabela-verdade; cada LED da barra, uma de saída.
import { beforeEach, describe, expect, it } from 'vitest'
import { allOutputPins } from '../../engine/pins'
import { simulate } from '../../engine/simulate'
import { circuitTruthTable } from '../../engine/truthTable'
import { inputPins, pinKey } from '../../engine/types'
import { useCircuit } from '../store'

const st = () => useCircuit.getState()

beforeEach(() => {
  useCircuit.setState({ components: [], wires: [], selectedId: null, past: [], future: [] })
})

/** Banco de 4 posições ligado direto numa barra de 4 LEDs. */
function bancoNaBarra() {
  st().addComponent('DIP_SWITCH', 0, 0)
  st().addComponent('LED_BAR', 200, 0)
  const [k, y] = st().components
  for (let i = 0; i < 4; i++) st().connect({ comp: k.id, pin: `out${i}` }, { comp: y.id, pin: `in${i}` })
  return { k: st().components[0], y: st().components[1] }
}

describe('banco de chaves e barra de LEDs', () => {
  it('entram com 4 posições, todas desligadas', () => {
    const { k, y } = bancoNaBarra()
    expect(k).toMatchObject({ bits: 4, estados: [0, 0, 0, 0] })
    expect(allOutputPins(k)).toEqual(['out0', 'out1', 'out2', 'out3'])
    expect(inputPins(y)).toEqual(['in0', 'in1', 'in2', 'in3'])
  })

  it('cada chave do banco liga só a sua posição, e a barra acompanha', () => {
    const { k, y } = bancoNaBarra()
    st().toggleChave(k.id, 2)
    expect(st().components[0].estados).toEqual([0, 0, 1, 0])
    const sim = simulate(st().components, st().wires)
    expect([0, 1, 2, 3].map((i) => sim.pins.get(pinKey(y.id, `in${i}`)))).toEqual([0, 0, 1, 0])
  })

  it('passa para 8 posições e volta para 4, tirando os fios das posições que somem', () => {
    const { k, y } = bancoNaBarra()
    st().setBits(k.id, 8)
    st().setBits(y.id, 8)
    st().connect({ comp: k.id, pin: 'out6' }, { comp: y.id, pin: 'in6' })
    expect(st().components[0].estados).toHaveLength(8)
    st().setBits(k.id, 4)
    expect(st().components[0].estados).toHaveLength(4)
    expect(st().wires.some((w) => w.from.pin === 'out6')).toBe(false)
    expect(st().wires).toHaveLength(4)
  })

  it('na tabela-verdade, cada posição é uma coluna com o nome do banco e o número', () => {
    bancoNaBarra()
    const t = circuitTruthTable(st().components, st().wires)
    expect(t.inputs.map((c) => c.name)).toEqual(['K1', 'K2', 'K3', 'K4'])
    expect(t.outputs.map((c) => c.name)).toEqual(['Y1', 'Y2', 'Y3', 'Y4'])
    expect(t.rows).toHaveLength(16)
    for (const r of t.rows) expect(r.outputs).toEqual(r.inputs)
  })

  it('clicar numa linha da tabela aplica as posições do banco', () => {
    const { k } = bancoNaBarra()
    const t = circuitTruthTable(st().components, st().wires)
    const linha = t.rows[5] // 0101
    st().applyInputs(new Map(t.inputs.map((c, i) => [c.key, linha.inputs[i]])))
    expect(st().components.find((c) => c.id === k.id)?.estados).toEqual([0, 1, 0, 1])
  })

  it('salva e abre; recusa número de posições ou estados malformados', () => {
    bancoNaBarra()
    st().toggleChave(st().components[0].id, 0)
    const json = st().toJSON()
    st().clearAll()
    expect(st().loadJSON(json)).toBeNull()
    expect(st().components[0].estados).toEqual([1, 0, 0, 0])
    const com = (extra: object) =>
      JSON.stringify({ version: 1, components: [{ id: 'k', type: 'DIP_SWITCH', x: 0, y: 0, ...extra }], wires: [] })
    expect(st().loadJSON(com({ bits: 5 }))).toMatch(/inválido/)
    expect(st().loadJSON(com({ bits: 4, estados: [0, 2, 0, 0] }))).toMatch(/inválido/)
    expect(st().loadJSON(com({ bits: 4, estados: [0, 1] }))).toMatch(/inválido/)
  })
})
