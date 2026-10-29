// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Só para testes: avalia uma expressão na janela do programa instalado pelo protocolo de depuração do WebView2.
// O programa só abre essa porta quando o teste liga WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=N.
// Uso:  node instalador/cdp.mjs <porta> "<expressão JavaScript>"
const [porta, expressao] = process.argv.slice(2)
const alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json()
const pagina = alvos.find((a) => a.type === 'page' && a.url.startsWith('http://tauri.localhost'))
if (!pagina) throw new Error('a janela do simulador não apareceu no protocolo de depuração')
const ws = new WebSocket(pagina.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expressao, awaitPromise: true, returnByValue: true } }))
const resposta = await new Promise((r) => ws.addEventListener('message', (e) => r(JSON.parse(e.data))))
ws.close()
if (resposta.result?.exceptionDetails) throw new Error(resposta.result.exceptionDetails.text)
console.log(JSON.stringify(resposta.result?.result?.value ?? null))
