// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Pinos de entrada/saída incluindo CIs — camada acima de types.ts, que não
// pode conhecer os chips (evita import circular types ⇄ ics).

import { chipOf } from './ics'
import { bitsDe, inputPins, isSeq, isSink, type CircuitComponent } from './types'

/** Todos os pinos que RECEBEM sinal (CIs: entradas das portas/função + VCC + GND). */
export function allInputPins(c: CircuitComponent): string[] {
  if (c.type === 'IC') {
    const def = chipOf(c)
    const pins = def.gates.flatMap((g) => g.inputs.map((n) => `p${n}`))
    if (def.func) pins.push(...def.func.inputs.map((n) => `p${n}`))
    if (def.seq) pins.push(...[...def.seq.sincronas, ...def.seq.assincronas].map((n) => `p${n}`))
    pins.push(`p${def.gnd}`, `p${def.vcc}`)
    return pins
  }
  return inputPins(c)
}

/** Todos os pinos que EMITEM sinal (CIs: saídas das portas/função). */
export function allOutputPins(c: CircuitComponent): string[] {
  if (c.type === 'IC') {
    const def = chipOf(c)
    const pins = def.gates.map((g) => `p${g.output}`)
    if (def.func) pins.push(...def.func.outputs.map((n) => `p${n}`))
    if (def.seq) pins.push(...def.seq.saidas.map((n) => `p${n}`))
    return pins
  }
  if (isSink(c.type) || c.type === 'LABEL') return []
  if (isSeq(c.type)) return ['q', 'qn']
  if (c.type === 'DIP_SWITCH') return Array.from({ length: bitsDe(c) }, (_, i) => `out${i}`)
  // contador: do bit mais alto (em cima) para o mais baixo
  if (c.type === 'COUNTER') return Array.from({ length: bitsDe(c) }, (_, i) => `q${bitsDe(c) - 1 - i}`)
  return ['out'] // fontes e portas
}
