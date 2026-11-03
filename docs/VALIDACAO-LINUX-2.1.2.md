<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Validação da 2.1.2 no Linux

Teste feito em 03/11/2026 sobre a `main` (commit `adef9fe`), que é a tag `v2.1.2` (`682ea17`) mais dois commits que
não mudam o programa: o README e a troca do `minimatch` usado pelo ESLint. É o registro de um teste, não uma promessa
de suporte: no Linux só o arquivo HTML é usado.

## O que não foi repetido, e por quê

Os relatórios anteriores (ramos `linux-validacao`, `migracao-2.1.1` e `validacao-2.1.2`) já provaram:

- o HTML no Chromium e no Firefox do Linux: montar com o mouse, salvar e reabrir, salvamento automático, PNG, SVG,
  CSV, tabela-verdade e Karnaugh;
- a migração 2.1.0 → 2.1.1 e as correções da 2.1.2 (storage bloqueado e "Fechar sem escolher"), com o
  `salvamento.rs` real, no commit `3d05d88`.

Do `3d05d88` até a `v2.1.2`, a pasta `src/` só ganhou um arquivo de teste (`src/state/__tests__/propriedades.test.ts`).
O `main.rs` mudou só num teste, e o `salvamento.rs` é o mesmo (SHA-256 `b21c860f…a594c`). Por isso a bateria de
migração não foi rodada de novo. Esta validação cobre o que faltava: a suíte da 2.1.2, os circuitos sintéticos, o
arquivo de versão anterior, o nome com acento, o circuito grande e os acentos dos textos.

## Resumo dos achados

| # | Achado | Gravidade | Teste que mostra |
|---|---|---|---|
| 1 | No Firefox, o PNG de um circuito muito largo não sai, e a pessoa não é avisada | **leve** | `testes-linux/defeitos/png-largo.mjs` (falha) |
| 2 | `cargo test` em `src-tauri` não compila no Linux | **leve** | `testes-linux/defeitos/cargo-test-linux.sh` (falha) |
| 3 | Em circuitos muito largos, nem o menor zoom mostra tudo | **leve** (observação) | etapa 3 de `ponta-a-ponta.mjs` |
| 4 | Sem localidade UTF-8, o Chromium não abre arquivo com acento no caminho | **leve** (do ambiente, não do programa) | descrito abaixo |

Nenhum achado grave ou médio. Tudo o mais passou: a suíte do Vitest, o circuito sintético nos dois navegadores, os 70
arquivos de versões anteriores, o nome e a pasta com acento, os circuitos de até 4020 peças e os acentos dos textos.

## Ambiente

| Item | Versão |
|---|---|
| Distribuição | Ubuntu 24.04.5 LTS, x86_64, contêiner sem tela |
| Node.js e npm | 22.22.0 e 10.9.4 |
| Rust | 1.97.0 (com `libwebkit2gtk-4.1-dev` 2.52.6, `libgtk-3-dev` 3.24.41, `librsvg2-dev` e `libsoup-3.0-dev` do Ubuntu) |
| Chromium | 153.0.8010.12, sem janela |
| Firefox | 136.0 (pacote `.deb` do Ubuntu 20.04: a rede desta máquina não baixa um Firefox mais novo), sem janela |
| Controle dos navegadores | `puppeteer-core` 25.14.0 |

## 1. Suíte de testes da 2.1.2

| Comando | Resultado |
|---|---|
| `npm ci` | passou: 199 pacotes, 0 vulnerabilidades |
| `npm run lint` | passou |
| `npx tsc --noEmit` | passou |
| `npm test` | passou: 48 arquivos, 534 testes |
| `npm run build` | passou: `dist/index.html`, 346.874 bytes |
| `cd src-tauri && cargo test` | **falhou**: não compila no Linux (achado 2) |

SHA-256 do `dist/index.html` montado no Linux:

```
ebbceaa190aad4416073c1be393adca66d745f5588d8631554e2f225f2c3d3c4
```

É o mesmo SHA-256 do `BancadaLivre-2.1.2.html` publicado na versão 2.1.2: o arquivo testado é o que o aluno baixa.

## 2. Ponta a ponta, sem janela

