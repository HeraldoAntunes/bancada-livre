// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Usado só no build (vite.config.ts): injeta no HTML único uma política de segurança (CSP) que libera
// apenas o script embutido, pelo hash dele, e bloqueia qualquer acesso à rede. Como o arquivo abre por
// file://, a política vai numa <meta>, logo depois do charset.

async function sha256Base64(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

/** Um bloco <script>: o texto dos atributos e o corpo, exatamente como estão no HTML. */
interface BlocoScript {
  atributos: string
  corpo: string
}

/**
 * Acha todos os blocos <script> do HTML gerado pelo build, varrendo o texto em vez de usar expressão regular:
 * qualquer variação de caixa ou de espaço no fechamento (`</SCRIPT >`, `</script` com quebra de linha) é
 * reconhecida, e um <script> sem fechamento para o build.
 */
export function blocosScript(html: string): BlocoScript[] {
  const baixo = html.toLowerCase()
  const blocos: BlocoScript[] = []
  let pos = 0
  for (;;) {
    const inicio = baixo.indexOf('<script', pos)
    if (inicio === -1) return blocos
    const depois = baixo.charAt(inicio + 7)
    // "<scripts" ou "<script-x" não são a tag script
    if (depois !== '>' && depois !== '/' && depois.trim() !== '') {
      pos = inicio + 7
      continue
    }
    const fimAbertura = html.indexOf('>', inicio)
    const fechamento = fimAbertura === -1 ? -1 : baixo.indexOf('</script', fimAbertura)
    const fimFechamento = fechamento === -1 ? -1 : html.indexOf('>', fechamento)
    if (fimFechamento === -1) {
      throw new Error('CSP: há um <script> que a busca não reconheceu; a política não liberaria todos')
    }
    blocos.push({ atributos: html.slice(inicio + 7, fimAbertura), corpo: html.slice(fimAbertura + 1, fechamento) })
    pos = fimFechamento + 1
  }
}

export async function comCsp(html: string): Promise<string> {
  // todo <script> precisa entrar no hash; um que escapasse da busca ficaria bloqueado (o texto "<script"
  // dentro do próprio código do programa não conta, porque a busca pula o corpo de cada bloco achado)
  const encontrados = blocosScript(html)
  // script externo ou vazio daria um hash que não libera o programa: o HTML abriria em branco
  for (const { atributos, corpo } of encontrados) {
    if (/\bsrc\s*=/.test(atributos) || corpo.trim() === '') {
      throw new Error('CSP: script ainda não embutido no HTML; a política seria calculada sobre um script vazio')
    }
  }
  const scripts = encontrados.map((b) => b.corpo)
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
  const charset = /(<meta charset="[^"]*"\s*\/?>)/i
  // sem o charset não haveria onde pôr a política, e o HTML sairia sem CSP
  if (!charset.test(html)) throw new Error('CSP: o HTML não tem <meta charset>; a política ficaria de fora')
  return html.replace(charset, `$1\n    ${meta}`)
}
