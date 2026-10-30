// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Textos da janela Sobre, separados do desenho para o teste conferir o que o usuário lê.
// O aviso de marcas é o mesmo do README (o teste compara os dois).

export const SOBRE = {
  nome: 'Bancada Livre',
  autor: 'Heraldo Antunes',
  licenca:
    'MIT. É software livre: pode usar, copiar, modificar e distribuir, inclusive em outras ' +
    'instituições de ensino, desde que mantenha o aviso de autoria e a licença.',
  privacidade:
    'O simulador funciona sem internet: nada é enviado a servidores. No programa do Windows, o WebView2 da ' +
    'Microsoft, que desenha a janela, pode abrir conexões próprias com a Microsoft. O circuito em uso e os ajustes ' +
    'ficam guardados só neste computador. Os arquivos que você salvar vão para a pasta de downloads.',
  ia:
    'Feito com apoio de inteligência artificial (Claude, da Anthropic, e Codex, da OpenAI), usada como ferramenta. ' +
    'A ideia, os requisitos, as decisões e a revisão de cada versão são do autor.',
  terceiros:
    'Usa as bibliotecas React e zustand, ambas com licença MIT, e o desenho da bandeira do Brasil, de domínio ' +
    'público (Wikimedia Commons). O texto das licenças vai no fim deste arquivo HTML.',
  tecnologias: 'TypeScript · React 18 · SVG · Vite · zustand · Vitest',
  marcas:
    'As marcas citadas pertencem aos seus donos; o Bancada Livre é um projeto ' +
    'independente, sem vínculo com elas.',
}
