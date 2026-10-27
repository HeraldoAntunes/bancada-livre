// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { comCsp } from './src/build/csp'
import { comIcone } from './src/build/icone'

// Ícone da aba embutido no HTML (no build e no servidor de desenvolvimento).
const iconeDaAba = {
  name: 'icone-da-aba',
  transformIndexHtml: (html: string) => comIcone(html, readFileSync('src/assets/icone.svg', 'utf8')),
}

// Política de segurança no HTML único (ver src/build/csp.ts). Roda depois do
// viteSingleFile, quando o script já está embutido e o hash é o definitivo.
const politicaDeSeguranca = {
  name: 'politica-de-seguranca',
  apply: 'build' as const,
  enforce: 'post' as const,
  generateBundle(_: unknown, bundle: Record<string, { type: string; fileName: string; source?: string | Uint8Array }>) {
    return Promise.all(
      Object.values(bundle)
        .filter((f) => f.type === 'asset' && f.fileName.endsWith('.html') && typeof f.source === 'string')
        .map(async (f) => {
          f.source = await comCsp(f.source as string)
        }),
    ).then(() => undefined)
  },
}

// A licença MIT das bibliotecas embutidas pede que o aviso viaje junto com
// elas; como o build é um arquivo só, o aviso vai num comentário no fim dele.
const avisoDeTerceiros = {
  name: 'aviso-de-terceiros',
  apply: 'build' as const,
  transformIndexHtml: {
    order: 'post' as const,
    handler: (html: string) =>
      `${html}\n<!--\n${readFileSync('THIRD-PARTY-NOTICES.md', 'utf8')}-->\n`,
  },
}

// viteSingleFile embute JS e CSS no index.html: o build vira UM arquivo
// autocontido que abre com dois cliques (file://), sem servidor — ideal
// para distribuir aos alunos (RNF-01/RNF-02).
export default defineConfig({
  plugins: [react(), iconeDaAba, viteSingleFile(), avisoDeTerceiros, politicaDeSeguranca],
  server: { port: 5173 },
  test: {
    environment: 'node',
    // processa o CSS nos testes: sem isso, styles.css?raw chega vazio ao teste de cabeçalho
    css: true,
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
