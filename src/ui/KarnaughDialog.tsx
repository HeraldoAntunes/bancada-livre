// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Mapa de Karnaugh da tabela-verdade do circuito: células em código Gray, grupos coloridos e a expressão mínima.
// Clicar numa célula põe as chaves do circuito naquela combinação, como clicar numa linha da tabela.
import { useEffect, useMemo } from 'react'
import { executarNaTela as cmd } from '../comandos'
import { mintermExpression } from '../engine/expression'
import { mapaKarnaugh } from '../engine/karnaugh'
import { circuitTruthTable, estadoDaColuna } from '../engine/truthTable'
import { useCircuit } from '../state/store'

/** Cores dos grupos, fortes o bastante para o projetor e distintas entre si. */
const CORES = ['#e8590c', '#1971c2', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#c2255c', '#5c940d']

export function KarnaughDialog() {
  const components = useCircuit((s) => s.components)
  const wires = useCircuit((s) => s.wires)
  const saida = useCircuit((s) => s.karnaughSaida)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cmd('karnaugh.fechar')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // no máximo 16 linhas: refazer a cada mudança das chaves é barato
  const tabela = useMemo(() => circuitTruthTable(components, wires, 4), [components, wires])
  const saidas = tabela.outputs.filter((o) => o.comp.type !== 'DISPLAY')
  const indice = Math.max(0, tabela.outputs.findIndex((o) => o.key === (saidas[saida] ?? saidas[0])?.key))
  const mapa = useMemo(() => mapaKarnaugh(tabela, indice), [tabela, indice])
  const atual = parseInt(tabela.inputs.map((c) => estadoDaColuna(c)).join('') || '0', 2)

  const motivo =
    tabela.inputs.length < 2 || tabela.inputs.length > 4
      ? `O mapa vale para circuitos de 2 a 4 entradas (este tem ${tabela.inputs.length}).`
      : saidas.length === 0
        ? 'Ligue um LED, uma barra de LEDs ou uma sonda: o display não tem uma saída de 0 ou 1.'
        : 'Alguma linha da tabela dá X ou E nesta saída: ligue todas as entradas do circuito.'

  return (
    <div className="modal-overlay" onClick={() => cmd('karnaugh.fechar')}>
      <div className="modal modal-karnaugh" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Mapa de Karnaugh">
        <h2>Mapa de Karnaugh</h2>
        {saidas.length > 1 && (
          <label className="field">
            Saída{' '}
            <select value={saida} onChange={(e) => cmd('karnaugh.abrir', { saida: saidas[Number(e.target.value)].name })}>
              {saidas.map((o, i) => (
                <option key={o.key} value={i}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!mapa ? (
          <p className="hint">{motivo}</p>
        ) : (
          <>
            <p className="hint">
              Vizinhos no mapa diferem em uma variável só. Cada grupo colorido junta 1s vizinhos e vira um termo da
              expressão. Clique numa célula para pôr as chaves nessa combinação.
            </p>
            <table className="karnaugh">
              <thead>
                <tr>
                  <th className="karnaugh-canto">
                    {mapa.varsLinha.join('')} \ {mapa.varsColuna.join('')}
                  </th>
                  {mapa.rotulosColuna.map((r) => (
                    <th key={r}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapa.mintermo.map((linha, li) => (
                  <tr key={li}>
                    <th>{mapa.rotulosLinha[li]}</th>
                    {linha.map((m, ci) => {
                      const cores = mapa.grupos.flatMap((g, gi) => (g.mintermos.includes(m) ? [CORES[gi % CORES.length]] : []))
                      return (
                        <td
                          key={m}
                          className={m === atual ? 'atual' : undefined}
                          style={{ boxShadow: cores.map((c, k) => `inset 0 0 0 ${3 * (k + 1)}px ${c}`).join(', ') || undefined }}
                          title={`Linha ${m} da tabela`}
                          onClick={() => cmd('tabela.aplicar_linha', { linha: m })}
                        >
                          {mapa.valor[li][ci]}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="expr">
              <strong>Simplificada:</strong> {tabela.outputs[indice].name} ={' '}
              {mapa.grupos.length === 0
                ? mapa.expressao
                : mapa.grupos.map((g, gi) => (
                    <span key={gi}>
                      {gi > 0 && ' + '}
                      <span style={{ color: CORES[gi % CORES.length], fontWeight: 700 }}>{g.termo}</span>
                    </span>
                  ))}
            </p>
            <p className="expr">
              <strong>Soma de mintermos:</strong> {tabela.outputs[indice].name} = {mintermExpression(tabela, indice)}
            </p>
          </>
        )}
        <button onClick={() => cmd('karnaugh.fechar')}>Fechar</button>
      </div>
    </div>
  )
}
