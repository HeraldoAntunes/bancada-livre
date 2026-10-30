<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Bancada Livre no Linux

Este documento conta como usar o Bancada Livre no Linux e o que foi conferido nele em 30/10/2026. É o registro de um
teste, não uma promessa de suporte: o programa é feito e testado no Windows, e o Linux não faz parte desse teste a
cada versão.

## Como usar no Linux

No Linux só existe o **arquivo HTML**. O programa do Windows (`BancadaLivre-x.y.z.exe`, com janela própria pelo
WebView2) não roda no Linux.

1. Baixe o `BancadaLivre-x.y.z.html` na página de versões do GitHub.
2. Abra o arquivo no navegador: clique com o botão direito, **Abrir com** e escolha o Firefox ou o Chromium (ou o
   Chrome). Também dá para arrastar o arquivo para dentro de uma janela do navegador. Não precisa de internet.
3. Use como no Windows. **Salvar**, **PNG**, **SVG** e **Exportar CSV** baixam o arquivo para a pasta de downloads do
   navegador; **Abrir** lê um `.json` salvo.

O salvamento automático guarda o circuito dentro do navegador, para aquele usuário. Trocar de navegador (do Firefox
para o Chromium, por exemplo), usar janela anônima ou limpar os dados de navegação não traz o circuito: para guardar
de verdade, use **Salvar**.

## O que foi testado

### O computador

| Item | Versão |
|---|---|
| Distribuição | Ubuntu 24.04.5 LTS (Noble Numbat), 64 bits (x86_64) |
| Núcleo (kernel) | 6.18.44 |
| Máquina | contêiner na nuvem, **sem tela**: os navegadores rodaram sem janela (modo headless) |
| Node.js e npm | 22.22.0 e 10.9.4 |
| Chromium | 153.0.8010.12 (a compilação do Chromium que acompanha o Playwright 1.63) |
| Firefox | 136.0 (pacote `.deb` do Ubuntu 20.04, `136.0+build3-0ubuntu0.20.04.1`) |
| Quem controlou os navegadores | Puppeteer (`puppeteer-core` 25.14.0): Chromium pelo CDP, Firefox pelo WebDriver BiDi |

Por que esse Firefox: a rede da máquina de teste não deixava baixar o Firefox do Playwright nem o do site da Mozilla, e
o Ubuntu 24.04 só oferece o Firefox em Snap. O único Firefox ao alcance era o 136, de março de 2025, do Ubuntu 20.04.
Ele é mais antigo que o Firefox atual.

### Montagem a partir do código (commit `442d7e1`, versão 2.1.0)

| Etapa | Resultado |
|---|---|
| `npm ci` (dependências pelo `package-lock.json`) | passou: 200 pacotes, 0 vulnerabilidades |
| `npm run lint` | passou, sem avisos |
| `npx tsc --noEmit` (checagem de tipos) | passou |
| `npm test` (Vitest) | passou: 31 arquivos, 402 testes |
| `npm run build` (HTML único) | passou: `dist/index.html`, 327.968 bytes |

SHA-256 do `dist/index.html` montado no Linux:

```
0bf92518ab9b0b517584cef2baa28efd9bfdcc2358e6b9e807c8f2ebd5594866
```

Montando duas vezes, o resultado foi o mesmo arquivo, byte por byte. E é o mesmo SHA-256 do `BancadaLivre-2.1.0.html`
publicado na versão 2.1.0 do GitHub: o arquivo testado aqui é exatamente o que o aluno baixa.

### O HTML no navegador

O roteiro está em [`testes-linux/validar.mjs`](../testes-linux/validar.mjs). Ele abre o HTML direto do disco
(`file://`), como o aluno abre, num perfil de navegador novo, e usa o mouse: abas e itens da paleta, arrastar
componente, ligar fios arrastando de pino a pino, clicar nas chaves, botões do CLOCK, **Salvar**, **Limpar tudo**,
**PNG**, **SVG**, clique numa linha da tabela, **Exportar CSV** e **Mapa de Karnaugh**. Os comandos da página
(`bancadaLivre.executar`) serviram para conferir o estado do circuito, para pôr os componentes em posições fixas e para
dar os rótulos A, B, E, X e CLK. O arquivo de **Abrir** foi entregue direto ao campo de arquivo da página, sem passar
pela janela de escolher arquivo.

O circuito: duas chaves (A e B) ligadas a uma porta AND (LED E) e a uma XOR (LED X), mais um CLOCK ligado a um LED
(CLK). São 8 componentes e 7 fios.

