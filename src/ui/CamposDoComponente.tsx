// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Campos editáveis de um componente (rótulo, entradas, modo, frequência...): os mesmos no painel de
// propriedades e na janela de edição aberta com duplo clique.
import { chipOf } from '../engine/ics'
import { bitsDe, entradaUnica, inputCount, isGate, isSeq, type CircuitComponent } from '../engine/types'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd } from '../comandos'
import { Icon } from './icons'

const NOMES: Record<string, string> = {
  SWITCH: 'Chave (SWITCH)',
  CLOCK: 'Clock (onda quadrada)',
  PUSH_BUTTON: 'Botão (PUSH BUTTON)',
  LEVEL_HIGH: 'Nível alto (1)',
  LEVEL_LOW: 'Nível baixo (0)',
  LED: 'LED',
  DIP_SWITCH: 'Banco de chaves',
  COUNTER: 'Contador automático',
  LED_BAR: 'Barra de LEDs',
  DISPLAY: 'Display 7 segmentos',
  PROBE: 'Sonda (valor lógico)',
  LABEL: 'Texto (anotação)',
  FF_D: 'Flip-flop D',
  FF_JK: 'Flip-flop JK',
  FF_T: 'Flip-flop T',
  FF_SR: 'Flip-flop SR',
  LATCH_D: 'Trava D (latch)',
}

const COM_ROTULO = new Set(['SWITCH', 'PUSH_BUTTON', 'LED', 'DISPLAY', 'PROBE', 'CLOCK', 'LABEL', 'DIP_SWITCH', 'LED_BAR', 'COUNTER', 'FF_D', 'FF_JK', 'FF_T', 'FF_SR', 'LATCH_D'])

export function nomeDoComponente(c: CircuitComponent): string {
  return c.type === 'IC' ? `CI ${chipOf(c).id}` : (NOMES[c.type] ?? `Porta ${c.type}`)
}

export function CamposDoComponente({ comp }: { comp: CircuitComponent }) {
  const clockRunning = useCircuit((s) => s.clockRunning)

  return (
    <>
      <div className="orientacao-acoes">
        <button onClick={() => cmd('componente.espelhar', { id: comp.id })} title="Troca o lado das entradas e da saída (tecla E)">
          Espelhar
        </button>
        <button onClick={() => cmd('componente.girar', { id: comp.id })} title="Gira 90 graus no sentido horário (tecla R)">
          Girar 90 graus
        </button>
      </div>
      {(COM_ROTULO.has(comp.type) || isGate(comp.type)) && (
        <label className="field">
          {comp.type === 'LABEL' ? 'Texto' : 'Rótulo'}{' '}
          <input
            value={comp.label ?? ''}
            maxLength={comp.type === 'LABEL' ? 60 : 8}
            onChange={(e) => cmd('componente.rotulo', { id: comp.id, texto: e.target.value })}
          />
        </label>
      )}
      {comp.type === 'IC' && (
        <>
          <p className="hint">{chipOf(comp).title}</p>
          <button onClick={() => cmd('guia.abrir', { chip: chipOf(comp).id })}>
            <Icon name="livro" size={14} /> Abrir no Guia de CIs
          </button>
        </>
      )}
      {(comp.type === 'CLOCK' || comp.type === 'COUNTER') && (
        <>
          <div className="clock-acoes">
            <button onClick={() => cmd(clockRunning ? 'clock.pausar' : 'clock.rodar')}>
              <Icon name={clockRunning ? 'pausar' : 'rodar'} size={14} /> {clockRunning ? 'Pausar' : 'Rodar'}
            </button>
            <button onClick={() => cmd('clock.avancar')} title="Com o clock pausado, vê cada transição">
              <Icon name="avancar" size={14} /> Avançar meio período
            </button>
          </div>
          <label className="field">
            Frequência{' '}
            <select value={comp.freq ?? 1} onChange={(e) => cmd('clock.frequencia', { id: comp.id, hz: Number(e.target.value) })}>
              {[0.5, 1, 2, 5, 10].map((hz) => (
                <option key={hz} value={hz}>
                  {hz} Hz
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {comp.type === 'DISPLAY' && (
        <label className="field">
          Modo{' '}
          <select value={comp.mode ?? 'bcd'} onChange={(e) => cmd('display.modo', { id: comp.id, modo: e.target.value })}>
            <option value="bcd">BCD (0 a 9)</option>
            <option value="hex">Hexadecimal (0 a F)</option>
            <option value="raw">Segmento a segmento (a a g)</option>
          </select>
        </label>
      )}
      {(comp.type === 'LED' || comp.type === 'LED_BAR') && (
        <label className="field">
          Cor{' '}
          <select value={comp.cor ?? 'azul'} onChange={(e) => cmd('led.cor', { id: comp.id, cor: e.target.value })}>
            <option value="azul">Azul</option>
            <option value="vermelho">Vermelho</option>
            <option value="verde">Verde</option>
            <option value="amarelo">Amarelo</option>
          </select>
        </label>
      )}
      {(comp.type === 'DIP_SWITCH' || comp.type === 'LED_BAR') && (
        <label className="field">
          Posições{' '}
          <select value={bitsDe(comp)} onChange={(e) => cmd('componente.bits', { id: comp.id, n: Number(e.target.value) })}>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </label>
      )}
      {comp.type === 'COUNTER' && (
        <label className="field">
          Bits{' '}
          <select value={bitsDe(comp)} onChange={(e) => cmd('componente.bits', { id: comp.id, n: Number(e.target.value) })}>
            <option value={2}>2 (0 a 3)</option>
            <option value={3}>3 (0 a 7)</option>
            <option value={4}>4 (0 a 15)</option>
          </select>
        </label>
      )}
      {isSeq(comp.type) && (
        <label className="field">
          Estado guardado (Q){' '}
          <select
            value={comp.q === 1 ? 1 : 0}
            onChange={(e) => cmd('memoria.definir', { id: comp.id, q: Number(e.target.value) })}
          >
            <option value={0}>0</option>
            <option value={1}>1</option>
          </select>
          {comp.q === 'X' && ' (agora indefinido)'}
        </label>
      )}
      {isGate(comp.type) && !entradaUnica(comp.type) && (
        <label className="field">
          Entradas{' '}
          <select value={inputCount(comp)} onChange={(e) => cmd('porta.entradas', { id: comp.id, n: Number(e.target.value) })}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )
}
