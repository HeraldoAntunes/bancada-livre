// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { evalGate } from '../gates'
import type { GateType, Signal } from '../types'

type Case = [Signal[], Signal]

const cases: Record<GateType, Case[]> = {
  BUFFER: [
    [[0], 0],
    [[1], 1],
    [['X'], 'X'],
    [['E'], 'E'],
  ],
  NOT: [
    [[0], 1],
    [[1], 0],
    [['X'], 'X'],
    [['E'], 'E'],
  ],
  AND: [
    [[0, 0], 0],
    [[0, 1], 0],
    [[1, 0], 0],
    [[1, 1], 1],
    // 0 dominante vence o X; X só quando indeterminado
    [[0, 'X'], 0],
    [[1, 'X'], 'X'],
    [['X', 'X'], 'X'],
    [['E', 1], 'E'],
    [[1, 1, 1], 1],
    [[1, 1, 0], 0],
  ],
  OR: [
    [[0, 0], 0],
    [[0, 1], 1],
    [[1, 0], 1],
    [[1, 1], 1],
    [[1, 'X'], 1],
    [[0, 'X'], 'X'],
    [['E', 0], 'E'],
    [[0, 0, 1], 1],
  ],
  NAND: [
    [[0, 0], 1],
    [[0, 1], 1],
    [[1, 0], 1],
    [[1, 1], 0],
    [[0, 'X'], 1],
    [[1, 'X'], 'X'],
  ],
  NOR: [
    [[0, 0], 1],
    [[0, 1], 0],
    [[1, 0], 0],
    [[1, 1], 0],
    [[1, 'X'], 0],
    [[0, 'X'], 'X'],
  ],
  XOR: [
    [[0, 0], 0],
    [[0, 1], 1],
    [[1, 0], 1],
    [[1, 1], 0],
    // XOR nunca é determinado com X presente
    [[1, 'X'], 'X'],
    [[0, 'X'], 'X'],
    [[1, 1, 1], 1],
    [[1, 1, 0], 0],
  ],
  XNOR: [
    [[0, 0], 1],
    [[0, 1], 0],
    [[1, 0], 0],
    [[1, 1], 1],
    [['X', 1], 'X'],
  ],
}

describe('evalGate — semântica ternária (spec §3.2)', () => {
  for (const [gate, list] of Object.entries(cases) as [GateType, Case[]][]) {
    describe(gate, () => {
      for (const [ins, expected] of list) {
        it(`${gate}(${ins.join(', ')}) = ${expected}`, () => {
          expect(evalGate(gate, ins)).toBe(expected)
        })
      }
    })
  }
})
