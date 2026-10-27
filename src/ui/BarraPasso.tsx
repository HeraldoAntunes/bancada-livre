// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Barra do passo a passo, no topo da bancada: nível atual, bolinhas de progresso, botões grandes e a frase
// do que acontece no nível. Teclas: seta para a direita ou espaço avança, seta para a esquerda volta,
// Home reinicia, Esc sai.
import { useEffect } from 'react'
import { executarNaTela as cmd } from '../comandos'
import { Icon } from './icons'

interface Props {
  nivel: number
  maxNivel: number
  frase: string
}

export function BarraPasso({ nivel, maxNivel, frase }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight' || e.key === ' ') cmd('passo.proximo')
      else if (e.key === 'ArrowLeft') cmd('passo.anterior')
      else if (e.key === 'Home') cmd('passo.ir_para', { nivel: 0 })
      else if (e.key === 'Escape') cmd('passo.sair')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="barra-passo" role="region" aria-label="Passo a passo">
      <div className="barra-passo-linha">
        <strong className="barra-passo-nivel">
          Nível {nivel} de {maxNivel}
        </strong>
        <span className="barra-passo-pontos" aria-hidden="true">
          {Array.from({ length: maxNivel + 1 }, (_, i) => (
            <button key={i} className={i <= nivel ? 'feito' : undefined} title={`Ir ao nível ${i}`} onClick={() => cmd('passo.ir_para', { nivel: i })} />
          ))}
        </span>
        <button onClick={() => cmd('passo.anterior')} disabled={nivel === 0} title="Voltar um nível (seta para a esquerda)">
          <Icon name="voltar" /> Voltar
        </button>
        <button
          className="principal"
          onClick={() => cmd('passo.proximo')}
          disabled={nivel >= maxNivel}
          title="Avançar um nível (seta para a direita ou espaço)"
        >
          Próximo <Icon name="rodar" />
        </button>
        <button onClick={() => cmd('passo.ir_para', { nivel: 0 })} title="Voltar ao começo (Home)">
          <Icon name="desfazer" /> Reiniciar
        </button>
        <button className="sair" onClick={() => cmd('passo.sair')} title="Sair do passo a passo (Esc)">
          Sair
        </button>
      </div>
      <p className="barra-passo-frase">{frase}</p>
    </div>
  )
}
