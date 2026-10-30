// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Textos das licenças das bibliotecas Rust do BancadaLivre.exe, tirados dos arquivos de licença que vêm em cada pacote
// (pasta do registro do Cargo), sem repetir os iguais. Vai para THIRD-PARTY-RUST.md, que acompanha o programa (não o
// HTML, que não usa nenhuma delas). Auditoria da rc.5 (30/10/2026): o inventário sozinho não trazia os textos.
// Uso (pelo instalador/licencas-rust.ps1):  node instalador/licencas-rust-textos.mjs <lista> [--escrever]
//   <lista>: arquivo com uma linha "nome vX.Y.Z|licença" por biblioteca, a mesma do inventário.
// Sem --escrever, só confere: sai com 1 se o arquivo estiver desatualizado.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const [arquivoLista, opcao] = process.argv.slice(2)
const lista = readFileSync(arquivoLista, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => {
  const [p, licenca] = l.split('|')
  const [nome, versao] = p.split(' v')
  return { nome, versao, licenca }
})
const meta = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--filter-platform',
  'x86_64-pc-windows-msvc'], { cwd: join(raiz, 'src-tauri'), maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }))

// Pacotes publicados sem o arquivo da licença (auditoria da rc.6): o texto guardado em instalador/licencas-extras, tirado
// do repositório da biblioteca no commit do pacote (`.cargo_vcs_info.json`). O webview2-rs traz o aviso de copyright de
// Bill Avery; o repositório do selectors (servo/stylo) não tem arquivo de licença nesse commit, e vai o texto padrão da
// MPL-2.0 (o mesmo do pacote cssparser), com os avisos de cada arquivo-fonte, como a MPL prevê.
const EXTRAS = {
  'webview2-com': ['webview2-rs-LICENSE', 'github.com/wravery/webview2-rs, commit edc2caf'],
  'webview2-com-sys': ['webview2-rs-LICENSE', 'github.com/wravery/webview2-rs, commit edc2caf'],
  'webview2-com-macros': ['webview2-rs-LICENSE', 'github.com/wravery/webview2-rs, commit dffa41a'],
  selectors: ['MPL-2.0', 'texto padrão da MPL-2.0; github.com/servo/stylo, commit 572ecba, sem arquivo de licença'],
}
const ordinal = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const textos = new Map()            // texto sem diferença de espaços -> { texto, usos }
const semArquivo = []
for (const b of lista) {
  const pacote = meta.packages.find((p) => p.name === b.nome && p.version === b.versao)
  if (!pacote) throw new Error(`o cargo metadata não traz ${b.nome} ${b.versao}`)
  let pasta = dirname(pacote.manifest_path)
  let arquivos = readdirSync(pasta).filter((f) => /^(licen[cs]e|copying|unlicense|notice)/i.test(f)).sort(ordinal)
  let origem = (a) => a
  if (arquivos.length === 0 && EXTRAS[b.nome]) {
    pasta = join(raiz, 'instalador', 'licencas-extras')
    arquivos = [EXTRAS[b.nome][0]]
    origem = () => EXTRAS[b.nome][1]
  }
  if (arquivos.length === 0) {
    semArquivo.push(`- ${b.nome} ${b.versao}: ${b.licenca}. O pacote publicado não traz o arquivo da licença; o texto está no ` +
      `repositório da biblioteca: ${pacote.repository ?? 'não informado no pacote'}.`)
    continue
  }
  for (const a of arquivos) {
    const texto = readFileSync(join(pasta, a), 'utf8').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim()
    const chave = createHash('sha256').update(texto.replace(/\s+/g, ' ')).digest('hex')
    if (!textos.has(chave)) textos.set(chave, { texto, usos: [] })
    textos.get(chave).usos.push(`${b.nome} ${b.versao} (${origem(a)})`)
  }
}
const grupos = [...textos.values()].sort((x, y) => ordinal(x.usos[0], y.usos[0]))
const partes = [
  '# Licenças das bibliotecas Rust do Bancada Livre',
  '',
  `Textos das licenças das ${lista.length} bibliotecas Rust do BancadaLivre.exe, como vêm nos pacotes publicados no`,
  'crates.io (os iguais aparecem uma vez só); para os pacotes que não trazem o arquivo, o texto do repositório da',
  'biblioteca, indicado ao lado. A lista com versão e licença está no THIRD-PARTY-NOTICES.md. Gerado por',
  'instalador/licencas-rust.ps1; o build confere se está em dia.',
  '',
]
grupos.forEach((g, i) => {
  partes.push(`## Texto ${i + 1}`, '', `Usado por: ${g.usos.join(', ')}.`, '', '~~~text', g.texto, '~~~', '')
})
if (semArquivo.length) partes.push('## Pacotes sem o arquivo da licença', '', ...semArquivo, '')
const novo = partes.join('\n')

const destino = join(raiz, 'THIRD-PARTY-RUST.md')
const atual = existsSync(destino) ? readFileSync(destino, 'utf8').replace(/\r\n/g, '\n') : ''
if (atual === novo) {
  console.log(`THIRD-PARTY-RUST: ${grupos.length} textos de licença em dia`)
} else if (opcao === '--escrever') {
  writeFileSync(destino, novo)
  console.log(`THIRD-PARTY-RUST: ${grupos.length} textos de licença reescritos`)
} else {
  console.log('THIRD-PARTY-RUST: os textos das licenças estão desatualizados (rode instalador\\licencas-rust.ps1 -Escrever)')
  process.exit(1)
}
