// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Corpos SVG dos componentes — estilo skeuomórfico + portas ANSI (spec §8.1).

import type { ChipDef } from '../engine/ics'
import type { CorLed, GateType, Signal } from '../engine/types'
import { bancoY, barraY, contadorY, IC_ROW_H, IC_W, icHeight, icPinY } from './geometry'

const SHAPE = { fill: '#fdfdfd', stroke: '#1a1a1a', strokeWidth: 2.4 } as const

function orPath(h: number): string {
  return `M 2 4 Q 16 ${h / 2} 2 ${h - 4} Q 34 ${h - 4} 60 ${h / 2} Q 34 4 2 4 Z`
}

function andPath(h: number): string {
  const r = (h - 8) / 2
  return `M 4 4 H 34 A ${r} ${r} 0 0 1 34 ${h - 4} H 4 Z`
}

/** Bolinha de inversão (NOT/NAND/NOR/XNOR). */
function Bubble({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r={5} {...SHAPE} />
}

export function GateShape({ type, h }: { type: GateType; h: number }) {
  const mid = h / 2
  const andTip = 34 + (h - 8) / 2
  switch (type) {
    case 'AND':
      return <path d={andPath(h)} {...SHAPE} strokeLinejoin="round" />
    case 'NAND':
      return (
        <g>
          <path d={andPath(h)} {...SHAPE} strokeLinejoin="round" />
          <Bubble cx={andTip + 6} cy={mid} />
        </g>
      )
    case 'OR':
      return <path d={orPath(h)} {...SHAPE} strokeLinejoin="round" />
    case 'NOR':
      return (
        <g>
          <path d={orPath(h)} {...SHAPE} strokeLinejoin="round" />
          <Bubble cx={66} cy={mid} />
        </g>
      )
    case 'XOR':
      return (
        <g>
          <path d={`M -5 4 Q 9 ${mid} -5 ${h - 4}`} fill="none" stroke="#1a1a1a" strokeWidth={2.4} />
          <path d={orPath(h)} {...SHAPE} strokeLinejoin="round" />
        </g>
      )
    case 'XNOR':
      return (
        <g>
          <path d={`M -5 4 Q 9 ${mid} -5 ${h - 4}`} fill="none" stroke="#1a1a1a" strokeWidth={2.4} />
          <path d={orPath(h)} {...SHAPE} strokeLinejoin="round" />
          <Bubble cx={66} cy={mid} />
        </g>
      )
    case 'NOT':
      return (
        <g>
          <path d={`M 4 6 L 44 ${mid} L 4 ${h - 6} Z`} {...SHAPE} strokeLinejoin="round" />
          <Bubble cx={50} cy={mid} />
        </g>
      )
    case 'BUFFER':
      // mesmo triângulo do NOT, sem a bolinha: a saída repete a entrada
      return <path d={`M 4 6 L 50 ${mid} L 4 ${h - 6} Z`} {...SHAPE} strokeLinejoin="round" />
  }
}

/** Chave em placa metálica com parafusos; alavanca azul = ligada. */
export function SwitchBody({ on }: { on: boolean }) {
  return (
    <g>
      <rect x={0} y={0} width={48} height={60} rx={5} fill="#f1f3f5" stroke="#495057" strokeWidth={2} />
      {(
        [
          [7, 7],
          [41, 7],
          [7, 53],
          [41, 53],
        ] as const
      ).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.6} fill="#ced4da" stroke="#868e96" strokeWidth={1} />
      ))}
      <rect x={16} y={13} width={16} height={34} rx={7} fill="#dee2e6" stroke="#868e96" strokeWidth={1.5} />
      <rect x={21} y={on ? 20 : 28} width={6} height={12} rx={2} fill="#adb5bd" />
      <circle cx={24} cy={on ? 17 : 43} r={7.5} fill={on ? '#1c5d99' : '#adb5bd'} stroke="#343a40" strokeWidth={1.5} />
      {on && <circle cx={22} cy={15} r={2.2} fill="#7db4e0" />}
    </g>
  )
}

