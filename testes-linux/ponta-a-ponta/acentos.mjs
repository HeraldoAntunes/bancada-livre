// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Confere os acentos dos textos que a pessoa lê:
//   1. no código: só os textos (strings e texto de JSX) de src/, fora dos testes, lidos pelo compilador do TypeScript;
//   2. na documentação: README.md, CHANGELOG.md e docs/*.md;
//   3. na tela: o texto mostrado pelo HTML único no Chromium sem janela, em cada janela que dá para abrir.
// Procura palavras comuns escritas sem o acento (lista abaixo) e caracteres trocados por codificação errada (Ã©, Â,
// �). Uso: node acentos.mjs [caminho do HTML]   (padrão: saida/html/BancadaLivre-atual.html)
/* global process, console, setTimeout, window, document -- Node e, em evaluate, a página */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..', '..')
const SAIDA = process.env.SAIDA ?? join(AQUI, 'saida')
const ts = createRequire(join(RAIZ, 'package.json'))('typescript')

// palavras que em português só existem com acento (sem as que também existem sem ele, como "esta", "so", "ha", "valida"
// e "sequencial")
const SEM_ACENTO = [
  'nao', 'voce', 'voces', 'entao', 'tambem', 'ate', 'ja', 'apos', 'atraves', 'funcao', 'funcoes', 'saida', 'saidas',
  'conexao', 'conexoes', 'simulacao', 'botao', 'botoes', 'numero', 'numeros', 'codigo', 'ultimo', 'ultima', 'possivel',
  'logica', 'logicas', 'logico', 'binario', 'valido', 'invalido', 'maximo', 'minimo', 'pagina',
  'versao', 'versoes', 'informacao', 'atencao', 'proximo', 'proxima', 'memoria', 'expressao', 'expressoes', 'combinacao',
  'combinacoes', 'alimentacao', 'descricao', 'selecao', 'direcao', 'rotulo', 'rotulos', 'frequencia', 'periodo', 'nivel',
  'niveis', 'sequencia', 'padrao', 'unico', 'unica', 'facil', 'util', 'area', 'automatico', 'automatica',
  'usuario', 'diretorio', 'propagacao', 'transicao', 'posicao', 'posicoes', 'edicao', 'opcao', 'opcoes', 'exibicao',
  'instalacao', 'migracao', 'gravacao', 'gravacoes', 'recuperacao', 'conteudo', 'distribuicao', 'licenca', 'tecnologia',
  'grafico', 'video', 'eletrica', 'eletronica', 'pratica', 'pratico', 'basico', 'basica', 'decodificacao',
]
const PALAVRA = new RegExp(`(?<![\\p{L}\\p{N}_])(${SEM_ACENTO.join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
const TROCADO = /Ã[\u0080-¿]|Â[\u0080-¿ ]|�/g

function procurar(texto) {
  const achados = []
  for (const m of texto.matchAll(PALAVRA)) achados.push(`sem acento: "${m[0]}"`)
  for (const m of texto.matchAll(TROCADO)) achados.push(`caractere trocado: "${m[0]}"`)
  return achados
}

function arquivos(dir, filtro) {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n)
    return statSync(c).isDirectory() ? (n === '__tests__' || n === 'node_modules' ? [] : arquivos(c, filtro)) : filtro(c) ? [c] : []
  })
}

/** Textos que a pessoa pode ler: strings com espaço ou letra maiúscula e texto de JSX; nomes de comando e chaves ficam de fora. */
function textosDoCodigo(caminho) {
  const fonte = ts.createSourceFile(caminho, readFileSync(caminho, 'utf8'), ts.ScriptTarget.Latest, true,
    caminho.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const textos = []
  const visitar = (no) => {
    const linha = () => fonte.getLineAndCharacterOfPosition(no.getStart()).line + 1
    if (ts.isJsxText(no) && no.text.trim()) textos.push({ linha: linha(), texto: no.text.trim() })
    // nome de classe do CSS não é texto para ler
    else if (ts.isJsxAttribute(no) && no.name.getText() === 'className') return
    else if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no) || ts.isTemplateHead(no) ||
      ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) && /\s/.test(no.text) && !ts.isImportDeclaration(no.parent)) {
      textos.push({ linha: linha(), texto: no.text })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return textos
}

const resultado = { codigo: [], documentacao: [], tela: [] }

for (const c of arquivos(join(RAIZ, 'src'), (f) => /\.(ts|tsx)$/.test(f))) {
  for (const { linha, texto } of textosDoCodigo(c)) {
    // entre aspas, um nome de parâmetro dos comandos (que é sem acento de propósito, como "posicao")
    if (/^[.#][\w-]+[ \w.#-]*$/.test(texto)) continue    // seletor do CSS, como ".clock-botao rect"
    const semNomes = texto.replace(/"[a-z_]+"/g, '')
    for (const a of procurar(semNomes)) resultado.codigo.push(`${relative(RAIZ, c)}:${linha}: ${a} em "${texto.slice(0, 90)}"`)
  }
}

for (const c of [join(RAIZ, 'README.md'), join(RAIZ, 'CHANGELOG.md'), ...arquivos(join(RAIZ, 'docs'), (f) => f.endsWith('.md'))]) {
  const linhas = readFileSync(c, 'utf8').split('\n')
  let emCodigo = false
  linhas.forEach((l, i) => {
    if (l.trimStart().startsWith('```')) emCodigo = !emCodigo
    // trechos de código (blocos e `entre crases`) e endereços não são texto para ler
    if (emCodigo) return
    const texto = l.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, '')
    for (const a of procurar(texto)) resultado.documentacao.push(`${relative(RAIZ, c)}:${i + 1}: ${a} em "${l.trim().slice(0, 90)}"`)
  })
}

