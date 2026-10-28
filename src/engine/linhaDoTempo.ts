// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Linha do tempo dos sinais (diagrama de tempo): quais sinais acompanhar e o valor de cada um num momento.
// Cada amostra é um momento em que algum sinal acompanhado mudou; o desenho põe as amostras lado a lado.

import { allOutputPins } from './pins'
import { simulate, type SimResult } from './simulate'
import { inputPins, isSeq, pinKey, type CircuitComponent, type Signal, type Wire } from './types'

export interface SinalObservado {
  /** Pino lido (`comp:pin`). */
  chave: string
  /** Nome mostrado na linha (o rótulo do componente, com o pino quando há mais de um). */
  nome: string
}

export type Amostra = Record<string, Signal>

/** Mais linhas que isso não cabem para ler na tela do projetor. */
export const MAX_SINAIS = 16
/** Amostras guardadas: as mais antigas saem pela esquerda. */
export const MAX_AMOSTRAS = 64

/**
 * Sinais acompanhados, na ordem em que aparecem: clocks, depois as outras entradas, o estado guardado de cada
 * flip-flop e por fim as saídas (LEDs, sondas e barras). CIs ficam de fora: o que sai deles chega a um LED.
 */
export function sinaisObservados(components: CircuitComponent[]): SinalObservado[] {
  const nome = (c: CircuitComponent) => c.label || c.id
  const clocks: SinalObservado[] = []
  const entradas: SinalObservado[] = []
  const memoria: SinalObservado[] = []
  const saidas: SinalObservado[] = []
  for (const c of components) {
    if (c.type === 'CLOCK') clocks.push({ chave: pinKey(c.id, 'out'), nome: nome(c) })
    else if (c.type === 'SWITCH' || c.type === 'PUSH_BUTTON') entradas.push({ chave: pinKey(c.id, 'out'), nome: nome(c) })
    else if (c.type === 'COUNTER' || c.type === 'DIP_SWITCH') {
      for (const p of allOutputPins(c)) entradas.push({ chave: pinKey(c.id, p), nome: `${nome(c)}.${p.toUpperCase()}` })
    } else if (isSeq(c.type)) memoria.push({ chave: pinKey(c.id, 'q'), nome: `${nome(c)}.Q` })
    else if (c.type === 'LED' || c.type === 'PROBE') saidas.push({ chave: pinKey(c.id, 'in'), nome: nome(c) })
    else if (c.type === 'LED_BAR') {
      inputPins(c).forEach((p, i) => saidas.push({ chave: pinKey(c.id, p), nome: `${nome(c)}${i}` }))
    }
  }
  return [...clocks, ...entradas, ...memoria, ...saidas].slice(0, MAX_SINAIS)
}

/** Valor de cada sinal acompanhado agora. */
export function amostrar(components: CircuitComponent[], wires: Wire[], sim?: SimResult): Amostra {
  const s = sim ?? simulate(components, wires)
  const a: Amostra = {}
  for (const { chave } of sinaisObservados(components)) a[chave] = s.pins.get(chave) ?? 'X'
  return a
}

/** Acrescenta a amostra se algum valor mudou desde a última, descartando as mais antigas. */
export function acrescentar(amostras: Amostra[], nova: Amostra): Amostra[] {
  const ultima = amostras[amostras.length - 1]
  if (ultima && Object.keys(nova).length === Object.keys(ultima).length && Object.keys(nova).every((k) => ultima[k] === nova[k])) {
    return amostras
  }
  const lista = [...amostras, nova]
  return lista.length > MAX_AMOSTRAS ? lista.slice(lista.length - MAX_AMOSTRAS) : lista
}
