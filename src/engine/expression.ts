// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Expressão booleana por soma de mintermos (RF-06.4), derivada da tabela-verdade.
// Notação didática: A' = negado, · = E, + = OU.

import type { CircuitTable } from './truthTable'

/**
 * Expressão da coluna de saída `outIndex` da tabela do circuito.
 * Retorna null quando não é viável: saída de DISPLAY (valor não-booleano)
 * ou alguma linha com X/E.
 */
export function mintermExpression(table: CircuitTable, outIndex: number): string | null {
  const out = table.outputs[outIndex]
  if (!out || out.comp.type === 'DISPLAY') return null
  if (table.rows.length === 0) return null
  const names = table.inputs.map((c) => c.name)
  const terms: string[] = []
  for (const r of table.rows) {
    const v = r.outputs[outIndex]
    if (v !== 0 && v !== 1) return null // X, E ou dígito: não viável
    if (v === 1) {
      terms.push(r.inputs.map((b, i) => (b === 1 ? names[i] : `${names[i]}'`)).join('·'))
    }
  }
  if (terms.length === 0) return '0'
  if (terms.length === table.rows.length) return '1'
  return terms.join(' + ')
}