/** Botão momentâneo: pressionado = azul. */
export function PushButtonBody({ pressed }: { pressed: boolean }) {
  return (
    <g>
      <rect x={0} y={0} width={48} height={52} rx={5} fill="#f1f3f5" stroke="#495057" strokeWidth={2} />
      {(
        [
          [7, 7],
          [41, 7],
          [7, 45],
          [41, 45],
        ] as const
      ).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.6} fill="#ced4da" stroke="#868e96" strokeWidth={1} />
      ))}
      <circle cx={24} cy={26} r={13} fill="#dee2e6" stroke="#868e96" strokeWidth={1.5} />
      <circle cx={24} cy={26} r={9} fill={pressed ? '#1c5d99' : '#9aa4ad'} stroke="#343a40" strokeWidth={1.5} />
    </g>
  )
}

/** CI DIP (14 ou 16 pinos): corpo preto, chanfro, ponto do pino 1 e numeração real (RF-10.2). */
export function ChipBody({ def, powered }: { def: ChipDef; powered: boolean }) {
  const h = icHeight(def.pins)
  let faixaY = icPinY(1, def.pins) + IC_ROW_H / 2
  while (faixaY < h / 2 + 22) faixaY += IC_ROW_H
  return (
    <g>
      <rect x={0} y={0} width={IC_W} height={h} rx={5} fill="#212529" stroke="#0b0e11" strokeWidth={2} />
      {/* chanfro (entalhe) no topo — indica o lado do pino 1 */}
      <path
        d={`M ${IC_W / 2 - 8} 1 A 8 8 0 0 0 ${IC_W / 2 + 8} 1 Z`}
        fill="#3b434b"
        stroke="#0b0e11"
        strokeWidth={1}
      />
      {/* ponto do pino 1 */}
      <circle cx={11} cy={icPinY(1, def.pins) - 8} r={2.6} fill="#adb5bd" />
      {/* nome impresso no corpo */}
      <text
        x={IC_W / 2}
        y={h / 2 - 4}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="#e9ecef"
        fontFamily="Consolas, monospace"
      >
        {def.id}
      </text>
      <text x={IC_W / 2} y={h / 2 + 12} textAnchor="middle" fontSize={8} fill="#8a939b">
        {def.badge}
      </text>
      {!powered && (
        // faixa escura abaixo do nome, entre duas linhas de pinos: os números ficam livres
        <g>
          <rect x={2} y={faixaY - 7} width={IC_W - 4} height={14} rx={3} fill="#7a2e00" />
          <text x={IC_W / 2} y={faixaY + 3.3} textAnchor="middle" fontSize={9.5} letterSpacing={-0.3} fill="#ffd8a8">
            sem VCC e GND
          </text>
        </g>
      )}
      {/* números dos pinos, dentro do corpo */}
      {Array.from({ length: def.pins }, (_, i) => i + 1).map((n) => (
        <text
          key={n}
          x={n <= def.pins / 2 ? 7 : IC_W - 7}
          y={icPinY(n, def.pins) + 3}
          textAnchor={n <= def.pins / 2 ? 'start' : 'end'}
          fontSize={8}
          fill="#8a939b"
          fontFamily="Consolas, monospace"
        >
          {n}
        </text>
      ))}
    </g>
  )
}

/** Clock: caixinha escura com onda quadrada; borda azul quando em nível 1. */
export function ClockBody({ state }: { state: 0 | 1 }) {
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={40}
        height={32}
        rx={4}
        fill="#14365c"
        stroke={state === 1 ? '#4dabf7' : '#0b2340'}
        strokeWidth={2.5}
      />
      <path
        d="M 6 22 H 12 V 10 H 20 V 22 H 28 V 10 H 34"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </g>
  )
}

/** Sonda: mostra o valor lógico (0/1/X/E) em texto. */
export function ProbeBody({ signal }: { signal: Signal }) {
  const color =
    signal === 1 ? '#1c5d99' : signal === 'E' ? '#e8590c' : signal === 'X' ? '#889' : '#495057'
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={36}
        height={28}
        rx={5}
        fill="#fff"
        stroke={signal === 'E' ? '#e8590c' : '#495057'}
        strokeWidth={2}
        strokeDasharray={signal === 'X' ? '4 3' : undefined}
      />
      <text
        x={18}
        y={20}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill={color}
        fontFamily="Consolas, monospace"
      >
        {signal}
      </text>
    </g>
  )
}

