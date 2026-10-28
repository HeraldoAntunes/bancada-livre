// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// CIs didáticos da série 74xx — definições com pinagem REAL.
// A pinagem é a fonte da verdade: vem dos datasheets (vista superior, pino 1
// à esquerda do chanfro, numeração anti-horária).
// Dois tipos de chip: de PORTAS (coleção de portas independentes) e de FUNÇÃO
// (bloco único, ex.: decodificador 7448).

import { DIGIT_SEGMENTS } from './display'
import { pinKey, type CircuitComponent, type GateType, type Signal } from './types'
import { CHIP_7474, CHIP_7476, CHIP_74161, CHIP_74164, type ChipSeq } from './icsSequenciais'

export type ChipId =
  | '7400'
  | '7402'
  | '7404'
  | '7408'
  | '7432'
  | '7486'
  | '7448'
  | '74138'
  | '74151'
  | '74283'
  | '7474'
  | '7476'
  | '74161'
  | '74164'

export interface ChipGate {
  type: GateType
  /** Números dos pinos de entrada (reais). */
  inputs: number[]
  /** Número do pino de saída (real). */
  output: number
}

export interface ChipFunc {
  /** Pinos de entrada lógica, na ordem esperada por `evaluate`. */
  inputs: number[]
  /** Pinos de saída, na ordem produzida por `evaluate`. */
  outputs: number[]
  evaluate: (ins: Signal[]) => Signal[]
}

export interface ChipDef {
  id: ChipId
  /** Função, ex.: "4× NAND de 2 entradas". */
  title: string
  /** Sufixo curto para a paleta (ex.: "NAND", "BCD→7seg"). */
  short: string
  /** Legenda impressa no corpo (ex.: "4× NAND"). */
  badge: string
  /** Total de pinos do encapsulamento (14 ou 16). */
  pins: number
  /** Portas independentes (chips de portas); vazio nos chips de função. */
  gates: ChipGate[]
  /** Bloco de função única (ex.: decodificador). */
  func?: ChipFunc
  /** Parte sequencial (flip-flops, contador, registrador), desde a 2.0. */
  seq?: ChipSeq
  vcc: number
  gnd: number
  /** Rótulo de cada pino (1 → "1A", 14 → "VCC"…). */
  pinLabels: Record<number, string>
}

function labelsOf(gates: ChipGate[], vcc: number, gnd: number): Record<number, string> {
  const labels: Record<number, string> = { [vcc]: 'VCC', [gnd]: 'GND' }
  gates.forEach((g, i) => {
    const n = i + 1
    if (g.inputs.length === 1) {
      labels[g.inputs[0]] = `${n}A`
    } else {
      labels[g.inputs[0]] = `${n}A`
      labels[g.inputs[1]] = `${n}B`
    }
    labels[g.output] = `${n}Y`
  })
  return labels
}

/** Quádrupla de 2 entradas: [inA, inB, out] por porta. */
function quad(id: ChipId, type: GateType, title: string, pins: [number, number, number][]): ChipDef {
  const gates = pins.map(([a, b, y]) => ({ type, inputs: [a, b], output: y }))
  return {
    id,
    title,
    short: type,
    badge: `4× ${type}`,
    pins: 14,
    gates,
    vcc: 14,
    gnd: 7,
    pinLabels: labelsOf(gates, 14, 7),
  }
}

// ---- 7448: decodificador BCD → 7 segmentos (saídas ativas em nível ALTO) ----
// Pinagem real (DIP-16): B=1, C=2, LT=3, BI/RBO=4, RBI=5, D=6, A=7, GND=8,
// e=9, d=10, c=11, b=12, a=13, g=14, f=15, VCC=16.
// Simplificação didática fiel ao TTL: entrada desconectada "flutua" em 1 —
// por isso LT/RBI/BI podem ficar soltos para operação normal.

/** Entrada de controle TTL: solta (X) flutua em 1, como no chip real (mesma regra do 7448). */
const ttl = (v: Signal): Signal => (v === 'X' ? 1 : v)

const SEG_OFF: Signal[] = Array(7).fill(0)

function eval7448(ins: Signal[]): Signal[] {
  // ordem: [A, B, C, D, LT, RBI, BI]
  if (ins.some((v) => v === 'E')) return Array(7).fill('E')
  const lt = ttl(ins[4])
  const rbi = ttl(ins[5])
  const bi = ttl(ins[6])
  if (bi === 0) return [...SEG_OFF] // blanking domina
  if (lt === 0) return Array(7).fill(1) // teste de lâmpada: tudo aceso
  const data = ins.slice(0, 4)
  if (data.some((v) => v === 'X')) return Array(7).fill('X')
  const value =
    (data[3] === 1 ? 8 : 0) + (data[2] === 1 ? 4 : 0) + (data[1] === 1 ? 2 : 0) + (data[0] === 1 ? 1 : 0)
  if (rbi === 0 && value === 0) return [...SEG_OFF] // apagamento do zero (ripple blanking)
  if (value > 9) return [...SEG_OFF] // didático: o chip real mostra padrões parciais
  return [...DIGIT_SEGMENTS[value]].map((ch) => (ch === '1' ? 1 : 0) as Signal)
}

