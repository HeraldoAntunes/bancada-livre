// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Frases do passo a passo: o que acontece em cada nível da onda de propagação.
import { describe, expect, it } from 'vitest'
import { propagationLevels } from '../../engine/propagation'
import type { CircuitComponent, Wire } from '../../engine/types'
import { descreverNivel } from '../passos'

// chave A e chave B → AND U1 → LED S
const comps = [
  { id: 'a', type: 'SWITCH', x: 0, y: 0, label: 'A' },
  { id: 'b', type: 'SWITCH', x: 0, y: 80, label: 'B' },
  { id: 'g', type: 'AND', x: 120, y: 40, inputs: 2, label: 'U1' },
  { id: 'l', type: 'LED', x: 260, y: 40, label: 'S' },
] as CircuitComponent[]
const wires = [
  { id: 'w1', from: { comp: 'a', pin: 'out' }, to: { comp: 'g', pin: 'in0' } },
  { id: 'w2', from: { comp: 'b', pin: 'out' }, to: { comp: 'g', pin: 'in1' } },
  { id: 'w3', from: { comp: 'g', pin: 'out' }, to: { comp: 'l', pin: 'in' } },
] as Wire[]
const { levels, maxLevel } = propagationLevels(comps, wires)

describe('frases do passo a passo', () => {
  it('nível 0: as entradas', () => {
    expect(descreverNivel(comps, levels, 0, maxLevel)).toMatch(/entradas.*A.*B/)
  })

  it('nível do meio: quem calcula a saída', () => {
    expect(descreverNivel(comps, levels, 1, maxLevel)).toMatch(/AND U1/)
  })

  it('último nível: onde o resultado aparece', () => {
    expect(descreverNivel(comps, levels, maxLevel, maxLevel)).toMatch(/resultado.*LED S/)
  })

  it('não usa travessão', () => {
    for (let n = 0; n <= maxLevel; n++) expect(descreverNivel(comps, levels, n, maxLevel)).not.toMatch(/[—–]/)
  })
})
