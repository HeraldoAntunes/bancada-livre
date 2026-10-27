// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Geração de tabelas-verdade (spec §4.6).

import { decodeDisplay, DIGIT_SEGMENTS } from './display'
import { evalGate } from './gates'
import { simulate } from './simulate'
import { allOutputPins } from './pins'
import {
  inputCount,
  inputPins,
  pinKey,
  type CircuitComponent,
  type GateType,
  type Signal,
  type Wire,
} from './types'

export interface GateTableRow {
  inputs: (0 | 1)[]
  output: Signal
}

/** Tabela-verdade estática de uma porta isolada (RF-06.1). */
export function gateTruthTable(type: GateType, n: number): GateTableRow[] {
  const rows: GateTableRow[] = []
  for (let m = 0; m < 1 << n; m++) {
    const inputs = Array.from({ length: n }, (_, i) => ((m >> (n - 1 - i)) & 1) as 0 | 1)
    rows.push({ inputs, output: evalGate(type, inputs) })
  }
  return rows
}

/**
 * Coluna da tabela do circuito: um componente inteiro (chave, LED, display, sonda) ou uma
 * posição dele (banco de chaves, barra de LEDs), que vira uma variável própria.
 */
export interface TableColumn {
  comp: CircuitComponent
  /** Pino lido (saídas) ou ligado (entradas). */
  pin: string
  /** Nome no cabeçalho e na expressão: o rótulo, mais o número da posição quando há várias. */
  name: string
  /** Chave de `simulate(…, overrides)` e de `applyInputs`: o id, ou `id:outN` para o banco. */
  key: string
}

/** Rótulo mais o número da posição (K1, K2…); com rótulo terminado em número, um ponto no meio (Y2.1). */
function nomeDaPosicao(c: CircuitComponent, i: number): string {
  const base = c.label ?? '?'
  return /\d$/.test(base) ? `${base}.${i + 1}` : `${base}${i + 1}`
}

/**
 * Colunas de entrada: cada chave ou botão, cada posição de cada banco de chaves e cada bit de cada contador
 * (do mais alto para o mais baixo, então as linhas seguem a contagem 0, 1, 2…).
 */
export function inputColumns(components: CircuitComponent[]): TableColumn[] {
  return components.flatMap((c): TableColumn[] => {
    if (c.type === 'SWITCH' || c.type === 'PUSH_BUTTON') {
      return [{ comp: c, pin: 'out', name: c.label ?? '?', key: c.id }]
    }
    if (c.type === 'DIP_SWITCH') {
      return allOutputPins(c).map((p, i) => ({ comp: c, pin: p, name: nomeDaPosicao(c, i), key: pinKey(c.id, p) }))
    }
    if (c.type === 'COUNTER') {
      return allOutputPins(c).map((p) => ({ comp: c, pin: p, name: `${c.label ?? '?'}.Q${p.slice(1)}`, key: pinKey(c.id, p) }))
    }
    return []
  })
}

/** Colunas de saída: cada LED, display e sonda, e cada LED de cada barra. */
export function outputColumns(components: CircuitComponent[]): TableColumn[] {
  return components.flatMap((c): TableColumn[] => {
    if (c.type === 'LED' || c.type === 'DISPLAY' || c.type === 'PROBE') {
      return [{ comp: c, pin: 'in', name: c.label ?? '?', key: c.id }]
    }
    if (c.type === 'LED_BAR') {
      return inputPins(c).map((p, i) => ({ comp: c, pin: p, name: nomeDaPosicao(c, i), key: pinKey(c.id, p) }))
    }
    return []
  })
}

/** Estado atual de uma coluna de entrada (para marcar a linha da tabela que está na bancada). */
export function estadoDaColuna(col: TableColumn): 0 | 1 {
  if (col.comp.type === 'DIP_SWITCH') return col.comp.estados?.[Number(col.pin.slice(3))] ?? 0
  if (col.comp.type === 'COUNTER') return (((col.comp.contagem ?? 0) >> Number(col.pin.slice(1))) & 1) as 0 | 1
  return col.comp.state ?? 0
}

export interface CircuitTable {
  /** Variáveis de entrada, na ordem das colunas. */
  inputs: TableColumn[]
  /** Saídas, na ordem das colunas. */
  outputs: TableColumn[]
  /** LED → Signal; DISPLAY → dígito ('0'–'F'), '—' apagado, 'X'/'E'. */
  rows: { inputs: (0 | 1)[]; outputs: (Signal | string)[] }[]
  /** true quando nº de entradas excede o limite e a tabela não foi gerada. */
  tooBig: boolean
}

/** Valor de célula de um DISPLAY na tabela do circuito. */
function displayCell(c: CircuitComponent, sim: ReturnType<typeof simulate>): string {
  const ins = inputPins(c).map((p) => sim.pins.get(pinKey(c.id, p)) ?? 'X')
  const d = decodeDisplay(c.mode ?? 'bcd', ins)
  if (d.error) return 'E'
  if ((c.mode ?? 'bcd') === 'raw') {
    // modo bruto: reconhece o dígito pelo padrão de segmentos (ex.: saída do 7448)
    const pattern = d.segments.map((s) => (s ? '1' : '0')).join('')
    if (pattern === '0000000') return '—'
    const idx = DIGIT_SEGMENTS.indexOf(pattern)
    return idx >= 0 ? idx.toString(16).toUpperCase() : '·'
  }
  if (d.floating) return 'X'
  return d.value === null ? '—' : d.value.toString(16).toUpperCase()
}

/**
 * Tabela-verdade do circuito completo (RF-06.2): varre as 2^n combinações
 * das fontes interativas e registra o valor visto por cada LED/DISPLAY.
 */
export function circuitTruthTable(
  components: CircuitComponent[],
  wires: Wire[],
  maxInputs = 8,
): CircuitTable {
  const inputs = inputColumns(components)
  const outputs = outputColumns(components)
  if (inputs.length === 0 || outputs.length === 0) {
    return { inputs, outputs, rows: [], tooBig: false }
  }
  if (inputs.length > maxInputs) {
    return { inputs, outputs, rows: [], tooBig: true }
  }
  const rows: CircuitTable['rows'] = []
  for (let m = 0; m < 1 << inputs.length; m++) {
    const bits = inputs.map((_, i) => ((m >> (inputs.length - 1 - i)) & 1) as 0 | 1)
    const overrides = new Map(inputs.map((c, i) => [c.key, bits[i]]))
    const sim = simulate(components, wires, overrides)
    rows.push({
      inputs: bits,
      outputs: outputs.map((o) =>
        o.comp.type === 'DISPLAY' ? displayCell(o.comp, sim) : (sim.pins.get(pinKey(o.comp.id, o.pin)) ?? 'X'),
      ),
    })
  }
  return { inputs, outputs, rows, tooBig: false }
}

/** Nº de entradas efetivo de um componente de porta (para a tabela da porta). */
export function gateArity(c: CircuitComponent): number {
  return inputCount(c)
}
