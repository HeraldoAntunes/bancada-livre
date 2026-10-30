// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { useEffect, useMemo } from 'react'
import { chipOf, icPowered } from '../engine/ics'
import { propagationLevels, stepFilteredSim } from '../engine/propagation'
import { simulate } from '../engine/simulate'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd } from '../comandos'
import { Palette } from './Palette'
import { BarraPasso } from './BarraPasso'
import { JanelaEdicao } from './JanelaEdicao'
import { JanelaRecuperacao } from './JanelaRecuperacao'
import { JanelaLinhaDoTempo } from './JanelaLinhaDoTempo'
import { JanelaTabela } from './JanelaTabela'
import { descreverNivel } from './passos'
import { SidePanel } from './SidePanel'
import { TopBar } from './TopBar'
import { Workbench } from './Workbench'
import { Icon } from './icons'
import { ignorarAtalho } from './atalhos'

export default function App() {
  const components = useCircuit((s) => s.components)
  const tabelaSolta = useCircuit((s) => s.tabelaSolta)
  const linhaAtiva = useCircuit((s) => s.linhaAtiva)
  const wires = useCircuit((s) => s.wires)
  const clockRunning = useCircuit((s) => s.clockRunning)
  const oscilando = useCircuit((s) => s.oscilando)
  const falhaSalvamento = useCircuit((s) => s.falhaSalvamento)
  const avisoRecuperacao = useCircuit((s) => s.avisoRecuperacao)
  const avisoRelogio = useCircuit((s) => s.avisoRelogio)
  const tickClocks = useCircuit((s) => s.tickClocks)
  const hasClock = components.some((c) => c.type === 'CLOCK' || c.type === 'COUNTER')
  const tab = useCircuit((s) => s.abaPaleta)

  // Modo passo a passo: a onda de propagação avança nível a nível.
  const passo = useCircuit((s) => s.passo)
  const stepMode = passo.ativo
  const stepIndex = passo.nivel

  const sim = useMemo(() => simulate(components, wires), [components, wires])
  // primeiro CI sem VCC/GND: o aviso diz os pinos certos dele (14 e 7 ou 16 e 8)
  const semEnergia = components.find((c) => c.type === 'IC' && !icPowered(c, sim.pins))
  const prop = useMemo(() => propagationLevels(components, wires), [components, wires])
  const shownSim = useMemo(
    () => (stepMode ? stepFilteredSim(sim, components, wires, prop.levels, stepIndex, prop.saidas) : sim),
    [stepMode, sim, components, wires, prop, stepIndex],
  )

  // Mudanças no circuito não podem deixar o passo além do último nível.
  useEffect(() => {
    if (stepMode && stepIndex > prop.maxLevel) cmd('passo.ir_para', { nivel: prop.maxLevel })
  }, [stepMode, stepIndex, prop.maxLevel])

  const toggleStepMode = () => cmd(stepMode ? 'passo.sair' : 'passo.ligar')

  // Relógio: avança o tempo virtual enquanto houver CLOCK e o transporte estiver rodando.
  // Usa o tempo real decorrido (performance.now) — navegadores estrangulam timers em
  // abas ocultas, e o delta real mantém a frequência do clock correta mesmo assim.
  useEffect(() => {
    if (!clockRunning || !hasClock) return
    let last = performance.now()
    const iv = window.setInterval(() => {
      const now = performance.now()
      tickClocks(now - last)
      last = now
    }, 50)
    return () => window.clearInterval(iv)
  }, [clockRunning, hasClock, tickClocks])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignorarAtalho(document)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        cmd(e.shiftKey ? 'historico.refazer' : 'historico.desfazer')
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        cmd('historico.refazer')
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') cmd('selecao.remover')
      // E espelha e R gira o componente selecionado
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'e' || e.key === 'E' || e.key === 'r' || e.key === 'R')) {
        const { selectedId, components: cs } = useCircuit.getState()
        if (selectedId && cs.some((c) => c.id === selectedId)) {
          cmd(e.key.toLowerCase() === 'e' ? 'componente.espelhar' : 'componente.girar', { id: selectedId })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <TopBar tab={tab} stepMode={stepMode} onToggleStep={toggleStepMode} />
      <Palette tab={tab} />
      <Workbench
        sim={shownSim}
        stepHighlight={stepMode ? stepIndex : null}
        levels={prop.levels}
      />
      {stepMode && (
        <BarraPasso
          nivel={stepIndex}
          maxNivel={prop.maxLevel}
          frase={descreverNivel(components, prop.levels, stepIndex, prop.maxLevel)}
        />
      )}
      <SidePanel sim={sim} />
      {tabelaSolta && <JanelaTabela />}
      {linhaAtiva && <JanelaLinhaDoTempo />}
      <JanelaEdicao />
      <JanelaRecuperacao />
      <footer className="status">
        <span>
          {components.length} componente{components.length === 1 ? '' : 's'} · {wires.length} fio
          {wires.length === 1 ? '' : 's'}
        </span>
        {falhaSalvamento && (
          <span className="warn" role="alert">
            <Icon name="alerta" size={14} /> {falhaSalvamento}
          </span>
        )}
        {avisoRecuperacao && (
          <span className="warn" role="status">
            <Icon name="alerta" size={14} /> {avisoRecuperacao}
          </span>
        )}
        {avisoRelogio && (
          <span className="warn" role="status">
            <Icon name="alerta" size={14} /> {avisoRelogio}
          </span>
        )}
        {semEnergia && (
          <span className="warn">
            <Icon name="raio" size={14} /> {chipOf(semEnergia).id} sem alimentação: ligue VCC (pino{' '}
            {chipOf(semEnergia).vcc}) ao nível 1 e GND (pino {chipOf(semEnergia).gnd}) ao nível 0
          </span>
        )}
        {sim.cycleComps.size > 0 && (
          <span className="warn">
            <Icon name="alerta" size={14} /> Laço combinacional detectado: sinal marcado como E
          </span>
        )}
        {oscilando && (
          <span className="warn">
            <Icon name="alerta" size={14} /> Oscilação: um flip-flop ou trava não parou de mudar e ficou indefinido (X)
          </span>
        )}
        {sim.conflictPins.size > 0 && (
          <span className="warn">
            <Icon name="alerta" size={14} /> Conflito: mais de uma saída no mesmo ponto
          </span>
        )}
        <span className="spacer" />
        <span className="legend">
          1 = azul grosso · 0 = fino vazado · X = tracejado · E = laranja
        </span>
      </footer>
    </div>
  )
}
