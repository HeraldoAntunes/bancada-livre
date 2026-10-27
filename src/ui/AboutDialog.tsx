// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Janela "Sobre": versão, autoria, licença, privacidade, uso de IA e terceiros.
// Visível dentro do próprio programa: quem recebe só o HTML também vê os créditos.

import { useEffect } from 'react'
import { version } from '../../package.json'
import { Marca } from './Marca'
import { SOBRE } from './sobre'

export function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Sobre o Bancada Livre">
        <h2>
          <Marca size={32} /> Bancada Livre
        </h2>
        <p className="about-version">Versão {version} · 2026</p>

        <dl className="about-list">
          <dt>Autor</dt>
          <dd>{SOBRE.autor}</dd>

          <dt>Licença</dt>
          <dd>{SOBRE.licenca}</dd>

          <dt>Privacidade</dt>
          <dd>{SOBRE.privacidade}</dd>

          <dt>Como foi feito</dt>
          <dd>{SOBRE.ia}</dd>

          <dt>Componentes de terceiros</dt>
          <dd>{SOBRE.terceiros}</dd>

          <dt>Tecnologias</dt>
          <dd>{SOBRE.tecnologias}</dd>
        </dl>

        <p className="about-hint">
          Ferramenta didática para o ensino de lógica digital. {SOBRE.marcas}
        </p>

        <button className="about-close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
