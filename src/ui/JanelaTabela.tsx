// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Tabela-verdade destacada: janela dentro do programa que se arrasta pela barra de título e se
// redimensiona pelo canto; a letra cresce com a largura (bom para projetar). Posição e tamanho ficam
// lembrados neste navegador.
import { useEffect, useRef, useState } from 'react'
import { executarNaTela as cmd } from '../comandos'
import { janelaInicial, manterNaTela, type Caixa } from './janela'
import { ouvirFimDoPonteiro } from './ponteiro'
import { TabelaDoCircuito } from './TabelaDoCircuito'

const CHAVE = 'bancada-livre:janela-tabela'
const tela = () => ({ w: window.innerWidth, h: window.innerHeight })

function lerSalva(): Caixa | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    return c && [c.x, c.y, c.w, c.h].every(Number.isFinite) ? c : null
  } catch {
    return null
  }
}

export function JanelaTabela() {
  const [caixa, setCaixa] = useState<Caixa>(() => manterNaTela(lerSalva() ?? janelaInicial(tela()), tela()))
  const ref = useRef<HTMLDivElement>(null)

  // redimensionar pelo canto (CSS resize): acompanha o tamanho novo
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

  return (
    <div
      ref={ref}
      className="janela"
      role="dialog"
      aria-label="Tabela-verdade do circuito"
      style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }}
      // garantia além do ResizeObserver: ao soltar o canto de redimensionar, guarda o tamanho atual
      onPointerUp={() => {
        const el = ref.current
        if (el) setCaixa((c) => ({ ...c, w: el.offsetWidth, h: el.offsetHeight }))
      }}
    >
      <div className="janela-titulo" onPointerDown={arrastar} title="Arraste para mover">
        <span>Tabela-verdade do circuito</span>
        <button title="Devolver a tabela ao painel lateral" onClick={() => cmd('tabela.destacar', { solta: false })}>
          Devolver ao painel
        </button>
      </div>
      <div className="janela-corpo">
        <TabelaDoCircuito />
      </div>
    </div>
  )
}
