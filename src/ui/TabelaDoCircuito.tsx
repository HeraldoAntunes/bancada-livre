// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Tabela-verdade do circuito: a mesma no painel lateral e na janela flutuante.

import { useEffect, useMemo, useRef, useState } from 'react'
import { mintermExpression } from '../engine/expression'
import { conferir, MAX_CSV_CHARS } from '../engine/gabarito'
import { temMemoria } from '../engine/sequencial'
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
  const gabarito = useCircuit((s) => s.gabarito)
  const conferencia = useMemo(() => (gabarito && table ? conferir(gabarito, table) : null), [gabarito, table])
  /** Erros de cada linha da tabela (pela combinação), para marcar as células que não batem. */
  const errosDaLinha = new Map(conferencia?.linhas.map((l) => [l.entradas.join(''), l.erros]) ?? [])
  const arquivo = useRef<HTMLInputElement>(null)
  const [avisoCsv, setAvisoCsv] = useState('')

  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // confere o tamanho antes de ler: um arquivo enorme não chega a ir para a memória
    if (f.size > MAX_CSV_CHARS * 4) {
      setAvisoCsv('Arquivo grande demais para ser uma tabela-verdade.')
      return
    }
    const r = cmd('gabarito.importar', { csv: await f.text() })
    setAvisoCsv(r.ok ? '' : r.erro)
  }

  return (
    <>
        {components.some(temMemoria) && (
          <p className="hint">
            Circuito com memória: a saída depende do que veio antes, não só das entradas de agora. A tabela usa o
            estado guardado neste momento em cada flip-flop; para ver o que acontece ao longo do tempo, use o botão Tempo.
          </p>
        )}
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
                  {table.rows.map((r, linha) => {
                    const erros = errosDaLinha.get(r.inputs.join(''))
                    return (
                      <tr
                        key={r.inputs.join('')}
                        className={
                          [r.inputs.join('') === currentKey ? 'current' : '', erros?.length ? 'gabarito-erro' : '']
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                        onClick={() => cmd('tabela.aplicar_linha', { linha })}
                      >
                        {r.inputs.map((v, i) => (
                          <td key={i}>{v}</td>
                        ))}
                        {r.outputs.map((v, i) => {
                          const e = erros?.find((x) => x.saida === table.outputs[i].name)
                          return e ? (
                            <td key={`o${i}`} className="gabarito-celula" title={`O gabarito espera ${e.esperado}`}>
                              {v} <small>(esperado {e.esperado})</small>
                            </td>
                          ) : (
                            <SignalCell key={`o${i}`} v={v} />
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* expressão booleana por soma de mintermos */}
            {table.outputs.map((o, i) => {
              const expr = mintermExpression(table, i)
              return expr ? (
                <p key={o.key} className="expr">
                  {o.name + ' = ' + expr}
                </p>
              ) : null
            })}
            {conferencia && (
              <p className={'hint gabarito-resumo' + (conferencia.acertos === conferencia.linhas.length ? ' certo' : '')}>
                {conferencia.faltam.length > 0
                  ? `O gabarito não tem a entrada ${conferencia.faltam.join(', ')}: confira os nomes das chaves.`
                  : conferencia.saidas.length === 0
                    ? 'Nenhuma coluna do gabarito tem o nome de uma saída deste circuito.'
                    : `Gabarito: ${conferencia.acertos} de ${conferencia.linhas.length} linhas certas` +
                      ` (saídas ${conferencia.saidas.join(', ')}).`}
                {conferencia.sobram.length > 0 && ` Colunas sem par no circuito: ${conferencia.sobram.join(', ')}.`}
              </p>
            )}
            {avisoCsv && <p className="hint gabarito-resumo">{avisoCsv}</p>}
            <input ref={arquivo} type="file" accept=".csv,text/csv" hidden onChange={importar} />
            <span className="tt-botoes">
              <button onClick={() => cmd('tabela.exportar_csv')}>Exportar CSV</button>
              <button
                title="Ler uma tabela esperada (CSV) e conferir o circuito linha a linha"
                onClick={() => arquivo.current?.click()}
              >
                Conferir com gabarito
              </button>
              {gabarito && <button onClick={() => cmd('gabarito.remover')}>Tirar gabarito</button>}
              {table.inputs.length >= 2 && table.inputs.length <= 4 && (
                <button title="Mapa de Karnaugh e expressão simplificada" onClick={() => cmd('karnaugh.abrir')}>
                  Mapa de Karnaugh
                </button>
              )}
            </span>
          </>
        ) : null}
    </>
  )
}