const CHIP_7448: ChipDef = {
  id: '7448',
  title: 'Decodificador BCD → 7 segmentos (catodo comum)',
  short: 'BCD→7seg',
  badge: 'BCD → 7 seg',
  pins: 16,
  gates: [],
  func: {
    inputs: [7, 1, 2, 6, 3, 5, 4], // A, B, C, D, LT, RBI, BI
    outputs: [13, 12, 11, 10, 9, 15, 14], // a, b, c, d, e, f, g
    evaluate: eval7448,
  },
  vcc: 16,
  gnd: 8,
  pinLabels: {
    1: 'B',
    2: 'C',
    3: 'LT',
    4: 'BI',
    5: 'RBI',
    6: 'D',
    7: 'A',
    8: 'GND',
    9: 'e',
    10: 'd',
    11: 'c',
    12: 'b',
    13: 'a',
    14: 'g',
    15: 'f',
    16: 'VCC',
  },
}

/** Rótulos dos pinos 1 a 16, na ordem do desenho do datasheet. */
function rotulos(nomes: string[]): Record<number, string> {
  return Object.fromEntries(nomes.map((n, i) => [i + 1, n]))
}

/** Valor binário de bits [peso 1, peso 2, ...]; null se algum não for 0 ou 1. */
function valorDe(bits: Signal[]): number | null {
  if (bits.some((b) => b !== 0 && b !== 1)) return null
  return bits.reduce<number>((soma, b, i) => soma + (b === 1 ? 2 ** i : 0), 0)
}

// ---- 74138: decodificador 3 → 8 (saídas ativas em nível BAIXO) ----
// Pinagem real (DIP-16, TI SDLS014): A=1, B=2, C=3, G2A=4, G2B=5, G1=6, Y7=7, GND=8,
// Y6=9, Y5=10, Y4=11, Y3=12, Y2=13, Y1=14, Y0=15, VCC=16.
// Habilitado com G1 = 1, G2A = 0 e G2B = 0; desabilitado, todas as saídas ficam em 1.
function eval74138(ins: Signal[]): Signal[] {
  // ordem: [A, B, C, G1, G2A, G2B]
  if (ins.some((v) => v === 'E')) return Array(8).fill('E')
  const habilitado = ttl(ins[3]) === 1 && ttl(ins[4]) === 0 && ttl(ins[5]) === 0
  if (!habilitado) return Array(8).fill(1)
  const v = valorDe(ins.slice(0, 3))
  if (v === null) return Array(8).fill('X')
  return Array.from({ length: 8 }, (_, k) => (k === v ? 0 : 1) as Signal)
}

const CHIP_74138: ChipDef = {
  id: '74138',
  title: 'Decodificador 3 → 8 (saídas ativas em nível baixo)',
  short: 'DEC 3→8',
  badge: 'DEC 3 → 8',
  pins: 16,
  gates: [],
  func: {
    inputs: [1, 2, 3, 6, 4, 5], // A, B, C, G1, G2A, G2B
    outputs: [15, 14, 13, 12, 11, 10, 9, 7], // Y0 ... Y7
    evaluate: eval74138,
  },
  vcc: 16,
  gnd: 8,
  pinLabels: rotulos(['A', 'B', 'C', 'G2A', 'G2B', 'G1', 'Y7', 'GND', 'Y6', 'Y5', 'Y4', 'Y3', 'Y2', 'Y1', 'Y0', 'VCC']),
}

// ---- 74151: multiplexador 8 → 1 (seletor de dados) ----
// Pinagem real (DIP-16, TI SDLS054): D3=1, D2=2, D1=3, D0=4, Y=5, W=6, G=7, GND=8,
// C=9, B=10, A=11, D7=12, D6=13, D5=14, D4=15, VCC=16.
// G (strobe) ativo em 0: com G = 1, Y = 0 e W = 1. W é sempre o inverso de Y.
function eval74151(ins: Signal[]): Signal[] {
  // ordem: [D0 ... D7, A, B, C, G]
  if (ins.some((v) => v === 'E')) return ['E', 'E']
  if (ttl(ins[11]) === 1) return [0, 1]
  const sel = valorDe(ins.slice(8, 11))
  if (sel === null) return ['X', 'X']
  const d = ins[sel]
  if (d === 'X') return ['X', 'X']
  return [d, d === 1 ? 0 : 1]
}

