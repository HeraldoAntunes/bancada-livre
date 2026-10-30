// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Testa o HTML único (dist/index.html) no Chromium e no Firefox do Linux, sem janela, aberto direto do disco
// (file://), como o aluno abre. Usa o mouse onde dá: paleta, fios, chaves, botões do clock, Salvar, Limpar,
// PNG, Exportar CSV e Mapa de Karnaugh. Os comandos da página (window.bancadaLivre) servem para conferir o estado e
// para pôr os componentes em posições fixas. Nada no programa é alterado.
//
// Uso (dentro de testes-linux/, depois de "npm run build" na raiz):
//   npm ci
//   FIREFOX=/caminho/do/firefox CHROMIUM=/caminho/do/chrome node validar.mjs [chromium] [firefox]
// Os arquivos baixados e as capturas de tela ficam em testes-linux/saida/<navegador>/.
/* global process, console, setTimeout, Buffer, window, document, localStorage, Event -- código do Node e, dentro de evaluate, da página */

import puppeteer from 'puppeteer-core'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const HTML = resolve(process.env.HTML ?? join(AQUI, '..', 'dist', 'index.html'))
const URL_HTML = pathToFileURL(HTML).href
const SAIDA = join(AQUI, 'saida')

const NAVEGADORES = {
  chromium: { browser: 'chrome', exe: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' },
  firefox: { browser: 'firefox', exe: process.env.FIREFOX ?? 'firefox' },
}
const escolhidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NAVEGADORES)

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function ate(condicao, ms = 5000, passo = 100) {
  const fim = Date.now() + ms
  for (;;) {
    const v = await condicao()
    if (v) return v
    if (Date.now() > fim) return v
    await esperar(passo)
  }
}

// ---------------------------------------------------------------- navegador

async function abrirNavegador(nome, perfil, baixados) {
  const n = NAVEGADORES[nome]
  // tamanho da janela pelos argumentos: o Firefox 136 não aceita o setViewport do Puppeteer
  const opcoes = { browser: n.browser, executablePath: n.exe, headless: true, userDataDir: perfil, defaultViewport: null }
  if (nome === 'chromium') opcoes.args = ['--no-sandbox', '--window-size=1600,1000']
  if (nome === 'firefox') {
    opcoes.args = ['--width=1600', '--height=1000']
    opcoes.extraPrefsFirefox = {
      'browser.download.folderList': 2,
      'browser.download.dir': baixados,
      'browser.download.useDownloadDir': true,
      'browser.download.always_ask_before_handling_new_types': false,
      'browser.download.manager.showWhenStarting': false,
      'browser.helperApps.neverAsk.saveToDisk': 'application/json,text/csv,image/png,image/svg+xml,application/octet-stream',
    }
  }
  const navegador = await puppeteer.launch(opcoes)
  // com um perfil já usado, o Chromium reabre as abas da última vez: o teste usa uma aba nova e fecha as outras
  const pagina = await navegador.newPage()
  for (const p of await navegador.pages()) if (p !== pagina) await p.close()
  await pagina.bringToFront()
  if (nome === 'chromium') {
    const s = await pagina.createCDPSession()
    await s.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados })
  }
  return { navegador, pagina }
}

function vigiar(pagina, erros) {
  pagina.on('pageerror', (e) => erros.push(`erro na página: ${e.message}`))
  pagina.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') erros.push(`console ${m.type()}: ${m.text()}`)
  })
  // "Limpar tudo" pergunta antes; aqui a resposta é sempre sim
  pagina.on('dialog', (d) => d.accept())
}

const cmd = (pagina, nome, params) =>
  pagina.evaluate((n, p) => window.bancadaLivre.executar(n, p), nome, params ?? {})

async function cmdOk(pagina, nome, params) {
  const r = await cmd(pagina, nome, params)
  if (!r.ok) throw new Error(`${nome}: ${r.erro}`)
  return r.resultado
}

async function clicarBotao(pagina, seletor, texto) {
  const ok = await pagina.evaluate(
    (s, t) => {
      const b = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().replace(/\s+/g, ' ').includes(t))
      if (!b) return false
      b.scrollIntoView({ block: 'center' })
      return true
    },
    seletor,
    texto,
  )
  if (!ok) throw new Error(`botão não encontrado: ${seletor} "${texto}"`)
  const handles = await pagina.$$(seletor)
  for (const h of handles) {
    const t = await h.evaluate((e) => e.textContent.trim().replace(/\s+/g, ' '))
    if (t.includes(texto)) {
      await h.click()
      return
    }
  }
}

