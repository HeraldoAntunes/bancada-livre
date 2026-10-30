// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { Falha, executarNaTela as cmd, registrar } from '../comandos'
import { programa, useCircuit } from '../state/store'

export function registrarComandosRecuperacao() {
  const retirar = [
    registrar('recuperacao.listar', { descricao: 'Lista as versões de circuito aguardando escolha',
      params: {}, executar: () => useCircuit.getState().recuperacao }),
    registrar('recuperacao.escolher', { descricao: 'Continua uma das versões apresentadas na recuperação',
      params: { indice: { tipo: 'inteiro', descricao: 'posição da versão, a partir de zero', min: 0 } },
      executar: (p) => {
        const estado = useCircuit.getState()
        if (!estado.recuperacao?.[p.indice as number]) throw new Falha('Escolha uma das versões apresentadas.')
        estado.escolherRecuperacao(p.indice as number)
      } }),
    registrar('recuperacao.adiar', { descricao: 'Fecha sem escolher nem substituir circuitos guardados',
      params: {}, executar: () => {
        // nada se perde ao adiar: fecha direto (fechar_sem_gravar faria o programa perguntar se fecha mesmo sem gravar)
        if (programa().__TAURI__) return programa().__TAURI__!.core.invoke('fechar')
        window.close()
      } }),
  ]
  return () => retirar.forEach(f => f())
}

export function horaDaCopia(hora: number) {
  const data = new Date(hora)
  return hora > 0 && Number.isFinite(data.getTime()) ? data.toLocaleString('pt-BR') : 'Hora não disponível'
}

export function JanelaRecuperacao() {
  const copias = useCircuit(s => s.recuperacao)
  const janela = useRef<HTMLDivElement>(null)
  useEffect(registrarComandosRecuperacao, [])
  useEffect(() => {
    if (!copias) return
    janela.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [copias])
  if (!copias) return null
  const pergunta = `Encontrei ${copias.length === 2 ? 'duas' : copias.length} versões do seu circuito. Qual quer continuar?`
  return (
    <div className="modal-overlay">
      <div className="modal recuperacao" ref={janela} role="dialog" aria-modal="true"
        aria-labelledby="pergunta-recuperacao" onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); cmd('recuperacao.adiar') }
          if (e.key !== 'Tab') return
          const botoes = janela.current?.querySelectorAll<HTMLButtonElement>('button')
          if (!botoes?.length) return
          const primeiro = botoes[0], ultimo = botoes[botoes.length - 1]
          if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
          if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
        }}>
        <h2 id="pergunta-recuperacao">{pergunta}</h2>
        <p>Confira a origem, a hora e o tamanho de cada versão antes de escolher.</p>
        <ul className="recuperacao-copias">
          {copias.map((copia, indice) => (
            <li key={indice}>
              <strong>{copia.origem}</strong>
              <span>{horaDaCopia(copia.hora)}</span>
              <span>{copia.componentes} peça{copia.componentes === 1 ? '' : 's'} e {copia.fios} fio{copia.fios === 1 ? '' : 's'}</span>
              <button className="principal" aria-label={`Continuar versão ${indice + 1}: ${copia.origem}`}
                onClick={() => cmd('recuperacao.escolher', { indice })}>Continuar esta versão</button>
            </li>
          ))}
        </ul>
        <p>As outras versões continuam guardadas. Se fechar sem escolher, a pergunta volta na próxima abertura.</p>
        <button onClick={() => cmd('recuperacao.adiar')}>Fechar sem escolher</button>
      </div>
    </div>
  )
}
