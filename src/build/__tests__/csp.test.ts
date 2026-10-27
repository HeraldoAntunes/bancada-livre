// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Política de segurança (CSP) que o build injeta no HTML único.
import { describe, expect, it } from 'vitest'
import { blocosScript, comCsp } from '../csp'

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

  it('recusa script ainda não embutido (o HTML abriria em branco)', async () => {
    const externo = html.replace('<script type="module">console.log(1)</script>', '<script type="module" src="/assets/index.js"></script>')
    const vazio = html.replace('console.log(1)', '')
    await expect(comCsp(externo)).rejects.toThrow(/não embutido/)
    await expect(comCsp(vazio)).rejects.toThrow(/não embutido/)
  })

  it('reconhece a tag em maiúsculas e com espaço antes do ">"', async () => {
    const variante = html.replace('<script type="module">console.log(1)</script>', '<SCRIPT type="module">console.log(1)</SCRIPT >')
    const politica = (await comCsp(variante)).match(/content="([^"]+)"/)?.[1] ?? ''
    expect(politica).toContain(`'sha256-${await sha256('console.log(1)')}'`)
  })

  it('para o build se algum <script> escapar da busca', async () => {
    await expect(comCsp(html.replace('</head>', '<script>sem fechamento</head>'))).rejects.toThrow(/não reconheceu/)
  })

  it('reconhece fechamento com quebra de linha e texto antes do ">"', async () => {
    const variante = html.replace('</script>', '</script\t\n bar>')
    const politica = (await comCsp(variante)).match(/content="([^"]+)"/)?.[1] ?? ''
    expect(politica).toContain(`'sha256-${await sha256('console.log(1)')}'`)
  })

  it('não confunde "<script" dentro do código com uma tag', () => {
    const variante = html.replace('console.log(1)', 'const t = "<script"; const s = "<scripts>"')
    expect(blocosScript(variante)).toHaveLength(1)
    expect(blocosScript('<p><scripts>x</scripts></p>')).toHaveLength(0)
  })

  it('para o build se o HTML não tiver <meta charset>', async () => {
    await expect(comCsp(html.replace('<meta charset="UTF-8" />', ''))).rejects.toThrow(/charset/)
  })

  it('não deixa nada sair nem entrar pela rede', () => {
    for (const regra of ["default-src 'none'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
      expect(csp).toContain(regra)
    }
  })
})
