// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Usado só no build (vite.config.ts): injeta no HTML único uma política de segurança (CSP) que libera
// apenas o script embutido, pelo hash dele, e bloqueia qualquer acesso à rede. Como o arquivo abre por
// file://, a política vai numa <meta>, logo depois do charset.

async function sha256Base64(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

export async function comCsp(html: string): Promise<string> {
  const encontrados = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  // script externo ou vazio daria um hash que não libera o programa: o HTML abriria em branco
  for (const [, atributos, corpo] of encontrados) {
    if (/\bsrc\s*=/.test(atributos) || corpo.trim() === '') {
      throw new Error('CSP: script ainda não embutido no HTML; a política seria calculada sobre um script vazio')
    }
  }
  const scripts = encontrados.map((m) => m[2])
  const hashes = await Promise.all(scripts.map(async (s) => `'sha256-${await sha256Base64(s)}'`))
  const politica = [
    "default-src 'none'",
    `script-src ${hashes.join(' ') || "'none'"}`,
    // o React aplica estilos pelo atributo style; o CSS do build também vem embutido
    "style-src 'unsafe-inline'",
    // exportar PNG desenha a bancada numa imagem blob:/data: antes de baixar
    'img-src data: blob:',
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  const meta = `<meta http-equiv="Content-Security-Policy" content="${politica}" />`
  return html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${meta}`)
}
