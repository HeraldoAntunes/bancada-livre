<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Mudanças

O que mudou em cada versão do Bancada Livre, da mais nova para a mais antiga.
Formato baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e numeração no
[Versionamento Semântico](https://semver.org/lang/pt-BR/): correção muda o terceiro número, recurso novo muda o
segundo, e circuito salvo que a versão anterior não consegue abrir muda o primeiro. As versões 0.x são a fase de
desenvolvimento, antes da primeira publicação.

## [Não publicado]

## [1.0.2] - 2026-10-27 · "Arquivos mais seguros"

Correções: o uso do simulador continua o mesmo.

### Corrigido
- Um arquivo de circuito estragado ou feito de propósito com valores estranhos não consegue mais travar o
  programa: o simulador confere o nome de cada CI, os rótulos, o número de entradas das portas, a frequência do
  clock, o modo do display, a posição dos componentes e se cada fio liga pinos que existem, e recusa o arquivo
  com uma mensagem clara.
- Se o circuito salvo automaticamente não puder ser aberto, ele fica guardado à parte no navegador, em vez de
  ser apagado na primeira mudança.
- O aviso de CI sem alimentação diz os pinos certos de cada chip: VCC no 14 e GND no 7 nos CIs de 14 pinos, VCC
  no 16 e GND no 8 no 7448, 74138, 74151 e 74283.
- Na tabela de atalhos, `Ctrl+0` aparece como o que ele faz: mostrar o circuito inteiro (Ajustar).

### Adicionado
- A bandeira do Brasil, pequena, ao lado do nome do programa na janela Sobre e na página do projeto.

### Alterado
- A montagem do arquivo HTML confere a política de segurança de um jeito mais rigoroso e para com erro se
  alguma coisa ficar de fora.

## [1.0.1] - 2026-10-27 · "Bibliotecas e página do projeto"

Manutenção: nada muda no uso do simulador.

### Alterado
- Bibliotecas atualizadas: zustand 5.0.16 (vai no arquivo do aluno) e, nas ferramentas de montagem,
  vite 6.4.5, vite-plugin-singlefile 2.3.4 e dependências indiretas com correções de segurança.
- O build confere que o programa ficou embutido no arquivo HTML antes de aplicar a política de segurança; se não
  ficou, a montagem para com erro, em vez de gerar um arquivo que abre em branco.

### Adicionado
- Guia de uso (docs/GUIA-DE-USO.md) e página do projeto com capa, imagens do programa e tabela de downloads.

## [1.0.0] - 2026-10-27 · "Bancada Livre"

Primeira versão pública. Reúne as versões de desenvolvimento 0.1 a 0.7 e o que foi preparado como 0.8.0,
que não chegou a sair.

### Adicionado
- O programa ganha nome e ícone próprios: **Bancada Livre**, com um chip marcado BL.
- **Versão para Windows**: instalador (cria atalho no menu Iniciar, sem pedir administrador) e versão portátil em
  zip, que abrem o simulador numa janela própria do Edge ou do Chrome. O arquivo HTML único continua disponível.
- Arquivo de citação (CITATION.cff), para quem quiser citar o simulador num trabalho.
- **Zoom da bancada**: a roda do mouse amplia no ponto do cursor, arrastar o fundo move a bancada e os botões
  do canto ampliam, reduzem, voltam a 100% e ajustam a vista para mostrar todo o circuito. Ao abrir um exemplo
  ou um arquivo, o circuito já aparece enquadrado. A imagem exportada sai sempre com o circuito inteiro.
- **Tabela-verdade em janela**: o botão Destacar abre a tabela do circuito numa janela que você arrasta e
  redimensiona; a letra cresce junto com a janela, bom para projetar. O botão Devolver ao painel traz de volta.
- **Passo a passo mais visível**: ao ligar o modo, aparece uma barra no topo da bancada com o nível atual,
  bolinhas de progresso, botões grandes de Voltar, Próximo e Reiniciar e uma frase do que acontece em cada
  nível. Setas, espaço, Home e Esc também funcionam.
- **Controles do CLOCK no próprio CLOCK**: rodar ou pausar e avançar meio período ficam logo acima do
  componente na bancada e nas propriedades dele, e saíram da barra de cima, onde não dava para saber para que
  serviam.
- **Editar com duplo clique**: um duplo clique no componente abre uma janela com o que dá para mudar nele
  (rótulo ou texto, número de entradas, modo do display, frequência e controles do clock) e o botão Remover.
- **Espelhar e girar componentes**: a tecla E (ou o botão Espelhar) troca o lado das entradas e da saída, e a
  tecla R (ou Girar 90 graus) gira o componente. Os fios acompanham e os textos continuam de pé. Circuitos
  salvos nesta versão guardam a orientação; arquivos antigos abrem como antes. Uma versão anterior consegue
  abrir o arquivo novo, mas mostra os componentes sem a orientação.
- **Barra de cima reorganizada**: os botões ficam em três grupos com título (Arquivo, Editar e Aula) e têm
  cara de botão; o nome Bancada Livre virou só a marca. O botão Tabela abre a tabela-verdade em janela. O
  seletor de idioma, que só tinha português, saiu.
- **Abas da paleta com ícone e nome** (chave, porta, lâmpada e chip); a aba escolhida fica azul. O botão
  **Limpar tudo** ganhou nome e cor de alerta.
- **Porta BUFFER**: uma entrada, a saída repete a entrada (S = A).
- **LED colorido**: azul, vermelho, verde ou amarelo. Apagado, o LED mostra um tom claro da cor escolhida.
- **Banco de chaves** de 4 ou 8 posições: cada chave liga só a sua posição e vira uma coluna da
  tabela-verdade (K1, K2...). **Barra de LEDs** de 4 ou 8, com a mesma escolha de cor do LED.
- **Contador automático** de 2, 3 ou 4 bits: conta 00, 01, 10, 11... sozinho, na frequência escolhida, com
  rodar, pausar e avançar como o CLOCK. O corpo mostra a contagem em binário. Na tabela-verdade, cada bit
  do contador vira uma coluna (CT1.Q1, CT1.Q0), e cada linha é uma contagem: no semáforo, a tabela mostra qual
  luz acende em cada passo. Circuito sem chave nem contador mostra um aviso que explica o que entra na tabela.
- **CIs 74138** (decodificador 3 para 8), **74151** (multiplexador 8 para 1) e **74283** (somador de 4 bits),
  com a pinagem real de 16 pinos conferida nos datasheets, alimentação obrigatória e explicação no Guia de CIs.
- **8 exemplos novos**, somando 30: Porta BUFFER, banco de chaves na barra de LEDs, semáforo com contador,
  contador na barra de LEDs, contador no display com 7448, 74138 acendendo 8 LEDs, 74151 como gerador de
  função e somador de 4 bits com o 74283.
- **Comandos para agentes de IA**: cada ação do programa (montar, ligar, alternar chaves, ler o circuito e a
  tabela-verdade, zoom, passo a passo...) existe também como comando com nome, descrição e parâmetros conferidos.
  Um agente de IA que controla o navegador usa o simulador aberto sem clicar, por `window.bancadaLivre`. Nada
  muda para quem usa com o mouse.
- Os circuitos salvos guardam a cor do LED, o número de posições e o estado do banco de chaves e o valor do
  contador. Arquivos antigos abrem como antes.

### Corrigido
- Um toque muito rápido na chave, comum em tela de toque e lousa interativa, às vezes não mudava o estado.
- Em telas de 1366 px (notebook e projetor), a barra superior saía da tela e escondia os botões de limpar e da
  versão. Agora cabe numa linha; em telas mais estreitas, passa para duas linhas sem esconder nada.

## [0.7.0] - 2026-07-23 · "7448 e display"

### Adicionado
- **Decodificador 7448** (BCD para 7 segmentos), com a pinagem real de 16 pinos: a montagem clássica de fim de
  unidade, chaves BCD ligadas ao 7448 e ele ao display. Os controles de teste de lâmpada, apagamento e apagamento
  do zero funcionam, e uma entrada desligada fica em 1, como no chip de verdade. O Guia de CIs explica a diferença
  entre o 7447 e o 7448 (display de anodo comum e de catodo comum).
- Exemplo "Decodificador 7448 → Display" no grupo CIs, somando 22 exemplos.
- A tabela-verdade mostra o dígito que o display está formando também quando ele é ligado segmento a segmento.
- **Texto livre** na bancada, para anotar o circuito (aba ENTRADAS, item TEXTO).

## [0.6.0] - 2026-07-23 · "CIs didáticos"

### Adicionado
- **CIs da série 74xx**: 7400, 7402, 7404, 7408, 7432 e 7486, com a pinagem real de 14 pinos (chanfro, ponto do
  pino 1 e numeração no sentido anti-horário), na nova aba CIs.
- **Alimentação obrigatória**: um chip sem VCC (pino 14) em 1 e GND (pino 7) em 0 fica com as saídas indefinidas
  e mostra o aviso "sem VCC/GND", no corpo do chip e no rodapé. É o esquecimento mais comum na protoboard.
- **Guia de CIs**: para cada chip, a figura da pinagem, a função, as portas internas, a tabela-verdade, dicas de
  bancada e um exemplo pronto para carregar.
- Portas do mesmo chip podem ser ligadas entre si (por exemplo, NOT, AND e OR feitos com um único 7400) sem
  aviso falso de laço.
- Três exemplos com CIs: primeira ligação com o 7408, universalidade do NAND num só 7400 e meio-somador com
  7486 e 7408.
- Janela **Sobre**, aberta pelo número da versão: autoria, licença, tecnologias e o uso de IA no desenvolvimento.

## [0.5.0] - 2026-07-23 · "Pacote sala de aula"

### Adicionado
- **18 circuitos de exemplo em três níveis**, com o menu agrupado: Básico (as 7 portas sozinhas), Intermediário
  (meio-somador, detector de paridade, comparador A=B, MUX 2:1, teorema de De Morgan, universalidade do NAND,
  decodificador 2:4) e Avançado (somador completo, somador de 2 bits, comparador de 2 bits, BCD para display).
- **Nome das portas na bancada**, escrito sob cada porta. O botão `Aa` liga e desliga, e cada porta aceita um
  rótulo próprio, como `U1`.
- **Salvamento automático** no navegador: ao reabrir a página, a bancada volta como estava.
- Proteção contra falhas: se a tela der erro, aparece um aviso com as opções de recarregar e de baixar o circuito,
  sem perder o trabalho.
- **Arquivo único**: o simulador inteiro cabe num só arquivo HTML, que abre com dois cliques, sem servidor e sem
  internet. Dá para levar no pendrive, pôr no Moodle ou mandar por e-mail.
- Licença MIT e esta lista de mudanças.

## [0.4.0] - 2026-07-21

### Adicionado
- **Modo passo a passo**: o sinal avança uma porta de cada vez, com destaque do nível atual e controles no rodapé.
- **Expressão booleana** (soma de mintermos) logo abaixo da tabela-verdade.
- Ao passar o mouse sobre uma porta, aparece uma mini tabela-verdade.

### Corrigido
- Abrir um arquivo de circuito com defeito deixava a tela em branco; agora aparece uma mensagem de erro.
- Duas saídas ligadas no mesmo ponto não eram acusadas quando esse ponto fazia parte de um laço.
- O desfazer juntava edições diferentes num passo só.
- A tabela-verdade ficava desatualizada em circuitos com CLOCK, e não aparecia em circuitos só com SONDA.
- Soltar o mouse fora da janela deixava o botão ou o arrasto presos; o PUSH BUTTON ficava travado pela tabela.
- O PNG exportado saía sem o desenho dos pinos; rótulos automáticos se repetiam depois de apagar componentes.

## [0.3.0] - 2026-07-21

### Adicionado
- **CLOCK** de 0,5 a 10 Hz, com rodar, pausar e avançar um passo. A frequência se mantém mesmo com a aba em
  segundo plano.
- **SONDA**, que mostra o valor lógico (0, 1, X ou E) num fio e entra na tabela-verdade.
- **Desfazer e refazer** (Ctrl+Z e Ctrl+Y), com até 50 passos.
- 6 exemplos prontos na barra superior.
- Exportar a bancada em **PNG** e a tabela-verdade em **CSV**.

## [0.2.0] - 2026-07-21

### Adicionado
- **Display de 7 segmentos** nos modos BCD (0 a 9), hexadecimal (0 a F) e segmento a segmento (a a g), com pinos de
  peso 8, 4, 2 e 1 e coluna do dígito na tabela-verdade.

## [0.1.0] - 2026-07-21

### Adicionado
- Primeira versão: simulação com os estados 0, 1, X (indefinido) e E (erro), que acusa laço e conflito, e
  tabela-verdade de cada porta e do circuito.
- Bancada com arrastar e soltar, fios curvos que mostram o estado pela cor e pela espessura, paleta em abas
  (ENTRADAS, PORTAS e SAÍDAS) e salvar e abrir circuitos.
- As 7 portas no símbolo ANSI (de 2 a 8 entradas), chave (SWITCH), NÍVEL ALTO, NÍVEL BAIXO, PUSH BUTTON e LED.