| Verificação | Chromium 153 | Firefox 136 |
|---|---|---|
| Abrir o HTML pelo `file://`, bancada vazia num perfil novo | passou | passou |
| Montar pela paleta: 2 chaves, CLOCK, AND, XOR e 3 LEDs | passou | passou |
| Arrastar um componente com o mouse | passou | passou |
| Ligar 7 fios arrastando com o mouse | passou | passou |
| Clicar nas chaves: E e X seguem AND e XOR (00, 10, 11, 01, 00) | passou | passou |
| CLOCK rodando pisca o LED; botões de pausar e de avançar meio período | passou | passou |
| **Salvar** baixa `circuito.json` igual ao circuito da tela | passou | passou |
| **Limpar tudo** e abrir o `circuito.json` de volta: mesmos componentes e fios | passou | passou |
| Recarregar a página e recuperar o circuito pelo salvamento automático | passou | passou |
| Fechar o navegador, abrir de novo com o mesmo perfil e recuperar o circuito | passou | passou |
| **PNG** baixa `circuito.png` válido (1132 x 828 px) | passou | passou |
| **SVG** baixa `circuito.svg` | passou | passou |
| Tabela-verdade no painel: 4 linhas certas; clicar na linha 1 1 liga as chaves | passou | passou |
| **Exportar CSV**: `tabela-verdade.csv` com BOM, separador `;` e as 4 linhas certas | passou | passou |
| **Mapa de Karnaugh**: E = A·B (1 grupo) e X = A'·B + A·B' (2 grupos), iguais na janela | passou | passou |
| Nenhum erro no console nem na página | passou | passou |

O roteiro completo rodou 5 vezes seguidas nos dois navegadores, sem nenhuma falha.

### Defeito encontrado

**Os botões do CLOCK saem como dois quadrados pretos na imagem exportada (PNG e SVG).** Aconteceu igual no Chromium e
no Firefox, então não parece coisa do Linux. Na tela, os botões são azuis com os desenhos de pausar e avançar; na
imagem, viram dois quadrados pretos sem desenho em cima do CLOCK. Não foi conferido no Windows, mas a causa provável
está no próprio código e vale para qualquer sistema: a exportação (`src/ui/exportPng.ts`) embute no desenho o estilo
dos pinos e dos textos, mas não o da classe `clock-botao` do `styles.css` (fundo azul do quadrado e cor branca do
ícone), e um retângulo SVG sem cor definida é pintado de preto.

Para reproduzir:

1. Abra o `BancadaLivre-2.1.0.html` no navegador.
2. Na aba **ENTRADAS**, clique em **CLOCK**. Na aba **SAÍDAS**, clique em **LED**. Ligue a saída do CLOCK na entrada
   do LED.
3. Clique em **PNG** (ou **SVG**) e abra o arquivo baixado.
4. Esperado: o CLOCK sem os botões, ou com os botões azuis como na tela. Obtido: dois quadrados pretos logo acima do
   CLOCK.

Nada foi corrigido: este teste não altera o programa.

### Observações

- A letra do programa é a Segoe UI, que não existe no Linux; o navegador usa a letra padrão do sistema no lugar (nesta
  máquina, a Inter). O desenho fica um pouco diferente do Windows, mas nada ficou cortado nas capturas de tela.
- Com um perfil já usado, o Chromium reabre as abas da última vez. Se o Bancada Livre estava aberto, ele volta numa
  aba e a mesma bancada pode ficar aberta em duas abas. Isso não foi testado a fundo.

## O que não foi testado

- **Computador de verdade, com tela.** Tudo rodou sem janela. Não foram testados área de trabalho (GNOME, KDE, XFCE,
  Cinnamon), Wayland ou X11, tela pequena, tela de toque, impressão nem projetor.
- **Firefox atual e Firefox em Snap.** O Firefox testado é o 136, de 2025, em pacote `.deb`. O Firefox que vem no
  Ubuntu 22.04 e 24.04 é Snap, que tem regras próprias para abrir arquivos fora da pasta pessoal e para a pasta de
  downloads.
- **Google Chrome, Chromium em Snap ou Flatpak, Edge para Linux, Brave, Opera** e outros navegadores.
- **Outras distribuições:** Debian, Linux Mint, Fedora, Zorin, Linux Educacional e outras. Nem computadores ARM (como
  o Raspberry Pi).
- **As janelas do navegador para escolher arquivo** (no **Abrir**) e para escolher onde salvar (quando o navegador
  está configurado para perguntar). No teste, o arquivo foi entregue direto à página e os downloads foram direto para
  uma pasta.
- **O resto do programa:** exemplos prontos, CIs 74xx e o Guia, flip-flops, passo a passo, linha do tempo, gabarito,
  **Destacar**, zoom, atalhos de teclado, janela de edição (duplo clique), desfazer e refazer.
- **O programa do Windows** (`.exe`) no Linux, inclusive pelo Wine.
- **Uso sem internet de verdade.** A máquina tinha rede limitada, mas isso não foi conferido de propósito.

## Como repetir o teste

Na raiz do repositório:

```bash
npm ci && npm run lint && npm test && npm run build
```

```bash
sha256sum dist/index.html
```

Depois, na pasta `testes-linux` (o Puppeteer não baixa navegador: use os que já estão instalados):

```bash
cd testes-linux && npm ci
```

```bash
FIREFOX=/usr/bin/firefox CHROMIUM=/usr/bin/chromium node validar.mjs
```

Para um navegador só, ponha o nome no fim: `node validar.mjs firefox`. Os arquivos baixados e as capturas de tela
ficam em `testes-linux/saida/`, e o resultado de cada verificação em `testes-linux/saida/resultado.json`.
