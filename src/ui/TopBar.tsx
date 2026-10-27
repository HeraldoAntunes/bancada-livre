// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Barra superior: marca, abas da paleta e botões agrupados por função (Arquivo, Editar, Aula),
// com título em cada grupo, e a versão (abre o Sobre).

import { useRef, useState } from 'react'
import { version } from '../../package.json'
import { EXAMPLE_LEVELS, EXAMPLES } from '../examples'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd } from '../comandos'
import { AboutDialog } from './AboutDialog'
import { GuideDialog } from './GuideDialog'
import type { Tab } from './Palette'
import { Icon, type IconName } from './icons'
import { Marca } from './Marca'

const TABS: { id: Tab; name: string; icon: IconName }[] = [
  { id: 'ENTRADAS', name: 'ENTRADAS', icon: 'chave' },
  { id: 'PORTAS', name: 'PORTAS', icon: 'porta' },
  { id: 'SAIDAS', name: 'SAÍDAS', icon: 'lampada' },
  { id: 'CIS', name: 'CIs', icon: 'chip' },
]

interface TopBarProps {
  tab: Tab
  stepMode: boolean
  onToggleStep: () => void
}

export function TopBar({ tab, stepMode, onToggleStep }: TopBarProps) {
  const canUndo = useCircuit((s) => s.past.length > 0)
  const canRedo = useCircuit((s) => s.future.length > 0)
  const showNames = useCircuit((s) => s.showNames)
  const guideChip = useCircuit((s) => s.guideChip)
  const tabelaSolta = useCircuit((s) => s.tabelaSolta)
  const fileRef = useRef<HTMLInputElement>(null)
  const [showAbout, setShowAbout] = useState(false)

  const open = async (file: File | undefined) => {
    if (!file) return
    cmd('circuito.abrir', { json: await file.text() })
  }

  return (
    <header className="topbar">
      <span className="brand">
        <Marca size={34} /> Bancada Livre
      </span>
      {TABS.map((t) => (
        <button key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => cmd('paleta.aba', { aba: t.id })}>
          <Icon name={t.icon} size={20} />
          <span className="tab-nome">{t.name}</span>
        </button>
      ))}
      <span className="spacer" />

      <div className="grupo" role="group" aria-label="Arquivo">
        <span className="grupo-titulo">Arquivo</span>
        <div className="grupo-botoes">
          <button className="action" title="Abrir um circuito salvo (.json)" onClick={() => fileRef.current?.click()}>
            <Icon name="abrir" size={15} /> Abrir
          </button>
          <button className="action" title="Salvar o circuito num arquivo (.json)" onClick={() => cmd('arquivo.salvar')}>
            <Icon name="salvar" size={15} /> Salvar
          </button>
          <button className="action" title="Exportar a imagem do circuito" onClick={() => cmd('imagem.exportar')}>
            <Icon name="imagem" size={15} /> PNG
          </button>
        </div>
      </div>

      <div className="grupo" role="group" aria-label="Editar">
        <span className="grupo-titulo">Editar</span>
        <div className="grupo-botoes">
          <button className="action" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled={!canUndo} onClick={() => cmd('historico.desfazer')}>
            <Icon name="desfazer" />
          </button>
          <button className="action" title="Refazer (Ctrl+Y)" aria-label="Refazer" disabled={!canRedo} onClick={() => cmd('historico.refazer')}>
            <Icon name="refazer" />
          </button>
          <button
            className="action alerta"
            title="Apagar todos os componentes e fios da bancada"
            onClick={() => {
              if (window.confirm('Limpar toda a bancada?')) cmd('circuito.limpar')
            }}
          >
            <Icon name="limpar" size={15} /> Limpar tudo
          </button>
        </div>
      </div>

      <div className="grupo" role="group" aria-label="Aula">
        <span className="grupo-titulo">Aula</span>
        <div className="grupo-botoes">
          <select
            className="lang exemplos"
            value=""
            title="Carregar circuito de exemplo"
            onChange={(e) => {
              if (e.target.value) cmd('exemplo.abrir', { nome: e.target.value })
            }}
          >
            <option value="" disabled>
              Exemplos…
            </option>
            {EXAMPLE_LEVELS.map((lv) => (
              <optgroup key={lv} label={lv}>
                {EXAMPLES.filter((e) => e.level === lv).map((ex) => (
                  <option key={ex.name} value={ex.name}>
                    {ex.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            className={'action' + (stepMode ? ' active' : '')}
            title="Modo passo a passo: veja a propagação avançar porta a porta"
            aria-label="Modo passo a passo"
            onClick={onToggleStep}
          >
            <Icon name="degraus" size={15} /> Passo a passo
          </button>
          <button
            className={'action' + (tabelaSolta ? ' active' : '')}
            title="Tabela-verdade do circuito numa janela que dá para mover e aumentar"
            onClick={() => cmd('tabela.destacar', { solta: !tabelaSolta })}
          >
            <Icon name="tabela" size={15} /> Tabela
          </button>
          <button className="action" title="Guia de CIs: pinagem, função e exemplos" onClick={() => cmd('guia.abrir')}>
            <Icon name="livro" size={15} /> Guia
          </button>
          <button
            className={'action' + (showNames ? ' active' : '')}
            title="Mostrar ou ocultar os nomes das portas na bancada"
            aria-label="Nomes das portas"
            onClick={() => cmd('nomes.mostrar', { mostrar: !showNames })}
          >
            Aa
          </button>
        </div>
      </div>

      <button
        className="version"
        title="Sobre o Bancada Livre: versão, autoria, licença e tecnologias"
        onClick={() => setShowAbout(true)}
      >
        v{version} <Icon name="info" size={14} />
      </button>
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {guideChip && <GuideDialog initial={guideChip} onClose={() => cmd('guia.fechar')} />}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          void open(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </header>
  )
}