Roteiro em `testes-linux/ponta-a-ponta/ponta-a-ponta.mjs`. O HTML é aberto pelo `file://`, num perfil novo, no
Chromium e no Firefox. Abrir, Salvar, Limpar tudo, PNG, SVG e Exportar CSV passam pelos botões, e as chaves são
clicadas com o mouse. Os comandos da página (`bancadaLivre.executar`) servem para conferir o estado.

### 2a. Circuito sintético: montar, simular, salvar, reabrir e exportar

Um somador completo feito de portas (2 XOR, 2 AND e 1 OR), com entradas **Á**, **É** e **Ç**, saídas **SAÍDA** e
**VAI-UM** e uma anotação "Somador: entrada, saída e vai-um (ação de aula)".

| Verificação | Chromium | Firefox |
|---|---|---|
| Abre o arquivo `Circuito ação nº 1 saída ü.json` pelo botão Abrir | passou | passou |
| Os rótulos com acento chegam intactos | passou | passou |
| Simulação com o mouse: as 8 combinações das chaves dão a soma certa | passou | passou |
| Tabela-verdade com os nomes acentuados (Á, É, Ç; SAÍDA, VAI-UM) | passou | passou |
| Salvar grava `circuito.json` na pasta `Área de trabalho/Ação e saída`, igual ao circuito | passou | passou |
| O arquivo salvo é UTF-8 com os acentos, sem `\u00..` nem caractere trocado | passou | passou |
| Limpar tudo e reabrir o arquivo salvo: igual | passou | passou |
| Recarregar a página recupera pelo salvamento automático, com os acentos | passou | passou |
| PNG válido (1732 x 804 px) | passou | passou |
| SVG com os textos acentuados | passou | passou |
| CSV com BOM, cabeçalho `Á;É;Ç;SAÍDA;VAI-UM` e 8 linhas | passou | passou |
| Nenhum erro na página | passou | passou |

### 2b. Arquivos de versões anteriores

O `preparar.sh` monta o HTML das tags `v1.0.2` e `v2.0.3`. Na própria versão antiga, cada exemplo é aberto e salvo
pelo comando de salvar dela, que baixa um `circuito.json` de verdade. Junto, fica guardada a tabela-verdade que a
versão antiga calcula. Depois, a 2.1.2 abre cada arquivo pelo botão Abrir.

| Verificação | Chromium | Firefox |
|---|---|---|
| 1.0.2: os 30 exemplos abrem, com as mesmas peças e fios | 30 de 30 | 30 de 30 |
| 1.0.2: tabela-verdade igual à da 1.0.2 | 30 de 30 | 30 de 30 |
| 2.0.3: os 40 exemplos abrem, com as mesmas peças e fios | 40 de 40 | 40 de 40 |
| 2.0.3: tabela-verdade igual à da 2.0.3 (os 5 restantes têm mais de 8 entradas ou não têm tabela) | 35 de 35 | 35 de 35 |

Os HTML das versões antigas montados aqui: 1.0.2 `306dcd92e45eb6219af3e8bfe74ab8c3ee5fa7c9278e6beb0f13927d7061a6b8` e
2.0.3 `9dddfcac90ab4fc546db8bbf0642cce7e2fab5cb664877e76c0284bda85c2db8`.

### 2c. Nome de arquivo e pasta com acento

Passou nos dois navegadores: abrir `Circuito ação nº 1 saída ü.json` (acento, til, cedilha, ordinal e trema) e
salvar dentro de `Área de trabalho/Ação e saída`. O programa sempre baixa com o nome `circuito.json` e não usa o nome
do arquivo aberto para nada. Por isso o nome com acento só depende do navegador e do sistema (veja o achado 4).

### 2d. Circuitos grandes, com tempo

Cada circuito tem filas de portas NOT, cada uma ligada a uma chave no começo e a um LED no fim. O tempo de "clique até
o LED" vai do clique (ou do comando, quando a chave fica fora da tela, veja o achado 3) até o LED do fim da fila mudar.
Os tempos são de uma rodada, nesta máquina sem tela, e servem de ordem de grandeza.

