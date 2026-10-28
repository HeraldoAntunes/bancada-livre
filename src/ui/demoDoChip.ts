// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Circuito que o Guia de CIs carrega para cada chip (botão "Carregar exemplo" e comando guia.carregar_exemplo).
import { EXAMPLES } from '../examples'
import { CHIPS, type ChipId } from '../engine/ics'
import type { CircuitComponent, Wire } from '../engine/types'

/** Chips de função e sequenciais: a montagem da biblioteca de exemplos que o Guia carrega. */
const EXEMPLO_DO_CHIP: Partial<Record<ChipId, string>> = {
  '7448': 'Decodificador 7448 → Display',
  '74138': 'Decodificador 74138 → 8 LEDs',
  '74151': '74151 como gerador de função: maioria de 3',
  '74283': 'Somador de 4 bits com 74283',
  '7474': '7474: contador de 0 a 3 com dois flip-flops D',
  '7476': '7476: contador de 0 a 3 com JK',
  '74161': '74161: contador de 0 a F no display',
  '74164': '74164: registrador de 8 bits na barra de LEDs',
}

/** Circuito-demonstração gerado para qualquer chip: alimentação + porta 1 + LED. */
export function chipDemo(chip: ChipId): { components: CircuitComponent[]; wires: Wire[] } {
  const def = CHIPS[chip]
  if (def.func || def.seq) {
    const ex = EXAMPLES.find((e) => e.name === EXEMPLO_DO_CHIP[chip])
    if (ex) return structuredClone({ components: ex.components, wires: ex.wires })
  }
  const g = def.gates[0]
  const two = g.inputs.length === 2
  const components: CircuitComponent[] = [
    { id: 'e1', type: 'LEVEL_HIGH', x: 60, y: 30 },
    { id: 'e2', type: 'LEVEL_LOW', x: 60, y: 110 },
    { id: 'e3', type: 'SWITCH', x: 60, y: 210, state: 0, label: 'A' },
    ...(two ? [{ id: 'e4', type: 'SWITCH' as const, x: 60, y: 360, state: 0 as const, label: 'B' }] : []),
    { id: 'e5', type: 'IC', x: 320, y: 120, chip },
    { id: 'e6', type: 'LED', x: 560, y: 150, label: 'S' },
  ]
  const wires: Wire[] = [
    { id: 'f1', from: { comp: 'e1', pin: 'out' }, to: { comp: 'e5', pin: `p${def.vcc}` } },
    { id: 'f2', from: { comp: 'e2', pin: 'out' }, to: { comp: 'e5', pin: `p${def.gnd}` } },
    { id: 'f3', from: { comp: 'e3', pin: 'out' }, to: { comp: 'e5', pin: `p${g.inputs[0]}` } },
    ...(two
      ? [{ id: 'f4', from: { comp: 'e4', pin: 'out' }, to: { comp: 'e5', pin: `p${g.inputs[1]}` } }]
      : []),
    { id: 'f5', from: { comp: 'e5', pin: `p${g.output}` }, to: { comp: 'e6', pin: 'in' } },
  ]
  return { components, wires }
}

