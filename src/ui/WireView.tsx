// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Fio na bancada: estado comunicado por cor + espessura.

import type { Signal } from '../engine/types'

interface Props {
  d: string
  signal: Signal
  selected: boolean
  onSelect: () => void
}

export function WireView({ d, signal, selected, onSelect }: Props) {
  return (
    <g className={signal === 'E' ? 'wire-error' : undefined}>
      {selected && <path d={d} fill="none" stroke="#74c0fc" strokeWidth={12} opacity={0.4} />}
      {signal === 1 && (
        <>
          <path d={d} fill="none" stroke="#0d3a68" strokeWidth={8} strokeLinecap="round" />
          <path d={d} fill="none" stroke="#2568b0" strokeWidth={4} strokeLinecap="round" />
        </>
      )}
      {signal === 0 && (
        <>
          <path d={d} fill="none" stroke="#94a3b2" strokeWidth={6} strokeLinecap="round" />
          <path d={d} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {signal === 'X' && (
        <path d={d} fill="none" stroke="#b0b7bf" strokeWidth={3} strokeDasharray="6 6" />
      )}
      {signal === 'E' && (
        <path d={d} fill="none" stroke="#e8590c" strokeWidth={6} strokeDasharray="10 6" strokeLinecap="round" />
      )}
      {/* área de clique generosa */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        style={{ cursor: 'pointer' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      />
    </g>
  )
}
