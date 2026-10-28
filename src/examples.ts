// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Biblioteca de circuitos de exemplo graduada por nível.
// Ids numéricos ('e1', 'f1') para o store realinhar o contador ao carregar.

import type { CircuitComponent, ComponentType, GateType, Wire } from './engine/types'

const C = (
  id: string,
  type: ComponentType,
  x: number,
  y: number,
  extra: Partial<CircuitComponent> = {},
): CircuitComponent => ({ id, type, x, y, ...extra })

const W = (id: string, from: string, fromPin: string, to: string, toPin: string): Wire => ({
  id,
  from: { comp: from, pin: fromPin },
  to: { comp: to, pin: toPin },
})

export type ExampleLevel = 'Básico' | 'Intermediário' | 'Avançado' | 'Memória' | 'CIs'

export interface Example {
  name: string
  level: ExampleLevel
  components: CircuitComponent[]
  wires: Wire[]
}

/** Básico: chave(s) → porta → LED, uma para cada porta (primeira aula). */
function basicGate(type: GateType): Example {
  if (type === 'NOT' || type === 'BUFFER') {
    return {
      name: `Porta ${type}`,
      level: 'Básico',
      components: [
        C('e1', 'SWITCH', 60, 80, { state: 0, label: 'A' }),
        C('e2', type, 260, 86),
        C('e3', 'LED', 440, 60, { label: 'S' }),
      ],
      wires: [W('f1', 'e1', 'out', 'e2', 'in0'), W('f2', 'e2', 'out', 'e3', 'in')],
    }
  }
  return {
    name: `Porta ${type}`,
    level: 'Básico',
    components: [
      C('e1', 'SWITCH', 60, 40, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 60, 200, { state: 0, label: 'B' }),
      C('e3', type, 280, 96, { inputs: 2 }),
      C('e4', 'LED', 480, 70, { label: 'S' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 'in0'),
      W('f2', 'e2', 'out', 'e3', 'in1'),
      W('f3', 'e3', 'out', 'e4', 'in'),
    ],
  }
}

export const EXAMPLES: Example[] = [
  // ---------- BÁSICO ----------
  basicGate('AND'),
  basicGate('OR'),
  basicGate('NOT'),
  basicGate('BUFFER'),
  basicGate('NAND'),
  basicGate('NOR'),
  basicGate('XOR'),
  basicGate('XNOR'),
  {
    // Cada posição do banco acende o LED da mesma altura: o primeiro contato com 8 bits.
    name: 'Banco de chaves na barra de LEDs',
    level: 'Básico',
    components: [
      C('e1', 'DIP_SWITCH', 60, 40, { bits: 8, estados: [0, 0, 0, 0, 0, 0, 0, 0], label: 'K' }),
      C('e2', 'LED_BAR', 300, 50, { bits: 8, label: 'Y', cor: 'verde' }),
    ],
    wires: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => W(`f${i + 1}`, 'e1', `out${i}`, 'e2', `in${i}`)),
  },

  // ---------- INTERMEDIÁRIO ----------
  {
    // O contador gera 00, 01, 10, 11 sozinho; as portas escolhem o LED: verde, amarelo, vermelho (duas vezes).
    name: 'Semáforo com contador',
    level: 'Intermediário',
    components: [
      C('e1', 'COUNTER', 40, 140, { bits: 2, freq: 1, contagem: 0, label: 'CT1' }),
      C('e2', 'BUFFER', 240, 20),
      C('e3', 'NOT', 240, 140),
      C('e4', 'AND', 400, 150, { inputs: 2 }),
      C('e5', 'NOR', 400, 290, { inputs: 2 }),
      C('e6', 'LED', 600, 0, { label: 'Vermelho', cor: 'vermelho' }),
      C('e7', 'LED', 600, 140, { label: 'Amarelo', cor: 'amarelo' }),
      C('e8', 'LED', 600, 280, { label: 'Verde', cor: 'verde' }),
    ],
    wires: [
      W('f1', 'e1', 'q1', 'e2', 'in0'), // vermelho = Q1
      W('f2', 'e1', 'q1', 'e3', 'in0'),
      W('f3', 'e3', 'out', 'e4', 'in0'), // amarelo = ¬Q1 · Q0
      W('f4', 'e1', 'q0', 'e4', 'in1'),
      W('f5', 'e1', 'q1', 'e5', 'in0'), // verde = ¬(Q1 + Q0)
      W('f6', 'e1', 'q0', 'e5', 'in1'),
      W('f7', 'e2', 'out', 'e6', 'in'),
      W('f8', 'e4', 'out', 'e7', 'in'),
      W('f9', 'e5', 'out', 'e8', 'in'),
    ],
  },
  {
    // A contagem em binário, do bit mais alto (em cima) para o mais baixo.
    name: 'Contador na barra de LEDs',
    level: 'Intermediário',
    components: [
      C('e1', 'COUNTER', 60, 60, { bits: 4, freq: 1, contagem: 0, label: 'CT1' }),
      C('e2', 'LED_BAR', 300, 82, { bits: 4, label: 'Y', cor: 'amarelo' }),
    ],
    wires: [3, 2, 1, 0].map((b, i) => W(`f${i + 1}`, 'e1', `q${b}`, 'e2', `in${i}`)),
  },
  {
    name: 'Meio-somador',
    level: 'Intermediário',
    components: [
      C('e1', 'SWITCH', 60, 40, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 60, 200, { state: 0, label: 'B' }),
      C('e3', 'XOR', 280, 60, { inputs: 2 }),
      C('e4', 'AND', 280, 190, { inputs: 2 }),
      C('e5', 'LED', 500, 35, { label: 'S' }),
      C('e6', 'LED', 500, 165, { label: 'Cout' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 'in0'),
      W('f2', 'e2', 'out', 'e3', 'in1'),
      W('f3', 'e1', 'out', 'e4', 'in0'),
      W('f4', 'e2', 'out', 'e4', 'in1'),
      W('f5', 'e3', 'out', 'e5', 'in'),
      W('f6', 'e4', 'out', 'e6', 'in'),
    ],
  },
  {
    name: 'Detector de paridade',
    level: 'Intermediário',
    components: [
      C('e1', 'SWITCH', 40, 40, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 40, 180, { state: 0, label: 'B' }),
      C('e3', 'SWITCH', 40, 320, { state: 0, label: 'C' }),
      C('e4', 'XOR', 240, 86, { inputs: 2 }),
      C('e5', 'XOR', 430, 140, { inputs: 2 }),
      C('e6', 'LED', 620, 114, { label: 'ÍMPAR' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e4', 'in0'),
      W('f2', 'e2', 'out', 'e4', 'in1'),
      W('f3', 'e4', 'out', 'e5', 'in0'),
      W('f4', 'e3', 'out', 'e5', 'in1'),
      W('f5', 'e5', 'out', 'e6', 'in'),
    ],
  },
  {
    name: 'Comparador (A = B)',
    level: 'Intermediário',
    components: [
      C('e1', 'SWITCH', 60, 60, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 60, 200, { state: 0, label: 'B' }),
      C('e3', 'XNOR', 280, 110, { inputs: 2 }),
      C('e4', 'LED', 480, 84, { label: 'A=B' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 'in0'),
      W('f2', 'e2', 'out', 'e3', 'in1'),
      W('f3', 'e3', 'out', 'e4', 'in'),
    ],
  },
  {
    name: 'MUX 2:1',
    level: 'Intermediário',
    components: [
      C('e1', 'SWITCH', 40, 50, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 40, 190, { state: 0, label: 'B' }),
      C('e3', 'SWITCH', 40, 330, { state: 0, label: 'Sel' }),
      C('e4', 'NOT', 180, 310),
      C('e5', 'AND', 360, 75, { inputs: 2 }),
      C('e6', 'AND', 360, 210, { inputs: 2 }),
      C('e7', 'OR', 540, 140, { inputs: 2 }),
      C('e8', 'LED', 700, 110, { label: 'S' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'in0'),
      W('f2', 'e4', 'out', 'e5', 'in1'),
      W('f3', 'e2', 'out', 'e6', 'in0'),
      W('f4', 'e3', 'out', 'e6', 'in1'),
      W('f5', 'e3', 'out', 'e4', 'in0'),
      W('f6', 'e5', 'out', 'e7', 'in0'),
      W('f7', 'e6', 'out', 'e7', 'in1'),
      W('f8', 'e7', 'out', 'e8', 'in'),
    ],
  },
  {
    // Os dois LEDs acendem sempre juntos: ¬(A·B) = ¬A + ¬B.
    name: 'De Morgan: ¬(A·B) = ¬A + ¬B',
    level: 'Intermediário',
    components: [
      C('e1', 'SWITCH', 40, 40, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 40, 300, { state: 0, label: 'B' }),
      C('e3', 'NAND', 260, 60, { inputs: 2 }),
      C('e4', 'LED', 560, 34, { label: 'S1' }),
      C('e5', 'NOT', 200, 180),
      C('e6', 'NOT', 200, 280),
      C('e7', 'OR', 420, 220, { inputs: 2 }),
      C('e8', 'LED', 560, 194, { label: 'S2' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 'in0'),
      W('f2', 'e2', 'out', 'e3', 'in1'),
      W('f3', 'e3', 'out', 'e4', 'in'),
      W('f4', 'e1', 'out', 'e5', 'in0'),
      W('f5', 'e2', 'out', 'e6', 'in0'),
      W('f6', 'e5', 'out', 'e7', 'in0'),
      W('f7', 'e6', 'out', 'e7', 'in1'),
      W('f8', 'e7', 'out', 'e8', 'in'),
    ],
  },
  {
    // Universalidade: qualquer porta pode ser feita só com NAND.
    name: 'Só com NAND: NOT, AND e OR',
    level: 'Intermediário',
    components: [
      C('e1', 'SWITCH', 40, 80, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 40, 400, { state: 0, label: 'B' }),
      C('e3', 'NAND', 220, 40, { inputs: 2, label: 'U1' }), // ¬A = NAND(A,A)
      C('e4', 'NAND', 220, 160, { inputs: 2, label: 'U2' }), // NAND(A,B)
      C('e5', 'NAND', 400, 160, { inputs: 2, label: 'U3' }), // AND = ¬NAND(A,B)
      C('e6', 'NAND', 220, 300, { inputs: 2, label: 'U4' }), // ¬B = NAND(B,B)
      C('e7', 'NAND', 420, 320, { inputs: 2, label: 'U5' }), // OR = NAND(¬A,¬B)
      C('e8', 'LED', 620, 14, { label: '¬A' }),
      C('e9', 'LED', 620, 134, { label: 'A·B' }),
      C('e10', 'LED', 620, 294, { label: 'A+B' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 'in0'),
      W('f2', 'e1', 'out', 'e3', 'in1'),
      W('f3', 'e1', 'out', 'e4', 'in0'),
      W('f4', 'e2', 'out', 'e4', 'in1'),
      W('f5', 'e4', 'out', 'e5', 'in0'),
      W('f6', 'e4', 'out', 'e5', 'in1'),
      W('f7', 'e2', 'out', 'e6', 'in0'),
      W('f8', 'e2', 'out', 'e6', 'in1'),
      W('f9', 'e3', 'out', 'e7', 'in0'),
      W('f10', 'e6', 'out', 'e7', 'in1'),
      W('f11', 'e3', 'out', 'e8', 'in'),
      W('f12', 'e5', 'out', 'e9', 'in'),
      W('f13', 'e7', 'out', 'e10', 'in'),
    ],
  },
  {
    name: 'Decodificador 2:4',
    level: 'Intermediário',
    components: [
      C('e1', 'SWITCH', 40, 100, { state: 0, label: 'A1' }),
      C('e2', 'SWITCH', 40, 320, { state: 0, label: 'A0' }),
      C('e3', 'NOT', 180, 40),
      C('e4', 'NOT', 180, 440),
      C('e5', 'AND', 400, 40, { inputs: 2 }), // ¬A1·¬A0
      C('e6', 'AND', 400, 170, { inputs: 2 }), // ¬A1·A0
      C('e7', 'AND', 400, 300, { inputs: 2 }), // A1·¬A0
      C('e8', 'AND', 400, 430, { inputs: 2 }), // A1·A0
      C('e9', 'LED', 620, 14, { label: 'S0' }),
      C('e10', 'LED', 620, 144, { label: 'S1' }),
      C('e11', 'LED', 620, 274, { label: 'S2' }),
      C('e12', 'LED', 620, 404, { label: 'S3' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 'in0'),
      W('f2', 'e2', 'out', 'e4', 'in0'),
      W('f3', 'e3', 'out', 'e5', 'in0'),
      W('f4', 'e4', 'out', 'e5', 'in1'),
      W('f5', 'e3', 'out', 'e6', 'in0'),
      W('f6', 'e2', 'out', 'e6', 'in1'),
      W('f7', 'e1', 'out', 'e7', 'in0'),
      W('f8', 'e4', 'out', 'e7', 'in1'),
      W('f9', 'e1', 'out', 'e8', 'in0'),
      W('f10', 'e2', 'out', 'e8', 'in1'),
      W('f11', 'e5', 'out', 'e9', 'in'),
      W('f12', 'e6', 'out', 'e10', 'in'),
      W('f13', 'e7', 'out', 'e11', 'in'),
      W('f14', 'e8', 'out', 'e12', 'in'),
    ],
  },

  // ---------- AVANÇADO ----------
  {
    name: 'Somador completo',
    level: 'Avançado',
    components: [
      C('e1', 'SWITCH', 40, 30, { state: 0, label: 'A' }),
      C('e2', 'SWITCH', 40, 150, { state: 0, label: 'B' }),
      C('e3', 'SWITCH', 40, 290, { state: 0, label: 'Cin' }),
      C('e4', 'XOR', 220, 55, { inputs: 2 }),
      C('e5', 'XOR', 400, 75, { inputs: 2 }),
      C('e6', 'AND', 220, 185, { inputs: 2 }),
      C('e7', 'AND', 400, 210, { inputs: 2 }),
      C('e8', 'OR', 560, 215, { inputs: 2 }),
      C('e9', 'LED', 620, 50, { label: 'S' }),
      C('e10', 'LED', 740, 190, { label: 'Cout' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e4', 'in0'),
      W('f2', 'e2', 'out', 'e4', 'in1'),
      W('f3', 'e4', 'out', 'e5', 'in0'),
      W('f4', 'e3', 'out', 'e5', 'in1'),
      W('f5', 'e5', 'out', 'e9', 'in'),
      W('f6', 'e1', 'out', 'e6', 'in0'),
      W('f7', 'e2', 'out', 'e6', 'in1'),
      W('f8', 'e4', 'out', 'e7', 'in0'),
      W('f9', 'e3', 'out', 'e7', 'in1'),
      W('f10', 'e6', 'out', 'e8', 'in0'),
      W('f11', 'e7', 'out', 'e8', 'in1'),
      W('f12', 'e8', 'out', 'e10', 'in'),
    ],
  },
  {
    // Meio-somador no bit 0 + somador completo no bit 1: A1A0 + B1B0 = Cout S1 S0.
    name: 'Somador de 2 bits',
    level: 'Avançado',
    components: [
      C('e1', 'SWITCH', 40, 40, { state: 0, label: 'A0' }),
      C('e2', 'SWITCH', 40, 160, { state: 0, label: 'B0' }),
      C('e3', 'SWITCH', 40, 300, { state: 0, label: 'A1' }),
      C('e4', 'SWITCH', 40, 420, { state: 0, label: 'B1' }),
      C('e5', 'XOR', 240, 70, { inputs: 2 }), // S0
      C('e6', 'AND', 240, 170, { inputs: 2 }), // c0
      C('e7', 'XOR', 240, 320, { inputs: 2 }), // A1⊕B1
      C('e8', 'XOR', 430, 340, { inputs: 2 }), // S1
      C('e9', 'AND', 240, 440, { inputs: 2 }), // A1·B1
      C('e10', 'AND', 430, 460, { inputs: 2 }), // (A1⊕B1)·c0
      C('e11', 'OR', 600, 450, { inputs: 2 }), // Cout
      C('e12', 'LED', 760, 44, { label: 'S0' }),
      C('e13', 'LED', 760, 314, { label: 'S1' }),
      C('e14', 'LED', 760, 424, { label: 'Cout' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'in0'),
      W('f2', 'e2', 'out', 'e5', 'in1'),
      W('f3', 'e1', 'out', 'e6', 'in0'),
      W('f4', 'e2', 'out', 'e6', 'in1'),
      W('f5', 'e5', 'out', 'e12', 'in'),
      W('f6', 'e3', 'out', 'e7', 'in0'),
      W('f7', 'e4', 'out', 'e7', 'in1'),
      W('f8', 'e7', 'out', 'e8', 'in0'),
      W('f9', 'e6', 'out', 'e8', 'in1'),
      W('f10', 'e8', 'out', 'e13', 'in'),
      W('f11', 'e3', 'out', 'e9', 'in0'),
      W('f12', 'e4', 'out', 'e9', 'in1'),
      W('f13', 'e7', 'out', 'e10', 'in0'),
      W('f14', 'e6', 'out', 'e10', 'in1'),
      W('f15', 'e9', 'out', 'e11', 'in0'),
      W('f16', 'e10', 'out', 'e11', 'in1'),
      W('f17', 'e11', 'out', 'e14', 'in'),
    ],
  },
  {
    name: 'Comparador de 2 bits',
    level: 'Avançado',
    components: [
      C('e1', 'SWITCH', 40, 40, { state: 0, label: 'A1' }),
      C('e2', 'SWITCH', 40, 160, { state: 0, label: 'A0' }),
      C('e3', 'SWITCH', 40, 300, { state: 0, label: 'B1' }),
      C('e4', 'SWITCH', 40, 420, { state: 0, label: 'B0' }),
      C('e5', 'XNOR', 280, 130, { inputs: 2 }),
      C('e6', 'XNOR', 280, 320, { inputs: 2 }),
      C('e7', 'AND', 480, 220, { inputs: 2 }),
      C('e8', 'LED', 680, 194, { label: 'A=B' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'in0'),
      W('f2', 'e3', 'out', 'e5', 'in1'),
      W('f3', 'e2', 'out', 'e6', 'in0'),
      W('f4', 'e4', 'out', 'e6', 'in1'),
      W('f5', 'e5', 'out', 'e7', 'in0'),
      W('f6', 'e6', 'out', 'e7', 'in1'),
      W('f7', 'e7', 'out', 'e8', 'in'),
    ],
  },
  // ---------- CIs ----------
  {
    // O ritual completo da primeira montagem: alimentar, ligar, testar.
    name: '7408: primeira ligação',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 60, 30),
      C('e2', 'LEVEL_LOW', 60, 110),
      C('e3', 'SWITCH', 60, 210, { state: 0, label: 'A' }),
      C('e4', 'SWITCH', 60, 360, { state: 0, label: 'B' }),
      C('e5', 'IC', 320, 120, { chip: '7408' }),
      C('e6', 'LED', 560, 150, { label: 'S' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'p14'),
      W('f2', 'e2', 'out', 'e5', 'p7'),
      W('f3', 'e3', 'out', 'e5', 'p1'),
      W('f4', 'e4', 'out', 'e5', 'p2'),
      W('f5', 'e5', 'p3', 'e6', 'in'),
    ],
  },
  {
    // Universalidade: com as 4 portas de UM 7400 saem ¬A, ¬B, A+B e ¬(A·B).
    name: 'Só um 7400: universalidade do NAND',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 180, 20),
      C('e2', 'LEVEL_LOW', 180, 440),
      C('e3', 'SWITCH', 30, 120, { state: 0, label: 'A' }),
      C('e4', 'SWITCH', 30, 320, { state: 0, label: 'B' }),
      C('e5', 'IC', 340, 140, { chip: '7400' }),
      C('e6', 'LED', 640, 60, { label: '¬A' }),
      C('e7', 'LED', 640, 200, { label: 'A+B' }),
      C('e8', 'LED', 640, 340, { label: '¬(A·B)' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'p14'),
      W('f2', 'e2', 'out', 'e5', 'p7'),
      // porta 1 (1,2→3): ¬A
      W('f3', 'e3', 'out', 'e5', 'p1'),
      W('f4', 'e3', 'out', 'e5', 'p2'),
      // porta 2 (4,5→6): ¬B
      W('f5', 'e4', 'out', 'e5', 'p4'),
      W('f6', 'e4', 'out', 'e5', 'p5'),
      // porta 3 (9,10→8): NAND(¬A,¬B) = A+B — encadeia portas do MESMO chip
      W('f7', 'e5', 'p3', 'e5', 'p9'),
      W('f8', 'e5', 'p6', 'e5', 'p10'),
      // porta 4 (12,13→11): NAND(A,B)
      W('f9', 'e3', 'out', 'e5', 'p12'),
      W('f10', 'e4', 'out', 'e5', 'p13'),
      W('f11', 'e5', 'p3', 'e6', 'in'),
      W('f12', 'e5', 'p8', 'e7', 'in'),
      W('f13', 'e5', 'p11', 'e8', 'in'),
    ],
  },
  {
    // Dois chips juntos: XOR do 7486 dá a soma, AND do 7408 dá o vai-um.
    name: 'Meio-somador com 7486 + 7408',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 100),
      C('e3', 'SWITCH', 40, 220, { state: 0, label: 'A' }),
      C('e4', 'SWITCH', 40, 400, { state: 0, label: 'B' }),
      C('e5', 'IC', 300, 40, { chip: '7486' }),
      C('e6', 'IC', 300, 300, { chip: '7408' }),
      C('e7', 'LED', 620, 80, { label: 'S' }),
      C('e8', 'LED', 620, 340, { label: 'Cout' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'p14'),
      W('f2', 'e2', 'out', 'e5', 'p7'),
      W('f3', 'e1', 'out', 'e6', 'p14'),
      W('f4', 'e2', 'out', 'e6', 'p7'),
      W('f5', 'e3', 'out', 'e5', 'p1'),
      W('f6', 'e4', 'out', 'e5', 'p2'),
      W('f7', 'e5', 'p3', 'e7', 'in'),
      W('f8', 'e3', 'out', 'e6', 'p1'),
      W('f9', 'e4', 'out', 'e6', 'p2'),
      W('f10', 'e6', 'p3', 'e8', 'in'),
    ],
  },
  {
    // A montagem clássica de fim de unidade: chaves BCD → 7448 → display bruto.
    name: 'Decodificador 7448 → Display',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 100),
      C('e3', 'SWITCH', 40, 200, { state: 0, label: '8' }), // D
      C('e4', 'SWITCH', 40, 320, { state: 0, label: '4' }), // C
      C('e5', 'SWITCH', 40, 440, { state: 0, label: '2' }), // B
      C('e6', 'SWITCH', 40, 560, { state: 0, label: '1' }), // A
      C('e7', 'IC', 320, 140, { chip: '7448' }),
      C('e8', 'DISPLAY', 620, 180, { mode: 'raw', label: 'D1' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e7', 'p16'), // VCC
      W('f2', 'e2', 'out', 'e7', 'p8'), // GND
      W('f3', 'e3', 'out', 'e7', 'p6'), // D (peso 8)
      W('f4', 'e4', 'out', 'e7', 'p2'), // C (peso 4)
      W('f5', 'e5', 'out', 'e7', 'p1'), // B (peso 2)
      W('f6', 'e6', 'out', 'e7', 'p7'), // A (peso 1)
      W('f7', 'e7', 'p13', 'e8', 'in0'), // a
      W('f8', 'e7', 'p12', 'e8', 'in1'), // b
      W('f9', 'e7', 'p11', 'e8', 'in2'), // c
      W('f10', 'e7', 'p10', 'e8', 'in3'), // d
      W('f11', 'e7', 'p9', 'e8', 'in4'), // e
      W('f12', 'e7', 'p15', 'e8', 'in5'), // f
      W('f13', 'e7', 'p14', 'e8', 'in6'), // g
    ],
  },
  {
    // Saídas ativas em nível baixo: o LED do endereço escolhido é o único APAGADO.
    name: 'Decodificador 74138 → 8 LEDs',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 100),
      C('e3', 'SWITCH', 40, 200, { state: 0, label: 'C' }),
      C('e4', 'SWITCH', 40, 310, { state: 0, label: 'B' }),
      C('e5', 'SWITCH', 40, 420, { state: 0, label: 'A' }),
      C('e6', 'IC', 320, 120, { chip: '74138' }),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) =>
        C(`e${7 + k}`, 'LED', 600, k * 82 + 10, { label: `Y${k}`, cor: 'vermelho' }),
      ),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e6', 'p16'), // VCC
      W('f2', 'e1', 'out', 'e6', 'p6'), // G1 = 1
      W('f3', 'e2', 'out', 'e6', 'p8'), // GND
      W('f4', 'e2', 'out', 'e6', 'p4'), // G2A = 0
      W('f5', 'e2', 'out', 'e6', 'p5'), // G2B = 0
      W('f6', 'e3', 'out', 'e6', 'p3'), // C (peso 4)
      W('f7', 'e4', 'out', 'e6', 'p2'), // B (peso 2)
      W('f8', 'e5', 'out', 'e6', 'p1'), // A (peso 1)
      ...[15, 14, 13, 12, 11, 10, 9, 7].map((pino, k) => W(`f${9 + k}`, 'e6', `p${pino}`, `e${7 + k}`, 'in')), // Y0 ... Y7
    ],
  },
  {
    // O multiplexador como gerador de função: D0 a D7 guardam a tabela-verdade da maioria.
    name: '74151 como gerador de função: maioria de 3',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 100),
      C('e3', 'SWITCH', 40, 200, { state: 0, label: 'C' }),
      C('e4', 'SWITCH', 40, 310, { state: 0, label: 'B' }),
      C('e5', 'SWITCH', 40, 420, { state: 0, label: 'A' }),
      C('e6', 'IC', 320, 120, { chip: '74151' }),
      C('e7', 'LED', 560, 100, { label: 'Y' }),
      C('e8', 'LED', 560, 220, { label: 'W' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e6', 'p16'), // VCC
      W('f2', 'e2', 'out', 'e6', 'p8'), // GND
      W('f3', 'e2', 'out', 'e6', 'p7'), // G = 0 (habilitado)
      W('f4', 'e2', 'out', 'e6', 'p4'), // D0 = 0 (CBA = 000)
      W('f5', 'e2', 'out', 'e6', 'p3'), // D1 = 0
      W('f6', 'e2', 'out', 'e6', 'p2'), // D2 = 0
      W('f7', 'e1', 'out', 'e6', 'p1'), // D3 = 1 (CBA = 011)
      W('f8', 'e2', 'out', 'e6', 'p15'), // D4 = 0
      W('f9', 'e1', 'out', 'e6', 'p14'), // D5 = 1
      W('f10', 'e1', 'out', 'e6', 'p13'), // D6 = 1
      W('f11', 'e1', 'out', 'e6', 'p12'), // D7 = 1
      W('f12', 'e3', 'out', 'e6', 'p9'), // C
      W('f13', 'e4', 'out', 'e6', 'p10'), // B
      W('f14', 'e5', 'out', 'e6', 'p11'), // A
      W('f15', 'e6', 'p5', 'e7', 'in'), // Y
      W('f16', 'e6', 'p6', 'e8', 'in'), // W
    ],
  },
  {
    // Dois bancos de chaves (A1 a A4 e B1 a B4, de cima para baixo) e a soma na barra de LEDs.
    name: 'Somador de 4 bits com 74283',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 100),
      C('e3', 'DIP_SWITCH', 60, 190, { bits: 4, estados: [0, 0, 0, 0], label: 'A' }),
      C('e4', 'DIP_SWITCH', 60, 330, { bits: 4, estados: [0, 0, 0, 0], label: 'B' }),
      C('e5', 'IC', 320, 120, { chip: '74283' }),
      C('e6', 'LED_BAR', 560, 130, { bits: 4, label: 'Σ' }),
      C('e7', 'LED', 560, 250, { label: 'C4' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'p16'), // VCC
      W('f2', 'e2', 'out', 'e5', 'p8'), // GND
      W('f3', 'e2', 'out', 'e5', 'p7'), // C0 = 0
      W('f4', 'e3', 'out0', 'e5', 'p5'), // A1
      W('f5', 'e3', 'out1', 'e5', 'p3'), // A2
      W('f6', 'e3', 'out2', 'e5', 'p14'), // A3
      W('f7', 'e3', 'out3', 'e5', 'p12'), // A4
      W('f8', 'e4', 'out0', 'e5', 'p6'), // B1
      W('f9', 'e4', 'out1', 'e5', 'p2'), // B2
      W('f10', 'e4', 'out2', 'e5', 'p15'), // B3
      W('f11', 'e4', 'out3', 'e5', 'p11'), // B4
      W('f12', 'e5', 'p4', 'e6', 'in0'), // Σ1
      W('f13', 'e5', 'p1', 'e6', 'in1'), // Σ2
      W('f14', 'e5', 'p13', 'e6', 'in2'), // Σ3
      W('f15', 'e5', 'p10', 'e6', 'in3'), // Σ4
      W('f16', 'e5', 'p9', 'e7', 'in'), // C4
    ],
  },
  {
    // O 7448 da aula anterior, agora com o contador gerando os números sozinho.
    name: 'Contador no display com 7448',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 100),
      C('e3', 'COUNTER', 40, 230, { bits: 4, freq: 1, contagem: 0, label: 'CT1' }),
      C('e4', 'IC', 320, 140, { chip: '7448' }),
      C('e5', 'DISPLAY', 620, 180, { mode: 'raw', label: 'D1' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e4', 'p16'), // VCC
      W('f2', 'e2', 'out', 'e4', 'p8'), // GND
      W('f3', 'e3', 'q3', 'e4', 'p6'), // D (peso 8)
      W('f4', 'e3', 'q2', 'e4', 'p2'), // C (peso 4)
      W('f5', 'e3', 'q1', 'e4', 'p1'), // B (peso 2)
      W('f6', 'e3', 'q0', 'e4', 'p7'), // A (peso 1)
      W('f7', 'e4', 'p13', 'e5', 'in0'), // a
      W('f8', 'e4', 'p12', 'e5', 'in1'), // b
      W('f9', 'e4', 'p11', 'e5', 'in2'), // c
      W('f10', 'e4', 'p10', 'e5', 'in3'), // d
      W('f11', 'e4', 'p9', 'e5', 'in4'), // e
      W('f12', 'e4', 'p15', 'e5', 'in5'), // f
      W('f13', 'e4', 'p14', 'e5', 'in6'), // g
    ],
  },
  {
    name: 'BCD → Display',
    level: 'Avançado',
    components: [
      C('e1', 'SWITCH', 60, 40, { state: 0, label: '8' }),
      C('e2', 'SWITCH', 60, 150, { state: 0, label: '4' }),
      C('e3', 'SWITCH', 60, 260, { state: 0, label: '2' }),
      C('e4', 'SWITCH', 60, 370, { state: 0, label: '1' }),
      C('e5', 'DISPLAY', 420, 160, { mode: 'bcd', label: 'D1' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'in0'),
      W('f2', 'e2', 'out', 'e5', 'in1'),
      W('f3', 'e3', 'out', 'e5', 'in2'),
      W('f4', 'e4', 'out', 'e5', 'in3'),
    ],
  },
  // ---------- Memória: flip-flops e trava D ----------
  {
    // D só entra no flip-flop quando o botão C sobe; soltar o botão ou mudar D depois não muda Q.
    name: 'Flip-flop D: guardar um bit',
    level: 'Memória',
    components: [
      C('e1', 'SWITCH', 60, 40, { state: 0, label: 'D' }),
      C('e2', 'PUSH_BUTTON', 60, 170, { state: 0, label: 'C' }),
      C('e3', 'FF_D', 280, 60, { label: 'FF1' }),
      C('e4', 'LED', 480, 30, { label: 'Q' }),
    ],
    wires: [W('f1', 'e1', 'out', 'e3', 'd'), W('f2', 'e2', 'out', 'e3', 'clk'), W('f3', 'e3', 'q', 'e4', 'in')],
  },
  {
    // Com T = 1 o flip-flop inverte a cada subida do clock: Q pisca na metade da frequência do clock.
    name: 'Divisor de frequência com flip-flop T',
    level: 'Memória',
    components: [
      C('e1', 'LEVEL_HIGH', 60, 40),
      C('e2', 'CLOCK', 60, 150, { state: 0, freq: 2, label: 'CLK1' }),
      C('e3', 'FF_T', 280, 60, { label: 'FF1' }),
      C('e4', 'LED', 480, 30, { label: 'Q', cor: 'verde' }),
      C('e5', 'LED', 480, 170, { label: 'CLK', cor: 'amarelo' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 't'),
      W('f2', 'e2', 'out', 'e3', 'clk'),
      W('f3', 'e3', 'q', 'e4', 'in'),
      W('f4', 'e2', 'out', 'e5', 'in'),
    ],
  },
  {
    // Cada JK com J = K = 1 inverte; o Q̄ de um é o clock do de baixo, que sobe quando o de cima desce.
    name: 'Contador assíncrono de 3 bits com JK',
    level: 'Memória',
    components: [
      C('e1', 'CLOCK', 100, 60, { state: 0, freq: 2, label: 'CLK1' }),
      C('e2', 'LEVEL_HIGH', 100, 0),
      C('e3', 'LEVEL_HIGH', 100, 160),
      C('e4', 'LEVEL_HIGH', 100, 310),
      C('e5', 'FF_JK', 280, 10, { label: 'FF0' }),
      C('e6', 'FF_JK', 280, 160, { label: 'FF1' }),
      C('e7', 'FF_JK', 280, 310, { label: 'FF2' }),
      C('e8', 'LED', 450, -20, { label: 'Q0' }),
      C('e9', 'LED', 450, 130, { label: 'Q1' }),
      C('e10', 'LED', 450, 280, { label: 'Q2' }),
    ],
    wires: [
      W('f1', 'e2', 'out', 'e5', 'j'),
      W('f2', 'e2', 'out', 'e5', 'k'),
      W('f3', 'e1', 'out', 'e5', 'clk'),
      W('f4', 'e3', 'out', 'e6', 'j'),
      W('f5', 'e3', 'out', 'e6', 'k'),
      W('f6', 'e5', 'qn', 'e6', 'clk'),
      W('f7', 'e4', 'out', 'e7', 'j'),
      W('f8', 'e4', 'out', 'e7', 'k'),
      W('f9', 'e6', 'qn', 'e7', 'clk'),
      W('f10', 'e5', 'q', 'e8', 'in'),
      W('f11', 'e6', 'q', 'e9', 'in'),
      W('f12', 'e7', 'q', 'e10', 'in'),
    ],
  },
  {
    // A cada toque em C, o bit da chave E entra à esquerda e os outros andam uma casa para a direita.
    name: 'Registrador de deslocamento de 4 bits',
    level: 'Memória',
    components: [
      C('e1', 'SWITCH', 30, 40, { state: 0, label: 'E' }),
      C('e2', 'PUSH_BUTTON', 30, 220, { state: 0, label: 'C' }),
      C('e3', 'FF_D', 190, 60, { label: 'FF1' }),
      C('e4', 'FF_D', 340, 60, { label: 'FF2' }),
      C('e5', 'FF_D', 490, 60, { label: 'FF3' }),
      C('e6', 'FF_D', 640, 60, { label: 'FF4' }),
      C('e7', 'LED_BAR', 820, 50, { bits: 4, label: 'Y', cor: 'verde' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e3', 'd'),
      W('f2', 'e3', 'q', 'e4', 'd'),
      W('f3', 'e4', 'q', 'e5', 'd'),
      W('f4', 'e5', 'q', 'e6', 'd'),
      W('f5', 'e2', 'out', 'e3', 'clk'),
      W('f6', 'e2', 'out', 'e4', 'clk'),
      W('f7', 'e2', 'out', 'e5', 'clk'),
      W('f8', 'e2', 'out', 'e6', 'clk'),
      W('f9', 'e3', 'q', 'e7', 'in0'),
      W('f10', 'e4', 'q', 'e7', 'in1'),
      W('f11', 'e5', 'q', 'e7', 'in2'),
      W('f12', 'e6', 'q', 'e7', 'in3'),
    ],
  },
  {
    // Com EN = 1 a saída acompanha D na hora; com EN = 0 fica o último valor.
    name: 'Trava D: transparente e guardando',
    level: 'Memória',
    components: [
      C('e1', 'SWITCH', 60, 40, { state: 0, label: 'D' }),
      C('e2', 'SWITCH', 60, 170, { state: 0, label: 'EN' }),
      C('e3', 'LATCH_D', 280, 80, { label: 'T1' }),
      C('e4', 'LED', 480, 50, { label: 'Q' }),
    ],
    wires: [W('f1', 'e1', 'out', 'e3', 'd'), W('f2', 'e2', 'out', 'e3', 'en'), W('f3', 'e3', 'q', 'e4', 'in')],
  },
  {
    // S liga, R desliga e S = R = 1 na subida do clock é a combinação proibida (Q indefinido).
    name: 'Flip-flop SR: ligar, desligar e a combinação proibida',
    level: 'Memória',
    components: [
      C('e1', 'SWITCH', 60, 20, { state: 0, label: 'S' }),
      C('e2', 'PUSH_BUTTON', 60, 130, { state: 0, label: 'C' }),
      C('e3', 'SWITCH', 60, 230, { state: 0, label: 'R' }),
      C('e4', 'FF_SR', 280, 80, { label: 'FF1' }),
      C('e5', 'LED', 480, 50, { label: 'Q' }),
      C('e6', 'LED', 480, 170, { label: 'Q̄', cor: 'vermelho' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e4', 's'),
      W('f2', 'e2', 'out', 'e4', 'clk'),
      W('f3', 'e3', 'out', 'e4', 'r'),
      W('f4', 'e4', 'q', 'e5', 'in'),
      W('f5', 'e4', 'qn', 'e6', 'in'),
    ],
  },
  // ---------- CIs sequenciais ----------
  {
    // Cada flip-flop do 7474 com D ligado ao próprio Q̄ inverte a cada subida; o 1Q̄ é o clock do segundo.
    name: '7474: contador de 0 a 3 com dois flip-flops D',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 300),
      C('e3', 'CLOCK', 40, 110, { state: 0, freq: 2, label: 'CLK1' }),
      C('e4', 'IC', 260, 40, { chip: '7474' }),
      C('e5', 'LED', 500, 10, { label: 'Q1' }),
      C('e6', 'LED', 500, 120, { label: 'Q0' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e4', 'p14'),
      W('f2', 'e2', 'out', 'e4', 'p7'),
      W('f3', 'e3', 'out', 'e4', 'p3'),
      W('f4', 'e4', 'p6', 'e4', 'p2'),
      W('f5', 'e4', 'p6', 'e4', 'p11'),
      W('f6', 'e4', 'p8', 'e4', 'p12'),
      W('f7', 'e4', 'p9', 'e5', 'in'),
      W('f8', 'e4', 'p5', 'e6', 'in'),
    ],
  },
  {
    // J = K = 1: cada JK do 7476 inverte na DESCIDA do clock; 1Q é o clock do segundo, então a contagem sobe.
    name: '7476: contador de 0 a 3 com JK',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 30, 20),
      C('e2', 'LEVEL_LOW', 30, 330),
      C('e3', 'CLOCK', 30, 110, { state: 0, freq: 2, label: 'CLK1' }),
      C('e4', 'LEVEL_HIGH', 30, 200),
      C('e5', 'IC', 260, 40, { chip: '7476' }),
      C('e6', 'LED', 520, 20, { label: 'Q1' }),
      C('e7', 'LED', 520, 150, { label: 'Q0' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'p5'),
      W('f2', 'e2', 'out', 'e5', 'p13'),
      W('f3', 'e3', 'out', 'e5', 'p1'),
      W('f4', 'e4', 'out', 'e5', 'p4'),
      W('f5', 'e4', 'out', 'e5', 'p16'),
      W('f6', 'e4', 'out', 'e5', 'p9'),
      W('f7', 'e4', 'out', 'e5', 'p12'),
      W('f8', 'e5', 'p15', 'e5', 'p6'),
      W('f9', 'e5', 'p11', 'e6', 'in'),
      W('f10', 'e5', 'p15', 'e7', 'in'),
    ],
  },
  {
    // Com CLR̄, LOAD̄, ENP e ENT soltos (TTL solto vale 1), o 74161 só conta: 0 a 15 no display em hexadecimal.
    name: '74161: contador de 0 a F no display',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 20),
      C('e2', 'LEVEL_LOW', 40, 300),
      C('e3', 'CLOCK', 40, 110, { state: 0, freq: 2, label: 'CLK1' }),
      C('e4', 'IC', 260, 40, { chip: '74161' }),
      C('e5', 'DISPLAY', 520, 50, { mode: 'hex', label: 'D1' }),
      C('e6', 'LED', 520, 220, { label: 'RCO', cor: 'vermelho' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e4', 'p16'),
      W('f2', 'e2', 'out', 'e4', 'p8'),
      W('f3', 'e3', 'out', 'e4', 'p2'),
      W('f4', 'e4', 'p11', 'e5', 'in0'),
      W('f5', 'e4', 'p12', 'e5', 'in1'),
      W('f6', 'e4', 'p13', 'e5', 'in2'),
      W('f7', 'e4', 'p14', 'e5', 'in3'),
      W('f8', 'e4', 'p15', 'e6', 'in'),
    ],
  },
  {
    // A entrada serial é A·B: com B em 1, o bit da chave A entra em QA a cada toque em C e os outros andam.
    name: '74164: registrador de 8 bits na barra de LEDs',
    level: 'CIs',
    components: [
      C('e1', 'LEVEL_HIGH', 40, 0),
      C('e2', 'LEVEL_LOW', 40, 330),
      C('e3', 'SWITCH', 40, 60, { state: 0, label: 'A' }),
      C('e4', 'PUSH_BUTTON', 40, 230, { state: 0, label: 'C' }),
      C('e5', 'IC', 260, 40, { chip: '74164' }),
      C('e6', 'LED_BAR', 520, 20, { bits: 8, label: 'Y', cor: 'verde' }),
    ],
    wires: [
      W('f1', 'e1', 'out', 'e5', 'p14'),
      W('f2', 'e2', 'out', 'e5', 'p7'),
      W('f3', 'e3', 'out', 'e5', 'p1'),
      W('f4', 'e1', 'out', 'e5', 'p2'),
      W('f5', 'e4', 'out', 'e5', 'p8'),
      ...[3, 4, 5, 6, 10, 11, 12, 13].map((n, i) => W(`f${6 + i}`, 'e5', `p${n}`, 'e6', `in${i}`)),
    ],
  },
]

export const EXAMPLE_LEVELS: ExampleLevel[] = ['Básico', 'Intermediário', 'Avançado', 'Memória', 'CIs']
