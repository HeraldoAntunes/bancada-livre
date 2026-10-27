// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
import React from 'react'
import ReactDOM from 'react-dom/client'
import { version } from '../package.json'
import { executar, listar } from './comandos'
import App from './ui/App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './styles.css'

// Cada ação é um comando: um agente de IA que controla o navegador usa o programa aberto sem clicar.
declare global {
  interface Window {
    bancadaLivre: { versao: string; listar: typeof listar; executar: typeof executar }
  }
}
window.bancadaLivre = { versao: version, listar, executar }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
