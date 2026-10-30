<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Mudanças

O que mudou em cada versão do Bancada Livre, da mais nova para a mais antiga.
Formato baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e numeração no
[Versionamento Semântico](https://semver.org/lang/pt-BR/): correção muda o terceiro número, recurso novo muda o
segundo, e circuito salvo que a versão anterior não consegue abrir muda o primeiro. As versões 0.x são a fase de
desenvolvimento, antes da primeira publicação.

## [Não publicado]

### Corrigido
- No programa do Windows, num PC em que a política bloqueia os dados de site, o circuito era gravado no arquivo, mas
  a barra avisava que o salvamento automático tinha falhado, tentava gravar de novo a cada 5 segundos e, ao fechar,
  perguntava se fechava mesmo assim. Agora o arquivo basta, e o aviso de contagem reiniciada aparece quando deve.
- "Fechar sem escolher", na pergunta sobre qual versão do circuito continuar, fazia o programa perguntar se fechava
  sem gravar, embora nada se perca. Agora fecha direto, e a pergunta volta na abertura seguinte.

## [2.1.1] - 2026-10-30

### Corrigido
- Fechar a janela enquanto o circuito ainda estava sendo gravado podia perder a última mudança. Agora o programa
  espera a gravação terminar antes de fechar; se ela demorar demais, pergunta se fecha assim mesmo.
- Quando o salvamento automático falhava, ele não tentava de novo, e ao reabrir o programa voltava ao circuito antigo.
  Agora tenta de novo sozinho e ao fechar, o aviso só sai quando grava de verdade, e, ao abrir, o programa
  fica com a cópia íntegra de gravação mais recente. Se não conseguir gravar ao fechar, pergunta antes.
- Abrir o Bancada Livre duas vezes criava duas janelas, e a última a gravar apagava o trabalho da outra. Agora a
  segunda abertura traz para a frente a janela que já está aberta.
- A desinstalação (e a atualização por cima) podia ficar pela metade quando o antivírus segurava o programa por um
  instante. Agora ela espera e, se não conseguir, não remove nada.
- Depois de uma queda, reabrir o programa às vezes não mostrava janela nenhuma. Agora ele encerra o que ficou preso
  da vez anterior, tenta abrir a janela de novo e, se mesmo assim não conseguir, avisa em português.
- Com uma janela aberta por cima da bancada (edição de peça, Sobre, Guia), Delete, Backspace, Ctrl+Z, Ctrl+Y, E e R
  agiam no circuito por trás dela.
- Ainda podia sair número de peça repetido ao abrir certos arquivos, e o CSV com quebra de linha no nome de uma chave
  não abria de volta como gabarito.
- O zip para escola sem internet traz também o simulador em HTML, para abrir no navegador, e um LEIA-ME.
- Se o programa não conseguisse pedir à página que gravasse antes de fechar, a janela fechava sem perguntar. Agora
  pergunta, e com Não a janela continua aberta.
- Uma cópia salva estragada (com uma peça vazia na lista) podia tomar o lugar da cópia de reserva boa, e uma cópia boa
  que não conseguia ser posta no lugar era apagada na abertura seguinte. Agora o programa não apaga nem troca nenhuma
  cópia ao abrir: confere todas e abre a de número de revisão mais alto, gravado dentro do próprio circuito. Antes, a
  data do arquivo podia fazer abrir uma cópia mais velha.
- Na imagem exportada (PNG e SVG), os botões do CLOCK saíam como dois quadrados pretos.
- No CSV da tabela-verdade, o nome de uma chave começado por `=`, `+`, `-` ou `@` podia virar fórmula na planilha. Agora
  sai com um apóstrofo na frente, e o Bancada lê de volta sem ele. Nomes com espaço no começo ou no fim também voltam
  iguais.
- Abrir um circuito e, antes de ele terminar de carregar, escolher outro ou mexer no circuito podia trocar o que estava
  na bancada pelo arquivo antigo.
- Arquivos com o mesmo nome interno numa peça e num fio, com `:` no nome interno ou com uma peça a milhões de pontos de
  distância passam a ser recusados ao abrir, sem mexer no circuito aberto. O salvamento automático tem o mesmo limite de
  tamanho do Abrir, e os comandos para agentes de IA recusam parâmetro que não é deles.

### Alterado
- O programa para Windows vem num zip, `Instalar-BancadaLivre-x.y.z.zip`, com a licença e um LEIA-ME: extraia e abra o
  `BancadaLivre.exe`, que se instala do mesmo jeito. Igual aos outros programas livres do professor; alguns antivírus
  acusavam de vez em quando o exe solto.
- O THIRD-PARTY-NOTICES lista cada biblioteca Rust do programa do Windows, com versão e licença, e o
  THIRD-PARTY-RUST.md traz o texto completo de cada licença.
- Na primeira abertura depois de atualizar, o circuito salvo pela 2.1.0 continua de onde parou, sem perguntar nada, e
  todas as cópias antigas ficam guardadas na pasta `copias-preservadas`. O programa só pergunta qual versão continuar
  quando o arquivo principal falta ou está estragado, ou quando há uma gravação interrompida mais nova que ele. Fechar
  sem escolher não grava nada, e a pergunta volta na abertura seguinte.
- A janela Sobre e o README dizem que o WebView2 da Microsoft pode abrir conexões próprias com a Microsoft, e citam o
  Codex, da OpenAI, junto com o Claude, como ferramentas de inteligência artificial usadas.

## [2.1.0] - 2026-10-29

### Adicionado
- No Windows, o Bancada Livre tem janela própria: o programa instalado não usa mais o navegador do dia a dia. Ele
  desenha com o WebView2 da Microsoft, que vem no Windows 11 e nos Windows 10 atualizados. Uma queda ou extensão do
  Edge não derruba mais o simulador.
- O programa se instala sozinho: é um arquivo só, `BancadaLivre-x.y.z.exe`. Aberto, ele pergunta se instala (para a
  conta, sem pedir administrador, com atalhos no menu Iniciar e na Área de Trabalho) ou se só abre, sem instalar.
  Para atualizar, basta abrir o arquivo novo. Desinstala por Aplicativos instalados, sem apagar os circuitos.
- Pacote para escola sem internet: um zip com o programa e o instalador oficial do WebView2 da Microsoft, que o
  programa oferece instalar se faltar (só depois de conferir que a assinatura é da Microsoft).
- O circuito em andamento também fica guardado em arquivo, com uma cópia anterior: nem uma queda de energia no meio
  da gravação deixa o circuito ilegível.

### Corrigido
- Com um CLOCK rápido rodando (acima de uns 2 Hz), o salvamento automático ficava esperando o circuito parar de
  mudar e uma peça posta nesse meio-tempo podia se perder se o programa caísse. Agora a gravação acontece no máximo
  0,4 s depois de cada mudança, e o clock sozinho não grava nada. Vale também para o arquivo HTML no navegador.
- Fechar a janela logo depois de uma mudança podia perder essa mudança. Agora ela é gravada antes de a janela fechar
  (e, no navegador, ao fechar a aba). Se o salvamento automático falhar, a barra de baixo avisa.
- O CSV da tabela-verdade com `;` ou aspas no nome de uma chave não abria de volta como gabarito.
- Um arquivo com número de peça muito grande fazia o simulador repetir números nas peças seguintes.
- Depois de alguns segundos com o programa parado ou em segundo plano, o CLOCK pulava as bordas que passavam de 2 s.
  Agora recupera até uns 100 s (a 1 Hz) borda a borda; além disso (computador suspenso), pula e avisa na tela.

### Alterado
- O programa do Windows foi refeito (antes era um lançador em Python que abria o Edge, barrado por alguns
  antivírus). Ao atualizar, o circuito que estava aberto não passa sozinho para a versão nova: use Salvar antes.
- Sai o instalador montado pelo Inno Setup e sai o zip portátil: o próprio programa faz os dois papéis. Instalado
  por cima de uma versão anterior, ele toma o lugar dela em Aplicativos instalados.

## [2.0.3] - 2026-10-28

### Corrigido
- O instalador da 2.0.2 era barrado por alguns antivírus, entre eles o Microsoft Defender em alguns computadores.
  O lançador voltou a só abrir o simulador e fechar, sem mexer na janela. O ícone próprio na barra de tarefas
  continua: agora quem cuida dele é o atalho criado pelo instalador.

## [2.0.2] - 2026-10-28

### Corrigido
- No Windows, o Bancada Livre fixado na barra de tarefas fica com o próprio ícone e reabre o programa, em vez de
  virar um atalho do Edge.

### Alterado
- Texto de privacidade do README e da janela Sobre mais curto e só com o que o programa faz de fato.

## [2.0.1] - 2026-10-28

### Corrigido
- Contador que se limpa sozinho (porta no CLR ou no CLR̄ do 74161, saída de um flip-flop no CLR̄ do outro) não é
  mais marcado como laço combinacional: o reset age na hora seguinte, como no chip real.
- O clock não perde bordas quando o navegador atrasa (aba em segundo plano, programa ocupado).
- No passo a passo, as saídas Q e Q̄ dos flip-flops aparecem desde o começo, porque vêm do estado guardado.
- A mensagem de erro do gabarito não sai mais na cor de certo; gabarito sem nenhuma linha comparável ganha aviso
  próprio.

### Adicionado
- Aviso no rodapé quando um flip-flop ou trava oscila e fica indefinido.

### Alterado
- README no modelo comum dos Programas Livres: topo centralizado, selos só com o que foi testado e a tabela da
  família no fim.

## [2.0.0] - 2026-10-27 · "Memória e tempo"

Lógica sequencial: o Bancada Livre passa a ter flip-flops, e com eles a outra metade da disciplina. Circuitos
salvos nesta versão que usem as peças novas não abrem na 1.0.x; os circuitos antigos abrem normalmente aqui.

### Adicionado
- **Aba MEMÓRIA:** flip-flops D, JK, T e SR, que mudam na subida do clock, com PR e CLR que agem na hora, e a
  trava D (latch), que acompanha D enquanto EN está em 1. Cada um mostra o valor guardado, que dá para mudar no
  painel. A realimentação através de um flip-flop funciona, e uma trava que oscila fica indefinida em vez de
  travar o programa.
- **CIs sequenciais** com a pinagem real: 7474 (dois flip-flops D), 7476 (dois JK, que mudam na descida do clock),
  74161 (contador síncrono de 4 bits, com carga e limpar) e 74164 (registrador de deslocamento de 8 bits), cada um
  com a sua página no Guia de CIs.
- **Linha do tempo** (botão Tempo): a onda de cada clock, chave, flip-flop e LED ao longo do tempo, numa janela
  que dá para mover e aumentar.
- **Mapa de Karnaugh** de circuitos com 2 a 4 entradas: células em ordem de código Gray, grupos coloridos e a
  expressão simplificada. Clicar numa célula põe as chaves naquela combinação.
- **Conferir com gabarito:** importar uma tabela-verdade esperada em CSV (o mesmo formato do Exportar CSV) e ver,
  linha a linha, onde o circuito bate ou não.
- **Exportar SVG:** o desenho do circuito nítido em qualquer tamanho, para prova e slides.
- **Ver se há versão nova**, na janela Sobre: abre a página de versões no navegador, ao lado da versão instalada.
  O programa continua sem consultar a internet sozinho.
- 10 circuitos de exemplo novos, um grupo Memória e quatro exemplos de CIs sequenciais: 40 ao todo.
- Comandos novos para agentes de IA: memória, linha do tempo, mapa de Karnaugh e gabarito.

### Alterado
- A tabela-verdade avisa quando o circuito tem memória (a saída depende do que veio antes).
- Ferramenta de testes atualizada (Vitest 4.1.12), o que resolve os alertas de segurança das ferramentas de
  montagem, e instalador montado com setuptools 84.2.1.
- Cada release ganha um atestado de origem (SLSA), conferível com `gh attestation verify`.

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
