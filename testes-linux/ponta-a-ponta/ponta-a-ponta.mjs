// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Testes de ponta a ponta do HTML único no Chromium e no Firefox do Linux, sem janela, aberto pelo file://:
//   1. circuito sintético com rótulos acentuados: abrir por um arquivo com acento no nome, simular com o mouse, salvar
//      numa pasta com acento, reabrir, recarregar, exportar PNG, SVG e CSV;
//   2. arquivos salvos pelas versões 1.0.2 e 2.0.3 (os exemplos de cada uma, salvos pela própria versão);
//   3. circuitos grandes, com o tempo de cada etapa.
// Os comandos da página (window.bancadaLivre) servem para conferir o estado; abrir, salvar, clicar e exportar passam
// pela tela. Nada do programa é alterado.
//
// Uso: ./preparar.sh && FIREFOX=/caminho/do/firefox node ponta-a-ponta.mjs [chromium] [firefox]
/* global process, console, setTimeout, window, document, localStorage -- Node e, em evaluate, a página */

import puppeteer from 'puppeteer-core'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SAIDA = process.env.SAIDA ?? join(AQUI, 'saida')
const HTML = join(SAIDA, 'html')
const NAVEGADORES = {
  chromium: { browser: 'chrome', exe: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' },
  firefox: { browser: 'firefox', exe: process.env.FIREFOX ?? 'firefox' },
}
const escolhidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NAVEGADORES)
const ANTIGAS = ['1.0.2', '2.0.3']
// pasta e nome com acento, til, cedilha, ordinal e trema, como um professor pode usar
const PASTA_ACENTO = 'Área de trabalho/Ação e saída'
const NOME_ACENTO = 'Circuito ação nº 1 saída ü.json'

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const sha = (b) => createHash('sha256').update(b).digest('hex')
async function ate(condicao, ms = 10000, passo = 50) {
  const fim = Date.now() + ms
  for (;;) {
    const v = await condicao()
    if (v || Date.now() > fim) return v
    await esperar(passo)
  }
}

// ---------------------------------------------------------------- navegador

async function abrir(nome, html, baixados, perfil = mkdtempSync(join(tmpdir(), `bl-${nome}-`))) {
  const n = NAVEGADORES[nome]
  // localidade UTF-8: sem ela (LANG vazio, como em muitos contêineres), o Chromium não abre arquivo com acento no
  // caminho; num Linux de mesa ela já vem assim
  const opcoes = { browser: n.browser, executablePath: n.exe, headless: true, userDataDir: perfil, defaultViewport: null,
    protocolTimeout: 120000, env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8', LC_ALL: process.env.LC_ALL || 'C.UTF-8' } }
  if (nome === 'chromium') opcoes.args = ['--no-sandbox', '--window-size=1600,1000']
  if (nome === 'firefox') {
    opcoes.args = ['--width=1600', '--height=1000']
    opcoes.extraPrefsFirefox = {
      'browser.download.folderList': 2, 'browser.download.dir': baixados, 'browser.download.useDownloadDir': true,
      'browser.download.always_ask_before_handling_new_types': false,
      'browser.helperApps.neverAsk.saveToDisk': 'application/json,text/csv,image/png,image/svg+xml',
    }
  }
  const navegador = await puppeteer.launch(opcoes)
  const pagina = await navegador.newPage()
  for (const p of await navegador.pages()) if (p !== pagina) await p.close()
  if (nome === 'chromium') {
    const s = await pagina.createCDPSession()
    await s.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados })
  }
  const prog = { navegador, pagina, perfil, baixados, avisos: [], erros: [] }
  pagina.on('dialog', (d) => { prog.avisos.push(d.message()); d.accept() })
  pagina.on('pageerror', (e) => prog.erros.push(e.message))
  pagina.on('console', (m) => { if (m.type() === 'error') prog.erros.push(m.text()) })
  await pagina.goto(pathToFileURL(html).href, { waitUntil: 'load' })
  await ate(() => pagina.evaluate(() => typeof window.bancadaLivre === 'object'))
  return prog
}

