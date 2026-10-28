// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// CIs sequenciais da série 74xx, com a pinagem e a tabela de função das folhas de dados: 7474 (dois flip-flops D),
// 7476 (dois flip-flops JK), 74161 (contador síncrono de 4 bits) e 74164 (registrador de deslocamento de 8 bits).
// O estado de cada chip fica no componente (`estadoCi`); o motor em sequencial.ts chama `proximo` a cada mudança.

import type { ChipDef } from './ics'
import type { Signal } from './types'

export type Bit = 0 | 1 | 'X'

/** Parte sequencial de um CI: o que só vale na borda do clock e o que age na hora. */
export interface ChipSeq {
  /** Pinos lidos só para calcular o próximo estado (dados e clocks). */
  sincronas: number[]
  /** Pinos que mudam a saída na hora (limpar, predefinir, habilitar o vai-um). */
  assincronas: number[]
  /** Pinos de clock, dentre as síncronas. */
  clocks: number[]
  /** Dispara na descida do clock (7476) em vez da subida. */
  bordaDescida?: boolean
  saidas: number[]
  /** Quantos bits de estado o chip guarda. */
  bits: number
  /** Saídas a partir do estado guardado e das entradas assíncronas (na ordem de `assincronas`). */
  saida: (estado: Bit[], asinc: Signal[]) => Signal[]
  /** Próximo estado; `bordas[i]` diz se `clocks[i]` acabou de ter a borda que dispara o chip. */
  proximo: (estado: Bit[], sinc: Signal[], asinc: Signal[], bordas: boolean[]) => Bit[]
}

/** Entrada de controle TTL solta flutua em 1, como no chip real. */
const ttl = (v: Signal): Signal => (v === 'X' ? 1 : v)
const ativoEmZero = (v: Signal) => ttl(v) === 0
const nivel = (v: Signal): Bit => (v === 0 || v === 1 ? v : 'X')
const inv = (v: Bit): Bit => (v === 'X' ? 'X' : v === 1 ? 0 : 1)

function rotulos(nomes: string[]): Record<number, string> {
  return Object.fromEntries(nomes.map((n, i) => [i + 1, n]))
}

/**
 * Saída de um flip-flop com PR̄ e CLR̄ ativos em 0. Os dois em 0 levam Q e Q̄ a 1 ao mesmo tempo, como a folha de
 * dados descreve (combinação que não se usa).
 */
function saidaComPrClr(q: Bit, clr: Signal, pr: Signal): [Signal, Signal] {
  const c = ativoEmZero(clr)
  const p = ativoEmZero(pr)
  if (c && p) return [1, 1]
  if (c) return [0, 1]
  if (p) return [1, 0]
  return [q, inv(q)]
}

/** Estado forçado por PR̄/CLR̄ (soltar os dois juntos deixa o estado indefinido), ou null se nenhum age. */
function forcado(clr: Signal, pr: Signal): Bit | null {
  const c = ativoEmZero(clr)
  const p = ativoEmZero(pr)
  if (c && p) return 'X'
  if (c) return 0
  if (p) return 1
  return null
}

function jk(q: Bit, j: Signal, k: Signal): Bit {
  const a = nivel(j)
  const b = nivel(k)
  if (a === 'X' || b === 'X') return 'X'
  if (a === 1 && b === 1) return inv(q)
  if (a === 1) return 1
  if (b === 1) return 0
  return q
}

export const CHIP_7474: ChipDef = {
  id: '7474',
  title: '2× flip-flop D (borda de subida, PR̄ e CLR̄)',
  short: 'FF D',
  badge: '2× FF D',
  pins: 14,
  gates: [],
  seq: {
    sincronas: [2, 3, 12, 11], // 1D, 1CLK, 2D, 2CLK
    assincronas: [1, 4, 13, 10], // 1CLR̄, 1PR̄, 2CLR̄, 2PR̄
    clocks: [3, 11],
    saidas: [5, 6, 9, 8], // 1Q, 1Q̄, 2Q, 2Q̄
    bits: 2,
    saida: (e, a) => [...saidaComPrClr(e[0], a[0], a[1]), ...saidaComPrClr(e[1], a[2], a[3])],
    proximo: (e, s, a, b) =>
      [0, 1].map((i) => forcado(a[2 * i], a[2 * i + 1]) ?? (b[i] ? nivel(s[2 * i]) : e[i])),
  },
  vcc: 14,
  gnd: 7,
  pinLabels: rotulos(['1CLR', '1D', '1CLK', '1PR', '1Q', '1Q̄', 'GND', '2Q̄', '2Q', '2PR', '2CLK', '2D', '2CLR', 'VCC']),
}

