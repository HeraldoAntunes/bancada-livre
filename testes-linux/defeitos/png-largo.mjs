// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Defeito (validação no Linux da 2.1.2): num circuito largo, o PNG não sai no Firefox e a pessoa não é avisada.
// A imagem tem o dobro do tamanho do circuito (nitidez para projeção); passando de 32767 px de largura, o limite da
// tela de desenho (canvas) do Firefox, o desenho dá erro, nenhum arquivo é baixado e nenhum aviso aparece.
// ESTE TESTE FALHA na 2.1.2 de propósito: passa quando o PNG sair, ou quando houver um aviso para a pessoa.
//
// Uso (depois de ../ponta-a-ponta/preparar.sh): FIREFOX=/caminho/do/firefox node png-largo.mjs
// Com o argumento "chromium" (e CHROMIUM=...), roda no Chromium para comparar: lá o PNG sai.
/* global process, console, setTimeout -- Node */

import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const HTML = process.env.HTML ?? join(AQUI, '..', 'ponta-a-ponta', 'saida', 'html', 'BancadaLivre-atual.html')
const qual = process.argv[2] ?? 'firefox'
const pasta = mkdtempSync(join(tmpdir(), 'bl-png-largo-'))
const baixados = join(pasta, 'baixados')
mkdirSync(baixados)

// uma chave e uma fila de 300 portas NOT até um LED: cerca de 21 mil px de largura, uns 42 mil px no PNG
const C = [{ id: 's', type: 'SWITCH', x: 40, y: 80, state: 0 }]
const W = []
for (let i = 0; i < 300; i++) {
  C.push({ id: `n${i}`, type: 'NOT', x: 160 + i * 70, y: 80 })
  W.push({ id: `w${i}`, from: { comp: i ? `n${i - 1}` : 's', pin: 'out' }, to: { comp: `n${i}`, pin: 'in0' } })
}
C.push({ id: 'l', type: 'LED', x: 160 + 300 * 70, y: 80 })
W.push({ id: 'wl', from: { comp: 'n299', pin: 'out' }, to: { comp: 'l', pin: 'in' } })
const arquivo = join(pasta, 'largo.json')
writeFileSync(arquivo, JSON.stringify({ version: 1, components: C, wires: W }))

const opcoes = qual === 'chromium'
  ? { browser: 'chrome', executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] }
  : { browser: 'firefox', executablePath: process.env.FIREFOX ?? 'firefox', extraPrefsFirefox: {
    'browser.download.folderList': 2, 'browser.download.dir': baixados, 'browser.download.useDownloadDir': true,
    'browser.download.always_ask_before_handling_new_types': false, 'browser.helperApps.neverAsk.saveToDisk': 'image/png' } }
const navegador = await puppeteer.launch({ ...opcoes, headless: true, defaultViewport: null, userDataDir: join(pasta, 'perfil') })
const versao = await navegador.version()
const pagina = await navegador.newPage()
if (qual === 'chromium') await (await pagina.createCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados })
const avisos = []
const erros = []
pagina.on('dialog', (d) => { avisos.push(d.message()); d.accept() })
pagina.on('pageerror', (e) => erros.push(e.message))
await pagina.goto(pathToFileURL(HTML).href, { waitUntil: 'load' })
await new Promise((r) => setTimeout(r, 800))
await (await pagina.$('input[type="file"][accept=".json,application/json"]')).uploadFile(arquivo)
await new Promise((r) => setTimeout(r, 2000))
for (const b of await pagina.$$('button.action')) if ((await b.evaluate((e) => e.textContent.trim())) === 'PNG') await b.click()
const fim = Date.now() + 20000
const pronto = () => existsSync(join(baixados, 'circuito.png')) && !readdirSync(baixados).some((f) => f.endsWith('.part'))
while (Date.now() < fim && !pronto()) await new Promise((r) => setTimeout(r, 200))
const saiu = pronto()
await navegador.close()

console.log(`${versao}: PNG ${saiu ? 'baixado' : 'NÃO baixado'}; avisos: ${avisos.join(' / ') || 'nenhum'}; erros na página: ${erros.join(' / ') || 'nenhum'}`)
if (!saiu && avisos.length === 0) {
  console.log('FALHOU: o PNG não saiu e a pessoa não foi avisada.')
  process.exitCode = 1
} else console.log('passou')