| Peças (fios, tamanho) | Etapa | Chromium | Firefox |
|---|---|---|---|
| 496 (488 fios, 63 KB; 8 filas de 60) | abrir | 94 ms | 169 ms |
| | clique até o LED | 109 ms (mouse) | 247 ms (mouse) |
| | Salvar | 290 ms | 448 ms |
| | PNG (8812 x 1492 px) | 1,7 s | 0,8 s |
| 2020 (2010 fios, 264 KB; 10 filas de 200) | abrir | 727 ms | 717 ms |
| | clique até o LED | 267 ms | 466 ms |
| | Salvar | 284 ms | 468 ms |
| | PNG (28412 x 1852 px) | 2,3 s | 5,6 s |
| 4020 (4010 fios, 532 KB; 10 filas de 400) | abrir | 900 ms | 1,97 s |
| | clique até o LED | 427 ms | 1,44 s |
| | Salvar | 317 ms | 508 ms |
| | PNG (56412 x 1852 px) | 7,9 s | **não sai** (achado 1) |

Nos três tamanhos e nos dois navegadores, o salvamento automático gravou. A medida começou depois de o LED mudar, e
em todos os casos a gravação terminou em menos de 0,3 s. Até 4020 peças, o programa continua usável: abrir leva até
2 s e a resposta ao clique fica abaixo de 1,5 s. Um circuito de aula tem dezenas de peças.

## 3. Acentos da interface e da ajuda

Roteiro em `testes-linux/ponta-a-ponta/acentos.mjs`. Ele procura palavras escritas sem o acento (como "nao", "saida",
"funcao", "botao", "versao", numa lista de cerca de 100) e caracteres trocados por codificação errada (`Ã©`, `Â`,
`�`):

- **código**: só os textos que a pessoa lê, ou seja, as strings e o texto de JSX de `src/`, fora dos testes, lidos
  pelo compilador do TypeScript;
- **documentação**: `README.md`, `CHANGELOG.md` e `docs/*.md`, fora dos trechos de código;
- **tela**: o texto que o HTML mostra no Chromium, inclusive títulos, rótulos de acessibilidade e opções. São 183
  telas: as 5 abas da paleta, a janela Sobre, o Guia de cada um dos 14 CIs e cada um dos 40 exemplos (com o mapa de
  Karnaugh, o passo a passo e a linha do tempo quando há), o painel de propriedades e as descrições dos comandos.

**Resultado: 0 achados no código, 0 na documentação e 0 na tela.** A primeira rodada acusou alguns falsos positivos,
que o roteiro passou a pular:

- nomes de classe e seletores do CSS (`modal recuperacao`, `.clock-botao rect`);
- nomes de parâmetro e valores aceitos dos comandos (`posicao`, `MEMORIA`, `SAIDAS`), que são sem acento de propósito
  (são para agentes de IA, não para a pessoa);
- palavras que existem sem acento ("sequencial", e "valida" e "invalida" como verbos).

## 4. Achados

### Achado 1 (leve): no Firefox, o PNG de um circuito muito largo não sai, e a pessoa não é avisada

O PNG tem o dobro do tamanho do circuito, para ficar nítido no projetor (`scale = 2` em `src/ui/exportPng.ts`). Quando
a largura (ou a altura) passa de 32767 px, o limite da tela de desenho (canvas) do Firefox, o desenho dá
`InvalidStateError: CanvasRenderingContext2D.scale: Canvas is already in error state`. Nenhum arquivo é baixado, e a
pessoa não vê aviso nenhum: clica em PNG e nada acontece. Isso vale para circuitos com mais de uns 16 mil px de
largura ou de altura na bancada, cerca de 230 portas lado a lado. No Chromium 153, a mesma imagem (56412 px) saiu.
Lá o limite é maior, mas existe, e o código não confere se o `toBlob` devolveu nada.

Gravidade leve: um circuito de aula fica muito longe desse tamanho, nada se perde, e o **SVG** sai normalmente.

Passo a passo:

1. Abra o `BancadaLivre-2.1.2.html` no Firefox.
2. Abra um circuito bem largo. O teste cria um com uma chave, 300 portas NOT em fila e um LED.
3. Clique em **PNG**.
4. Esperado: baixar o `circuito.png` ou avisar que a imagem é grande demais e sugerir o SVG. Obtido: nada acontece, e
   o console mostra o erro acima.

Teste que falha: na pasta `testes-linux/defeitos`, depois do `preparar.sh` da pasta `ponta-a-ponta`:

```bash
npm ci && FIREFOX=/caminho/do/firefox node png-largo.mjs
```

