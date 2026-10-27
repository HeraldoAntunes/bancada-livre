// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// BUFFER (repete a entrada) e LED com cor escolhida (campo opcional `cor` no arquivo, desde a 1.0).
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { gateExpression } from '../../engine/gates'
import { simulate } from '../../engine/simulate'
import { inputCount, pinKey } from '../../engine/types'
import { GateShape, LedBody } from '../../ui/symbols'
import { useCircuit } from '../store'

const st = () => useCircuit.getState()

beforeEach(() => {
  useCircuit.setState({ components: [], wires: [], selectedId: null, past: [], future: [] })
})

const desenho = <P extends object>(el: (props: P) => ReactElement, props: P) =>
  renderToStaticMarkup(createElement('svg', null, createElement(el, props)))

describe('BUFFER', () => {
  it('entra na bancada com uma entrada só', () => {
    st().addComponent('BUFFER', 0, 0)
    const b = st().components[0]
    expect(b.inputs).toBeUndefined()
    expect(inputCount(b)).toBe(1)
  })

  it('repete o sinal da entrada (SWITCH → BUFFER → LED)', () => {
    st().addComponent('SWITCH', 0, 0)
    st().addComponent('BUFFER', 100, 0)
    st().addComponent('LED', 200, 0)
    const [s, b, l] = st().components
    st().connect({ comp: s.id, pin: 'out' }, { comp: b.id, pin: 'in0' })
    st().connect({ comp: b.id, pin: 'out' }, { comp: l.id, pin: 'in' })
    const ligado = (v: 0 | 1) =>
      simulate(
        st().components.map((c) => (c.id === s.id ? { ...c, state: v } : c)),
        st().wires,
      ).pins.get(pinKey(l.id, 'in'))
    expect(ligado(1)).toBe(1)
    expect(ligado(0)).toBe(0)
  })

  it('tem expressão e símbolo próprios: triângulo sem a bolinha do NOT', () => {
    expect(gateExpression('BUFFER')).toBe('S = A')
    const buffer = desenho(GateShape, { type: 'BUFFER', h: 48 })
    const not = desenho(GateShape, { type: 'NOT', h: 48 })
    expect(buffer).toContain('<path')
    expect(buffer).not.toContain('<circle')
    expect(not).toContain('<circle')
  })

  it('abre de um arquivo salvo', () => {
    const arq = { version: 1, components: [{ id: 'b', type: 'BUFFER', x: 0, y: 0 }], wires: [] }
    expect(st().loadJSON(JSON.stringify(arq))).toBeNull()
  })
})

describe('LED colorido', () => {
  it('troca a cor, salva no arquivo e o desfazer volta', () => {
    st().addComponent('LED', 0, 0)
    const id = st().components[0].id
    st().setCorLed(id, 'vermelho')
    expect(st().components[0].cor).toBe('vermelho')
    expect(JSON.parse(st().toJSON()).components[0].cor).toBe('vermelho')
    st().undo()
    expect(st().components[0].cor).toBeUndefined()
  })

  it('azul é o padrão e não grava o campo', () => {
    st().addComponent('LED', 0, 0)
    const id = st().components[0].id
    st().setCorLed(id, 'verde')
    st().setCorLed(id, 'azul')
    expect('cor' in JSON.parse(st().toJSON()).components[0]).toBe(false)
  })

  it('arquivo antigo (sem cor) abre igual; cor desconhecida é recusada', () => {
    const antigo = { version: 1, components: [{ id: 'l', type: 'LED', x: 0, y: 0 }], wires: [] }
    expect(st().loadJSON(JSON.stringify(antigo))).toBeNull()
    const bom = { version: 1, components: [{ id: 'l', type: 'LED', x: 0, y: 0, cor: 'amarelo' }], wires: [] }
    expect(st().loadJSON(JSON.stringify(bom))).toBeNull()
    const ruim = { version: 1, components: [{ id: 'l', type: 'LED', x: 0, y: 0, cor: 'roxo' }], wires: [] }
    expect(st().loadJSON(JSON.stringify(ruim))).toMatch(/inválido/)
  })

  it('aceso, mostra a cor escolhida; apagado, só um tom claro dela', () => {
    expect(desenho(LedBody, { signal: 1, cor: 'vermelho' })).toContain('#e03131')
    expect(desenho(LedBody, { signal: 0, cor: 'vermelho' })).not.toContain('#e03131')
    expect(desenho(LedBody, { signal: 1 })).toContain('#1f6fd0')
  })
})