async function centro(pagina, seletor) {
  const h = await pagina.$(seletor)
  if (!h) throw new Error(`não achei ${seletor}`)
  const c = await h.boundingBox()
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 }
}

/** Liga um fio com o mouse: aperta no pino de saída, arrasta e solta no pino de entrada. */
async function ligarComMouse(pagina, de, para) {
  const [dc, dp] = de.split(':')
  const [pc, pp] = para.split(':')
  const a = await centro(pagina, `circle.pin[data-comp="${dc}"][data-pin="${dp}"]`)
  const b = await centro(pagina, `circle.pin[data-comp="${pc}"][data-pin="${pp}"]`)
  await pagina.mouse.move(a.x, a.y)
  await pagina.mouse.down()
  for (let i = 1; i <= 8; i++) await pagina.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8)
  await pagina.mouse.up()
  await esperar(100)
}

/** Centro do corpo de um componente na tela (o retângulo transparente que recebe o clique). */
async function corpo(pagina, id) {
  const c = await pagina.evaluate((id) => {
    const pino = document.querySelector(`circle.pin[data-comp="${id}"]`)
    const r = pino?.parentElement?.querySelector(':scope > g > rect')
    if (!r) return null
    const b = r.getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }, id)
  if (!c) throw new Error(`não achei o corpo de ${id}`)
  return c
}

async function clicarCorpo(pagina, id) {
  const c = await corpo(pagina, id)
  await pagina.mouse.click(c.x, c.y)
  await esperar(150)
}

/** Espera um arquivo novo na pasta de baixados, já completo (sem .part/.crdownload), e devolve o caminho. */
async function arquivoBaixado(pasta, nome, ms = 10000) {
  const caminho = join(pasta, nome)
  const ok = await ate(() => {
    if (!existsSync(caminho)) return false
    const temp = readdirSync(pasta).some((f) => f.endsWith('.part') || f.endsWith('.crdownload'))
    return !temp && statSync(caminho).size > 0
  }, ms)
  if (!ok) throw new Error(`o arquivo ${nome} não apareceu em ${pasta} (há: ${readdirSync(pasta).join(', ') || 'nada'})`)
  await esperar(300)
  return caminho
}

function tirarDaPasta(pasta, nome, destino) {
  const origem = join(pasta, nome)
  writeFileSync(destino, readFileSync(origem))
  rmSync(origem)
}

const circuito = async (pagina) => JSON.parse((await cmdOk(pagina, 'circuito.json')).json)
const valorDe = async (pagina, comp, pin) => (await cmdOk(pagina, 'circuito.ler')).valores[`${comp}:${pin}`]

/** Componentes e fios, sem o que é só da tela, para comparar dois circuitos. */
function essencial(c) {
  // o estado do CLOCK muda sozinho enquanto ele roda: fica de fora da comparação
  const components = c.components.map((x) => (x.type === 'CLOCK' ? { ...x, state: undefined } : x))
  return JSON.stringify({ components, wires: c.wires })
}

// ---------------------------------------------------------------- roteiro