/** Fonte constante: caixinha escura com o dígito. */
export function LevelBody({ value }: { value: 0 | 1 }) {
  return (
    <g>
      <rect x={0} y={0} width={40} height={32} rx={4} fill="#14365c" stroke="#0b2340" strokeWidth={2} />
      <text
        x={20}
        y={23}
        textAnchor="middle"
        fontSize={19}
        fontWeight={700}
        fill="#fff"
        fontFamily="Consolas, monospace"
      >
        {value}
      </text>
    </g>
  )
}

/** Display de 7 segmentos: corpo escuro, segmentos vermelhos (a–g). */
export function DisplayBody({
  h,
  segments,
  error,
}: {
  h: number
  segments: boolean[]
  error: boolean
}) {
  // Área do dígito centralizada no corpo 64 de largura.
  const x0 = 14
  const y0 = (h - 62) / 2
  const on = '#f03e3e'
  const off = '#3a2527'
  const segColor = (i: number) => (segments[i] ? on : off)
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={64}
        height={h}
        rx={6}
        fill="#212529"
        stroke={error ? '#e8590c' : '#0b0e11'}
        strokeWidth={error ? 3 : 2}
      />
      <rect x={8} y={y0 - 4} width={48} height={70} rx={4} fill="#101314" />
      {/* a (topo) */}
      <rect x={x0 + 6} y={y0 + 2} width={24} height={5} rx={2.5} fill={segColor(0)} />
      {/* b (dir. sup.) */}
      <rect x={x0 + 30} y={y0 + 8} width={5} height={22} rx={2.5} fill={segColor(1)} />
      {/* c (dir. inf.) */}
      <rect x={x0 + 30} y={y0 + 32} width={5} height={22} rx={2.5} fill={segColor(2)} />
      {/* d (base) */}
      <rect x={x0 + 6} y={y0 + 55} width={24} height={5} rx={2.5} fill={segColor(3)} />
      {/* e (esq. inf.) */}
      <rect x={x0 + 1} y={y0 + 32} width={5} height={22} rx={2.5} fill={segColor(4)} />
      {/* f (esq. sup.) */}
      <rect x={x0 + 1} y={y0 + 8} width={5} height={22} rx={2.5} fill={segColor(5)} />
      {/* g (meio) */}
      <rect x={x0 + 6} y={y0 + 28} width={24} height={5} rx={2.5} fill={segColor(6)} />
    </g>
  )
}

/** Vidro aceso, brilho em volta e vidro apagado (um tom claro da cor, para saber qual LED é). */
const TONS_LED: Record<CorLed, { aceso: string; brilho: string; apagado: string }> = {
  azul: { aceso: '#1f6fd0', brilho: '#4dabf7', apagado: '#e9eef3' },
  vermelho: { aceso: '#e03131', brilho: '#ff8787', apagado: '#f6e4e4' },
  verde: { aceso: '#2f9e44', brilho: '#69db7c', apagado: '#e2f1e5' },
  amarelo: { aceso: '#f5c400', brilho: '#ffe066', apagado: '#f6f1dc' },
}

/** LED tipo lâmpada: aceso = cor escolhida (azul se nada for escolhido) com brilho; X = tracejado; E = alaranjado. */
export function LedBody({ signal, cor = 'azul' }: { signal: Signal; cor?: CorLed }) {
  const lit = signal === 1
  const err = signal === 'E'
  const tom = TONS_LED[cor]
  const glass = lit ? tom.aceso : err ? '#ffd8a8' : tom.apagado
  const glassStroke = err ? '#e8590c' : '#343a40'
  return (
    <g>
      {lit && <ellipse cx={15} cy={23} rx={18} ry={24} fill={tom.brilho} opacity={0.3} />}
      <rect
        x={4}
        y={2}
        width={22}
        height={42}
        rx={11}
        fill={glass}
        stroke={glassStroke}
        strokeWidth={2}
        strokeDasharray={signal === 'X' ? '4 3' : undefined}
      />
      <line x1={11} y1={10} x2={11} y2={34} stroke={lit ? '#cfe8ff' : '#b6c2cd'} strokeWidth={2} />
      <line x1={19} y1={10} x2={19} y2={34} stroke={lit ? '#cfe8ff' : '#b6c2cd'} strokeWidth={2} />
      <rect x={7} y={44} width={16} height={12} rx={2} fill="#f8f9fa" stroke="#343a40" strokeWidth={2} />
      <line x1={8} y1={48} x2={22} y2={48} stroke="#868e96" strokeWidth={1.5} />
      <line x1={8} y1={52} x2={22} y2={52} stroke="#868e96" strokeWidth={1.5} />
    </g>
  )
}

