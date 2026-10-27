// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Valida os circuitos de exemplo: estrutura (fiação bem-formada) e
// comportamento (tabela-verdade bate com a função lógica esperada).

import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../examples'
import { decodeDisplay, DIGIT_SEGMENTS } from '../display'
import { evalGate } from '../gates'
import { allInputPins, allOutputPins } from '../pins'
import { simulate } from '../simulate'
import { circuitTruthTable } from '../truthTable'
import { inputPins, isGate, pinKey, type GateType, type Signal } from '../types'

function tableOf(name: string) {
  const ex = EXAMPLES.find((e) => e.name === name)
  if (!ex) throw new Error(`exemplo não encontrado: ${name}`)
  return circuitTruthTable(ex.components, ex.wires)
}

describe('exemplos — estrutura', () => {
  it.each(EXAMPLES.map((e) => [e.name, e] as const))('%s tem fiação bem-formada', (_, ex) => {
    const ids = ex.components.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)

    const byId = new Map(ex.components.map((c) => [c.id, c]))
    const usedInputs = new Set<string>()
    for (const w of ex.wires) {
      const from = byId.get(w.from.comp)
      const to = byId.get(w.to.comp)
      expect(from, `${w.id}: origem inexistente`).toBeDefined()
      expect(to, `${w.id}: destino inexistente`).toBeDefined()
      expect(
        allOutputPins(from!),
        `${w.id}: pino de origem ${w.from.pin} não é saída de ${from!.type}`,
      ).toContain(w.from.pin)
      expect(allInputPins(to!), `${w.id}: pino ${w.to.pin} não existe em ${to!.type}`).toContain(
        w.to.pin,
      )
      const key = `${w.to.comp}:${w.to.pin}`
      expect(usedInputs.has(key), `${w.id}: entrada ${key} com dois drivers`).toBe(false)
      usedInputs.add(key)
    }
  })

  it('todo exemplo tem nível e a tabela-verdade não contém X/E', () => {
    for (const ex of EXAMPLES) {
      expect(['Básico', 'Intermediário', 'Avançado', 'CIs']).toContain(ex.level)
      const t = circuitTruthTable(ex.components, ex.wires)
      for (const r of t.rows) {
        for (const v of r.outputs) {
          expect(v, `${ex.name}: saída indefinida`).not.toBe('X')
          expect(v, `${ex.name}: saída em erro`).not.toBe('E')
        }
      }
    }
  })
})

