// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Posição e tamanho da janela flutuante (tabela-verdade destacada), em pixels da página.

export interface Caixa {
  x: number
  y: number
  w: number
  h: number
}

export const JANELA_MIN = { w: 260, h: 160 }
// o quanto da janela precisa continuar à vista para dar para pegá-la de volta pela barra de título
const VISIVEL = { x: 80, y: 40 }

export function janelaInicial(tela: { w: number; h: number }): Caixa {
  const w = Math.min(560, tela.w - 40)
  const h = Math.min(520, tela.h - 100)
  return { x: Math.max(0, tela.w - w - 330), y: 70, w, h }
}

export function manterNaTela(j: Caixa, tela: { w: number; h: number }): Caixa {
  const w = Math.min(tela.w, Math.max(JANELA_MIN.w, j.w))
  const h = Math.min(tela.h, Math.max(JANELA_MIN.h, j.h))
  const x = Math.min(tela.w - VISIVEL.x, Math.max(VISIVEL.x - w, j.x))
  const y = Math.min(tela.h - VISIVEL.y, Math.max(0, j.y))
  return { x, y, w, h }
}