export const CHIP_7476: ChipDef = {
  id: '7476',
  title: '2× flip-flop JK (borda de descida, PR̄ e CLR̄)',
  short: 'FF JK',
  badge: '2× FF JK',
  pins: 16,
  gates: [],
  seq: {
    sincronas: [4, 16, 1, 9, 12, 6], // 1J, 1K, 1CLK, 2J, 2K, 2CLK
    assincronas: [3, 2, 8, 7], // 1CLR̄, 1PR̄, 2CLR̄, 2PR̄
    clocks: [1, 6],
    bordaDescida: true,
    saidas: [15, 14, 11, 10], // 1Q, 1Q̄, 2Q, 2Q̄
    bits: 2,
    saida: (e, a) => [...saidaComPrClr(e[0], a[0], a[1]), ...saidaComPrClr(e[1], a[2], a[3])],
    proximo: (e, s, a, b) =>
      [0, 1].map((i) => forcado(a[2 * i], a[2 * i + 1]) ?? (b[i] ? jk(e[i], s[3 * i], s[3 * i + 1]) : e[i])),
  },
  // o 7476 tem VCC e GND no meio das fileiras, não nos cantos: pegadinha de bancada
  vcc: 5,
  gnd: 13,
  pinLabels: rotulos([
    '1CLK', '1PR', '1CLR', '1J', 'VCC', '2CLK', '2PR', '2CLR',
    '2J', '2Q̄', '2Q', '2K', 'GND', '1Q̄', '1Q', '1K',
  ]),
}

/** Bits de QA (peso 1) a QD (peso 8) como número, ou null se algum for indefinido. */
function valor(bits: Bit[]): number | null {
  if (bits.some((b) => b === 'X')) return null
  return bits.reduce<number>((acc, b, i) => acc + (b as number) * 2 ** i, 0)
}

export const CHIP_74161: ChipDef = {
  id: '74161',
  title: 'Contador binário síncrono de 4 bits (carga e limpar)',
  short: 'CONT 4b',
  badge: 'CONT 4 bits',
  pins: 16,
  gates: [],
  seq: {
    sincronas: [3, 4, 5, 6, 7, 9, 2], // A, B, C, D, ENP, LOAD̄, CLK
    assincronas: [1, 10], // CLR̄, ENT (ENT também libera o vai-um RCO na hora)
    clocks: [2],
    saidas: [14, 13, 12, 11, 15], // QA, QB, QC, QD, RCO
    bits: 4,
    saida: (e, a) => {
      if (ativoEmZero(a[0])) return [0, 0, 0, 0, 0]
      const v = valor(e)
      const ent = ttl(a[1])
      const rco: Signal = ent === 0 ? 0 : v === null || ent !== 1 ? 'X' : v === 15 ? 1 : 0
      return [...e, rco]
    },
    proximo: (e, s, a, b) => {
      if (ativoEmZero(a[0])) return [0, 0, 0, 0]
      if (!b[0]) return e
      // carga síncrona tem prioridade sobre a contagem
      if (ativoEmZero(s[5])) return s.slice(0, 4).map(nivel)
      const enp = ttl(s[4])
      const ent = ttl(a[1])
      if (enp === 0 || ent === 0) return e
      const v = valor(e)
      if (v === null || enp !== 1 || ent !== 1) return ['X', 'X', 'X', 'X']
      const n = (v + 1) % 16
      return [0, 1, 2, 3].map((i) => ((n >> i) & 1) as Bit)
    },
  },
  vcc: 16,
  gnd: 8,
  pinLabels: rotulos(['CLR', 'CLK', 'A', 'B', 'C', 'D', 'ENP', 'GND', 'LOAD', 'ENT', 'RCO', 'QD', 'QC', 'QB', 'QA', 'VCC']),
}

export const CHIP_74164: ChipDef = {
  id: '74164',
  title: 'Registrador de deslocamento de 8 bits (entrada serial, saídas paralelas)',
  short: 'DESL 8b',
  badge: 'DESL 8 bits',
  pins: 14,
  gates: [],
  seq: {
    sincronas: [1, 2, 8], // A, B, CLK
    assincronas: [9], // CLR̄
    clocks: [8],
    saidas: [3, 4, 5, 6, 10, 11, 12, 13], // QA ... QH
    bits: 8,
    saida: (e, a) => (ativoEmZero(a[0]) ? Array(8).fill(0) : [...e]),
    proximo: (e, s, a, b) => {
      if (ativoEmZero(a[0])) return Array(8).fill(0)
      if (!b[0]) return e
      // a entrada serial é A·B: com uma das duas em 0 entra 0
      const ab = nivel(s[0]) === 0 || nivel(s[1]) === 0 ? 0 : nivel(s[0]) === 1 && nivel(s[1]) === 1 ? 1 : 'X'
      return [ab, ...e.slice(0, 7)]
    },
  },
  vcc: 14,
  gnd: 7,
  pinLabels: rotulos(['A', 'B', 'QA', 'QB', 'QC', 'QD', 'GND', 'CLK', 'CLR', 'QE', 'QF', 'QG', 'QH', 'VCC']),
}
