// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Núcleo do simulador — modelo de dados e tipos de sinal.
// Esta camada não conhece a UI.

/** Valor de sinal em um fio/pino. Ternário + condição de erro. */
export type Signal = 0 | 1 | 'X' | 'E'

export const GATE_TYPES = ['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUFFER'] as const
export type GateType = (typeof GATE_TYPES)[number]

export const SOURCE_TYPES = ['SWITCH', 'CLOCK', 'LEVEL_HIGH', 'LEVEL_LOW', 'PUSH_BUTTON', 'DIP_SWITCH', 'COUNTER'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const SINK_TYPES = ['LED', 'DISPLAY', 'PROBE', 'LED_BAR'] as const
export type SinkType = (typeof SINK_TYPES)[number]

/**
 * Elementos de memória (desde a 2.0): flip-flops disparados na borda de subida do clock, com PR e CLR
 * assíncronos, e a trava D, transparente enquanto EN = 1. Guardam o próprio estado em `q`.
 */
export const SEQ_TYPES = ['FF_D', 'FF_JK', 'FF_T', 'FF_SR', 'LATCH_D'] as const
export type SeqType = (typeof SEQ_TYPES)[number]

/**
 * 'IC' = circuito integrado 74xx; o campo `chip` identifica o modelo.
 * 'LABEL' = rótulo de texto livre para anotar o circuito (sem pinos, fora da simulação).
 */
export type ComponentType = GateType | SourceType | SinkType | SeqType | 'IC' | 'LABEL'

/** Cor do LED (opcional no arquivo; sem o campo, azul). */
export const CORES_LED = ['azul', 'vermelho', 'verde', 'amarelo'] as const
export type CorLed = (typeof CORES_LED)[number]

/** Modo do display de 7 segmentos. */
export type DisplayMode = 'bcd' | 'hex' | 'raw'

export interface CircuitComponent {
  id: string
  type: ComponentType
  x: number
  y: number
  label?: string
  /** Estado atual de fontes interativas (SWITCH, PUSH_BUTTON). */
  state?: 0 | 1
  /** Fan-in de portas multi-entrada (2 a 8). */
  inputs?: number
  /** Modo do DISPLAY: bcd (0–9), hex (0–F) ou raw (a–g). */
  mode?: DisplayMode
  /** Frequência do CLOCK em Hz (padrão 1). */
  freq?: number
  /** Modelo do CI (tipo 'IC'): '7400', '7408'… — ver engine/ics.ts. */
  chip?: string
  /** Desenho espelhado: entradas à direita, saída à esquerda (opcional, desde a 1.0). */
  espelhado?: boolean
  /** Giro no sentido horário, em graus (opcional, desde a 1.0). */
  giro?: 0 | 90 | 180 | 270
  /** Cor do LED (opcional, desde a 1.0; sem o campo, azul). */
  cor?: CorLed
  /**
   * Posições do banco de chaves ou LEDs da barra (4 ou 8; sem o campo, 4) e bits do contador
   * (2, 3 ou 4; sem o campo, 2). Opcional, desde a 1.0.
   */
  bits?: number
  /** Estado de cada posição do banco de chaves, de cima para baixo (opcional, desde a 1.0). */
  estados?: (0 | 1)[]
  /** Valor atual do contador (opcional, desde a 1.0; sem o campo, 0). */
  contagem?: number
  /** Estado guardado do flip-flop ou da trava (opcional, desde a 2.0; sem o campo, 0). */
  q?: 0 | 1 | 'X'
  /** Último nível visto na entrada de clock, para achar a borda de subida (opcional, desde a 2.0). */
  clkVisto?: 0 | 1
  /** Estado guardado de um CI sequencial (7474, 7476, 74161, 74164), um item por bit (opcional, desde a 2.0). */
  estadoCi?: (0 | 1 | 'X')[]
  /** Último nível visto em cada clock do CI sequencial, na ordem da folha de dados (opcional, desde a 2.0). */
  clksVistos?: (0 | 1)[]
}

export interface PinRef {
  comp: string
  pin: string
}

export interface Wire {
  id: string
  /** Sempre um pino de SAÍDA. */
  from: PinRef
  /** Sempre um pino de ENTRADA. */
  to: PinRef
}

export interface Circuit {
  version: 1
  meta?: { titulo?: string; autor?: string; criadoEm?: string }
  components: CircuitComponent[]
  wires: Wire[]
}

export function isGate(t: ComponentType): t is GateType {
  return (GATE_TYPES as readonly string[]).includes(t)
}

/** Portas de uma entrada só (NOT e BUFFER): sem escolha de fan-in. */
export function entradaUnica(t: ComponentType): boolean {
  return t === 'NOT' || t === 'BUFFER'
}

/** Número de posições do banco de chaves, de LEDs da barra ou de bits do contador. */
export function bitsDe(c: CircuitComponent): number {
  return c.bits ?? (c.type === 'COUNTER' ? 2 : 4)
}

/** Valores aceitos de `bits` em cada tipo. */
export function bitsPermitidos(t: ComponentType): number[] {
  return t === 'COUNTER' ? [2, 3, 4] : [4, 8]
}

export function isSeq(t: ComponentType): t is SeqType {
  return (SEQ_TYPES as readonly string[]).includes(t)
}

/**
 * Entradas de um elemento de memória que só valem na borda do clock (ou com EN = 1 na trava). PR e CLR ficam de
 * fora: agem na hora, sem esperar o clock.
 */
export function entradasSincronas(t: SeqType): string[] {
  switch (t) {
    case 'FF_D':
      return ['d', 'clk']
    case 'FF_JK':
      return ['j', 'clk', 'k']
    case 'FF_T':
      return ['t', 'clk']
    case 'FF_SR':
      return ['s', 'clk', 'r']
    case 'LATCH_D':
      return ['d', 'en']
  }
}

/** Entradas assíncronas: a trava D não tem. */
export function entradasAssincronas(t: SeqType): string[] {
  return t === 'LATCH_D' ? [] : ['pr', 'clr']
}

export function isSource(t: ComponentType): t is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(t)
}

export function isSink(t: ComponentType): t is SinkType {
  return (SINK_TYPES as readonly string[]).includes(t)
}

/** Número de pinos de entrada de um componente (CIs: usar engine/pins.ts). */
export function inputCount(c: CircuitComponent): number {
  if (isSeq(c.type)) return entradasSincronas(c.type).length + entradasAssincronas(c.type).length
  if (isSource(c.type) || c.type === 'IC' || c.type === 'LABEL') return 0
  if (c.type === 'LED' || c.type === 'PROBE') return 1
  if (c.type === 'DISPLAY') return c.mode === 'raw' ? 7 : 4
  if (c.type === 'LED_BAR') return bitsDe(c)
  if (entradaUnica(c.type)) return 1
  return c.inputs ?? 2
}

/** Nomes dos pinos de entrada de um componente (CIs: usar engine/pins.ts). */
export function inputPins(c: CircuitComponent): string[] {
  if (c.type === 'IC' || c.type === 'LABEL') return []
  if (c.type === 'LED' || c.type === 'PROBE') return ['in']
  if (isSeq(c.type)) return [...entradasSincronas(c.type), ...entradasAssincronas(c.type)]
  return Array.from({ length: inputCount(c) }, (_, i) => `in${i}`)
}

/** Chave única de um pino no circuito. */
export function pinKey(comp: string, pin: string): string {
  return `${comp}:${pin}`
}
