// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Janela de edição aberta com duplo clique no componente: os mesmos campos do painel, em destaque.
import { useEffect } from 'react'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd } from '../comandos'
import { CamposDoComponente, nomeDoComponente } from './CamposDoComponente'

export function JanelaEdicao() {
  const editandoId = useCircuit((s) => s.editandoId)
  const comp = useCircuit((s) => s.components.find((c) => c.id === s.editandoId))
  const editar = useCircuit((s) => s.editar)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT')) editar(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editar])

  if (!editandoId || !comp) return null
  return (
    <div className="modal-overlay" onClick={() => editar(null)}>
      <div className="modal edicao" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Editar ${nomeDoComponente(comp)}`}>
        <h2>{nomeDoComponente(comp)}</h2>
        <CamposDoComponente comp={comp} />
        <div className="edicao-rodape">
          <button
            className="danger"
            onClick={() => {
              cmd('componente.remover', { id: comp.id })
              editar(null)
            }}
          >
            Remover
          </button>
          <button className="principal" onClick={() => editar(null)}>
            Pronto
          </button>
        </div>
      </div>
    </div>
  )
}
