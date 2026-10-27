// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Zoom e movimento da bancada: a vista é um deslocamento (x, y, em pixels da tela) mais uma escala.
// Ponto na tela = ponto na bancada × escala + deslocamento. O circuito salvo não muda.
import type { CircuitComponent } from '../engine/types'
import { geometryOf } from './geometry'
import { transformarPonto } from './orientacao'

export interface Vista {
  x: number
  y: number
  escala: number
}
export interface Ponto {
  x: number
  y: number
}
export interface Retangulo {
  x: number
  y: number
  w: number
  h: number
}

export const VISTA_INICIAL: Vista = { x: 0, y: 0, escala: 1 }
export const ESCALA_MIN = 0.25
export const ESCALA_MAX = 3

const limitar = (e: number) => Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, e))

export function telaParaBancada(v: Vista, p: Ponto): Ponto {
  return { x: (p.x - v.x) / v.escala, y: (p.y - v.y) / v.escala }
}

/** Amplia (fator > 1) ou reduz mantendo parado o ponto da bancada que está sob o cursor. */
export function zoomNoPonto(v: Vista, cursor: Ponto, fator: number): Vista {
  const escala = limitar(v.escala * fator)
  const b = telaParaBancada(v, cursor)
  return { escala, x: cursor.x - b.x * escala, y: cursor.y - b.y * escala }
}

// sobra em volta de cada componente: pinos para fora do corpo e o rótulo embaixo
const FOLGA = 28

export function limitesDosComponentes(comps: CircuitComponent[]): Retangulo | null {
  if (comps.length === 0) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const c of comps) {
    const g = geometryOf(c)
    const pontos = [{ x: 0, y: 0 }, { x: g.w, y: g.h }, ...g.pins].map((p) => transformarPonto(g, c, p))
    const xs = pontos.map((p) => p.x)
    const ys = pontos.map((p) => p.y)
    x0 = Math.min(x0, c.x + Math.min(...xs) - FOLGA)
    y0 = Math.min(y0, c.y + Math.min(...ys) - FOLGA)
    x1 = Math.max(x1, c.x + Math.max(...xs) + FOLGA)
    y1 = Math.max(y1, c.y + Math.max(...ys) + FOLGA)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Vista que mostra a região inteira, centralizada, o maior possível (até ESCALA_MAX). */
export function enquadrar(r: Retangulo, largura: number, altura: number): Vista {
  const escala = limitar(Math.min(largura / r.w, altura / r.h))
  return {
    escala,
    x: (largura - r.w * escala) / 2 - r.x * escala,
    y: (altura - r.h * escala) / 2 - r.y * escala,
  }
}

/** Para exportar imagem: o circuito inteiro em tamanho real, recortado na região dos componentes. */
export function vistaDeExportacao(r: Retangulo): { vista: Vista; largura: number; altura: number } {
  return { vista: { x: -r.x, y: -r.y, escala: 1 }, largura: r.w, altura: r.h }
}
