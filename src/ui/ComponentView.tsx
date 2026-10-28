// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Um componente na bancada: corpo + terminais (leads) + pinos + rótulo.

import { decodeDisplay } from '../engine/display'
import { gateExpression } from '../engine/gates'
import { chipOf, icPowered } from '../engine/ics'
import { gateTruthTable } from '../engine/truthTable'
import {
  bitsDe,
  inputCount,
  inputPins,
  isSeq,
  isGate,
  pinKey,
  type CircuitComponent,
  type GateType,
} from '../engine/types'
import type { SimResult } from '../engine/simulate'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd } from '../comandos'
import { geometryOf, type PinDef } from './geometry'
import { Icon } from './icons'
import { desfazNoTexto, transformSvg } from './orientacao'
import {
  ChipBody,
  ClockBody,
  CounterBody,
  FlipFlopBody,
  DipSwitchBody,
  DisplayBody,
  GateShape,
  LedBarBody,
  LedBody,
  LevelBody,
  ProbeBody,
  PushButtonBody,
  SwitchBody,
} from './symbols'

/** Tooltip da porta: nome, expressão e mini tabela-verdade. */
function gateTooltip(c: CircuitComponent): string {
  if (!isGate(c.type)) return ''
  const head = `${c.type}: ${gateExpression(c.type)}`
  const n = inputCount(c)
  if (n > 3) return head // 16+ linhas não cabem num tooltip
  const rows = gateTruthTable(c.type as GateType, n)
  return `${head}\n${rows.map((r) => `${r.inputs.join(' ')} → ${r.output}`).join('\n')}`
}

interface Props {
  comp: CircuitComponent
  sim: SimResult
  selected: boolean
  /** Mostrar o nome do tipo sob as portas. */
  showNames: boolean
  /** true quando o componente está no nível atual da onda (modo passo a passo). */
  waveHighlight: boolean
  /** Direção do pino onde um fio em criação começou (para destacar alvos válidos). */
  draftDir: 'in' | 'out' | null
  onBodyDown: (e: React.PointerEvent, comp: CircuitComponent) => void
  onPinDown: (e: React.PointerEvent, comp: CircuitComponent, pin: PinDef) => void
  onPress: (id: string) => void
}

