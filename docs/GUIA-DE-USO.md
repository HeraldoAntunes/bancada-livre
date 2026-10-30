<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Guia de uso do Bancada Livre

Um passeio pelo programa, do primeiro circuito ao uso em sala. Para baixar, veja o [README](../README.md).

## 1. A tela

- **Barra de cima:** as abas da paleta (**ENTRADAS**, **PORTAS**, **MEMÓRIA**, **SAÍDAS** e **CIs**) e os botões em
  três grupos: **Arquivo** (Abrir, Salvar, PNG, SVG), **Editar** (desfazer, refazer, Limpar tudo) e **Aula**
  (Exemplos, Passo a passo, Tabela, Tempo, Guia de CIs e `Aa`, que mostra o nome das portas). O número da versão abre a janela **Sobre**, onde o botão **Ver se há versão nova** abre a página de
  versões no navegador (o programa não consulta a internet sozinho).
- **Paleta, à esquerda:** os componentes da aba escolhida.
- **Bancada, no meio:** onde o circuito é montado.
- **Painel, à direita:** as propriedades do item selecionado e a tabela-verdade do circuito.

## 2. Primeiro circuito (2 minutos)

1. Na aba **ENTRADAS**, arraste duas chaves (SWITCH) para a bancada, ou clique nelas.
2. Na aba **PORTAS**, ponha uma porta AND.
3. Na aba **SAÍDAS**, ponha um LED.
4. Ligue os pinos: arraste de um círculo de saída até um de entrada. Uma saída pode alimentar várias entradas; cada
   entrada aceita um fio só.
5. Clique nas chaves para alternar entre 0 e 1. O fio em 1 fica azul e grosso, o fio em 0 fica cinza e fino, e o
   LED acende quando as duas chaves estão em 1.

Para começar mais rápido, abra o menu **Exemplos**: são 40 circuitos prontos, do básico aos CIs.

## 3. Editar componentes

- **Duplo clique** no componente abre a janela de edição: rótulo, número de entradas da porta, cor do LED, modo do
  display, frequência do CLOCK e do contador, número de posições do banco de chaves e da barra de LEDs.
- Com o componente selecionado, a tecla **E** espelha (troca o lado das entradas e da saída) e **R** gira 90 graus.
- **Delete** apaga o item selecionado (componente ou fio). **Ctrl+Z** e **Ctrl+Y** desfazem e refazem.
- O item **TEXTO**, na aba ENTRADAS, serve para anotar o circuito na própria bancada.

## 4. Os sinais

| Estado | Como aparece | O que quer dizer |
|---|---|---|
| 1 | fio azul e grosso | nível alto |
| 0 | fio cinza e fino | nível baixo |
| X | fio tracejado | indefinido, como uma entrada solta |
| E | fio laranja | erro: duas saídas ligadas no mesmo ponto, ou um laço |

## 5. Tabela-verdade e expressão

O painel da direita monta a tabela-verdade do circuito inteiro, variando todas as entradas: chaves, botões, cada
posição do banco de chaves e cada bit do contador. As saídas são os LEDs, cada LED da barra, os displays e as sondas.

- **Clique numa linha** para pôr o circuito naquela combinação.
- Abaixo da tabela aparece a **expressão booleana** de cada saída.
- Até 5 entradas, a tabela aparece sozinha; de 6 a 8, pelo botão **Gerar tabela**. Acima de 8 entradas ela não é
  gerada.
- **Destacar** abre a tabela numa janela que dá para arrastar e aumentar: a letra cresce junto, bom para projetar.
- **Exportar CSV** baixa a tabela no formato que as planilhas em português esperam.
- **Mapa de Karnaugh** (circuitos de 2 a 4 entradas) mostra o mapa da saída escolhida em código Gray: vizinhos
  diferem em uma variável só. Cada grupo colorido junta 1s vizinhos e vira um termo da **expressão simplificada**.
  Clicar numa célula põe as chaves naquela combinação.
- **Conferir com gabarito** lê uma tabela esperada em CSV, no mesmo formato do Exportar CSV (as colunas são
  achadas pelo nome; um X numa saída do gabarito aceita qualquer valor). A tabela marca em vermelho cada saída que
  não bate, com o valor esperado, e diz quantas linhas estão certas. **Tirar gabarito** volta ao normal.
- Em circuito com flip-flops, a tabela usa o valor guardado neste momento: para ver o comportamento no tempo, use a
  linha do tempo (seção 8).

## 6. Memória: flip-flops e trava D

Na aba **MEMÓRIA** estão os elementos que guardam um bit:

- **Flip-flop D:** na subida do clock (de 0 para 1), Q passa a valer D. Fora disso, guarda.
- **Flip-flop JK:** na subida do clock, J e K em 0 guardam, J em 1 liga, K em 1 zera e os dois em 1 invertem.
- **Flip-flop T:** com T em 1, inverte a cada subida do clock; com T em 0, guarda.
- **Flip-flop SR:** S liga e R desliga na subida do clock; S e R em 1 juntos é a combinação proibida, e Q fica
  indefinido.
- **Trava D (latch):** enquanto EN está em 1, Q acompanha D na hora; com EN em 0, guarda o último valor.

Nos flip-flops, **PR** (predefinir) e **CLR** (limpar) agem na hora, sem esperar o clock: em 1, PR liga e CLR zera.
Soltos, não agem. O valor guardado aparece no meio do corpo e pode ser mudado no painel de propriedades. O clock
pode ser um CLOCK, uma chave ou um botão. Ligar o Q̄ de um flip-flop no clock do seguinte forma um contador; os
exemplos do grupo **Memória** mostram isso e mais.

## 7. CIs 74xx

Na aba **CIs** estão os chips com a pinagem real: 7400, 7402, 7404, 7408, 7432, 7486, 7448, 74138, 74151, 74283 e
os sequenciais 7474, 7476, 74161 e 74164.
Como na protoboard, o chip só funciona com **VCC no nível 1 e GND no nível 0**: sem alimentação, uma faixa no corpo
do chip avisa, e as saídas ficam indefinidas. O botão **Guia** mostra a pinagem de cada chip, dicas de bancada e um
exemplo pronto para abrir.

## 8. Linha do tempo

O botão **Tempo** abre a linha do tempo: uma onda para cada clock, chave, flip-flop e LED do circuito. Cada coluna é
um momento em que algum sinal mudou; em cima é 1, embaixo é 0, e a faixa cinza é indefinido. Deixe o clock rodar ou
avance meio período de cada vez e veja, por exemplo, cada flip-flop de um contador dividir a frequência do anterior
por 2. **Recomeçar** apaga o que foi guardado.

## 9. Passo a passo

O botão **Passo a passo** faz o sinal avançar uma porta de cada vez, com uma barra no topo da bancada que mostra o
nível atual e o que acontece nele. Use os botões da barra ou o teclado: `→` ou `Espaço` avançam, `←` volta, `Home`
reinicia e `Esc` sai.

## 10. Zoom e vista

A roda do mouse amplia no ponto do cursor, e arrastar o fundo move a bancada. Os botões do canto reduzem, voltam a
100%, ampliam e **Ajustar** mostra todo o circuito o maior possível. No teclado, `Ctrl` e `+` amplia, `Ctrl` e `−`
reduz e `Ctrl+0` faz o mesmo que **Ajustar**.

## 11. Salvar, abrir e exportar

- O circuito aberto fica guardado sozinho, e fechar a janela espera a gravação terminar. Queda de energia ou programa
  encerrado à força ainda podem perder a última mudança. Se o salvamento automático não
  conseguir gravar (disco cheio, modo privado do navegador), a barra de baixo avisa; aí, use **Salvar**.
- **Salvar** baixa o circuito como `circuito.json`, para guardar ou entregar trabalhos; **Abrir** carrega de volta.
- **PNG** baixa uma imagem do circuito inteiro; **SVG** baixa o desenho vetorial, nítido em qualquer tamanho, bom
  para prova e slides.
- Circuitos com as peças novas da 2.0 (flip-flops, trava e CIs sequenciais) não abrem nas versões 1.0.x.

## 12. Em sala de aula

- **Projetor:** use **Ajustar** e a tabela em janela (**Destacar**).
- **Para os alunos:** o arquivo `BancadaLivre-x.y.z.html` é o simulador inteiro num arquivo só. Dá para pôr no Moodle
  ou mandar por e-mail, e o aluno abre com dois cliques, sem instalar nada e sem internet.
- **Atividades:** o aluno monta o circuito, confere pela tabela-verdade e entrega o `.json` ou o PNG. Para corrigir,
  abra o `.json` do aluno e use **Conferir com gabarito** com a tabela esperada.

## 13. Agentes de IA

Cada ação do programa existe também como comando com nome. Um agente de IA que controla o navegador pode montar e
testar circuitos sem clicar, pelo objeto `bancadaLivre` da página (`bancadaLivre.listar()` mostra os comandos). Nada
muda para quem usa com o mouse. Detalhes na seção "Para quem desenvolve" do [README](../README.md).
