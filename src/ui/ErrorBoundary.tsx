// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Barreira de erro: um erro inesperado na UI não pode perder o
// trabalho do aluno — o circuito segue no autosave e pode ser baixado daqui.

import { Component, type ReactNode } from 'react'
import { executar } from '../comandos'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  private download = () => {
    // se nem isso for possível, o salvamento automático ainda cobre a recarga
    try {
      const r = executar('arquivo.salvar', { arquivo: 'circuito-recuperado.json' })
      if (!r.ok) console.warn('Bancada Livre: não foi possível baixar o circuito.', r.erro)
    } catch (e) {
      console.warn('Bancada Livre: não foi possível baixar o circuito.', e)
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <h1>Opa, algo deu errado</h1>
        <p>
          O simulador encontrou um erro inesperado. <strong>Seu circuito não foi perdido</strong>:
          ele é salvo automaticamente e deve reaparecer ao recarregar a página.
        </p>
        <div className="crash-actions">
          <button onClick={() => window.location.reload()}>Recarregar a página</button>
          <button onClick={this.download}>Baixar circuito (JSON)</button>
        </div>
        <pre>{String(this.state.error)}</pre>
      </div>
    )
  }
}
