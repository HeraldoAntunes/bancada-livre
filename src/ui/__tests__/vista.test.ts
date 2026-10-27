// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Zoom e movimento da bancada: as contas, separadas do desenho.
import { describe, expect, it } from 'vitest'
import type { CircuitComponent } from '../../engine/types'
import {
  ESCALA_MAX,
  ESCALA_MIN,
  VISTA_INICIAL,
  enquadrar,
  limitesDosComponentes,
  telaParaBancada,
  vistaDeExportacao,
  zoomNoPonto,
} from '../vista'

describe('zoom da bancada', () => {
  it('converte o ponto da tela para a bancada com deslocamento e escala', () => {
    expect(telaParaBancada({ x: 100, y: 50, escala: 2 }, { x: 300, y: 250 })).toEqual({ x: 100, y: 100 })
  })

  it('ampliar mantém parado o ponto que está sob o cursor', () => {
    const cursor = { x: 400, y: 300 }
    const antes = telaParaBancada(VISTA_INICIAL, cursor)
    const v = zoomNoPonto(VISTA_INICIAL, cursor, 1.5)
    expect(v.escala).toBeCloseTo(1.5)
    const depois = telaParaBancada(v, cursor)
    expect(depois.x).toBeCloseTo(antes.x)
    expect(depois.y).toBeCloseTo(antes.y)
  })

  it('não passa dos limites de escala', () => {
    expect(zoomNoPonto(VISTA_INICIAL, { x: 0, y: 0 }, 100).escala).toBe(ESCALA_MAX)
    expect(zoomNoPonto(VISTA_INICIAL, { x: 0, y: 0 }, 0.001).escala).toBe(ESCALA_MIN)
  })
})

describe('enquadrar a região com componentes', () => {
  const C = (id: string, x: number, y: number): CircuitComponent => ({ id, type: 'LED', x, y }) as CircuitComponent

  it('sem componentes, não há região', () => {
    expect(limitesDosComponentes([])).toBeNull()
  })

  it('a região cobre todos os componentes, com os pinos', () => {
    const r = limitesDosComponentes([C('a', 100, 100), C('b', 500, 300)])!
    expect(r.x).toBeLessThanOrEqual(100)
    expect(r.y).toBeLessThanOrEqual(100)
    expect(r.x + r.w).toBeGreaterThan(500)
    expect(r.y + r.h).toBeGreaterThan(300)
  })

  it('a região inteira cabe na área visível, centralizada', () => {
    const r = { x: 100, y: 100, w: 400, h: 200 }
    const v = enquadrar(r, 1000, 800)
    const cantoA = { x: r.x * v.escala + v.x, y: r.y * v.escala + v.y }
    const cantoB = { x: (r.x + r.w) * v.escala + v.x, y: (r.y + r.h) * v.escala + v.y }
    expect(cantoA.x).toBeGreaterThanOrEqual(0)
    expect(cantoB.x).toBeLessThanOrEqual(1000)
    expect(cantoA.y).toBeGreaterThanOrEqual(0)
    expect(cantoB.y).toBeLessThanOrEqual(800)
    expect(cantoA.x + cantoB.x).toBeCloseTo(1000)
  })

  it('circuito pequeno é ampliado, mas sem passar do máximo', () => {
    expect(enquadrar({ x: 0, y: 0, w: 50, h: 50 }, 1000, 800).escala).toBe(ESCALA_MAX)
  })
})

describe('exportar imagem', () => {
  it('sai o circuito inteiro em tamanho real, qualquer que seja o zoom da tela', () => {
    const e = vistaDeExportacao({ x: 40, y: -20, w: 300, h: 200 })
    expect(e.vista).toEqual({ x: -40, y: 20, escala: 1 })
    expect([e.largura, e.altura]).toEqual([300, 200])
  })
})
