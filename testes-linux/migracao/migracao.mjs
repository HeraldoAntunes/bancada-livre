// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Teste da migração 2.1.0 → 2.1.1 no Linux, sem janela. Cada "abertura do programa" é:
//   1. a ponte (ponte/, com o src-tauri/src/salvamento.rs real) lê a pasta de dados e monta o script de início, como
//      o main.rs;
//   2. o Chromium sem janela abre o HTML único com esse script e com window.__TAURI__.core.invoke ligado à ponte;
//   3. para fechar, roda o mesmo AO_FECHAR do main.rs e espera a página chamar "fechar" ou "fechar_sem_gravar".
// O perfil do Chromium faz o papel do perfil do WebView2 (o localStorage passa de uma abertura para a outra e da
// 2.1.0 para a 2.1.1). Os dados da 2.1.0 são criados pela própria 2.1.0 (HTML e salvamento.rs da tag v2.1.0).
//
// Uso: ./preparar.sh && node migracao.mjs   (CHROMIUM=/caminho/do/chrome para outro Chromium)
/* global process, console, setTimeout, fetch, window, document, localStorage -- Node e, em evaluate, a página */

import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SAIDA = process.env.SAIDA ?? join(AQUI, 'saida')
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
const VERSAO = {
  '2.1.0': { html: join(SAIDA, 'BancadaLivre-2.1.0.html'), ponte: join(SAIDA, 'ponte-2.1.0') },
  '2.1.1': { html: join(SAIDA, 'BancadaLivre-atual.html'), ponte: join(SAIDA, 'ponte-atual') },
}
// o mesmo texto de main.rs (AO_FECHAR)
const AO_FECHAR = "Promise.resolve(window.__bancadaAoFechar ? window.__bancadaAoFechar() : true)" +
  ".catch(() => false).then((gravou) => window.__TAURI__.core.invoke(gravou === true ? 'fechar' : 'fechar_sem_gravar'))"
const TETO = 9007199254740991 // Number.MAX_SAFE_INTEGER

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const sha = (b) => createHash('sha256').update(b).digest('hex')
let porta = 47100

async function ate(condicao, ms = 8000) {
  const fim = Date.now() + ms
  for (;;) {
    const v = await condicao()
    if (v || Date.now() > fim) return v
    await esperar(100)
  }
}

/** Todos os arquivos da pasta de dados (fora o perfil do navegador), com o SHA-256 de cada um. */
function inventario(pasta) {
  const lista = {}
  const andar = (d) => {
    for (const n of readdirSync(d).sort()) {
      const c = join(d, n)
      if (statSync(c).isDirectory()) andar(c)
      else lista[relative(pasta, c)] = sha(readFileSync(c))
    }
  }
  if (existsSync(pasta)) andar(pasta)
  return lista
}
const preservadas = (pasta) => Object.entries(inventario(pasta)).filter(([n]) => n.startsWith('copias-preservadas/circuito-'))

async function chamarPonte(p, caminho, corpo) {
  const r = await fetch(`http://127.0.0.1:${p}${caminho}`, { method: 'POST', body: JSON.stringify(corpo ?? {}) })
  return r.json()
}

/**
 * Abre o programa da versão dada sobre a pasta de dados e o perfil. `semLocal`: 'ausente' (localStorage não existe) ou
 * 'ilegivel' (ler o localStorage lança erro), para o caso BL-RC6-D01.
 */
