// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Decodificação do display de 7 segmentos (RF-03).
// Segmentos na ordem a, b, c, d, e, f, g:
//
//    ─a─
//   f   b
//    ─g─
//   e   c
//    ─d─

import type { DisplayMode, Signal } from './types'

/** Segmentos acesos (a..g) para cada valor 0–15. */
export const DIGIT_SEGMENTS: readonly string[] = [
  '1111110', // 0
  '0110000', // 1
  '1101101', // 2
  '1111001', // 3
  '0110011', // 4
  '1011011', // 5
  '1011111', // 6
  '1110000', // 7
  '1111111', // 8
  '1111011', // 9
  '1110111', // A
  '0011111', // b
  '1001110', // C
  '0111101', // d
  '1001111', // E
  '1000111', // F
]

export interface DisplayState {
  /** Aceso/apagado de cada segmento a–g. */
  segments: boolean[]
  /** Valor decodificado (bcd/hex); null quando apagado ou em modo raw. */
  value: number | null
  /** Alguma entrada em erro (E). */
  error: boolean
  /** Alguma entrada flutuando (X). */
  floating: boolean
}

const ALL_OFF = Array(7).fill(false) as boolean[]

/**
 * Decodifica o estado do display a partir dos sinais de entrada.
 * - bcd/hex: pinos in0..in3 com pesos 8, 4, 2, 1 (in0 = MSB, no topo).
 *   Em bcd, valores 10–15 apagam o display (entrada inválida).
 * - raw: pinos in0..in6 acionam diretamente os segmentos a–g.
 */
export function decodeDisplay(mode: DisplayMode, ins: Signal[]): DisplayState {
  const error = ins.some((s) => s === 'E')
  const floating = ins.some((s) => s === 'X')
  if (mode === 'raw') {
    return { segments: ins.slice(0, 7).map((s) => s === 1), value: null, error, floating }
  }
  if (error || floating) {
    return { segments: [...ALL_OFF], value: null, error, floating }
  }
  const value = ins.slice(0, 4).reduce<number>((acc, s, i) => acc + (s === 1 ? 8 >> i : 0), 0)
  const visible = mode === 'hex' || value <= 9
  return {
    segments: visible ? [...DIGIT_SEGMENTS[value]].map((ch) => ch === '1') : [...ALL_OFF],
    value: visible ? value : null,
    error,
    floating,
  }
}
