// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// CIs de função novos (desde a 1.0): 74138 (decodificador 3 → 8), 74151 (multiplexador 8 → 1) e
// 74283 (somador de 4 bits). Pinagem conferida nos datasheets da Texas Instruments (SDLS014, SDLS054,
// SDLS095A, vista superior do encapsulamento N).
import { describe, expect, it } from 'vitest'
import { CHIPS, type ChipId } from '../ics'
import type { Signal } from '../types'

/** Rótulo de cada pino, 1 a 16, como no desenho do datasheet. */
const PINAGEM: Record<string, string[]> = {
  '74138': ['A', 'B', 'C', 'G2A', 'G2B', 'G1', 'Y7', 'GND', 'Y6', 'Y5', 'Y4', 'Y3', 'Y2', 'Y1', 'Y0', 'VCC'],
  '74151': ['D3', 'D2', 'D1', 'D0', 'Y', 'W', 'G', 'GND', 'C', 'B', 'A', 'D7', 'D6', 'D5', 'D4', 'VCC'],
  '74283': ['Σ2', 'B2', 'A2', 'Σ1', 'A1', 'B1', 'C0', 'GND', 'C4', 'Σ4', 'B4', 'A4', 'Σ3', 'A3', 'B3', 'VCC'],
}

/** Avalia o chip pelos NOMES dos pinos: entradas por rótulo, saídas devolvidas por rótulo. */
function avaliar(chip: ChipId, entradas: Record<string, Signal>): Record<string, Signal> {
  const def = CHIPS[chip]
  const nome = (n: number) => def.pinLabels[n]
  const ins = def.func!.inputs.map((n) => entradas[nome(n)] ?? 'X')
  const outs = def.func!.evaluate(ins)
  return Object.fromEntries(def.func!.outputs.map((n, i) => [nome(n), outs[i]]))
}

const bit = (v: number, b: number) => ((v >> b) & 1) as 0 | 1

describe('pinagem dos CIs novos (datasheet)', () => {
  it.each(Object.entries(PINAGEM))('%s: 16 pinos, VCC 16, GND 8, rótulos do datasheet', (id, rotulos) => {
    const def = CHIPS[id as ChipId]
    expect(def.pins).toBe(16)
    expect(def.vcc).toBe(16)
    expect(def.gnd).toBe(8)
    expect(Array.from({ length: 16 }, (_, i) => def.pinLabels[i + 1])).toEqual(rotulos)
    // todo pino lógico é entrada ou saída do bloco, uma vez só
    const usados = [...def.func!.inputs, ...def.func!.outputs, def.vcc, def.gnd]
    expect(new Set(usados).size).toBe(16)
  })
})

describe('74138: decodificador 3 → 8, saídas ativas em nível baixo', () => {
  const ligado = { G1: 1, G2A: 0, G2B: 0 } as const

  it('habilitado, só a saída escolhida por CBA vai a 0', () => {
    for (let v = 0; v < 8; v++) {
      const s = avaliar('74138', { ...ligado, A: bit(v, 0), B: bit(v, 1), C: bit(v, 2) })
      for (let k = 0; k < 8; k++) expect(s[`Y${k}`], `CBA=${v}, Y${k}`).toBe(k === v ? 0 : 1)
    }
  })

  it('desabilitado (G1 = 0, ou G2A ou G2B = 1, ou soltos), todas as saídas em 1', () => {
    for (const en of [
      { G1: 0, G2A: 0, G2B: 0 },
      { G1: 1, G2A: 1, G2B: 0 },
      { G1: 1, G2A: 0, G2B: 1 },
      {},
    ]) {
      const s = avaliar('74138', { ...(en as Record<string, Signal>), A: 0, B: 0, C: 0 })
      expect(Object.values(s)).toEqual(Array(8).fill(1))
    }
  })

  it('endereço solto deixa as saídas indefinidas', () => {
    expect(avaliar('74138', { ...ligado, A: 0, B: 0 }).Y0).toBe('X')
  })
})

describe('74151: multiplexador 8 → 1', () => {
  it('com G = 0, Y repete a entrada D escolhida por CBA e W é o inverso', () => {
    const dados = [1, 0, 0, 1, 0, 1, 1, 0] as const
    const ds = Object.fromEntries(dados.map((d, i) => [`D${i}`, d]))
    for (let v = 0; v < 8; v++) {
      const s = avaliar('74151', { ...ds, G: 0, A: bit(v, 0), B: bit(v, 1), C: bit(v, 2) })
      expect(s.Y, `CBA=${v}`).toBe(dados[v])
      expect(s.W).toBe(dados[v] === 1 ? 0 : 1)
    }
  })

  it('com G = 1 (ou solto), Y = 0 e W = 1', () => {
    expect(avaliar('74151', { G: 1, A: 0, B: 0, C: 0, D0: 1 })).toEqual({ Y: 0, W: 1 })
    expect(avaliar('74151', { A: 0, B: 0, C: 0, D0: 1 })).toEqual({ Y: 0, W: 1 })
  })
})

describe('74283: somador de 4 bits', () => {
  it('Σ4 Σ3 Σ2 Σ1 com C4 = A + B + C0 em todas as 512 combinações', () => {
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        for (const c0 of [0, 1] as const) {
          const e: Record<string, Signal> = { C0: c0 }
          for (let i = 0; i < 4; i++) {
            e[`A${i + 1}`] = bit(a, i)
            e[`B${i + 1}`] = bit(b, i)
          }
          const s = avaliar('74283', e)
          const total = a + b + c0
          expect([s['Σ1'], s['Σ2'], s['Σ3'], s['Σ4'], s.C4]).toEqual([0, 1, 2, 3, 4].map((i) => bit(total, i)))
        }
      }
    }
  })

  it('C0 solto deixa a soma indefinida (ligue C0 no 0)', () => {
    expect(avaliar('74283', { A1: 1, B1: 0, A2: 0, B2: 0, A3: 0, B3: 0, A4: 0, B4: 0 })['Σ1']).toBe('X')
  })
})