export function ComponentView({
  comp,
  sim,
  selected,
  showNames,
  waveHighlight,
  draftDir,
  onBodyDown,
  onPinDown,
  onPress,
}: Props) {
  const editar = useCircuit((s) => s.editar)
  const g = geometryOf(comp)

  // Texto sob o componente: portas mostram o TIPO (muleta didática)
  // combinado com o rótulo próprio, quando houver; demais mostram só o rótulo.
  // LABEL desenha o texto no próprio corpo — sem legenda embaixo.
  const caption =
    comp.type === 'LABEL'
      ? null
      : isGate(comp.type)
        ? showNames
          ? comp.label
            ? `${comp.type} · ${comp.label}`
            : comp.type
          : (comp.label ?? null)
        : (comp.label ?? null)

  const body =
    comp.type === 'SWITCH' ? (
      <SwitchBody on={comp.state === 1} />
    ) : comp.type === 'PUSH_BUTTON' ? (
      <PushButtonBody pressed={comp.state === 1} />
    ) : comp.type === 'LEVEL_HIGH' ? (
      <LevelBody value={1} />
    ) : comp.type === 'LEVEL_LOW' ? (
      <LevelBody value={0} />
    ) : comp.type === 'CLOCK' ? (
      <ClockBody state={comp.state ?? 0} />
    ) : comp.type === 'PROBE' ? (
      <ProbeBody signal={sim.pins.get(pinKey(comp.id, 'in')) ?? 'X'} />
    ) : comp.type === 'COUNTER' ? (
      <CounterBody bits={bitsDe(comp)} contagem={comp.contagem ?? 0} />
    ) : comp.type === 'DIP_SWITCH' ? (
      <DipSwitchBody estados={Array.from({ length: bitsDe(comp) }, (_, i) => comp.estados?.[i] ?? 0)} />
    ) : comp.type === 'LED_BAR' ? (
      <LedBarBody signals={inputPins(comp).map((p) => sim.pins.get(pinKey(comp.id, p)) ?? 'X')} cor={comp.cor} />
    ) : comp.type === 'LED' ? (
      <LedBody signal={sim.pins.get(pinKey(comp.id, 'in')) ?? 'X'} cor={comp.cor} />
    ) : comp.type === 'DISPLAY' ? (
      (() => {
        const ins = inputPins(comp).map((p) => sim.pins.get(pinKey(comp.id, p)) ?? 'X')
        const d = decodeDisplay(comp.mode ?? 'bcd', ins)
        return <DisplayBody h={g.h} segments={d.segments} error={d.error} />
      })()
    ) : comp.type === 'IC' ? (
      <ChipBody def={chipOf(comp)} powered={icPowered(comp, sim.pins)} />
    ) : isSeq(comp.type) ? (
      <FlipFlopBody tipo={comp.type} entradas={inputPins(comp)} q={comp.q ?? 0} />
    ) : comp.type === 'LABEL' ? (
      <text x={4} y={18} fontSize={15} fontWeight={700} fill="#2f4a66">
        {comp.label || 'Texto…'}
      </text>
    ) : (
      <GateShape type={comp.type} h={g.h} />
    )

  return (
    <g
      transform={`translate(${comp.x} ${comp.y}) ${transformSvg(g, comp)}`}
      // espelhado ou girado: os textos desfazem a orientação para continuar legíveis (styles.css)
      className={comp.espelhado || comp.giro ? 'orientado' : undefined}
      style={{ '--desfaz': desfazNoTexto(comp) } as React.CSSProperties}
    >
      {/* terminais até a borda mais próxima do corpo (desenhados sob ele) */}
      {g.pins.map((p) => (
        <line
          key={`lead-${p.name}`}
          x1={p.x}
          y1={p.y}
          x2={p.x < g.w / 2 ? 8 : g.w - 8}
          y2={p.y}
          stroke="#1a1a1a"
          strokeWidth={3}
        />
      ))}

      {waveHighlight && (
        <rect
          x={-8}
          y={-8}
          width={g.w + 16}
          height={g.h + 16}
          fill="#4dabf7"
          opacity={0.18}
          stroke="#1c7ed6"
          strokeWidth={2}
          rx={6}
        />
      )}

      {selected && (
        <rect
          x={-6}
          y={-6}
          width={g.w + 12}
          height={g.h + 12}
          fill="none"
          stroke="#339af0"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          rx={4}
        />
      )}

      <g
        onPointerDown={(e) => onBodyDown(e, comp)}
        onDoubleClick={(e) => {
          e.stopPropagation()
          editar(comp.id)
        }}
        style={{ cursor: 'grab' }}
      >
        {isGate(comp.type) && <title>{gateTooltip(comp)}</title>}
        {comp.type === 'IC' &&
          (() => {
            const def = chipOf(comp)
            const powered = icPowered(comp, sim.pins)
            return (
              <title>{`${def.id}: ${def.title}${powered ? '' : '\nSEM ALIMENTAÇÃO: ligue VCC (pino 14) ao nível 1 e GND (pino 7) ao nível 0'}`}</title>
            )
          })()}
        <rect x={0} y={0} width={g.w} height={g.h} fill="transparent" />
        {body}
      </g>

      {/* área de acionamento do botão momentâneo */}
      {(comp.type === 'CLOCK' || comp.type === 'COUNTER') && <ControlesDoClock />}

      {comp.type === 'PUSH_BUTTON' && (
        <circle
          cx={24}
          cy={26}
          r={11}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            // captura: soltar fora da janela ainda libera o botão
            try {
              ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
            } catch {
              /* ponteiro sintético/inativo */
            }
            onPress(comp.id)
          }}
        />
      )}

      {/* rótulos dos pinos do display: pesos 8-4-2-1 ou segmentos a–g */}
      {comp.type === 'DISPLAY' &&
        g.pins.map((p, i) => (
          <text key={`pl-${p.name}`} x={-10} y={p.y - 8} fontSize={9} fill="#557" textAnchor="middle">
            {(comp.mode ?? 'bcd') === 'raw' ? 'abcdefg'[i] : ['8', '4', '2', '1'][i]}
          </text>
        ))}

      {/* pinos (conectores em nós) */}
      {g.pins.map((p) => (
        <circle
          key={p.name}
          className={'pin' + (draftDir && p.dir !== draftDir ? ' pin-target' : '')}
          data-comp={comp.id}
          data-pin={p.name}
          data-dir={p.dir}
          cx={p.x}
          cy={p.y}
          r={6.5}
          onPointerDown={(e) => onPinDown(e, comp, p)}
        />
      ))}

      {caption && (
        <text x={g.w / 2} y={g.h + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill="#365577">
          {caption}
        </text>
      )}
    </g>
  )
}

/** Rodar ou pausar e avançar meio período, logo acima do CLOCK na bancada (valem para todos os clocks). */
function ControlesDoClock() {
  const clockRunning = useCircuit((s) => s.clockRunning)
  const botao = (x: number, titulo: string, acao: () => void, icone: 'rodar' | 'pausar' | 'avancar') => (
    <g
      className="clock-botao"
      transform={`translate(${x} -24)`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        acao()
      }}
      role="button"
      aria-label={titulo}
    >
      <title>{titulo}</title>
      <rect width={19} height={19} rx={4} />
      <Icon name={icone} size={13} x={3} y={3} />
    </g>
  )
  return (
    <>
      {botao(0, clockRunning ? 'Pausar o clock' : 'Rodar o clock', () => cmd(clockRunning ? 'clock.pausar' : 'clock.rodar'), clockRunning ? 'pausar' : 'rodar')}
      {botao(22, 'Avançar meio período (com o clock pausado, vê cada transição)', () => cmd('clock.avancar'), 'avancar')}
    </>
  )
}
