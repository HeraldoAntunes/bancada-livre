// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Painel direito: propriedades do item selecionado + tabelas-verdade (spec §4.6, §8).

import { gateExpression } from '../engine/gates'
import type { SimResult } from '../engine/simulate'
import { gateTruthTable } from '../engine/truthTable'
import {
  inputCount,
  inputPins,
  isGate,
  pinKey,
  type CircuitComponent,
} from '../engine/types'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd } from '../comandos'
import { CamposDoComponente, nomeDoComponente } from './CamposDoComponente'
import { SignalCell, TabelaDoCircuito } from './TabelaDoCircuito'


function letters(n: number): string[] {
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
}

/** Tabela-verdade da porta selecionada (RF-06.1), com a linha atual destacada. */
function GateTable({ comp, sim }: { comp: CircuitComponent; sim: SimResult }) {
  if (!isGate(comp.type)) return null
  const n = inputCount(comp)
  const rows = gateTruthTable(comp.type, n)
  const current = inputPins(comp).map((p) => sim.pins.get(pinKey(comp.id, p)))
  const currentKey = current.every((v) => v === 0 || v === 1) ? current.join('') : null
  return (
    <>
      <h3>
        {comp.type} <small>{gateExpression(comp.type)}</small>
      </h3>
      {/* fan-in alto gera até 256 linhas — rolagem própria */}
      <div className="tt-scroll">
        <table className="tt">
        <thead>
          <tr>
            {letters(n).map((l) => (
              <th key={l}>{l}</th>
            ))}
            <th>S</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.inputs.join('')} className={r.inputs.join('') === currentKey ? 'current' : undefined}>
              {r.inputs.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
              <SignalCell v={r.output} />
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  )
}

export function SidePanel({ sim }: { sim: SimResult }) {
  const components = useCircuit((s) => s.components)
  const wires = useCircuit((s) => s.wires)
  const selectedId = useCircuit((s) => s.selectedId)
  const tabelaSolta = useCircuit((s) => s.tabelaSolta)

  const selectedComp = components.find((c) => c.id === selectedId)
  const selectedWire = wires.find((w) => w.id === selectedId)


  return (
    <aside className="side">
      <section>
        <h2>Propriedades</h2>
        {!selectedComp && !selectedWire && <p className="hint">Selecione um componente ou fio na bancada.</p>}
        {selectedWire && (
          <>
            <p>Fio selecionado.</p>
            <button className="danger" onClick={() => cmd('selecao.remover')}>
              Remover fio (Delete)
            </button>
          </>
        )}
        {selectedComp && (
          <>
            <p className="comp-name">{nomeDoComponente(selectedComp)}</p>
            <CamposDoComponente comp={selectedComp} />
            <p className="hint">Dica: duplo clique no componente abre a janela de edição.</p>
            <button className="danger" onClick={() => cmd('selecao.remover')}>
              Remover (Delete)
            </button>
            <GateTable comp={selectedComp} sim={sim} />
          </>
        )}
      </section>

      <section>
        <div className="secao-titulo">
          <h2>Tabela-verdade do circuito</h2>
          {!tabelaSolta && (
            <button
              className="destacar"
              title="Abrir a tabela numa janela que você pode mover e aumentar"
              onClick={() => cmd('tabela.destacar', { solta: true })}
            >
              Destacar
            </button>
          )}
        </div>
        {tabelaSolta ? (
          <p className="hint">
            A tabela está numa janela separada.{' '}
            <button onClick={() => cmd('tabela.destacar', { solta: false })}>Trazer de volta</button>
          </p>
        ) : (
          <TabelaDoCircuito />
        )}
      </section>
    </aside>
  )
}