/**
 * Banco de chaves (DIP): corpo escuro, uma chave deslizante por posição, numerada; ligada = cursor à
 * direita (lado do "ON") e azul, como a alavanca da chave comum. Cada fileira marca `data-chave`
 * para o clique saber qual posição alternar.
 */
export function DipSwitchBody({ estados }: { estados: (0 | 1)[] }) {
  const n = estados.length
  return (
    <g>
      <rect x={0} y={0} width={52} height={bancoY(n) - 4} rx={4} fill="#343a40" stroke="#1a1d20" strokeWidth={2} />
      <text x={44} y={12} textAnchor="end" fontSize={8} fontWeight={700} fill="#f1f3f5">
        ON
      </text>
      <path d="M 46 7 l 4 2.5 l -4 2.5 z" fill="#f1f3f5" />
      {estados.map((v, i) => {
        const y = bancoY(i)
        return (
          <g key={i} data-chave={i} style={{ cursor: 'pointer' }}>
            <rect x={2} y={y - 10} width={48} height={20} fill="transparent" />
            <text x={8} y={y + 3} textAnchor="middle" fontSize={8} fill="#ced4da" fontFamily="Consolas, monospace">
              {i + 1}
            </text>
            <rect x={16} y={y - 6} width={30} height={12} rx={2} fill="#f8f9fa" stroke="#868e96" strokeWidth={1} />
            <rect
              x={v === 1 ? 31 : 17}
              y={y - 5}
              width={14}
              height={10}
              rx={1.5}
              fill={v === 1 ? '#1c5d99' : '#adb5bd'}
              stroke="#343a40"
              strokeWidth={1}
            />
          </g>
        )
      })}
    </g>
  )
}

/** Barra de LEDs: corpo escuro com um segmento por entrada; aceso = cor com contorno claro; X tracejado; E alaranjado. */
export function LedBarBody({ signals, cor = 'azul' }: { signals: Signal[]; cor?: CorLed }) {
  const tom = TONS_LED[cor]
  const n = signals.length
  return (
    <g>
      <rect x={0} y={0} width={30} height={barraY(n) - 4} rx={3} fill="#212529" stroke="#0b0e11" strokeWidth={2} />
      {signals.map((s, i) => {
        const aceso = s === 1
        const erro = s === 'E'
        return (
          <rect
            key={i}
            x={5}
            y={barraY(i) - 7}
            width={20}
            height={14}
            rx={2}
            fill={aceso ? tom.aceso : erro ? '#ffd8a8' : '#495057'}
            stroke={aceso ? tom.brilho : erro ? '#e8590c' : '#6c757d'}
            strokeWidth={aceso ? 2.5 : 1.2}
            strokeDasharray={s === 'X' ? '3 2' : undefined}
          />
        )
      })}
    </g>
  )
}

/** Contador: caixa azul-escura como o CLOCK, com a contagem em binário e o nome de cada saída (Q1, Q0...). */
export function CounterBody({ bits, contagem }: { bits: number; contagem: number }) {
  const binario = contagem.toString(2).padStart(bits, '0')
  return (
    <g>
      <rect x={0} y={0} width={56} height={contadorY(bits) - 4} rx={4} fill="#14365c" stroke="#0b2340" strokeWidth={2.5} />
      <rect x={5} y={5} width={46} height={20} rx={3} fill="#0b2340" />
      <text x={28} y={20} textAnchor="middle" fontSize={14} fontWeight={700} fill="#8ce99a" fontFamily="Consolas, monospace">
        {binario}
      </text>
      {Array.from({ length: bits }, (_, i) => (
        <text key={i} x={50} y={contadorY(i) + 3} textAnchor="end" fontSize={9} fill="#cfe0f4" fontFamily="Consolas, monospace">
          Q{bits - 1 - i}
        </text>
      ))}
    </g>
  )
}
