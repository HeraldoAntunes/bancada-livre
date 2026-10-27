// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Tabela-verdade do circuito (spec §4.6): a mesma no painel lateral e na janela flutuante.

import { useEffect, useMemo, useState } from 'react'
import { mintermExpression } from '../engine/expression'
import { circuitTruthTable, estadoDaColuna, inputColumns, outputColumns } from '../engine/truthTable'
import type { Signal } from '../engine/types'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd, registrar } from '../comandos'

export function SignalCell({ v }: { v: Signal | string }) {
  return <td className={v === 'E' ? 'sig-e' : v === 'X' ? 'sig-x' : undefined}>{v}</td>
}

export function TabelaDoCircuito() {
  const components = useCircuit((s) => s.components)
  const wires = useCircuit((s) => s.wires)

  // A tabela do circuito depende da topologia — e do estado do CLOCK, que não é
  // varrido pelas 2^n combinações (chaves, botões, bancos e contadores são); posições,
  // estados de chaves e a contagem continuam fora da chave.
  const logicKey = JSON.stringify([
    components.map((c) => [
      c.id,
      c.type,
      c.inputs,
      c.label,
      c.mode,
      c.bits,
      c.type === 'CLOCK' ? c.state : null,
    ]),
    wires.map((w) => [w.from.comp, w.from.pin, w.to.comp, w.to.pin]),
  ])
  const inputComps = inputColumns(components)
  const hasOutputs = outputColumns(components).length > 0
  const auto = inputComps.length <= 5
  const [wantBig, setWantBig] = useState(false)
  useEffect(() => setWantBig(false), [logicKey])
  // circuito com mais de 5 entradas: a tabela só aparece quando pedida (botão ou comando)
  useEffect(
    () =>
      registrar('tabela.gerar', {
        descricao: 'Mostra no painel a tabela-verdade de um circuito com 6 a 8 entradas (até 5 ela aparece sozinha)',
        params: {},
        executar: () => setWantBig(true),
      }),
    [],
  )

  const table = useMemo(
    () => (auto || wantBig ? circuitTruthTable(components, wires, 8) : null),
    // deps deliberadamente pela chave lógica: posição/estado não alteram a tabela
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logicKey, wantBig, auto],
  )

  const currentKey = inputComps.map(estadoDaColuna).join('')

  return (
    <>
        {inputComps.length === 0 ? (
          <p className="hint">
            A tabela-verdade varia as chaves, os botões, os bancos de chaves e os contadores (aba ENTRADAS). Este
            circuito ainda não tem nenhum. O CLOCK e os níveis fixos não entram na tabela.
          </p>
        ) : !hasOutputs ? (
          <p className="hint">
            Ligue pelo menos uma saída (aba SAÍDAS): LED, barra de LEDs, display ou sonda.
          </p>
        ) : inputComps.length > 8 ? (
          <p className="hint">Máximo de 8 entradas para gerar a tabela ({inputComps.length} no circuito).</p>
        ) : !auto && !wantBig ? (
          <button onClick={() => cmd('tabela.gerar')}>
            Gerar tabela ({2 ** inputComps.length} linhas)
          </button>
        ) : table ? (
          <>
            <p className="hint">
              Clique em uma linha para aplicar os estados ao circuito.
              {components.some((c) => c.type === 'COUNTER') && ' As colunas .Q são os bits do contador: cada linha é uma contagem.'}
            </p>
            <div className="tt-scroll">
              <table className="tt">
                <thead>
                  <tr>
                    {table.inputs.map((c) => (
                      <th key={c.key}>{c.name}</th>
                    ))}
                    {table.outputs.map((c) => (
                      <th key={c.key} className="out-col">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r, linha) => (
                    <tr
                      key={r.inputs.join('')}
                      className={r.inputs.join('') === currentKey ? 'current' : undefined}
                      onClick={() => cmd('tabela.aplicar_linha', { linha })}
                    >
                      {r.inputs.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                      {r.outputs.map((v, i) => (
                        <SignalCell key={`o${i}`} v={v} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* expressão booleana por soma de mintermos (RF-06.4) */}
            {table.outputs.map((o, i) => {
              const expr = mintermExpression(table, i)
              return expr ? (
                <p key={o.key} className="expr">
                  {o.name + ' = ' + expr}
                </p>
              ) : null
            })}
            <button onClick={() => cmd('tabela.exportar_csv')}>Exportar CSV</button>
          </>
        ) : null}
    </>
  )
}
