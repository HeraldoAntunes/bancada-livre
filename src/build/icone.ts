// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Usado pelo vite.config.ts: põe o ícone da aba (src/assets/icone.svg) dentro do próprio HTML, como data:,
// para o build continuar sendo um arquivo único. A CSP libera imagens data:.

export function comIcone(html: string, svg: string): string {
  const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return html.replace(/(<\/title>)/i, `$1\n    <link rel="icon" type="image/svg+xml" href="${href}" />`)
}
