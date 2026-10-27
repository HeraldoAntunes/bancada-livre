// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Espelhar e girar componentes: pinos, direção dos fios e textos legíveis.
import { describe, expect, it } from 'vitest'
import type { CircuitComponent } from '../../engine/types'
import { pinDirection, pinPosition } from '../geometry'
import { desfazNoTexto, proximoGiro, transformarPonto, transformSvg } from '../orientacao'

const caixa = { w: 40, h: 20 }

describe('transformar pontos do componente', () => {
  it('sem orientação, nada muda', () => {
    expect(transformarPonto(caixa, {}, { x: 50, y: 10 })).toEqual({ x: 50, y: 10 })
  })

  it('espelhar troca o lado em torno do centro do corpo', () => {
    expect(transformarPonto(caixa, { espelhado: true }, { x: 50, y: 10 })).toEqual({ x: -10, y: 10 })
  })

  it('girar 90 graus no sentido horário em torno do centro', () => {
    const p = transformarPonto(caixa, { giro: 90 }, { x: 40, y: 10 })
    expect(p.x).toBeCloseTo(20)
    expect(p.y).toBeCloseTo(30)
  })

  it('a transformação do desenho leva o ponto para o mesmo lugar que a conta', () => {
    const o = { espelhado: true, giro: 270 as const }
    const m = new DOMMatrixLike(transformSvg(caixa, o))
    const conta = transformarPonto(caixa, o, { x: 50, y: 5 })
    const desenho = m.aplicar({ x: 50, y: 5 })
    expect(desenho.x).toBeCloseTo(conta.x)
    expect(desenho.y).toBeCloseTo(conta.y)
  })
})

describe('pinos e fios', () => {
  const sw = { id: 's', type: 'SWITCH', x: 100, y: 100 } as CircuitComponent

  it('a saída da chave espelhada fica à esquerda e o fio sai para a esquerda', () => {
    const normal = pinPosition(sw, 'out')
    const esp = pinPosition({ ...sw, espelhado: true }, 'out')
    expect(esp.x).toBeLessThan(sw.x)
    expect(normal.x).toBeGreaterThan(sw.x)
    expect(pinDirection({ ...sw, espelhado: true }, 'out')).toEqual({ x: -1, y: 0 })
    expect(pinDirection(sw, 'out')).toEqual({ x: 1, y: 0 })
  })

  it('girada 90 graus, a saída aponta para baixo', () => {
    const d = pinDirection({ ...sw, giro: 90 }, 'out')
    expect(d.x).toBeCloseTo(0)
    expect(d.y).toBeCloseTo(1)
  })
})

describe('texto continua legível', () => {
  it('desfaz o giro e o espelho nos textos', () => {
    expect(desfazNoTexto({})).toBe('none')
    expect(desfazNoTexto({ giro: 90 })).toBe('rotate(-90deg)')
    expect(desfazNoTexto({ espelhado: true, giro: 180 })).toBe('scaleX(-1) rotate(-180deg)')
  })

  it('girar dá a volta: 0, 90, 180, 270, 0', () => {
    expect([0, 90, 180, 270].map((g) => proximoGiro(g as 0 | 90 | 180 | 270))).toEqual([90, 180, 270, 0])
  })
})

/** Interpreta só translate, scale e rotate(a cx cy), o que transformSvg produz, para comparar com a conta. */
class DOMMatrixLike {
  private ops: ((p: { x: number; y: number }) => { x: number; y: number })[] = []
  constructor(t: string) {
    for (const m of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
      const n = m[2].split(/[\s,]+/).map(Number)
      if (m[1] === 'translate') this.ops.push((p) => ({ x: p.x + n[0], y: p.y + (n[1] ?? 0) }))
      if (m[1] === 'scale') this.ops.push((p) => ({ x: p.x * n[0], y: p.y * (n[1] ?? n[0]) }))
      if (m[1] === 'rotate') {
        const a = (n[0] * Math.PI) / 180
        const [cx, cy] = [n[1] ?? 0, n[2] ?? 0]
        this.ops.push((p) => ({
          x: cx + (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a),
          y: cy + (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a),
        }))
      }
    }
  }
  // na lista de transformações do SVG, a última se aplica primeiro ao ponto
  aplicar(p: { x: number; y: number }) {
    return [...this.ops].reverse().reduce((q, f) => f(q), p)
  }
}
