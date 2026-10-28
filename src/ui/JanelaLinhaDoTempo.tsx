// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Linha do tempo dos sinais: janela que se arrasta pela barra de título e se redimensiona pelo canto, com uma onda
// por sinal. Cada coluna é um momento em que algum sinal mudou (subida ou descida do clock, chave, flip-flop).
// Posição e tamanho ficam lembrados neste navegador.
import { useEffect, useRef, useState } from 'react'
import { executarNaTela as cmd } from '../comandos'
import { sinaisObservados } from '../engine/linhaDoTempo'
import type { Signal } from '../engine/types'
import { useCircuit } from '../state/store'
import { manterNaTela, type Caixa } from './janela'
import { ouvirFimDoPonteiro } from './ponteiro'

const CHAVE = 'bancada-livre:janela-linha-do-tempo'
const tela = () => ({ w: window.innerWidth, h: window.innerHeight })

const NOME_W = 78
const LINHA_H = 26
const ALTO = 5
const BAIXO = 19

function lerSalva(): Caixa | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    return c && [c.x, c.y, c.w, c.h].every(Number.isFinite) ? c : null
  } catch {
    return null
  }
}

function inicial(t: { w: number; h: number }): Caixa {
  const w = Math.min(900, t.w - 40)
  const h = Math.min(280, t.h - 120)
  return { x: 20, y: Math.max(70, t.h - h - 40), w, h }
}

/** Uma onda: degraus entre 0 (embaixo) e 1 (em cima); X é a faixa do meio tracejada e E, laranja. */
function Onda({ valores, passo }: { valores: Signal[]; passo: number }) {
  const y = (v: Signal) => (v === 1 ? ALTO : BAIXO)
  let d = ''
  const especiais: { i: number; v: Signal }[] = []
  valores.forEach((v, i) => {
    const x0 = i * passo
    const x1 = x0 + passo
    if (v === 0 || v === 1) {
      d += `${d === '' || (valores[i - 1] !== 0 && valores[i - 1] !== 1) ? 'M' : 'L'} ${x0} ${y(v)} L ${x1} ${y(v)} `
    } else {
      especiais.push({ i, v })
    }
  })
  return (
    <g>
      {especiais.map(({ i, v }) => (
        <rect
          key={i}
          x={i * passo}
          y={ALTO}
          width={passo}
          height={BAIXO - ALTO}
          fill={v === 'E' ? '#f08c00' : '#dee2e6'}
          opacity={v === 'E' ? 0.8 : 1}
        />
      ))}
      <path d={d} fill="none" stroke="#1c4f8a" strokeWidth={2.2} strokeLinejoin="round" />
    </g>
  )
}

export function JanelaLinhaDoTempo() {
  const components = useCircuit((s) => s.components)
  const amostras = useCircuit((s) => s.linhaDoTempo)
  const [caixa, setCaixa] = useState<Caixa>(() => manterNaTela(lerSalva() ?? inicial(tela()), tela()))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      setCaixa((c) => (c.w === w && c.h === h ? c : { ...c, w, h }))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(caixa))
    } catch {
      /* armazenamento indisponível: a janela só não fica lembrada */
    }
  }, [caixa])

  const arrastar = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const inicio = { x: e.clientX, y: e.clientY }
    const c0 = caixa
    const mover = (ev: PointerEvent) =>
      setCaixa(manterNaTela({ ...c0, x: c0.x + ev.clientX - inicio.x, y: c0.y + ev.clientY - inicio.y }, tela()))
    const fim = () => window.removeEventListener('pointermove', mover)
    window.addEventListener('pointermove', mover)
    ouvirFimDoPonteiro(window, fim, fim)
  }

  const sinais = sinaisObservados(components)
  const area = Math.max(caixa.w - NOME_W - 40, 120)
  const passo = Math.max(10, Math.min(36, area / Math.max(amostras.length, 1)))

  return (
    <div
      ref={ref}
      className="janela janela-tempo"
      role="dialog"
      aria-label="Linha do tempo dos sinais"
      style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }}
      onPointerUp={() => {
        const el = ref.current
        if (el) setCaixa((c) => ({ ...c, w: el.offsetWidth, h: el.offsetHeight }))
      }}
    >
      <div className="janela-titulo" onPointerDown={arrastar} title="Arraste para mover">
        <span>Linha do tempo dos sinais</span>
        <span className="janela-botoes">
          <button title="Apagar o que foi guardado e recomeçar agora" onClick={() => cmd('linha_do_tempo.limpar')}>
            Recomeçar
          </button>
          <button title="Fechar a linha do tempo" onClick={() => cmd('linha_do_tempo.mostrar', { mostrar: false })}>
            Fechar
          </button>
        </span>
      </div>
      <div className="janela-corpo">
        {sinais.length === 0 ? (
          <p className="hint">
            Ponha um clock, uma chave ou um flip-flop na bancada: cada um ganha uma linha aqui, junto com os LEDs.
          </p>
        ) : (
          <>
            <p className="hint">
              Cada coluna é um momento em que algum sinal mudou. Em cima é 1, embaixo é 0; a faixa cinza é indefinido.
            </p>
            <div className="tempo-scroll">
              <svg
                width={NOME_W + amostras.length * passo + 8}
                height={sinais.length * LINHA_H + 4}
                role="img"
                aria-label="Ondas dos sinais ao longo do tempo"
              >
                {sinais.map((s, i) => (
                  <g key={s.chave} transform={`translate(0 ${i * LINHA_H + 2})`}>
                    <text x={NOME_W - 8} y={16} textAnchor="end" fontSize={12} fontWeight={700} fill="#2f4a66">
                      {s.nome}
                    </text>
                    <line x1={NOME_W} y1={LINHA_H - 1} x2={NOME_W + amostras.length * passo} y2={LINHA_H - 1} stroke="#e9ecef" />
                    <g transform={`translate(${NOME_W} 0)`}>
                      <Onda valores={amostras.map((a) => a[s.chave] ?? 'X')} passo={passo} />
                    </g>
                  </g>
                ))}
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