describe('exemplos — nível Básico (uma porta por circuito)', () => {
  const gates: GateType[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']
  it.each(gates)('Porta %s bate com evalGate', (g) => {
    const t = tableOf(`Porta ${g}`)
    expect(t.rows).toHaveLength(4)
    for (const r of t.rows) {
      expect(r.outputs[0]).toBe(evalGate(g, r.inputs as Signal[]))
    }
  })

  it('Porta NOT inverte', () => {
    const t = tableOf('Porta NOT')
    for (const r of t.rows) expect(r.outputs[0]).toBe(r.inputs[0] === 0 ? 1 : 0)
  })

  it('Porta BUFFER repete a entrada', () => {
    const t = tableOf('Porta BUFFER')
    expect(t.rows).toHaveLength(2)
    for (const r of t.rows) expect(r.outputs[0]).toBe(r.inputs[0])
  })

  it('Banco de chaves na barra de LEDs: cada LED segue a sua chave nas 256 combinações', () => {
    const t = tableOf('Banco de chaves na barra de LEDs')
    expect(t.inputs).toHaveLength(8)
    expect(t.rows).toHaveLength(256)
    for (const r of t.rows) expect(r.outputs).toEqual(r.inputs)
  })
})

/** Simula um exemplo com o contador parado no valor `v` (o contador não entra na tabela-verdade). */
function comContador(name: string, v: number) {
  const ex = EXAMPLES.find((e) => e.name === name)
  if (!ex) throw new Error(`exemplo não encontrado: ${name}`)
  const comps = ex.components.map((c) => (c.type === 'COUNTER' ? { ...c, contagem: v } : c))
  const sim = simulate(comps, ex.wires)
  const porRotulo = (label: string) => {
    const c = comps.find((x) => x.label === label)!
    return sim.pins.get(pinKey(c.id, 'in'))
  }
  return { comps, sim, porRotulo }
}

describe('exemplos — com o contador automático', () => {
  it('Semáforo com contador: verde (00), amarelo (01), vermelho (10 e 11), um aceso por vez', () => {
    const esperado = [
      ['Verde', 'Amarelo', 'Vermelho'].map((l) => (l === 'Verde' ? 1 : 0)),
      ['Verde', 'Amarelo', 'Vermelho'].map((l) => (l === 'Amarelo' ? 1 : 0)),
      [0, 0, 1],
      [0, 0, 1],
    ]
    for (let v = 0; v < 4; v++) {
      const { porRotulo } = comContador('Semáforo com contador', v)
      expect(['Verde', 'Amarelo', 'Vermelho'].map(porRotulo), `contagem ${v}`).toEqual(esperado[v])
    }
  })

  it('Contador no display com 7448: mostra 0 a 9 e apaga de 10 a 15', () => {
    for (let v = 0; v < 16; v++) {
      const { comps, sim } = comContador('Contador no display com 7448', v)
      const d = comps.find((c) => c.type === 'DISPLAY')!
      const segs = decodeDisplay('raw', inputPins(d).map((p) => sim.pins.get(pinKey(d.id, p)) ?? 'X'))
      const padrao = v <= 9 ? DIGIT_SEGMENTS[v] : '0000000'
      expect(segs.segments.map((s) => (s ? '1' : '0')).join(''), `contagem ${v}`).toBe(padrao)
    }
  })

  it('Contador na barra de LEDs: a barra mostra a contagem em binário', () => {
    for (let v = 0; v < 16; v++) {
      const { comps, sim } = comContador('Contador na barra de LEDs', v)
      const barra = comps.find((c) => c.type === 'LED_BAR')!
      const leds = inputPins(barra).map((p) => sim.pins.get(pinKey(barra.id, p)))
      // de cima para baixo: bit 3, 2, 1, 0
      expect(leds, `contagem ${v}`).toEqual([3, 2, 1, 0].map((b) => (v >> b) & 1))
    }
  })
})

describe('exemplos — nível Intermediário', () => {
  it('Meio-somador: S = A⊕B, Cout = A·B', () => {
    const t = tableOf('Meio-somador')
    for (const r of t.rows) {
      const [a, b] = r.inputs
      expect(r.outputs[0]).toBe(a ^ b)
      expect(r.outputs[1]).toBe(a & b)
    }
  })

  it('Detector de paridade: 1 quando nº de 1s é ímpar', () => {
    const t = tableOf('Detector de paridade')
    expect(t.rows).toHaveLength(8)
    for (const r of t.rows) {
      expect(r.outputs[0]).toBe(r.inputs.filter((b) => b === 1).length % 2)
    }
  })

  it('Comparador: 1 quando A = B', () => {
    const t = tableOf('Comparador (A = B)')
    for (const r of t.rows) expect(r.outputs[0]).toBe(r.inputs[0] === r.inputs[1] ? 1 : 0)
  })

  it('MUX 2:1: S = Sel ? B : A', () => {
    const t = tableOf('MUX 2:1')
    for (const r of t.rows) {
      const [a, b, sel] = r.inputs
      expect(r.outputs[0]).toBe(sel === 1 ? b : a)
    }
  })

  it('De Morgan: os dois lados sempre iguais', () => {
    const t = tableOf('De Morgan: ¬(A·B) = ¬A + ¬B')
    for (const r of t.rows) {
      expect(r.outputs[0]).toBe(r.outputs[1])
      expect(r.outputs[0]).toBe(evalGate('NAND', r.inputs as Signal[]))
    }
  })

  it('Só com NAND: reproduz ¬A, A·B e A+B', () => {
    const t = tableOf('Só com NAND: NOT, AND e OR')
    for (const r of t.rows) {
      const [a, b] = r.inputs
      expect(r.outputs[0]).toBe(a === 0 ? 1 : 0) // ¬A
      expect(r.outputs[1]).toBe(a & b) // A·B
      expect(r.outputs[2]).toBe(a | b) // A+B
    }
  })

  it('Decodificador 2:4: saída one-hot no índice A1A0', () => {
    const t = tableOf('Decodificador 2:4')
    for (const r of t.rows) {
      const idx = r.inputs[0] * 2 + r.inputs[1]
      expect(r.outputs).toEqual([0, 1, 2, 3].map((i) => (i === idx ? 1 : 0)))
    }
  })
})

describe('exemplos — nível Avançado', () => {
  it('Somador completo: S = paridade, Cout = maioria', () => {
    const t = tableOf('Somador completo')
    expect(t.rows).toHaveLength(8)
    for (const r of t.rows) {
      const [a, b, cin] = r.inputs
      expect(r.outputs[0]).toBe(a ^ b ^ cin)
      expect(r.outputs[1]).toBe(((a & b) | (a & cin) | (b & cin)) as 0 | 1)
    }
  })

  it('Somador de 2 bits: Cout S1 S0 = (A1A0) + (B1B0) nas 16 combinações', () => {
    const t = tableOf('Somador de 2 bits')
    expect(t.rows).toHaveLength(16)
    for (const r of t.rows) {
      const [a0, b0, a1, b1] = r.inputs
      const soma = a0 + 2 * a1 + (b0 + 2 * b1)
      const [s0, s1, cout] = r.outputs as (0 | 1)[]
      expect(s0 + 2 * s1 + 4 * cout).toBe(soma)
    }
  })

  it('Comparador de 2 bits: 1 quando A1A0 = B1B0', () => {
    const t = tableOf('Comparador de 2 bits')
    expect(t.rows).toHaveLength(16)
    for (const r of t.rows) {
      const [a1, a0, b1, b0] = r.inputs
      expect(r.outputs[0]).toBe(a1 === b1 && a0 === b0 ? 1 : 0)
    }
  })

  it('BCD → Display: dígito correspondente às chaves 8-4-2-1', () => {
    const t = tableOf('BCD → Display')
    expect(t.rows).toHaveLength(16)
    for (let m = 0; m < 16; m++) {
      const expected = m <= 9 ? m.toString() : '—'
      expect(t.rows[m].outputs[0]).toBe(expected)
    }
  })
})

describe('exemplos — nível CIs', () => {
  it('7408: primeira ligação faz AND', () => {
    const t = tableOf('7408: primeira ligação')
    for (const r of t.rows) expect(r.outputs[0]).toBe(r.inputs[0] & r.inputs[1])
  })

  it('Só um 7400: ¬A, A+B e ¬(A·B) com portas encadeadas do mesmo chip', () => {
    const t = tableOf('Só um 7400: universalidade do NAND')
    for (const r of t.rows) {
      const [a, b] = r.inputs
      expect(r.outputs[0]).toBe(a === 0 ? 1 : 0) // ¬A
      expect(r.outputs[1]).toBe(a | b) // A+B
      expect(r.outputs[2]).toBe(a & b ? 0 : 1) // ¬(A·B)
    }
  })

  it('Meio-somador com 7486 + 7408: S = A⊕B, Cout = A·B', () => {
    const t = tableOf('Meio-somador com 7486 + 7408')
    for (const r of t.rows) {
      const [a, b] = r.inputs
      expect(r.outputs[0]).toBe(a ^ b)
      expect(r.outputs[1]).toBe(a & b)
    }
  })

  it('Decodificador 7448 → Display: dígito 0–9, apagado em 10–15', () => {
    const t = tableOf('Decodificador 7448 → Display')
    expect(t.rows).toHaveLength(16)
    for (let m = 0; m < 16; m++) {
      const expected = m <= 9 ? m.toString() : '—'
      expect(t.rows[m].outputs[0], `valor ${m}`).toBe(expected)
    }
  })

  it('Decodificador 74138 → 8 LEDs: só o LED do endereço CBA fica apagado', () => {
    const t = tableOf('Decodificador 74138 → 8 LEDs')
    expect(t.rows).toHaveLength(8)
    for (const r of t.rows) {
      const [c, b, a] = r.inputs
      const v = 4 * c + 2 * b + a
      expect(r.outputs).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k === v ? 0 : 1)))
    }
  })

  it('74151 como gerador de função: Y é a maioria de C, B, A e W o inverso', () => {
    const t = tableOf('74151 como gerador de função: maioria de 3')
    expect(t.rows).toHaveLength(8)
    for (const r of t.rows) {
      const maioria = r.inputs.filter((v) => v === 1).length >= 2 ? 1 : 0
      expect(r.outputs).toEqual([maioria, 1 - maioria])
    }
  })

  it('Somador de 4 bits com 74283: Σ e C4 = A + B nas 256 combinações', () => {
    const t = tableOf('Somador de 4 bits com 74283')
    expect(t.inputs.map((c) => c.name)).toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'])
    expect(t.rows).toHaveLength(256)
    for (const r of t.rows) {
      const peso = (bits: (0 | 1)[]) => bits.reduce<number>((s, b, i) => s + b * 2 ** i, 0)
      const soma = peso(r.outputs as (0 | 1)[])
      expect(soma).toBe(peso(r.inputs.slice(0, 4)) + peso(r.inputs.slice(4)))
    }
  })
})

describe('exemplos — sanidade extra', () => {
  it('nenhuma porta declarada nos exemplos deixa entrada flutuando', () => {
    for (const ex of EXAMPLES) {
      const driven = new Set(ex.wires.map((w) => `${w.to.comp}:${w.to.pin}`))
      for (const c of ex.components) {
        if (!isGate(c.type)) continue
        for (const p of allInputPins(c)) {
          expect(driven.has(`${c.id}:${p}`), `${ex.name}: ${c.type} ${c.id} com ${p} solto`).toBe(
            true,
          )
        }
      }
    }
  })
})
