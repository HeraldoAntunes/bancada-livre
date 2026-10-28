// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// CIs sequenciais: tabela de função de cada chip e os exemplos do Guia funcionando no tempo.
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../examples'
import { CHIPS } from '../ics'
import { assentar } from '../sequencial'
import { simulate } from '../simulate'
import { inputPins, pinKey, type CircuitComponent, type Signal } from '../types'

/** Abre um exemplo e devolve como mexer em chaves e clocks e ler LEDs, display e barra. */
function bancada(nome: string) {
  const ex = EXAMPLES.find((e) => e.name === nome)!
  let cs = assentar(ex.components, ex.wires).components
  const porRotulo = (r: string) => cs.find((c) => c.label === r)!
  const pinos = (c: CircuitComponent) => {
    const sim = simulate(cs, ex.wires)
    return inputPins(c).map((p) => sim.pins.get(pinKey(c.id, p)))
  }
  return {
    mudar(rotulo: string, v: 0 | 1) {
      const id = porRotulo(rotulo).id
      cs = assentar(
        cs.map((c) => (c.id === id ? { ...c, state: v } : c)),
        ex.wires,
      ).components
    },
    pulso(rotulo: string) {
      this.mudar(rotulo, 1)
      this.mudar(rotulo, 0)
    },
    led: (r: string) => pinos(porRotulo(r))[0],
    pinos: (r: string) => pinos(porRotulo(r)),
  }
}

const num = (bits: (Signal | undefined)[]) => bits.reduce<number>((a, b) => a * 2 + Number(b), 0)

describe('tabela de função dos chips', () => {
  it('7474: CLR̄ e PR̄ em 0 juntos levam Q e Q̄ a 1, como na folha de dados', () => {
    const seq = CHIPS['7474'].seq!
    expect(seq.saida([0, 0], [0, 0, 1, 1])).toEqual([1, 1, 0, 1])
    expect(seq.saida([1, 0], [1, 1, 1, 0])).toEqual([1, 0, 1, 0])
  })

  it('74161: carga tem prioridade sobre a contagem, e RCO sobe em 15 com ENT = 1', () => {
    const seq = CHIPS['74161'].seq!
    // sincronas: A, B, C, D, ENP, LOAD̄, CLK; assincronas: CLR̄, ENT
    expect(seq.proximo([0, 0, 0, 0], [1, 0, 1, 0, 1, 0, 1], [1, 1], [true])).toEqual([1, 0, 1, 0])
    expect(seq.proximo([1, 1, 1, 1], [0, 0, 0, 0, 1, 1, 1], [1, 1], [true])).toEqual([0, 0, 0, 0])
    expect(seq.proximo([1, 0, 0, 0], [0, 0, 0, 0, 0, 1, 1], [1, 1], [true])).toEqual([1, 0, 0, 0])
    expect(seq.saida([1, 1, 1, 1], [1, 1])[4]).toBe(1)
    expect(seq.saida([1, 1, 1, 1], [1, 0])[4]).toBe(0)
    expect(seq.saida([1, 1, 1, 1], [0, 1])).toEqual([0, 0, 0, 0, 0])
  })

  it('74164: a entrada serial é A·B', () => {
    const seq = CHIPS['74164'].seq!
    const um = seq.proximo(Array(8).fill(0), [1, 1, 1], [1], [true])
    expect(um[0]).toBe(1)
    expect(seq.proximo(um, [1, 0, 1], [1], [true]).slice(0, 2)).toEqual([0, 1])
  })
})

describe('exemplos dos CIs sequenciais', () => {
  it('7474: conta de 0 a 3 e volta', () => {
    const b = bancada('7474: contador de 0 a 3 com dois flip-flops D')
    const v: number[] = []
    for (let i = 0; i < 5; i++) {
      b.pulso('CLK1')
      v.push(num([b.led('Q1'), b.led('Q0')]))
    }
    expect(v).toEqual([1, 2, 3, 0, 1])
  })

  it('7476: muda na descida do clock e conta de 0 a 3', () => {
    const b = bancada('7476: contador de 0 a 3 com JK')
    b.mudar('CLK1', 1)
    expect(num([b.led('Q1'), b.led('Q0')])).toBe(0) // na subida ainda não muda
    b.mudar('CLK1', 0)
    expect(num([b.led('Q1'), b.led('Q0')])).toBe(1)
    const v: number[] = []
    for (let i = 0; i < 4; i++) {
      b.pulso('CLK1')
      v.push(num([b.led('Q1'), b.led('Q0')]))
    }
    expect(v).toEqual([2, 3, 0, 1])
  })

  it('74161: o display passa por 0 a 15 e RCO acende só no 15', () => {
    const b = bancada('74161: contador de 0 a F no display')
    const v: number[] = []
    const rco: unknown[] = []
    for (let i = 0; i < 16; i++) {
      b.pulso('CLK1')
      v.push(num(b.pinos('D1')))
      rco.push(b.led('RCO'))
    }
    expect(v).toEqual([...Array(15).keys()].map((n) => n + 1).concat(0))
    expect(rco.filter((r) => r === 1)).toHaveLength(1)
    expect(rco[14]).toBe(1)
  })

  it('74164: o bit da chave A entra em QA e anda uma casa por toque', () => {
    const b = bancada('74164: registrador de 8 bits na barra de LEDs')
    b.mudar('A', 1)
    b.pulso('C')
    b.mudar('A', 0)
    b.pulso('C')
    b.pulso('C')
    expect(b.pinos('Y')).toEqual([0, 0, 1, 0, 0, 0, 0, 0])
  })

  it('sem VCC e GND o chip não guarda nada e as saídas ficam indefinidas', () => {
    const ex = EXAMPLES.find((e) => e.name === '74161: contador de 0 a F no display')!
    const fios = ex.wires.filter((w) => w.to.pin !== 'p16')
    const cs = assentar(ex.components, fios).components
    const ci = cs.find((c) => c.type === 'IC')!
    expect(simulate(cs, fios).pins.get(pinKey(ci.id, 'p14'))).toBe('X')
  })
})
