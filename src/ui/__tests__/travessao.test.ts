// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Textos da tela sem travessão (regra do projeto). Comentários ficam de fora; o '—' sozinho entre aspas é
// símbolo de célula vazia (display apagado, pino sem nome), não pontuação.
import { describe, expect, it } from 'vitest'

const fontes = {
  ...import.meta.glob('../*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../{comandos,examples}.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../state/store.ts', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>

const semComentarios = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/'—'/g, '')

describe('textos da tela', () => {
  it('não usam travessão', () => {
    expect(Object.keys(fontes).length).toBeGreaterThan(10)
    for (const [arquivo, fonte] of Object.entries(fontes)) {
      const linhas = semComentarios(fonte)
        .split('\n')
        .filter((l) => l.includes('—'))
      expect(linhas, arquivo).toEqual([])
    }
  })
})