async function abrir(versao, pasta, perfil, { semLocal } = {}) {
  const v = VERSAO[versao]
  const p = porta++
  const ponte = spawn(v.ponte, [pasta, String(p)], { stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((ok) => ponte.stdout.once('data', ok))
  const inicio = (await chamarPonte(p, '/inicio')).resultado.js
  const navegador = await puppeteer.launch({ browser: 'chrome', executablePath: CHROMIUM, headless: true, userDataDir: perfil, args: ['--no-sandbox'] })
  const pagina = await navegador.newPage()
  for (const outra of await navegador.pages()) if (outra !== pagina) await outra.close()
  const prog = { versao, pasta, perfil, navegador, pagina, ponte, porta: p, pedidos: [], fechou: null, erros: [] }
  pagina.on('pageerror', (e) => prog.erros.push(e.message))
  pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') prog.erros.push(`${m.type()}: ${m.text()}`) })
  await pagina.exposeFunction('__ponteDeTeste', async (comando, args) => {
    prog.pedidos.push(comando)
    if (comando === 'fechar' || comando === 'fechar_sem_gravar') {
      prog.fechou = comando
      return JSON.stringify({ ok: true, resultado: null })
    }
    return JSON.stringify(await chamarPonte(p, `/${comando}`, JSON.parse(args)))
  })
  const ponteJs = `window.__TAURI__ = { core: { invoke: (c, a) => window.__ponteDeTeste(c, JSON.stringify(a ?? {}))
    .then((t) => { const r = JSON.parse(t); if (!r.ok) throw r.erro; return r.resultado }) } };`
  const localJs = semLocal === 'ausente'
    ? `Object.defineProperty(window, 'localStorage', { get: () => undefined, configurable: true });`
    : semLocal === 'ilegivel'
      ? `Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('negado', 'SecurityError') }, configurable: true });`
      : ''
  await pagina.evaluateOnNewDocument(`${localJs}${ponteJs}${inicio}`)
  await pagina.goto('file://' + v.html, { waitUntil: 'load' })
  await ate(() => pagina.evaluate(() => typeof window.bancadaLivre === 'object'))
  return prog
}

/** Fecha como o X da janela: AO_FECHAR, espera a resposta da página (até 8 s, o PRAZO_PARA_FECHAR) e encerra. */
async function fechar(prog, { comoX = true } = {}) {
  if (comoX && prog.versao !== '2.1.0') {
    await prog.pagina.evaluate(AO_FECHAR).catch(() => {})
    await ate(() => prog.fechou, 8000)
  } else {
    await esperar(1500) // a 2.1.0 grava até 400 ms depois da mudança
  }
  await prog.navegador.close()
  await chamarPonte(prog.porta, '/fim').catch(() => {})
  return prog.fechou
}

const cmd = async (prog, nome, params) => {
  const r = await prog.pagina.evaluate((n, p) => window.bancadaLivre.executar(n, p), nome, params ?? {})
  if (!r.ok) throw new Error(`${nome}: ${r.erro}`)
  return r.resultado
}
const pecas = async (prog) => (await cmd(prog, 'circuito.ler')).componentes.map((c) => c.label ?? c.type).join(',')
const pergunta = (prog) => prog.pagina.evaluate(() => !!document.querySelector('.modal.recuperacao'))
const localDe = (prog) => prog.pagina.evaluate(() => { try { return localStorage.getItem('simulador-portas:autosave') } catch { return null } })
const ler = (pasta, nome) => (existsSync(join(pasta, nome)) ? readFileSync(join(pasta, nome), 'utf8') : null)
const revisao = (texto) => (texto ? JSON.parse(texto).salvamento?.revisao : undefined)
const avisoNaTela = (prog) => prog.pagina.evaluate(() => document.body.innerText)

/** Põe peças com rótulo pelo comando da página (o mesmo caminho do mouse) e espera o salvamento automático. */
async function porPecas(prog, rotulos) {
  for (const r of rotulos) {
    const { id } = await cmd(prog, 'componente.adicionar', { tipo: 'LED', x: 100 + 60 * Math.random(), y: 100 + 60 * Math.random() })
    await cmd(prog, 'componente.rotulo', { id, texto: r })
    await esperar(700) // cada mudança vira uma gravação
  }
  await esperar(800)
}

/** Cria a pasta e o perfil de quem usava a 2.1.0: duas aberturas, circuito.json e circuito-anterior.json diferentes. */
async function dadosDa210(nome) {
  const base = join(SAIDA, 'casos', nome)
  rmSync(base, { recursive: true, force: true })
  mkdirSync(base, { recursive: true })
  const pasta = join(base, 'dados')
  const perfil = mkdtempSync(join(base, 'perfil-'))
  let p = await abrir('2.1.0', pasta, perfil)
  await porPecas(p, ['L1'])
  await fechar(p)
  p = await abrir('2.1.0', pasta, perfil)
  await porPecas(p, ['L2'])
  await fechar(p)
  return { base, pasta, perfil }
}

// ---------------------------------------------------------------- casos

const resultados = []
async function caso(titulo, fn) {
  const registro = { titulo, verificacoes: [], sha: {} }
  resultados.push(registro)
  console.log(`\n${titulo}`)
  const conferir = (texto, ok, detalhe = '') => {
    registro.verificacoes.push({ texto, ok: !!ok, detalhe })
    console.log(`  [${ok ? 'passou' : 'FALHOU'}] ${texto}${detalhe ? `: ${detalhe}` : ''}`)
  }
  try {
    await fn(conferir, registro.sha)
  } catch (e) {
    conferir('o roteiro rodou até o fim', false, e.stack)
  }
}

await caso('A) 2.1.0 → 2.1.1 em silêncio', async (conferir, shaDe) => {
  const { pasta, perfil } = await dadosDa210('A')
  const atual = ler(pasta, 'circuito.json')
  const anterior = ler(pasta, 'circuito-anterior.json')
  shaDe['antes'] = inventario(pasta)
  conferir('a 2.1.0 deixou circuito.json e circuito-anterior.json sem envelope e diferentes',
    atual && anterior && !atual.includes('"salvamento"') && !anterior.includes('"salvamento"') && atual !== anterior,
    `circuito.json ${sha(atual)}, circuito-anterior.json ${sha(anterior)}`)
  let p = await abrir('2.1.1', pasta, perfil)
  const local210 = await localDe(p)
  conferir('o localStorage da 2.1.0 chegou à 2.1.1 (mesmo perfil)', local210 && !local210.includes('"salvamento"'), local210 ? sha(local210) : 'vazio')
  conferir('abre sem pergunta', !(await pergunta(p)))
  conferir('abre o circuito do circuito.json (L1,L2)', (await pecas(p)) === 'L1,L2', await pecas(p))
  await esperar(1500)
  const migrado = ler(pasta, 'circuito.json')
  conferir('a migração pediu migrar_circuitos', p.pedidos.includes('migrar_circuitos'), p.pedidos.join(', '))
  conferir('circuito.json passou a ter envelope', revisao(migrado) >= 1, `revisão ${revisao(migrado)}`)
  conferir('circuito-anterior.json é o anterior de antes, convertido (revisão 0, só L1)',
    revisao(ler(pasta, 'circuito-anterior.json')) === 0 && JSON.parse(ler(pasta, 'circuito-anterior.json')).components.length === 1)
  const guardadas = preservadas(pasta)
  shaDe['copias-preservadas'] = Object.fromEntries(guardadas)
  const shas = guardadas.map(([, s]) => s)
  conferir('copias-preservadas tem o circuito.json original (SHA-256 igual)', shas.includes(sha(atual)))
  conferir('copias-preservadas tem o circuito-anterior.json original (SHA-256 igual)', shas.includes(sha(anterior)))
  if (local210 && local210 !== atual) conferir('copias-preservadas tem o original do localStorage', shas.includes(sha(local210)))
  await porPecas(p, ['L3'])
  conferir('fechar pelo X grava e fecha', (await fechar(p)) === 'fechar', p.fechou)
  shaDe['depois da edição'] = inventario(pasta)
  p = await abrir('2.1.1', pasta, perfil)
  conferir('reabre sem pergunta', !(await pergunta(p)))
  conferir('reabre certo depois de 1 edição (L1,L2,L3)', (await pecas(p)) === 'L1,L2,L3', await pecas(p))
  conferir('copias-preservadas não mudou', JSON.stringify(preservadas(pasta)) === JSON.stringify(guardadas))
  conferir('sem erro na página', p.erros.length === 0, p.erros.join(' / '))
  await fechar(p)
})

/** Pasta da 2.1.0 com uma gravação interrompida mais nova (circuito.json.tmp íntegro, como a 2.1.0 deixa se cair). */
async function comTemporario(nome) {
  const d = await dadosDa210(nome)
  const atual = ler(d.pasta, 'circuito.json')
  const anterior = ler(d.pasta, 'circuito-anterior.json')
  // terceira abertura da 2.1.0: o circuito com L3 que "estava sendo gravado" quando o programa caiu
  const p = await abrir('2.1.0', d.pasta, d.perfil)
  await porPecas(p, ['L3'])
  await fechar(p)
  copyFileSync(join(d.pasta, 'circuito.json'), join(d.pasta, 'circuito.json.tmp'))
  writeFileSync(join(d.pasta, 'circuito.json'), atual)
  writeFileSync(join(d.pasta, 'circuito-anterior.json'), anterior)
  const agora = Date.now() / 1000
  utimesSync(join(d.pasta, 'circuito-anterior.json'), agora - 120, agora - 120)
  utimesSync(join(d.pasta, 'circuito.json'), agora - 60, agora - 60)
  utimesSync(join(d.pasta, 'circuito.json.tmp'), agora, agora)
  return d
}

await caso('B) temporário mais novo que o principal', async (conferir, shaDe) => {
  const { pasta, perfil } = await comTemporario('B')
  const originais = { atual: ler(pasta, 'circuito.json'), anterior: ler(pasta, 'circuito-anterior.json'), tmp: ler(pasta, 'circuito.json.tmp') }
  shaDe['antes'] = inventario(pasta)
  let p = await abrir('2.1.1', pasta, perfil)
  const localAntes = await localDe(p)
  conferir('aparece a pergunta', await pergunta(p))
  const opcoes = await cmd(p, 'recuperacao.listar')
  conferir('a pergunta mostra a gravação interrompida', opcoes?.some((o) => o.origem === 'Gravação interrompida do programa'),
    (opcoes ?? []).map((o) => `${o.origem} (${o.componentes} peças)`).join('; '))
  await esperar(2000)
  await p.pagina.click('.modal.recuperacao > button')       // "Fechar sem escolher"
  await ate(() => p.fechou, 3000)
  conferir('"Fechar sem escolher" pede ao programa fechar_sem_gravar', p.fechou === 'fechar_sem_gravar', p.fechou)
  conferir('enquanto a pergunta estava aberta, nada foi pedido ao disco',
    !p.pedidos.some((c) => c === 'salvar_circuito' || c === 'migrar_circuitos'), p.pedidos.join(', '))
  const localDepois = await localDe(p)
  await p.navegador.close()
  await chamarPonte(p.porta, '/fim').catch(() => {})
  shaDe['depois de fechar sem escolher'] = inventario(pasta)
  conferir('fechar sem escolher não grava nada (SHA-256 de todos os arquivos iguais)',
    JSON.stringify(shaDe['depois de fechar sem escolher']) === JSON.stringify(shaDe['antes']))
  conferir('e o localStorage também não mudou', localDepois === localAntes)
  p = await abrir('2.1.1', pasta, perfil)
  conferir('reabrindo, a pergunta volta', await pergunta(p))
  const lista = await cmd(p, 'recuperacao.listar')
  const i = lista.findIndex((o) => o.origem === 'Gravação interrompida do programa')
  await p.pagina.click(`.modal.recuperacao li:nth-child(${i + 1}) button`)
  await esperar(2000)
  conferir('escolher a gravação interrompida abre L1,L2,L3', (await pecas(p)) === 'L1,L2,L3', await pecas(p))
  conferir('escolher migra (migrar_circuitos)', p.pedidos.includes('migrar_circuitos'), p.pedidos.join(', '))
  shaDe['depois de escolher'] = inventario(pasta)
  const shas = preservadas(pasta).map(([, s]) => s)
  for (const [n, t] of Object.entries(originais)) conferir(`original ${n} guardado em copias-preservadas (SHA-256 igual)`, shas.includes(sha(t)), sha(t))
  conferir('o temporário saiu das cópias ativas', !existsSync(join(pasta, 'circuito.json.tmp')))
  conferir('circuito.json é o escolhido, com envelope', revisao(ler(pasta, 'circuito.json')) >= 1 &&
    JSON.parse(ler(pasta, 'circuito.json')).components.length === 3)
  await fechar(p)
  p = await abrir('2.1.1', pasta, perfil)
  conferir('reabre sem pergunta e com L1,L2,L3', !(await pergunta(p)) && (await pecas(p)) === 'L1,L2,L3', await pecas(p))
  await fechar(p)
})

await caso('Extra 1) circuito.json ilegível → pergunta', async (conferir, shaDe) => {
  const { pasta, perfil } = await dadosDa210('ilegivel')
  const bom = ler(pasta, 'circuito.json')
  const estragado = bom.slice(0, Math.floor(bom.length / 2))
  writeFileSync(join(pasta, 'circuito.json'), estragado)
  shaDe['antes'] = inventario(pasta)
  const p = await abrir('2.1.1', pasta, perfil)
  conferir('aparece a pergunta', await pergunta(p))
  const opcoes = await cmd(p, 'recuperacao.listar')
  conferir('a pergunta lista a cópia anterior e o navegador', opcoes?.length === 2, (opcoes ?? []).map((o) => o.origem).join('; '))
  const i = opcoes.findIndex((o) => o.origem === 'Armazenamento do navegador')
  await p.pagina.click(`.modal.recuperacao li:nth-child(${i + 1}) button`)
  await esperar(2000)
  conferir('escolher o do navegador abre L1,L2', (await pecas(p)) === 'L1,L2', await pecas(p))
  const shas = preservadas(pasta).map(([, s]) => s)
  conferir('o circuito.json ilegível foi guardado em copias-preservadas (SHA-256 igual)', shas.includes(sha(estragado)), sha(estragado))
  conferir('circuito.json voltou a ser legível, com envelope', revisao(ler(pasta, 'circuito.json')) >= 1)
  shaDe['depois'] = inventario(pasta)
  await fechar(p)
})

for (const modo of ['ausente', 'ilegivel']) {
  await caso(`Extra 2) localStorage ${modo === 'ausente' ? 'ausente' : 'ilegível (lança erro)'} com revisão no teto → migra (BL-RC6-D01)`, async (conferir, shaDe) => {
    const base = join(SAIDA, 'casos', `teto-${modo}`)
    rmSync(base, { recursive: true, force: true })
    mkdirSync(base, { recursive: true })
    const pasta = join(base, 'dados')
    const perfil = mkdtempSync(join(base, 'perfil-'))
    // duas gravações reais da 2.1.1 (pela ponte), a mais nova com a revisão no teto
    const circ = (n) => ({ version: 1, components: Array.from({ length: n }, (_, k) => ({ id: `c${k + 1}`, type: 'LED', x: 100 + 40 * k, y: 100, label: `T${k + 1}` })), wires: [] })
    const p0 = porta++
    const ponte = spawn(VERSAO['2.1.1'].ponte, [pasta, String(p0)], { stdio: ['ignore', 'pipe', 'inherit'] })
    await new Promise((ok) => ponte.stdout.once('data', ok))
    const r1 = await chamarPonte(p0, '/salvar_circuito', { texto: JSON.stringify({ ...circ(1), salvamento: { hora: Date.now() - 60000, revisao: TETO - 1 } }) })
    const noTeto = JSON.stringify({ ...circ(2), salvamento: { hora: Date.now(), revisao: TETO } })
    const r2 = await chamarPonte(p0, '/salvar_circuito', { texto: noTeto })
    await chamarPonte(p0, '/fim')
    conferir('a 2.1.1 gravou as cópias com revisão no teto', r1.ok && r2.ok && revisao(ler(pasta, 'circuito.json')) === TETO)
    shaDe['antes'] = inventario(pasta)
    let p = await abrir('2.1.1', pasta, perfil, { semLocal: modo })
    conferir('a página não vê o localStorage', await p.pagina.evaluate(() => { try { return typeof localStorage === 'undefined' } catch { return true } }))
    conferir('abre sem pergunta e com T1,T2', !(await pergunta(p)) && (await pecas(p)) === 'T1,T2', await pecas(p))
    await esperar(2500)
    conferir('migrar_circuitos pedido com o reinício da contagem', p.pedidos.includes('migrar_circuitos'), p.pedidos.join(', '))
    const depois = ler(pasta, 'circuito.json')
    conferir('a contagem recomeçou (circuito.json com revisão 1)', revisao(depois) === 1, `revisão ${revisao(depois)}`)
    conferir('o original no teto foi guardado em copias-preservadas (SHA-256 igual)', preservadas(pasta).some(([, s]) => s === sha(noTeto)))
    const tela = await avisoNaTela(p)
    conferir('aviso "Contagem de salvamentos reiniciada" na tela', tela.includes('Contagem de salvamentos reiniciada'))
    conferir('sem aviso de falha do salvamento automático', !tela.includes('O salvamento automático falhou'))
    await porPecas(p, ['T3'])
    const fechou = await fechar(p)
    conferir('depois de 1 edição, fechar pelo X grava e fecha', fechou === 'fechar', fechou)
    conferir('a edição foi gravada com revisão 2', revisao(ler(pasta, 'circuito.json')) === 2, `revisão ${revisao(ler(pasta, 'circuito.json'))}`)
    shaDe['depois'] = inventario(pasta)
    p = await abrir('2.1.1', pasta, perfil, { semLocal: modo })
    conferir('reabre sem pergunta e com T1,T2,T3', !(await pergunta(p)) && (await pecas(p)) === 'T1,T2,T3', await pecas(p))
    await fechar(p)
  })
}

writeFileSync(join(SAIDA, 'resultado-migracao.json'), JSON.stringify({
  data: new Date().toISOString(),
  html: Object.fromEntries(Object.entries(VERSAO).map(([v, x]) => [v, sha(readFileSync(x.html))])),
  casos: resultados,
}, null, 2))
const falhas = resultados.flatMap((c) => c.verificacoes.filter((v) => !v.ok).map((v) => `${c.titulo}: ${v.texto}`))
console.log(`\n${falhas.length ? `${falhas.length} falha(s):\n  ${falhas.join('\n  ')}` : 'Tudo passou.'}`)
process.exitCode = falhas.length ? 1 : 0