async function testar(nome) {
  const pasta = join(SAIDA, nome)
  rmSync(pasta, { recursive: true, force: true })
  mkdirSync(pasta, { recursive: true })
  const baixados = join(pasta, 'baixados')
  mkdirSync(baixados)
  const perfil = mkdtempSync(join(tmpdir(), `bancada-perfil-${nome}-`))
  const resultados = []
  const erros = []
  let { navegador, pagina } = await abrirNavegador(nome, perfil, baixados)
  vigiar(pagina, erros)
  const info = { navegador: await navegador.version(), userAgent: await navegador.userAgent() }
  const ids = {}

  async function etapa(titulo, fn) {
    const t0 = Date.now()
    try {
      const detalhe = await fn()
      resultados.push({ titulo, ok: true, detalhe: detalhe ?? '', ms: Date.now() - t0 })
      console.log(`  [passou] ${titulo}${detalhe ? `: ${detalhe}` : ''}`)
    } catch (e) {
      resultados.push({ titulo, ok: false, detalhe: e.message, ms: Date.now() - t0 })
      console.log(`  [FALHOU] ${titulo}: ${e.message}`)
      try {
        await pagina.screenshot({ path: join(pasta, `falha-${resultados.length}.png`) })
      } catch {
        /* a página pode ter caído */
      }
    }
  }
  const garantir = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }

  console.log(`\n${nome}: ${info.navegador}`)

  await etapa('abrir o HTML pelo file://', async () => {
    await pagina.goto(URL_HTML, { waitUntil: 'load' })
    await ate(() => pagina.evaluate(() => typeof window.bancadaLivre === 'object'), 5000)
    const t = await pagina.title()
    garantir(t === 'Bancada Livre', `título "${t}"`)
    const vazio = await circuito(pagina)
    garantir(vazio.components.length === 0, 'a bancada devia começar vazia num perfil novo')
    return `título "${t}", bancada vazia`
  })

  await etapa('montar pela paleta: 2 chaves, CLOCK, AND, XOR e 3 LEDs', async () => {
    await clicarBotao(pagina, 'button.tab', 'ENTRADAS')
    await clicarBotao(pagina, '.palette-item', 'SWITCH')
    await clicarBotao(pagina, '.palette-item', 'SWITCH')
    await clicarBotao(pagina, '.palette-item', 'CLOCK')
    await clicarBotao(pagina, 'button.tab', 'PORTAS')
    await clicarBotao(pagina, '.palette-item', 'AND')
    await clicarBotao(pagina, '.palette-item', 'XOR')
    await clicarBotao(pagina, 'button.tab', 'SAÍDAS')
    for (let i = 0; i < 3; i++) await clicarBotao(pagina, '.palette-item', 'LED')
    const c = await cmdOk(pagina, 'circuito.ler')
    const tipos = c.componentes.map((x) => x.type)
    garantir(
      JSON.stringify(tipos) === JSON.stringify(['SWITCH', 'SWITCH', 'CLOCK', 'AND', 'XOR', 'LED', 'LED', 'LED']),
      `componentes: ${tipos.join(', ')}`,
    )
    ;[ids.a, ids.b, ids.clk, ids.and, ids.xor, ids.ledE, ids.ledX, ids.ledC] = c.componentes.map((x) => x.id)
    // posições fixas, para os fios não passarem por cima dos pinos
    const pos = { a: [80, 120], b: [80, 260], clk: [80, 420], and: [320, 120], xor: [320, 260], ledE: [560, 120], ledX: [560, 260], ledC: [560, 420] }
    for (const [k, [x, y]] of Object.entries(pos)) await cmdOk(pagina, 'componente.mover', { id: ids[k], x, y })
    for (const [k, r] of Object.entries({ a: 'A', b: 'B', ledE: 'E', ledX: 'X', ledC: 'CLK' })) {
      await cmdOk(pagina, 'componente.rotulo', { id: ids[k], texto: r })
    }
    await esperar(300)
    return `ids ${Object.values(ids).join(' ')}`
  })

  await etapa('arrastar um componente com o mouse', async () => {
    const antes = (await circuito(pagina)).components.find((x) => x.id === ids.and)
    const c = await corpo(pagina, ids.and)
    await pagina.mouse.move(c.x, c.y)
    await pagina.mouse.down()
    for (let i = 1; i <= 6; i++) await pagina.mouse.move(c.x + i * 5, c.y + i * 5)
    await pagina.mouse.up()
    await esperar(150)
    const depois = (await circuito(pagina)).components.find((x) => x.id === ids.and)
    garantir(depois.x !== antes.x || depois.y !== antes.y, 'o AND não saiu do lugar')
    await cmdOk(pagina, 'componente.mover', { id: ids.and, x: 320, y: 120 })
    return `de (${antes.x}, ${antes.y}) para (${depois.x}, ${depois.y})`
  })

  await etapa('ligar 7 fios arrastando com o mouse', async () => {
    const c = await cmdOk(pagina, 'circuito.ler')
    const pinos = Object.fromEntries(c.componentes.map((x) => [x.id, x]))
    const s = (id) => `${id}:${pinos[id].saidas[0]}`
    const e = (id, i = 0) => `${id}:${pinos[id].entradas[i]}`
    const fios = [
      [s(ids.a), e(ids.and, 0)],
      [s(ids.b), e(ids.and, 1)],
      [s(ids.a), e(ids.xor, 0)],
      [s(ids.b), e(ids.xor, 1)],
      [s(ids.and), e(ids.ledE)],
      [s(ids.xor), e(ids.ledX)],
      [s(ids.clk), e(ids.ledC)],
    ]
    for (const [de, para] of fios) await ligarComMouse(pagina, de, para)
    const depois = await cmdOk(pagina, 'circuito.ler')
    const feitos = depois.fios.map((f) => `${f.de}>${f.para}`).sort()
    const queria = fios.map(([de, para]) => `${de}>${para}`).sort()
    garantir(JSON.stringify(feitos) === JSON.stringify(queria), `fios: ${feitos.join(', ') || 'nenhum'}`)
    garantir(depois.avisos.conflito.length === 0 && depois.avisos.laco.length === 0, 'aviso de conflito ou laço')
    return `${feitos.length} fios`
  })

  await etapa('clicar nas chaves e ver os LEDs (AND e XOR)', async () => {
    const leds = async () => [await valorDe(pagina, ids.ledE, 'in'), await valorDe(pagina, ids.ledX, 'in')].join('')
    const visto = [await leds()]
    await clicarCorpo(pagina, ids.a)
    visto.push(await leds())
    await clicarCorpo(pagina, ids.b)
    visto.push(await leds())
    await clicarCorpo(pagina, ids.a)
    visto.push(await leds())
    await clicarCorpo(pagina, ids.b)
    visto.push(await leds())
    // (E, X) para A B = 00, 10, 11, 01, 00
    garantir(visto.join(' ') === '00 01 10 01 00', `E e X vistos: ${visto.join(' ')}`)
    await pagina.screenshot({ path: join(pasta, 'circuito.png') })
    return `E e X: ${visto.join(' ')}`
  })

  await etapa('CLOCK rodando pisca o LED; pausar e avançar pelos botões', async () => {
    const vistos = new Set()
    for (let i = 0; i < 25; i++) {
      vistos.add(await valorDe(pagina, ids.ledC, 'in'))
      await esperar(120)
    }
    garantir(vistos.has(0) && vistos.has(1), `o LED do clock só mostrou ${[...vistos].join(', ')} em 3 s`)
    await pagina.click('g.clock-botao[aria-label="Pausar o clock"]')
    await esperar(200)
    const parado = await valorDe(pagina, ids.ledC, 'in')
    await esperar(1500)
    garantir((await valorDe(pagina, ids.ledC, 'in')) === parado, 'o clock mudou depois de pausar')
    await pagina.click('g.clock-botao[aria-label^="Avançar meio período"]')
    await esperar(200)
    const avancado = await valorDe(pagina, ids.ledC, 'in')
    garantir(avancado !== parado, 'o botão de avançar não mudou o clock')
    garantir(await pagina.$('g.clock-botao[aria-label="Rodar o clock"]'), 'o botão de rodar não apareceu')
    return `piscou (0 e 1); pausado em ${parado}; avançou para ${avancado}`
  })

  let salvo
  await etapa('Salvar baixa circuito.json igual ao circuito', async () => {
    await clicarBotao(pagina, 'button.action', 'Salvar')
    const arq = await arquivoBaixado(baixados, 'circuito.json')
    salvo = JSON.parse(readFileSync(arq, 'utf8'))
    tirarDaPasta(baixados, 'circuito.json', join(pasta, 'circuito.json'))
    const agora = await circuito(pagina)
    garantir(essencial(salvo) === essencial(agora), 'o arquivo baixado é diferente do circuito na tela')
    return `${salvo.components.length} componentes, ${salvo.wires.length} fios`
  })

  await etapa('Limpar tudo e Abrir o circuito.json de volta', async () => {
    await clicarBotao(pagina, 'button.action', 'Limpar tudo')
    await esperar(200)
    garantir((await circuito(pagina)).components.length === 0, 'Limpar tudo não limpou')
    const input = await pagina.$('input[type="file"][accept=".json,application/json"]')
    await input.uploadFile(join(pasta, 'circuito.json'))
    const volta = await ate(async () => {
      const c = await circuito(pagina)
      return c.components.length ? c : null
    })
    garantir(volta, 'o circuito não abriu')
    garantir(essencial(volta) === essencial(salvo), 'o circuito aberto é diferente do salvo')
    return 'mesmos componentes e fios'
  })

  await etapa('recarregar a página e recuperar pelo salvamento automático', async () => {
    await esperar(1000) // o salvamento automático grava até 400 ms depois da mudança
    const guardado = await pagina.evaluate(() => localStorage.getItem('simulador-portas:autosave'))
    garantir(guardado, 'nada no localStorage')
    const antes = essencial(await circuito(pagina))
    await pagina.reload({ waitUntil: 'load' })
    await ate(() => pagina.evaluate(() => typeof window.bancadaLivre === 'object'), 5000)
    const depois = essencial(await circuito(pagina))
    garantir(depois === antes, 'depois de recarregar, o circuito é outro')
    return `${guardado.length} caracteres no localStorage; circuito igual`
  })

  await etapa('fechar o navegador, abrir de novo e recuperar o circuito', async () => {
    const antes = essencial(await circuito(pagina))
    await navegador.close()
    ;({ navegador, pagina } = await abrirNavegador(nome, perfil, baixados))
    vigiar(pagina, erros)
    await pagina.goto(URL_HTML, { waitUntil: 'load' })
    await ate(() => pagina.evaluate(() => typeof window.bancadaLivre === 'object'), 5000)
    const depois = essencial(await circuito(pagina))
    garantir(depois === antes, 'depois de fechar e abrir o navegador, o circuito é outro ou sumiu')
    await cmdOk(pagina, 'clock.pausar')
    return 'circuito igual'
  })

  await etapa('PNG baixa circuito.png válido', async () => {
    await clicarBotao(pagina, 'button.action', 'PNG')
    const arq = await arquivoBaixado(baixados, 'circuito.png')
    const b = readFileSync(arq)
    garantir(b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'não começa como PNG')
    const larg = b.readUInt32BE(16)
    const alt = b.readUInt32BE(20)
    garantir(larg > 200 && alt > 200, `imagem pequena demais: ${larg} x ${alt}`)
    tirarDaPasta(baixados, 'circuito.png', join(pasta, 'exportado.png'))
    return `${larg} x ${alt} px, ${b.length} bytes`
  })

  await etapa('SVG baixa circuito.svg', async () => {
    await clicarBotao(pagina, 'button.action', 'SVG')
    const arq = await arquivoBaixado(baixados, 'circuito.svg')
    const t = readFileSync(arq, 'utf8')
    garantir(t.startsWith('<?xml') && t.includes('<svg'), 'não parece SVG')
    tirarDaPasta(baixados, 'circuito.svg', join(pasta, 'exportado.svg'))
    return `${t.length} caracteres`
  })

  // tabela esperada: A B | E X (o LED do clock entra como saída, com o valor de agora)
  const esperada = [
    ['0', '0', '0', '0'],
    ['0', '1', '0', '1'],
    ['1', '0', '0', '1'],
    ['1', '1', '1', '0'],
  ]

  await etapa('tabela-verdade no painel', async () => {
    // clique no fundo da bancada: tira a seleção e o painel mostra a tabela do circuito
    const fundo = await centro(pagina, 'svg.bancada-svg')
    await pagina.mouse.click(fundo.x + 300, fundo.y + 300)
    await esperar(200)
    const t = await ate(() =>
      pagina.evaluate(() => {
        const tab = document.querySelector('table.tt')
        if (!tab) return null
        const linha = (tr) => [...tr.children].map((c) => c.textContent.trim())
        return { cab: linha(tab.querySelector('thead tr') ?? tab.querySelector('tr')), linhas: [...tab.querySelectorAll('tbody tr')].map(linha) }
      }),
    )
    garantir(t, 'a tabela não apareceu no painel')
    const col = (n) => t.cab.findIndex((c) => c === n)
    const [ia, ib, ie, ix] = ['A', 'B', 'E', 'X'].map(col)
    garantir([ia, ib, ie, ix].every((i) => i >= 0), `cabeçalho: ${t.cab.join(' | ')}`)
    const vistas = t.linhas.map((l) => [l[ia], l[ib], l[ie], l[ix]])
    garantir(JSON.stringify(vistas) === JSON.stringify(esperada), `linhas: ${vistas.map((l) => l.join('')).join(' ')}`)
    // clicar na última linha põe A = 1 e B = 1
    const trs = await pagina.$$('table.tt tbody tr')
    await trs[3].click()
    await esperar(200)
    const e = await valorDe(pagina, ids.ledE, 'in')
    garantir(e === 1, `depois de clicar na linha 11, o LED E está em ${e}`)
    await pagina.screenshot({ path: join(pasta, 'tabela.png') })
    return `cabeçalho ${t.cab.join(' | ')}; 4 linhas certas; clique na linha liga as chaves`
  })

  await etapa('Exportar CSV baixa tabela-verdade.csv certa', async () => {
    await clicarBotao(pagina, 'button', 'Exportar CSV')
    const arq = await arquivoBaixado(baixados, 'tabela-verdade.csv')
    const t = readFileSync(arq, 'utf8')
    garantir(t.charCodeAt(0) === 0xfeff, 'falta o BOM do UTF-8 no começo')
    const linhas = t.slice(1).trim().split(/\r?\n/).map((l) => l.split(';'))
    const cab = linhas[0]
    const ix = ['A', 'B', 'E', 'X'].map((n) => cab.indexOf(n))
    garantir(ix.every((i) => i >= 0), `cabeçalho do CSV: ${cab.join(';')}`)
    const corpo = linhas.slice(1).map((l) => ix.map((i) => l[i]))
    garantir(JSON.stringify(corpo) === JSON.stringify(esperada), `linhas do CSV: ${corpo.map((l) => l.join('')).join(' ')}`)
    tirarDaPasta(baixados, 'tabela-verdade.csv', join(pasta, 'tabela-verdade.csv'))
    return `cabeçalho ${cab.join(';')}, separador ";", 4 linhas`
  })

  await etapa('Mapa de Karnaugh do E e do X', async () => {
    await clicarBotao(pagina, 'button', 'Mapa de Karnaugh')
    const dlg = await ate(() => pagina.$('[role="dialog"][aria-label="Mapa de Karnaugh"]'))
    garantir(dlg, 'a janela do mapa não abriu')
    const detalhes = []
    for (const saida of ['E', 'X']) {
      const k = await cmdOk(pagina, 'karnaugh.ler', { saida })
      // muda a saída pela caixa de escolha da própria janela, se houver
      await pagina.evaluate((nome) => {
        const sel = document.querySelector('[aria-label="Mapa de Karnaugh"] select')
        if (!sel) return
        const op = [...sel.options].find((o) => o.textContent.trim() === nome)
        if (op) {
          sel.value = op.value
          sel.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, saida)
      await esperar(200)
      const texto = await pagina.evaluate(() => document.querySelector('[aria-label="Mapa de Karnaugh"]').textContent)
      const uns = k.valores.flat().filter((v) => v === 1).length
      if (saida === 'E') garantir(uns === 1 && k.grupos.length === 1, `E: ${uns} uns, ${k.grupos.length} grupos`)
      if (saida === 'X') garantir(uns === 2 && k.grupos.length === 2, `X: ${uns} uns, ${k.grupos.length} grupos`)
      garantir(texto.includes(k.expressao), `a janela não mostra a expressão "${k.expressao}"`)
      detalhes.push(`${saida} = ${k.expressao}`)
      await pagina.screenshot({ path: join(pasta, `karnaugh-${saida}.png`) })
    }
    await cmdOk(pagina, 'karnaugh.fechar')
    return detalhes.join('; ')
  })

  await etapa('sem erros no console nem na página', async () => {
    garantir(erros.length === 0, erros.join(' / '))
    return 'nenhum'
  })

  await navegador.close()
  rmSync(perfil, { recursive: true, force: true })
  return { nome, ...info, resultados }
}

// ---------------------------------------------------------------- relatório

const sha256 = createHash('sha256').update(readFileSync(HTML)).digest('hex')
console.log(`HTML: ${HTML}\nSHA-256: ${sha256}`)
mkdirSync(SAIDA, { recursive: true })
const todos = []
for (const nome of escolhidos) {
  if (!NAVEGADORES[nome]) throw new Error(`navegador desconhecido: ${nome} (use chromium ou firefox)`)
  todos.push(await testar(nome))
}
writeFileSync(join(SAIDA, 'resultado.json'), JSON.stringify({ html: HTML, sha256, data: new Date().toISOString(), navegadores: todos }, null, 2))
const falhas = todos.flatMap((n) => n.resultados.filter((r) => !r.ok).map((r) => `${n.nome}: ${r.titulo}`))
console.log(`\n${falhas.length ? `${falhas.length} falha(s):\n  ${falhas.join('\n  ')}` : 'Tudo passou.'}`)
process.exitCode = falhas.length ? 1 : 0