async function cmd(prog, nome, params) {
  const r = await prog.pagina.evaluate((n, p) => window.bancadaLivre.executar(n, p), nome, params ?? {})
  if (!r.ok) throw new Error(`${nome}: ${r.erro}`)
  return r.resultado
}
const tentar = async (prog, nome, params) => prog.pagina.evaluate((n, p) => window.bancadaLivre.executar(n, p), nome, params ?? {})
const circuito = async (prog) => JSON.parse((await cmd(prog, 'circuito.json')).json)
const essencial = (c) => JSON.stringify({ components: c.components, wires: c.wires })

async function clicarBotao(prog, seletor, texto) {
  const hs = await prog.pagina.$$(seletor)
  for (const h of hs) {
    if ((await h.evaluate((e) => e.textContent.trim().replace(/\s+/g, ' '))).includes(texto)) return h.click()
  }
  throw new Error(`botão não encontrado: "${texto}"`)
}

/** Abre um arquivo pelo campo de arquivo do botão Abrir e espera o circuito mudar. */
async function abrirArquivo(prog, caminho) {
  const antes = await prog.pagina.evaluate(() => window.bancadaLivre.executar('circuito.json').resultado.json)
  const input = await prog.pagina.$('input[type="file"][accept=".json,application/json"]')
  const t0 = Date.now()
  await input.uploadFile(caminho)
  const mudou = await ate(() => prog.pagina.evaluate((a) => window.bancadaLivre.executar('circuito.json').resultado.json !== a, antes), 60000)
  return { ms: Date.now() - t0, mudou }
}

async function baixado(prog, nome, ms = 30000) {
  const c = join(prog.baixados, nome)
  const ok = await ate(() => existsSync(c) && statSync(c).size > 0 &&
    !readdirSync(prog.baixados).some((f) => f.endsWith('.part') || f.endsWith('.crdownload')), ms)
  if (!ok) throw new Error(`não baixou ${nome} (pasta: ${readdirSync(prog.baixados).join(', ') || 'vazia'})`)
  await esperar(200)
  return c
}

async function corpo(prog, id) {
  return prog.pagina.evaluate((id) => {
    const r = document.querySelector(`circle.pin[data-comp="${id}"]`)?.parentElement?.querySelector(':scope > g > rect')
    if (!r) return null
    r.scrollIntoView?.()
    const b = r.getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }, id)
}

// ---------------------------------------------------------------- circuitos sintéticos

/** Somador completo com rótulos acentuados: entradas Á, É, Ç; saídas SAÍDA (soma) e VAI-UM. */
function somadorAcentuado() {
  const C = []
  const W = []
  const c = (id, type, x, y, extra = {}) => C.push({ id, type, x, y, ...extra })
  const w = (de, para) => { const [a, p] = de.split(':'); const [b, q] = para.split(':'); W.push({ id: `w${W.length + 1}`, from: { comp: a, pin: p }, to: { comp: b, pin: q } }) }
  c('c1', 'SWITCH', 80, 100, { label: 'Á', state: 0 })
  c('c2', 'SWITCH', 80, 220, { label: 'É', state: 0 })
  c('c3', 'SWITCH', 80, 340, { label: 'Ç', state: 0 })
  c('c4', 'XOR', 300, 120, { inputs: 2 })
  c('c5', 'XOR', 500, 160, { inputs: 2 })
  c('c6', 'AND', 300, 260, { inputs: 2 })
  c('c7', 'AND', 500, 300, { inputs: 2 })
  c('c8', 'OR', 680, 280, { inputs: 2 })
  c('c9', 'LED', 860, 160, { label: 'SAÍDA' })
  c('c10', 'LED', 860, 280, { label: 'VAI-UM' })
  c('c11', 'LABEL', 300, 420, { label: 'Somador: entrada, saída e vai-um (ação de aula)' })
  w('c1:out', 'c4:in0'); w('c2:out', 'c4:in1'); w('c4:out', 'c5:in0'); w('c3:out', 'c5:in1')
  w('c1:out', 'c6:in0'); w('c2:out', 'c6:in1'); w('c4:out', 'c7:in0'); w('c3:out', 'c7:in1')
  w('c6:out', 'c8:in0'); w('c7:out', 'c8:in1'); w('c5:out', 'c9:in'); w('c8:out', 'c10:in')
  return { version: 1, components: C, wires: W }
}