const CHIP_74151: ChipDef = {
  id: '74151',
  title: 'Multiplexador 8 → 1 (seletor de dados)',
  short: 'MUX 8→1',
  badge: 'MUX 8 → 1',
  pins: 16,
  gates: [],
  func: {
    inputs: [4, 3, 2, 1, 15, 14, 13, 12, 11, 10, 9, 7], // D0 ... D7, A, B, C, G
    outputs: [5, 6], // Y, W
    evaluate: eval74151,
  },
  vcc: 16,
  gnd: 8,
  pinLabels: rotulos(['D3', 'D2', 'D1', 'D0', 'Y', 'W', 'G', 'GND', 'C', 'B', 'A', 'D7', 'D6', 'D5', 'D4', 'VCC']),
}

// ---- 74283: somador binário completo de 4 bits ----
// Pinagem real (DIP-16, TI SDLS095A): Σ2=1, B2=2, A2=3, Σ1=4, A1=5, B1=6, C0=7, GND=8,
// C4=9, Σ4=10, B4=11, A4=12, Σ3=13, A3=14, B3=15, VCC=16.
// C0 é dado (vem-um), não controle: solto, a soma fica indefinida, e o aluno liga C0 no 0.
function eval74283(ins: Signal[]): Signal[] {
  // ordem: [A1 ... A4, B1 ... B4, C0]
  if (ins.some((v) => v === 'E')) return Array(5).fill('E')
  const a = valorDe(ins.slice(0, 4))
  const b = valorDe(ins.slice(4, 8))
  const c0 = valorDe([ins[8]])
  if (a === null || b === null || c0 === null) return Array(5).fill('X')
  const total = a + b + c0
  return Array.from({ length: 5 }, (_, i) => ((total >> i) & 1) as Signal)
}

const CHIP_74283: ChipDef = {
  id: '74283',
  title: 'Somador binário completo de 4 bits',
  short: 'SOMA 4b',
  badge: 'SOMA 4 bits',
  pins: 16,
  gates: [],
  func: {
    inputs: [5, 3, 14, 12, 6, 2, 15, 11, 7], // A1 ... A4, B1 ... B4, C0
    outputs: [4, 1, 13, 10, 9], // Σ1 ... Σ4, C4
    evaluate: eval74283,
  },
  vcc: 16,
  gnd: 8,
  pinLabels: rotulos(['Σ2', 'B2', 'A2', 'Σ1', 'A1', 'B1', 'C0', 'GND', 'C4', 'Σ4', 'B4', 'A4', 'Σ3', 'A3', 'B3', 'VCC']),
}

export const CHIPS: Record<ChipId, ChipDef> = {
  // 7400/7408/7432/7486 compartilham o arranjo A,B→Y
  '7400': quad('7400', 'NAND', '4× NAND de 2 entradas', [
    [1, 2, 3],
    [4, 5, 6],
    [9, 10, 8],
    [12, 13, 11],
  ]),
  // ⚠ 7402: a saída vem ANTES das entradas — pegadinha clássica de bancada
  '7402': quad('7402', 'NOR', '4× NOR de 2 entradas', [
    [2, 3, 1],
    [5, 6, 4],
    [8, 9, 10],
    [11, 12, 13],
  ]),
  '7404': (() => {
    const pairs: [number, number][] = [
      [1, 2],
      [3, 4],
      [5, 6],
      [9, 8],
      [11, 10],
      [13, 12],
    ]
    const gates = pairs.map(([a, y]) => ({ type: 'NOT' as GateType, inputs: [a], output: y }))
    return {
      id: '7404' as ChipId,
      title: '6× NOT (hex inverter)',
      short: 'NOT',
      badge: '6× NOT',
      pins: 14,
      gates,
      vcc: 14,
      gnd: 7,
      pinLabels: labelsOf(gates, 14, 7),
    }
  })(),
  '7408': quad('7408', 'AND', '4× AND de 2 entradas', [
    [1, 2, 3],
    [4, 5, 6],
    [9, 10, 8],
    [12, 13, 11],
  ]),
  '7432': quad('7432', 'OR', '4× OR de 2 entradas', [
    [1, 2, 3],
    [4, 5, 6],
    [9, 10, 8],
    [12, 13, 11],
  ]),
  '7486': quad('7486', 'XOR', '4× XOR de 2 entradas', [
    [1, 2, 3],
    [4, 5, 6],
    [9, 10, 8],
    [12, 13, 11],
  ]),
  '7448': CHIP_7448,
  '74138': CHIP_74138,
  '74151': CHIP_74151,
  '74283': CHIP_74283,
  '7474': CHIP_7474,
  '7476': CHIP_7476,
  '74161': CHIP_74161,
  '74164': CHIP_74164,
}

export const CHIP_IDS = Object.keys(CHIPS) as ChipId[]

export function chipOf(c: CircuitComponent): ChipDef {
  return CHIPS[(c.chip ?? '7400') as ChipId] ?? CHIPS['7400']
}

/** Um CI está alimentado quando VCC = 1 e GND = 0. */
export function icPowered(c: CircuitComponent, pins: Map<string, Signal>): boolean {
  const def = chipOf(c)
  return pins.get(pinKey(c.id, `p${def.vcc}`)) === 1 && pins.get(pinKey(c.id, `p${def.gnd}`)) === 0
}
