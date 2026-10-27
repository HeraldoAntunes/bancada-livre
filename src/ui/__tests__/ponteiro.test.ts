// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// O fim do toque é ouvido desde o pointerdown: um toque instantâneo (tela de toque, lousa interativa) não se perde.
import { describe, expect, it, vi } from 'vitest'
import { ouvirFimDoPonteiro } from '../ponteiro'

describe('ouvirFimDoPonteiro', () => {
  it('pega o pointerup que chega logo depois, sem esperar a tela redesenhar', () => {
    const janela = new EventTarget()
    const aoSoltar = vi.fn()
    ouvirFimDoPonteiro(janela, aoSoltar, vi.fn())
    janela.dispatchEvent(new Event('pointerup'))
    expect(aoSoltar).toHaveBeenCalledTimes(1)
  })

  it('atende uma vez só e para de ouvir (soltar e cancelar não somam)', () => {
    const janela = new EventTarget()
    const aoSoltar = vi.fn()
    const aoCancelar = vi.fn()
    ouvirFimDoPonteiro(janela, aoSoltar, aoCancelar)
    janela.dispatchEvent(new Event('pointerup'))
    janela.dispatchEvent(new Event('pointerup'))
    janela.dispatchEvent(new Event('pointercancel'))
    expect(aoSoltar).toHaveBeenCalledTimes(1)
    expect(aoCancelar).not.toHaveBeenCalled()
  })

  it('cancelamento do sistema encerra sem soltar', () => {
    const janela = new EventTarget()
    const aoSoltar = vi.fn()
    const aoCancelar = vi.fn()
    ouvirFimDoPonteiro(janela, aoSoltar, aoCancelar)
    janela.dispatchEvent(new Event('pointercancel'))
    janela.dispatchEvent(new Event('pointerup'))
    expect(aoCancelar).toHaveBeenCalledTimes(1)
    expect(aoSoltar).not.toHaveBeenCalled()
  })
})
