// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Política de segurança (CSP) que o build injeta no HTML único.
import { describe, expect, it } from 'vitest'
import { comCsp } from '../csp'

const html = '<!doctype html>\n<html><head><meta charset="UTF-8" />\n<script type="module">console.log(1)</script></head><body></body></html>'

async function sha256(texto: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

describe('CSP do HTML único', async () => {
  const saida = await comCsp(html)
  const csp = saida.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? ''

  it('entra logo depois do charset, antes de qualquer script', () => {
    expect(saida.indexOf('Content-Security-Policy')).toBeLessThan(saida.indexOf('<script'))
    expect(saida.indexOf('Content-Security-Policy')).toBeGreaterThan(saida.indexOf('charset'))
  })

  it('libera só o script embutido, pelo hash dele', async () => {
    const hash = await sha256('console.log(1)')
    expect(csp).toContain(`script-src 'sha256-${hash}'`)
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
  })

  it('não deixa nada sair nem entrar pela rede', () => {
    for (const regra of ["default-src 'none'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
      expect(csp).toContain(regra)
    }
  })
})
