// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Geometria dos componentes na bancada: tamanho do corpo e posição dos pinos.

import { chipOf } from '../engine/ics'
import { bitsDe, inputCount, inputPins, isSeq, type CircuitComponent } from '../engine/types'
import { transformarDirecao, transformarPonto } from './orientacao'

/** Constantes do encapsulamento DIP (compartilhadas com o símbolo). */
export const IC_W = 72
export const IC_ROW_H = 24
export const IC_TOP = 18

/** Banco de chaves e barra de LEDs: uma posição a cada 20 px; o banco tem a faixa "ON" no alto. */
export const POSICAO_H = 20
export const bancoY = (i: number) => 26 + i * POSICAO_H
export const barraY = (i: number) => 16 + i * POSICAO_H
/** Contador: o valor em binário no alto e uma saída por fileira, do bit mais alto para o mais baixo. */
export const contadorY = (i: number) => 38 + i * POSICAO_H

/** Flip-flop e trava: uma entrada por fileira à esquerda (as do clock, depois PR e CLR), Q no alto e Q̄ embaixo. */
export const FF_W = 64
export const ffY = (i: number) => 18 + i * POSICAO_H
export const ffAltura = (fileiras: number) => ffY(fileiras - 1) + 18

/** Altura do corpo para um DIP de `totalPins` pinos (14 ou 16). */
export function icHeight(totalPins: number): number {
  return (totalPins / 2) * IC_ROW_H + 12
}

/** Posição y do pino n: metade esquerda desce, metade direita sobe. */
export function icPinY(n: number, totalPins: number): number {
  const half = totalPins / 2
  return n <= half ? IC_TOP + (n - 1) * IC_ROW_H : IC_TOP + (totalPins - n) * IC_ROW_H
}

export interface PinDef {
  name: string
  x: number
  y: number
  dir: 'in' | 'out'
}

export interface Geometry {
  w: number
  h: number
  pins: PinDef[]
}

export function geometryOf(c: CircuitComponent): Geometry {
  if (isSeq(c.type)) {
    const ins = inputPins(c)
    const fileiras = Math.max(ins.length, 2)
    const pins: PinDef[] = ins.map((name, i) => ({ name, x: -20, y: ffY(i), dir: 'in' as const }))
    pins.push({ name: 'q', x: FF_W + 20, y: ffY(0), dir: 'out' }, { name: 'qn', x: FF_W + 20, y: ffY(fileiras - 1), dir: 'out' })
    return { w: FF_W, h: ffAltura(fileiras), pins }
  }
  switch (c.type) {
    case 'SWITCH':
      return { w: 48, h: 60, pins: [{ name: 'out', x: 70, y: 30, dir: 'out' }] }
    case 'PUSH_BUTTON':
      return { w: 48, h: 52, pins: [{ name: 'out', x: 70, y: 26, dir: 'out' }] }
    case 'LEVEL_HIGH':
    case 'LEVEL_LOW':
    case 'CLOCK':
      return { w: 40, h: 32, pins: [{ name: 'out', x: 62, y: 16, dir: 'out' }] }
    case 'PROBE':
      return { w: 36, h: 28, pins: [{ name: 'in', x: -20, y: 14, dir: 'in' }] }
    case 'LABEL':
      return { w: 120, h: 26, pins: [] }
    case 'IC': {
      const def = chipOf(c)
      const outs = new Set([
        ...def.gates.map((g) => g.output),
        ...(def.func?.outputs ?? []),
        ...(def.seq?.saidas ?? []),
      ])
      const pins: PinDef[] = []
      for (let n = 1; n <= def.pins; n++) {
        pins.push({
          name: `p${n}`,
          x: n <= def.pins / 2 ? -20 : IC_W + 20,
          y: icPinY(n, def.pins),
          dir: outs.has(n) ? 'out' : 'in',
        })
      }
      return { w: IC_W, h: icHeight(def.pins), pins }
    }
    case 'DIP_SWITCH': {
      const n = bitsDe(c)
      const pins: PinDef[] = Array.from({ length: n }, (_, i) => ({
        name: `out${i}`,
        x: 74,
        y: bancoY(i),
        dir: 'out' as const,
      }))
      return { w: 52, h: bancoY(n) - 4, pins }
    }
    case 'COUNTER': {
      const n = bitsDe(c)
      const pins: PinDef[] = Array.from({ length: n }, (_, i) => ({
        name: `q${n - 1 - i}`,
        x: 78,
        y: contadorY(i),
        dir: 'out' as const,
      }))
      return { w: 56, h: contadorY(n) - 4, pins }
    }
    case 'LED_BAR': {
      const n = bitsDe(c)
      const pins: PinDef[] = Array.from({ length: n }, (_, i) => ({
        name: `in${i}`,
        x: -22,
        y: barraY(i),
        dir: 'in' as const,
      }))
      return { w: 30, h: barraY(n) - 4, pins }
    }
    case 'LED':
      return { w: 30, h: 58, pins: [{ name: 'in', x: -22, y: 50, dir: 'in' }] }
    case 'DISPLAY': {
      // 4 pinos (bcd/hex, pesos 8-4-2-1) ou 7 pinos (raw, segmentos a–g).
      const n = inputCount(c)
      const h = Math.max(88, n * 16 + 24)
      const pins: PinDef[] = Array.from({ length: n }, (_, i) => ({
        name: `in${i}`,
        x: -22,
        y: h / 2 + (i - (n - 1) / 2) * 16,
        dir: 'in' as const,
      }))
      return { w: 64, h, pins }
    }
    default: {
      // Portas: altura cresce com o fan-in; entradas à esquerda, saída à direita.
      const n = inputCount(c)
      const h = Math.max(48, n * 18 + 12)
      const pins: PinDef[] = Array.from({ length: n }, (_, i) => ({
        name: `in${i}`,
        x: -20,
        y: h / 2 + (i - (n - 1) / 2) * 18,
        dir: 'in' as const,
      }))
      pins.push({ name: 'out', x: 86, y: h / 2, dir: 'out' })
      return { w: 64, h, pins }
    }
  }
}

export function pinPosition(c: CircuitComponent, pin: string): { x: number; y: number } {
  const g = geometryOf(c)
  const p = g.pins.find((pp) => pp.name === pin)
  if (!p) return { x: c.x, y: c.y }
  const t = transformarPonto(g, c, p)
  return { x: c.x + t.x, y: c.y + t.y }
}

/** Para onde o fio sai do pino: saída para a direita e entrada para a esquerda, girando junto. */
export function pinDirection(c: CircuitComponent, pin: string): { x: number; y: number } {
  const p = geometryOf(c).pins.find((pp) => pp.name === pin)
  const base = { x: p?.dir === 'in' ? -1 : 1, y: 0 }
  return transformarDirecao(c, base)
}

/**
 * Curva Bézier suave entre dois pinos. d1 e d2 dizem para onde o fio sai de cada pino (padrão:
 * da saída para a direita e da entrada para a esquerda); componentes espelhados ou girados mudam isso.
 */
export function wirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  d1 = { x: 1, y: 0 },
  d2 = { x: -1, y: 0 },
): string {
  const k = Math.min(Math.max(Math.hypot(x2 - x1, y2 - y1) * 0.5, 40), 120)
  return `M ${x1} ${y1} C ${x1 + d1.x * k} ${y1 + d1.y * k}, ${x2 + d2.x * k} ${y2 + d2.y * k}, ${x2} ${y2}`
}