Resultado na 2.1.2: `firefox/136.0: PNG NÃO baixado; avisos: nenhum; erros na página: InvalidStateError: ...` e
`FALHOU`, com código de saída 1. Com o argumento `chromium`, o mesmo teste passa. Só o Firefox 136 foi testado: o
limite de 32767 px é antigo no Firefox, mas não foi conferido numa versão atual.

### Achado 2 (leve): `cargo test` em `src-tauri` não compila no Linux

Mesmo com as bibliotecas do Tauri para Linux instaladas, `cargo test` em `src-tauri` para em três erros:

1. `tauri::generate_context!()` (`src-tauri/src/main.rs`, linha 199): "failed to open icon
   .../src-tauri/icons/icon.png: No such file or directory". O `tauri.conf.json` só aponta o
   `../instalador/bancada-livre.ico`, e fora do Windows o Tauri procura um PNG.
2. e 3. `src-tauri/src/instalacao.rs`, linhas 566 a 569: a função de teste `prender` usa
   `std::os::windows::fs::OpenOptionsExt` e `share_mode` sem `#[cfg(windows)]`. Os testes desse módulo também usam o
   registro do Windows.

Gravidade leve: o programa é só para Windows e não é afetado. Mas os testes Rust de `src-tauri` só rodam no Windows,
e um `cargo test` no Ubuntu do GitHub Actions falharia. Já constava do relatório da validação anterior e continua na
2.1.2. Os testes do `salvamento.rs` sozinho rodam no Linux (24 de 24, relatório anterior, mesmo arquivo).

Passo a passo: num Ubuntu 24.04 com `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev` e `libsoup-3.0-dev`,
rode `cd src-tauri && cargo test`.

Teste que falha: `testes-linux/defeitos/cargo-test-linux.sh`, que sai com "FALHOU: cargo test em src-tauri saiu com
código 101".

### Achado 3 (leve, observação): em circuitos muito largos, nem o menor zoom mostra tudo

O zoom mínimo é 25% (`ESCALA_MIN` em `src/ui/vista.ts`). Num circuito de 14 mil px de largura, **Ajustar** não cabe
na tela, e as chaves do começo ficam fora dela. Dá para arrastar a bancada até elas. O teste passou a usar o comando
da chave quando ela está fora da tela. É um limite de projeto, não um erro, e fica bem longe de um circuito de aula.

Passo a passo: abra o circuito do achado 1 e clique em **Ajustar**: a ponta esquerda fica fora da tela.

### Achado 4 (leve, do ambiente): sem localidade UTF-8, o Chromium não abre arquivo com acento no caminho

Com `LANG` vazio (o padrão de muitos contêineres e servidores, e o desta máquina), o Chromium não entrega ao campo de
arquivo um arquivo com acento no caminho: a lista de arquivos chega vazia, até num campo de arquivo comum, fora do
programa. Com `LANG=C.UTF-8`, funciona. Um Linux de mesa (Ubuntu, Mint, Fedora) já vem com localidade UTF-8, então
isso não é defeito do Bancada Livre. O teste fixa `LANG=C.UTF-8` ao abrir os navegadores. O Firefox não foi testado
sem localidade.

Passo a passo: num terminal com `LANG` e `LC_ALL` vazios, abra o Chromium e use **Abrir** com um arquivo chamado
`ação.json`. Nada abre.

## Comandos

Na raiz:

```bash
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
```

```bash
sha256sum dist/index.html
```

```bash
cd src-tauri && cargo test
```

Ponta a ponta e acentos, na pasta `testes-linux/ponta-a-ponta`:

```bash
npm ci && ./preparar.sh
```

```bash
FIREFOX=/caminho/do/firefox node ponta-a-ponta.mjs
```

```bash
node acentos.mjs
```

Os resultados ficam em `testes-linux/ponta-a-ponta/saida/resultado.json` e `saida/acentos.json`, e os arquivos
baixados ficam em `saida/<navegador>/`.

## O que não foi testado

- Firefox atual, Firefox em Snap, Google Chrome e outras distribuições.
- Tela de verdade, toque e impressão.
- Circuitos grandes com CIs, flip-flops e clocks rápidos: o circuito grande aqui é só de portas NOT.
- A janela do programa do Windows (Tauri e WebView2).
- Arquivos das versões 1.0.0, 1.0.1, 2.0.0 a 2.0.2 e 2.1.x: só a 1.0.2 e a 2.0.3 representam as linhas 1.0 e 2.0.
