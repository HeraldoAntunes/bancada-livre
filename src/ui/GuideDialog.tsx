// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Guia de CIs: datasheet didático — figura da pinagem (a "marcação"),
// função, portas internas, tabela-verdade, dicas de bancada e exemplo pronto.

import { useEffect, useState } from 'react'
import { CHIP_IDS, CHIPS, type ChipId } from '../engine/ics'
import { gateTruthTable } from '../engine/truthTable'
import { executarNaTela as cmd } from '../comandos'
import { Icon } from './icons'

/** Figura clássica da pinagem: DIP vista superior, chanfro, ponto do pino 1. */
function Pinout({ chip }: { chip: ChipId }) {
  const def = CHIPS[chip]
  const rowH = 26
  const top = 26
  const bodyX = 80
  const bodyW = 100
  const half = def.pins / 2
  const h = half * rowH + 18
  const y = (n: number) => (n <= half ? top + (n - 1) * rowH : top + (def.pins - n) * rowH)
  return (
    <svg viewBox={`0 0 260 ${h + 16}`} className="pinout">
      <rect x={bodyX} y={8} width={bodyW} height={h} rx={6} fill="#212529" stroke="#0b0e11" strokeWidth={2} />
      <path d={`M ${bodyX + bodyW / 2 - 11} 9 A 11 11 0 0 0 ${bodyX + bodyW / 2 + 11} 9 Z`} fill="#3b434b" />
      <circle cx={bodyX + 13} cy={y(1) - 9} r={3} fill="#adb5bd" />
      <text
        x={bodyX + bodyW / 2}
        y={h / 2 + 14}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="#e9ecef"
        fontFamily="Consolas, monospace"
      >
        {def.id}
      </text>
      {Array.from({ length: def.pins }, (_, i) => i + 1).map((n) => {
        const left = n <= half
        const py = y(n)
        return (
          <g key={n} fontFamily="Consolas, monospace">
            <rect x={left ? bodyX - 14 : bodyX + bodyW} y={py - 3} width={14} height={6} fill="#868e96" />
            <text
              x={left ? bodyX + 8 : bodyX + bodyW - 8}
              y={py + 4}
              textAnchor={left ? 'start' : 'end'}
              fontSize={10}
              fill="#ced4da"
            >
              {n}
            </text>
            <text
              x={left ? bodyX - 20 : bodyX + bodyW + 20}
              y={py + 4}
              textAnchor={left ? 'end' : 'start'}
              fontSize={11}
              fontWeight={700}
              fill="#14365c"
            >
              {def.pinLabels[n] ?? '—'}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function GuideDialog({ initial, onClose }: { initial: ChipId; onClose: () => void }) {
  const [chip, setChip] = useState<ChipId>(initial)
  const def = CHIPS[chip]
  const table =
    def.gates.length > 0 ? gateTruthTable(def.gates[0].type, def.gates[0].inputs.length) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loadDemo = () => {
    cmd('guia.carregar_exemplo', { chip })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal guide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Guia de CIs">
        <h2>
          <Icon name="livro" size={22} /> Guia de CIs: série 74xx
        </h2>
        <div className="guide-body">
          <nav className="guide-nav">
            {CHIP_IDS.map((id) => (
              <button key={id} className={id === chip ? 'active' : ''} onClick={() => setChip(id)}>
                {id}
                <small>{CHIPS[id].short}</small>
              </button>
            ))}
          </nav>
          <div className="guide-content">
            <h3>
              {def.id} <small>{def.title}</small>
            </h3>
            <Pinout chip={chip} />
            {def.gates.length > 0 && (
              <>
                <h4>Portas internas</h4>
                <ul>
                  {def.gates.map((g, i) => (
                    <li key={i}>
                      Porta {i + 1}: pino{g.inputs.length > 1 ? 's' : ''} {g.inputs.join(' e ')} →{' '}
                      {g.type} → pino {g.output}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {chip === '7448' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    Entradas BCD: <strong>A(7)</strong> peso 1, <strong>B(1)</strong> peso 2,{' '}
                    <strong>C(2)</strong> peso 4, <strong>D(6)</strong> peso 8.
                  </li>
                  <li>
                    Saídas <strong>a(13) b(12) c(11) d(10) e(9) f(15) g(14)</strong>: ligue nos
                    segmentos do DISPLAY em <em>modo bruto</em>.
                  </li>
                  <li>
                    Controles (podem ficar <em>desconectados</em>: entrada TTL solta flutua em 1,
                    como no chip real): <strong>LT(3)</strong> em 0 acende tudo (teste de lâmpada);{' '}
                    <strong>BI(4)</strong> em 0 apaga tudo; <strong>RBI(5)</strong> em 0 apaga o
                    zero.
                  </li>
                  <li>Valores de 10 a 15: display apagado (o chip real mostra padrões parciais).</li>
                  <li>
                    <Icon name="alerta" size={14} /> <strong>7447 × 7448</strong>: o 7447 é o gêmeo de saídas ativas em nível{' '}
                    <em>baixo</em>, para display de <em>anodo comum</em>; o 7448 (este) tem saídas
                    ativas em nível <em>alto</em>, para <em>catodo comum</em>, que é o caso do display
                    deste simulador. Na bancada, confira qual display você tem antes de escolher o
                    chip!
                  </li>
                </ul>
              </>
            )}
            {chip === '74138' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    Endereço: <strong>A(1)</strong> peso 1, <strong>B(2)</strong> peso 2, <strong>C(3)</strong> peso 4.
                    Escolhe uma das oito saídas <strong>Y0 a Y7</strong>.
                  </li>
                  <li>
                    <Icon name="alerta" size={14} /> As saídas são ativas em nível <em>baixo</em>: a saída escolhida vai
                    a 0 e as outras ficam em 1. Com LEDs, o LED escolhido é o único apagado.
                  </li>
                  <li>
                    Para funcionar: <strong>G1(6)</strong> em 1, <strong>G2A(4)</strong> e <strong>G2B(5)</strong> em 0.
                    Fora disso, todas as saídas ficam em 1. Habilitação solta conta como 1, como no chip real.
                  </li>
                </ul>
              </>
            )}
            {chip === '74151' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    Seleção: <strong>A(11)</strong> peso 1, <strong>B(10)</strong> peso 2, <strong>C(9)</strong> peso 4.
                    Escolhe qual das entradas <strong>D0 a D7</strong> aparece na saída.
                  </li>
                  <li>
                    <strong>Y(5)</strong> repete a entrada escolhida e <strong>W(6)</strong> é o inverso dela.
                  </li>
                  <li>
                    <strong>G(7)</strong> habilita em 0. Com G em 1 (ou solto), Y fica em 0 e W em 1.
                  </li>
                  <li>
                    Truque de aula: ligando D0 a D7 em 0 ou 1, o chip vira qualquer função de três variáveis. As oito
                    entradas são a própria tabela-verdade.
                  </li>
                </ul>
              </>
            )}
            {chip === '74283' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    Soma dois números de 4 bits: <strong>A1 a A4</strong> e <strong>B1 a B4</strong> (o 1 é o bit de peso
                    1). O resultado sai em <strong>Σ1 a Σ4</strong> e o vai-um em <strong>C4(9)</strong>.
                  </li>
                  <li>
                    <strong>C0(7)</strong> é o vem-um: ligue no 0 para somar só A e B. Solto, a soma fica indefinida.
                  </li>
                  <li>
                    <Icon name="alerta" size={14} /> A pinagem é embaralhada: Σ2 está no pino 1 e A1 no pino 5. Confira
                    cada fio no desenho acima.
                  </li>
                  <li>Para somar 8 bits, ligue o C4 de um chip no C0 do outro.</li>
                </ul>
              </>
            )}
            {chip === '7474' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    Dois flip-flops D independentes. Na <strong>subida</strong> do clock (<strong>1CLK(3)</strong>,{' '}
                    <strong>2CLK(11)</strong>), Q passa a valer o que está em D (<strong>1D(2)</strong>,{' '}
                    <strong>2D(12)</strong>). Fora da subida, Q guarda o valor.
                  </li>
                  <li>
                    <strong>PR</strong> (predefinir) e <strong>CLR</strong> (limpar) agem na hora, sem esperar o clock, e
                    são ativos em <em>0</em>: PR em 0 liga Q, CLR em 0 zera Q. Soltos, valem 1 e não atrapalham.
                  </li>
                  <li>
                    <Icon name="alerta" size={14} /> PR e CLR em 0 ao mesmo tempo levam Q e Q̄ a 1. É uma combinação que
                    não se usa: ao soltar os dois, o estado fica indefinido.
                  </li>
                  <li>Ligando D no próprio Q̄, o flip-flop inverte a cada subida e divide a frequência do clock por 2.</li>
                </ul>
              </>
            )}
            {chip === '7476' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    Dois flip-flops JK. Com J e K em 0, guarda; J em 1 liga; K em 1 zera; os dois em 1, inverte.
                  </li>
                  <li>
                    <Icon name="alerta" size={14} /> Este chip muda na <strong>descida</strong> do clock (de 1 para 0),
                    não na subida. Por isso, ligando o 1Q no clock do segundo, a contagem sobe.
                  </li>
                  <li>
                    <Icon name="alerta" size={14} /> A alimentação fica no meio: <strong>VCC no pino 5</strong> e{' '}
                    <strong>GND no pino 13</strong>, não nos cantos como na maioria dos chips.
                  </li>
                  <li>
                    PR e CLR agem na hora e são ativos em 0, como no 7474. J e K precisam estar ligados: soltos, o
                    estado fica indefinido.
                  </li>
                </ul>
              </>
            )}
            {chip === '74161' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    Conta de 0 a 15 em binário a cada <strong>subida</strong> do clock <strong>CLK(2)</strong>.{' '}
                    <strong>QA(14)</strong> é o bit de peso 1 e <strong>QD(11)</strong> o de peso 8.
                  </li>
                  <li>
                    Para contar, <strong>ENP(7)</strong> e <strong>ENT(10)</strong> ficam em 1. Com qualquer um em 0, a
                    contagem para.
                  </li>
                  <li>
                    <strong>LOAD(9)</strong> em 0 carrega o número de <strong>A</strong> a <strong>D</strong> na próxima
                    subida do clock (a carga vence a contagem). <strong>CLR(1)</strong> em 0 zera na hora.
                  </li>
                  <li>
                    <strong>RCO(15)</strong> vai a 1 quando a contagem chega a 15 com ENT em 1: ligado no ENT de outro
                    74161, forma um contador de 8 bits.
                  </li>
                  <li>Entradas de controle soltas valem 1, então o chip conta sozinho só com VCC, GND e clock.</li>
                </ul>
              </>
            )}
            {chip === '74164' && (
              <>
                <h4>Como funciona</h4>
                <ul>
                  <li>
                    A cada <strong>subida</strong> do clock <strong>CLK(8)</strong>, os bits andam uma casa: o que estava
                    em QA vai para QB, e assim até QH. O bit que entra em QA é <strong>A(1) · B(2)</strong>.
                  </li>
                  <li>Ligue B em 1 e use A como entrada; com A ou B em 0, entra um 0.</li>
                  <li>
                    <strong>CLR(9)</strong> em 0 zera as oito saídas na hora. Solto, vale 1.
                  </li>
                  <li>Serve para transformar uma sequência de bits que chega um por vez em oito saídas ao mesmo tempo.</li>
                </ul>
              </>
            )}
            {table && (
              <>
                <h4>Tabela-verdade (cada porta)</h4>
                <table className="tt">
                  <thead>
                    <tr>
                      {def.gates[0].inputs.map((_, i) => (
                        <th key={i}>{String.fromCharCode(65 + i)}</th>
                      ))}
                      <th>Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r) => (
                      <tr key={r.inputs.join('')}>
                        {r.inputs.map((v, i) => (
                          <td key={i}>{v}</td>
                        ))}
                        <td>{r.output}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <h4>Dicas de bancada</h4>
            <ul>
              <li>O <strong>chanfro</strong> (entalhe) indica o lado do pino 1, e o ponto marca o pino 1.</li>
              <li>
                <strong>Sempre ligue a alimentação primeiro</strong>: VCC (pino {def.vcc}) no nível 1
                e GND (pino {def.gnd}) no nível 0. Sem isso, as saídas ficam indefinidas, aqui e na
                protoboard.
              </li>
              {chip === '7402' && (
                <li>
                  <Icon name="alerta" size={14} /> O 7402 tem pinagem <strong>diferente</strong> dos irmãos: a saída (Y) vem
                  <em> antes</em> das entradas em cada porta.
                </li>
              )}
              <li>A numeração cresce em sentido anti-horário, vista de cima.</li>
            </ul>
            <button className="about-close" onClick={loadDemo}>
              Carregar exemplo com o {def.id}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
