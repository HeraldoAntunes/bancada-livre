// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Avaliação ternária das portas lógicas (spec §3.2).
// Regra: valor já conhecido que determina a saída vence o X
// (ex.: AND com uma entrada 0 → 0 mesmo com a outra X). Erro (E) sempre propaga.

import type { GateType, Signal } from './types'

function hasError(ins: Signal[]): boolean {
  return ins.some((s) => s === 'E')
}

function and(ins: Signal[]): Signal {
  if (hasError(ins)) return 'E'
  if (ins.some((s) => s === 0)) return 0
  if (ins.every((s) => s === 1)) return 1
  return 'X'
}

function or(ins: Signal[]): Signal {
  if (hasError(ins)) return 'E'
  if (ins.some((s) => s === 1)) return 1
  if (ins.every((s) => s === 0)) return 0
  return 'X'
}

function xor(ins: Signal[]): Signal {
  if (hasError(ins)) return 'E'
  if (ins.some((s) => s === 'X')) return 'X'
  return ins.filter((s) => s === 1).length % 2 === 1 ? 1 : 0
}

function invert(s: Signal): Signal {
  if (s === 0) return 1
  if (s === 1) return 0
  return s
}

export function evalGate(type: GateType, ins: Signal[]): Signal {
  switch (type) {
    case 'NOT':
      return invert(ins[0] ?? 'X')
    case 'BUFFER':
      return ins[0] ?? 'X'
    case 'AND':
      return and(ins)
    case 'OR':
      return or(ins)
    case 'NAND':
      return invert(and(ins))
    case 'NOR':
      return invert(or(ins))
    case 'XOR':
      return xor(ins)
    case 'XNOR':
      return invert(xor(ins))
  }
}

/** Expressão booleana curta da porta, para exibição didática. */
export function gateExpression(type: GateType): string {
  switch (type) {
    case 'NOT':
      return 'S = ¬A'
    case 'BUFFER':
      return 'S = A'
    case 'AND':
      return 'S = A · B'
    case 'OR':
      return 'S = A + B'
    case 'NAND':
      return 'S = ¬(A · B)'
    case 'NOR':
      return 'S = ¬(A + B)'
    case 'XOR':
      return 'S = A ⊕ B'
    case 'XNOR':
      return 'S = ¬(A ⊕ B)'
  }
}