/** Circuito grande: `cadeias` chaves, cada uma puxando uma fila de `tamanho` portas NOT até um LED. */
function grande(cadeias, tamanho) {
  const C = []
  const W = []
  for (let k = 0; k < cadeias; k++) {
    const y = 80 + k * 90
    C.push({ id: `s${k}`, type: 'SWITCH', x: 40, y, label: `E${k}`, state: 0 })
    let anterior = `s${k}`
    for (let i = 0; i < tamanho; i++) {
      const id = `n${k}_${i}`
      C.push({ id, type: 'NOT', x: 160 + i * 70, y })
      W.push({ id: `w${W.length + 1}`, from: { comp: anterior, pin: 'out' }, to: { comp: id, pin: 'in0' } })
      anterior = id
    }
    C.push({ id: `l${k}`, type: 'LED', x: 160 + tamanho * 70, y, label: `S${k}` })
    W.push({ id: `w${W.length + 1}`, from: { comp: anterior, pin: 'out' }, to: { comp: `l${k}`, pin: 'in' } })
  }
  return { version: 1, components: C, wires: W }
}

// ---------------------------------------------------------------- roteiro

const relatorio = { data: new Date().toISOString(), html: {}, navegadores: {} }
for (const f of readdirSync(HTML)) relatorio.html[f] = sha(readFileSync(join(HTML, f)))

/** Os exemplos de cada versão antiga, salvos pelo botão Salvar da própria versão, com a tabela-verdade dela. */
async function gerarAntigos() {
  const pasta = join(SAIDA, 'antigos')
  if (existsSync(join(pasta, 'indice.json'))) return JSON.parse(readFileSync(join(pasta, 'indice.json'), 'utf8'))
  rmSync(pasta, { recursive: true, force: true })
  const indice = []
  for (const v of ANTIGAS) {
    const baixados = join(pasta, v, 'baixados')
    mkdirSync(baixados, { recursive: true })
    const p = await abrir('chromium', join(HTML, `BancadaLivre-${v}.html`), baixados)
    const lista = await cmd(p, 'exemplo.listar')
    const nomes = (lista.exemplos ?? lista).map((e) => e.nome ?? e.name ?? e)
    for (const [i, nome] of nomes.entries()) {
      await cmd(p, 'exemplo.abrir', { nome })
      await esperar(100)
      const tabela = await tentar(p, 'tabela.ler')
      await cmd(p, 'arquivo.salvar')
      const arq = await baixado(p, 'circuito.json')
      const destino = join(pasta, v, `${String(i + 1).padStart(2, '0')}.json`)
      renameSync(arq, destino)
      indice.push({ versao: v, nome, arquivo: destino, tabela: tabela.ok ? tabela.resultado : null })
    }
    await p.navegador.close()
  }
  writeFileSync(join(pasta, 'indice.json'), JSON.stringify(indice, null, 2))
  return indice
}

