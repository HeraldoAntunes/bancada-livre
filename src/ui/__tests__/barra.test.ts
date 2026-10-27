// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// A barra superior não pode esconder botões em tela estreita: quebra em duas linhas e a primeira linha
// da grade da página cresce junto. (A largura real em 1366 px é conferida no navegador.)
import { describe, expect, it } from 'vitest'
import css from '../../styles.css?raw'

// Corpo da regra CSS que começa a linha com o seletor exato (sem regex, para não escapar o seletor).
const regra = (seletor: string) => {
  const linhas = css.split(/\r?\n/)
  const i = linhas.findIndex((l) => l === `${seletor} {`)
  if (i < 0) return ''
  const fim = linhas.findIndex((l, j) => j > i && l.startsWith('}'))
  return linhas.slice(i + 1, fim).join('\n')
}

describe('barra superior em tela estreita', () => {
  it('quebra em mais de uma linha em vez de sair da tela', () => {
    expect(regra('.topbar')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('a linha da barra na grade acompanha a altura (não fica presa em 52 px)', () => {
    expect(regra('.app')).toMatch(/grid-template-rows:\s*minmax\(52px, auto\)/)
  })

  it('a caixa de Exemplos tem largura própria, sem crescer com o nome do exemplo mais longo', () => {
    expect(regra('.topbar .exemplos')).toMatch(/width:\s*\d+px/)
  })
})
