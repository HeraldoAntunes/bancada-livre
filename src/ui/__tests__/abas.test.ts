// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Abas da paleta com ícone e nome (a escolhida em azul), "Limpar tudo" com nome e cor de alerta e,
// no CI sem alimentação, a faixa escura no meio do corpo, longe dos números dos pinos.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CHIPS } from '../../engine/ics'
import css from '../../styles.css?raw'
import { ChipBody } from '../symbols'
import { TopBar } from '../TopBar'

const regra = (seletor: string) => {
  const linhas = css.split(/\r?\n/)
  const i = linhas.findIndex((l) => l === `${seletor} {`)
  if (i < 0) return ''
  const fim = linhas.findIndex((l, j) => j > i && l.startsWith('}'))
  return linhas.slice(i + 1, fim).join('\n')
}

const barra = renderToStaticMarkup(
  createElement(TopBar, { tab: 'PORTAS', stepMode: false, onToggleStep: () => {} }),
)
const chip = (powered: boolean) =>
  renderToStaticMarkup(createElement('svg', null, createElement(ChipBody, { def: CHIPS['7400'], powered })))

describe('abas da paleta', () => {
  it('cada aba tem ícone e nome', () => {
    const abas = barra.match(/<button class="tab[^"]*"[^>]*>.*?<\/button>/g) ?? []
    expect(abas).toHaveLength(5)
    for (const aba of abas) {
      expect(aba).toContain('<svg')
      expect(aba).toMatch(/<span class="tab-nome">[^<]+<\/span>/)
    }
  })

  it('a aba escolhida fica azul', () => {
    expect(barra).toMatch(/<button class="tab active"[^>]*>.*?PORTAS/)
    expect(regra('.tab.active')).toMatch(/background:\s*#1c7ed6/)
  })
})

describe('Limpar tudo', () => {
  it('mostra o nome e usa a cor de alerta', () => {
    expect(barra).toMatch(/<button class="action alerta"[^>]*>.*?Limpar tudo<\/button>/)
    expect(regra('.topbar .grupo .action.alerta')).toMatch(/background:\s*#c92a2a/)
  })
})

describe('CI sem VCC e GND', () => {
  const sem = chip(false)
  const com = chip(true)

  it('mostra uma faixa escura com texto menor no meio do corpo', () => {
    expect(sem).toContain('fill="#7a2e00"')
    expect(sem).toMatch(/font-size="9.5"[^>]*fill="#ffd8a8"[^>]*>sem VCC e GND</)
  })

  it('não usa mais o texto amarelo sobre os pinos', () => {
    expect(sem).not.toContain('#ffd43b')
  })

  it('alimentado, não mostra a faixa', () => {
    expect(com).not.toContain('#7a2e00')
    expect(com).not.toContain('sem VCC')
  })
})
