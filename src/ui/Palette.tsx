// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Paleta lateral: itens da aba ativa (ENTRADAS / PORTAS / SAÍDAS / CIs) — spec §8, §4.10.

import { CHIPS, type ChipId } from '../engine/ics'
import { entradaUnica, isGate, type ComponentType } from '../engine/types'
import type { AbaPaleta } from '../state/store'
import { executarNaTela as cmd } from '../comandos'
import {
  ClockBody,
  CounterBody,
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

export type Tab = AbaPaleta

interface PaletteItem {
  type: ComponentType
  chip?: ChipId
  name: string
}

const CATALOG: Record<Tab, PaletteItem[]> = {
  ENTRADAS: [
    { type: 'SWITCH', name: 'SWITCH' },
    { type: 'CLOCK', name: 'CLOCK' },
    { type: 'LEVEL_HIGH', name: 'NÍVEL ALTO' },
    { type: 'LEVEL_LOW', name: 'NÍVEL BAIXO' },
    { type: 'PUSH_BUTTON', name: 'PUSH BUTTON' },
    { type: 'DIP_SWITCH', name: 'BANCO DE CHAVES' },
    { type: 'COUNTER', name: 'CONTADOR' },
    { type: 'LABEL', name: 'TEXTO' },
  ],
  PORTAS: [
    { type: 'AND', name: 'AND' },
    { type: 'OR', name: 'OR' },
    { type: 'NOT', name: 'NOT' },
    { type: 'BUFFER', name: 'BUFFER' },
    { type: 'NAND', name: 'NAND' },
    { type: 'NOR', name: 'NOR' },
    { type: 'XOR', name: 'XOR' },
    { type: 'XNOR', name: 'XNOR' },
  ],
  SAIDAS: [
    { type: 'LED', name: 'LED' },
    { type: 'DISPLAY', name: 'DISPLAY' },
    { type: 'PROBE', name: 'SONDA' },
    { type: 'LED_BAR', name: 'BARRA DE LEDS' },
  ],
  CIS: (Object.keys(CHIPS) as ChipId[]).map((id) => ({
    type: 'IC' as const,
    chip: id,
    name: `${id} · ${CHIPS[id].short}`,
  })),
}

function PaletteIcon({ type, chip }: { type: ComponentType; chip?: ChipId }) {
  if (type === 'IC') {
    return (
      <svg width={26} height={52} viewBox="-2 -2 40 92">
        <rect x={0} y={0} width={36} height={88} rx={4} fill="#212529" stroke="#0b0e11" strokeWidth={2} />
        <path d="M 12 1 A 6 6 0 0 0 24 1 Z" fill="#3b434b" />
        <circle cx={6} cy={10} r={2} fill="#adb5bd" />
        <text
          x={18}
          y={50}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="#e9ecef"
          fontFamily="Consolas, monospace"
        >
          {chip}
        </text>
      </svg>
    )
  }
  if (isGate(type)) {
    return (
      <svg width={60} height={30} viewBox="-26 -4 118 56">
        {entradaUnica(type) ? (
          <line x1={-22} y1={24} x2={8} y2={24} stroke="#1a1a1a" strokeWidth={3} />
        ) : (
          <>
            <line x1={-22} y1={14} x2={8} y2={14} stroke="#1a1a1a" strokeWidth={3} />
            <line x1={-22} y1={34} x2={8} y2={34} stroke="#1a1a1a" strokeWidth={3} />
          </>
        )}
        <line x1={44} y1={24} x2={88} y2={24} stroke="#1a1a1a" strokeWidth={3} />
        <GateShape type={type} h={48} />
      </svg>
    )
  }
  switch (type) {
    case 'SWITCH':
      return (
        <svg width={30} height={36} viewBox="-2 -2 52 64">
          <SwitchBody on={false} />
        </svg>
      )
    case 'PUSH_BUTTON':
      return (
        <svg width={30} height={32} viewBox="-2 -2 52 56">
          <PushButtonBody pressed={false} />
        </svg>
      )
    case 'LEVEL_HIGH':
      return (
        <svg width={36} height={30} viewBox="-2 -2 44 36">
          <LevelBody value={1} />
        </svg>
      )
    case 'LEVEL_LOW':
      return (
        <svg width={36} height={30} viewBox="-2 -2 44 36">
          <LevelBody value={0} />
        </svg>
      )
    case 'LED':
      return (
        <svg width={22} height={40} viewBox="-2 0 34 60">
          <LedBody signal={0} />
        </svg>
      )
    case 'DIP_SWITCH':
      return (
        <svg width={28} height={52} viewBox="-2 -2 56 108">
          <DipSwitchBody estados={[1, 0, 1, 0]} />
        </svg>
      )
    case 'COUNTER':
      return (
        <svg width={34} height={46} viewBox="-2 -2 60 78">
          <CounterBody bits={2} contagem={2} />
        </svg>
      )
    case 'LED_BAR':
      return (
        <svg width={18} height={48} viewBox="-2 -2 34 96">
          <LedBarBody signals={[1, 0, 1, 1]} />
        </svg>
      )
    case 'DISPLAY':
      return (
        <svg width={34} height={44} viewBox="-2 -2 68 92">
          <DisplayBody h={88} segments={[...'1111111'].map(() => true)} error={false} />
        </svg>
      )
    case 'CLOCK':
      return (
        <svg width={36} height={30} viewBox="-2 -2 44 36">
          <ClockBody state={0} />
        </svg>
      )
    case 'PROBE':
      return (
        <svg width={34} height={28} viewBox="-2 -2 40 32">
          <ProbeBody signal={1} />
        </svg>
      )
    case 'LABEL':
      return (
        <svg width={40} height={24} viewBox="0 0 40 24">
          <rect x={1} y={2} width={38} height={20} rx={3} fill="#2f4a66" />
          <text x={20} y={16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
            Text
          </text>
        </svg>
      )
  }
}

export function Palette({ tab }: { tab: Tab }) {

  return (
    <nav className="palette" aria-label="Paleta de componentes">
      {CATALOG[tab].map((item) => (
        <div
          key={item.chip ?? item.type}
          className="palette-item"
          draggable
          title={`Arraste ${item.name} para a bancada (ou clique para adicionar)`}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/x-comp-type',
              item.chip ? `IC:${item.chip}` : item.type,
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => cmd('componente.adicionar', item.chip ? { tipo: item.type, chip: item.chip } : { tipo: item.type })}
        >
          <PaletteIcon type={item.type} chip={item.chip} />
          <div className="palette-name">{item.name}</div>
        </div>
      ))}
    </nav>
  )
}