// na tela: abre cada janela e lê o texto mostrado
const html = process.argv[2] ?? join(SAIDA, 'html', 'BancadaLivre-atual.html')
const { default: puppeteer } = await import('puppeteer-core')
const navegador = await puppeteer.launch({ browser: 'chrome', headless: true, args: ['--no-sandbox', '--window-size=1600,1000'],
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', defaultViewport: null })
const pagina = await navegador.newPage()
pagina.on('dialog', (d) => d.accept())
await pagina.goto(pathToFileURL(html).href, { waitUntil: 'load' })
await new Promise((r) => setTimeout(r, 500))
const telas = {}
const ler = async (nome) => { telas[nome] = await pagina.evaluate(() => document.body.innerText + '\n' +
  [...document.querySelectorAll('[title],[aria-label],option')].map((e) => [e.getAttribute('title'), e.getAttribute('aria-label'), e.tagName === 'OPTION' ? e.textContent : ''].join('\n')).join('\n')) }
const executar = (n, p) => pagina.evaluate((n, p) => window.bancadaLivre.executar(n, p ?? {}), n, p)
await ler('inicial')
for (const aba of ['ENTRADAS', 'PORTAS', 'MEMORIA', 'SAIDAS', 'CIS']) { await executar('paleta.aba', { aba }); await ler(`paleta ${aba}`) }
await pagina.click('button.version'); await new Promise((r) => setTimeout(r, 200)); await ler('Sobre')
await pagina.keyboard.press('Escape')
await pagina.evaluate(() => [...document.querySelectorAll('.modal-overlay')].forEach((m) => m.click()))
for (const chip of ['7400', '7402', '7404', '7408', '7432', '7486', '7448', '74138', '74151', '74283', '7474', '7476', '74161', '74164']) {
  const r = await executar('guia.abrir', { chip })
  if (r.ok) { await new Promise((r) => setTimeout(r, 100)); await ler(`Guia ${chip}`); await executar('guia.fechar') }
}
const lista = (await executar('exemplo.listar')).resultado
const exemplos = lista?.exemplos ?? lista ?? []
for (const e of exemplos) {
  const nome = e.nome ?? e.name ?? e
  await executar('exemplo.abrir', { nome })
  await new Promise((r) => setTimeout(r, 50))
  await ler(`exemplo ${nome}`)
  if ((await executar('karnaugh.abrir')).ok) { await ler(`Karnaugh de ${nome}`); await executar('karnaugh.fechar') }
  await executar('passo.ligar'); await ler(`passo a passo de ${nome}`); await executar('passo.sair')
  await executar('linha_do_tempo.mostrar', { mostrar: true }); await ler(`linha do tempo de ${nome}`); await executar('linha_do_tempo.mostrar', { mostrar: false })
}
const primeira = (await executar('circuito.ler')).resultado.componentes[0]
if (primeira) { await executar('selecao.escolher', { id: primeira.id }); await ler('painel de propriedades') }
// a lista de comandos (o que um agente lê): descrições e parâmetros
// (só as descrições: os nomes dos comandos, dos parâmetros e os valores aceitos são sem acento de propósito)
telas['comandos'] = (await pagina.evaluate(() => window.bancadaLivre.listar()))
  .flatMap((c) => [c.descricao, ...Object.values(c.params).map((p) => p.descricao)]).join('\n').replace(/"[a-z_]+"/g, '')
await navegador.close()
const vistos = new Set()
for (const [nome, texto] of Object.entries(telas)) {
  for (const linha of texto.split('\n')) {
    for (const a of procurar(linha)) {
      const chave = `${a} em "${linha.trim().slice(0, 90)}"`
      if (!vistos.has(chave)) { vistos.add(chave); resultado.tela.push(`${nome}: ${chave}`) }
    }
  }
}
resultado.telas = Object.keys(telas).length

mkdirSync(SAIDA, { recursive: true })
writeFileSync(join(SAIDA, 'acentos.json'), JSON.stringify(resultado, null, 2))
for (const k of ['codigo', 'documentacao', 'tela']) {
  console.log(`\n${k}: ${resultado[k].length} achado(s)`)
  for (const a of resultado[k]) console.log(`  ${a}`)
}
console.log(`\n${resultado.telas} telas lidas`)
