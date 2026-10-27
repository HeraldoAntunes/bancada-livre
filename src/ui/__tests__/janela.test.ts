// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Janela flutuante (tabela-verdade destacada): posição e tamanho sempre alcançáveis na tela.
import { describe, expect, it } from 'vitest'
import { JANELA_MIN, janelaInicial, manterNaTela } from '../janela'

describe('janela flutuante', () => {
  const tela = { w: 1366, h: 768 }

  it('começa grande e dentro da tela', () => {
    const j = janelaInicial(tela)
    expect(j.w).toBeGreaterThanOrEqual(400)
    expect(j.x).toBeGreaterThanOrEqual(0)
    expect(j.y).toBeGreaterThanOrEqual(0)
    expect(j.x + j.w).toBeLessThanOrEqual(tela.w)
    expect(j.y + j.h).toBeLessThanOrEqual(tela.h)
  })

  it('arrastada para fora, volta com a barra de título alcançável', () => {
    const j = manterNaTela({ x: 5000, y: -300, w: 500, h: 400 }, tela)
    expect(j.y).toBe(0)
    expect(j.x).toBeLessThanOrEqual(tela.w - 80)
    const k = manterNaTela({ x: -2000, y: 2000, w: 500, h: 400 }, tela)
    expect(k.x + k.w).toBeGreaterThanOrEqual(80)
    expect(k.y).toBeLessThanOrEqual(tela.h - 40)
  })

  it('não fica menor que o mínimo nem maior que a tela', () => {
    expect(manterNaTela({ x: 0, y: 0, w: 10, h: 10 }, tela)).toMatchObject({ w: JANELA_MIN.w, h: JANELA_MIN.h })
    expect(manterNaTela({ x: 0, y: 0, w: 9999, h: 9999 }, tela)).toMatchObject({ w: tela.w, h: tela.h })
  })
})