async function testar(nome) {
  const pasta = join(SAIDA, nome)
  rmSync(pasta, { recursive: true, force: true })
  const baixados = join(pasta, PASTA_ACENTO)
  mkdirSync(baixados, { recursive: true })
  const resultados = []
  const tempos = {}
  const conferir = (texto, ok, detalhe = '') => {
    resultados.push({ texto, ok: !!ok, detalhe: String(detalhe) })
    console.log(`  [${ok ? 'passou' : 'FALHOU'}] ${texto}${detalhe ? `: ${detalhe}` : ''}`)
  }
  async function etapa(titulo, fn) {
    console.log(` ${titulo}`)
    try { await fn() } catch (e) { conferir(`${titulo}: o roteiro rodou até o fim`, false, e.message) }
  }
  let p = await abrir(nome, join(HTML, 'BancadaLivre-atual.html'), baixados)
  console.log(`\n${nome}: ${await p.navegador.version()}`)
  relatorio.navegadores[nome] = { versao: await p.navegador.version(), resultados, tempos }

  await etapa('1. circuito sintético com acentos', async () => {
    const original = somadorAcentuado()
    const arquivo = join(pasta, 'entrada', NOME_ACENTO)
    mkdirSync(dirname(arquivo), { recursive: true })
    writeFileSync(arquivo, JSON.stringify(original))
    const r = await abrirArquivo(p, arquivo)
    conferir(`abre o arquivo "${NOME_ACENTO}"`, r.mudou && p.avisos.length === 0, p.avisos.join(' / '))
    const lido = await cmd(p, 'circuito.ler')
    conferir('rótulos com acento chegam intactos', ['Á', 'É', 'Ç', 'SAÍDA', 'VAI-UM'].every((l) => lido.componentes.some((c) => c.label === l)))
    // simular com o mouse: cada combinação das chaves, conferindo os LEDs com a soma
    const leds = async () => { const v = (await cmd(p, 'circuito.ler')).valores; return `${v['c9:in']}${v['c10:in']}` }
    let certas = 0
    let estado = [0, 0, 0]
    for (let n = 0; n < 8; n++) {
      const alvo = [(n >> 2) & 1, (n >> 1) & 1, n & 1]
      for (let i = 0; i < 3; i++) {
        if (estado[i] !== alvo[i]) {
          const b = await corpo(p, `c${i + 1}`)
          await p.pagina.mouse.click(b.x, b.y)
          await esperar(80)
        }
      }
      estado = alvo
      const soma = alvo[0] + alvo[1] + alvo[2]
      if ((await leds()) === `${soma & 1}${soma >> 1}`) certas++
    }
    conferir('simulação com o mouse: as 8 combinações das chaves dão a soma certa', certas === 8, `${certas} de 8`)
    const t = await cmd(p, 'tabela.ler')
    conferir('tabela-verdade com os nomes acentuados', JSON.stringify(t.entradas) === '["Á","É","Ç"]' &&
      JSON.stringify(t.saidas) === '["SAÍDA","VAI-UM"]', `${t.entradas.join(',')} | ${t.saidas.join(',')}`)
    await cmd(p, 'tabela.aplicar_linha', { linha: 0 })
    await esperar(600)
    await clicarBotao(p, 'button.action', 'Salvar')
    const salvo = await baixado(p, 'circuito.json')
    const json = JSON.parse(readFileSync(salvo, 'utf8'))
    conferir(`Salvar grava em "${PASTA_ACENTO}"`, essencial(json) === essencial(await circuito(p)))
    conferir('o arquivo salvo é UTF-8 com os acentos (sem \\u escapado nem caractere trocado)',
      readFileSync(salvo, 'utf8').includes('"SAÍDA"') && !/Ã|\\u00/.test(readFileSync(salvo, 'utf8')))
    renameSync(salvo, join(pasta, 'salvo-pelo-salvar.json'))
    await clicarBotao(p, 'button.action', 'Limpar tudo')
    await esperar(200)
    await abrirArquivo(p, join(pasta, 'salvo-pelo-salvar.json'))
    conferir('reabre o arquivo salvo, igual', essencial(await circuito(p)) === essencial(json))
    await esperar(1000)
    await p.pagina.reload({ waitUntil: 'load' })
    await ate(() => p.pagina.evaluate(() => typeof window.bancadaLivre === 'object'))
    conferir('recarregar recupera pelo salvamento automático, com os acentos', essencial(await circuito(p)) === essencial(json))
    await clicarBotao(p, 'button.action', 'PNG')
    const png = readFileSync(await baixado(p, 'circuito.png'))
    conferir('PNG válido', png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) > 200, `${png.readUInt32BE(16)} x ${png.readUInt32BE(20)}`)
    renameSync(join(baixados, 'circuito.png'), join(pasta, 'exportado.png'))
    await clicarBotao(p, 'button.action', 'SVG')
    const svg = readFileSync(await baixado(p, 'circuito.svg'), 'utf8')
    conferir('SVG com os textos acentuados', ['SAÍDA', 'VAI-UM', 'ação de aula'].every((s) => svg.includes(s)))
    renameSync(join(baixados, 'circuito.svg'), join(pasta, 'exportado.svg'))
    await p.pagina.mouse.click(1100, 800)
    await clicarBotao(p, 'button', 'Exportar CSV')
    const csv = readFileSync(await baixado(p, 'tabela-verdade.csv'), 'utf8')
    const linhas = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
    conferir('CSV com BOM, cabeçalho acentuado e 8 linhas', csv.charCodeAt(0) === 0xfeff && linhas[0] === 'Á;É;Ç;SAÍDA;VAI-UM' && linhas.length === 9, linhas[0])
    renameSync(join(baixados, 'tabela-verdade.csv'), join(pasta, 'exportado.csv'))
    conferir('nenhum erro na página', p.erros.length === 0, p.erros.join(' / '))
  })

  await etapa('2. arquivos das versões 1.0.2 e 2.0.3', async () => {
    const antigos = await gerarAntigos()
    const porVersao = {}
    for (const a of antigos) {
      const r = (porVersao[a.versao] ??= { total: 0, abriu: 0, tabelaIgual: 0, comTabela: 0, problemas: [] })
      r.total++
      p.avisos.length = 0
      await cmd(p, 'circuito.limpar')
      const o = await abrirArquivo(p, a.arquivo)
      const lido = await circuito(p)
      const salvo = JSON.parse(readFileSync(a.arquivo, 'utf8'))
      const ok = o.mudou && p.avisos.length === 0 && lido.components.length === salvo.components.length && lido.wires.length === salvo.wires.length
      if (ok) r.abriu++
      else r.problemas.push(`${a.nome}: ${p.avisos.join(' / ') || 'não abriu igual'}`)
      if (a.tabela) {
        r.comTabela++
        const t = await tentar(p, 'tabela.ler')
        if (t.ok && JSON.stringify(t.resultado) === JSON.stringify(a.tabela)) r.tabelaIgual++
        else r.problemas.push(`${a.nome}: tabela-verdade diferente da versão ${a.versao}`)
      }
    }
    for (const [v, r] of Object.entries(porVersao)) {
      conferir(`${v}: os ${r.total} exemplos salvos pela ${v} abrem, com as mesmas peças e fios`, r.abriu === r.total, `${r.abriu} de ${r.total}`)
      conferir(`${v}: tabela-verdade igual à da ${v}`, r.tabelaIgual === r.comTabela, `${r.tabelaIgual} de ${r.comTabela}${r.problemas.length ? '; ' + r.problemas.join('; ') : ''}`)
    }
  })

  await etapa('3. circuitos grandes, com tempo', async () => {
    for (const [cadeias, tamanho] of [[8, 60], [10, 200], [10, 400]]) {
      const c = grande(cadeias, tamanho)
      const n = c.components.length
      const arquivo = join(pasta, `grande-${n}.json`)
      writeFileSync(arquivo, JSON.stringify(c))
      const tam = statSync(arquivo).size
      await cmd(p, 'circuito.limpar')
      await esperar(500)
      const ab = await abrirArquivo(p, arquivo)
      const t = { pecas: n, fios: c.wires.length, bytes: tam, abrir_ms: ab.ms }
      conferir(`${n} peças (${tam} bytes): abre`, ab.mudou && p.avisos.length === 0, `${ab.ms} ms ${p.avisos.join(' / ')}`)
      // desenho na tela: espera o número certo de peças desenhadas
      const t1 = Date.now()
      await ate(() => p.pagina.evaluate((n) => document.querySelectorAll('circle.pin').length >= n, n), 60000)
      t.desenhar_ms = Date.now() - t1
      // clicar na primeira chave e esperar o LED do fim da fila mudar
      const ultimo = `l0:in`
      const v0 = (await cmd(p, 'circuito.ler')).valores[ultimo]
      // com o circuito largo demais, a chave pode ficar fora da tela mesmo no menor zoom: aí vale o comando da chave
      const b = await corpo(p, 's0')
      const naTela = b && b.x > 0 && b.y > 0 && b.x < 1600 && b.y < 900
      t.chave = naTela ? 'mouse' : 'comando'
      const t2 = Date.now()
      if (naTela) await p.pagina.mouse.click(b.x, b.y)
      else await cmd(p, 'chave.alternar', { id: 's0' })
      const mudou = await ate(async () => (await cmd(p, 'circuito.ler')).valores[ultimo] !== v0, 60000, 20)
      t.clique_ate_led_ms = Date.now() - t2
      const esperado = tamanho % 2 === 0 ? 1 : 0
      conferir(`${n} peças: o clique na chave chega ao LED do fim da fila (${tamanho} portas)`,
        mudou && (await cmd(p, 'circuito.ler')).valores[ultimo] === esperado, `${t.clique_ate_led_ms} ms`)
      const t3 = Date.now()
      const gravou = await ate(() => p.pagina.evaluate((s) => (localStorage.getItem('simulador-portas:autosave') ?? '').includes(`"state":${s}`), 1), 30000)
      t.salvamento_automatico_ms = Date.now() - t3
      conferir(`${n} peças: o salvamento automático grava`, gravou, `${t.salvamento_automatico_ms} ms`)
      const t4 = Date.now()
      await clicarBotao(p, 'button.action', 'Salvar')
      await baixado(p, 'circuito.json', 60000)
      t.salvar_ms = Date.now() - t4
      rmSync(join(baixados, 'circuito.json'))
      const t5 = Date.now()
      await clicarBotao(p, 'button.action', 'PNG')
      let png = true
      try { await baixado(p, 'circuito.png', 60000) } catch { png = false }
      t.png_ms = Date.now() - t5
      conferir(`${n} peças: exporta PNG`, png, `${t.png_ms} ms${png ? '' : `; nenhum arquivo e nenhum aviso (${p.avisos.length} avisos)`}`)
      if (png) {
        const b2 = readFileSync(join(baixados, 'circuito.png'))
        t.png_px = `${b2.readUInt32BE(16)} x ${b2.readUInt32BE(20)}`
        rmSync(join(baixados, 'circuito.png'))
      }
      tempos[n] = t
      console.log(`    tempos: ${JSON.stringify(t)}`)
    }
    conferir('nenhum erro na página', p.erros.length === 0, p.erros.join(' / '))
  })
  await p.navegador.close()
}

for (const n of escolhidos) await testar(n)
writeFileSync(join(SAIDA, 'resultado.json'), JSON.stringify(relatorio, null, 2))
const falhas = Object.entries(relatorio.navegadores).flatMap(([n, r]) => r.resultados.filter((x) => !x.ok).map((x) => `${n}: ${x.texto}`))
console.log(`\n${falhas.length ? `${falhas.length} falha(s):\n  ${falhas.join('\n  ')}` : 'Tudo passou.'}`)
process.exitCode = falhas.length ? 1 : 0
