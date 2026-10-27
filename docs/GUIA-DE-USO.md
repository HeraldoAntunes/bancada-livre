<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Guia de uso do Bancada Livre

Um passeio pelo programa, do primeiro circuito ao uso em sala. Para baixar, veja o [README](../README.md).

## 1. A tela

- **Barra de cima:** as abas da paleta (**ENTRADAS**, **PORTAS**, **SAÍDAS** e **CIs**) e os botões em três grupos:
  **Arquivo** (Abrir, Salvar, PNG), **Editar** (desfazer, refazer, Limpar tudo) e **Aula** (Exemplos, Passo a
  passo, Tabela, Guia de CIs e `Aa`, que mostra o nome das portas). O número da versão abre a janela **Sobre**.
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

Para começar mais rápido, abra o menu **Exemplos**: são 30 circuitos prontos, do básico aos CIs.

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

## 6. CIs 74xx

Na aba **CIs** estão os chips com a pinagem real: 7400, 7402, 7404, 7408, 7432, 7486, 7448, 74138, 74151 e 74283.
Como na protoboard, o chip só funciona com **VCC no nível 1 e GND no nível 0**: sem alimentação, uma faixa no corpo
do chip avisa, e as saídas ficam indefinidas. O botão **Guia** mostra a pinagem de cada chip, dicas de bancada e um
exemplo pronto para abrir.

## 7. Passo a passo

O botão **Passo a passo** faz o sinal avançar uma porta de cada vez, com uma barra no topo da bancada que mostra o
nível atual e o que acontece nele. Use os botões da barra ou o teclado: `→` ou `Espaço` avançam, `←` volta, `Home`
reinicia e `Esc` sai.

## 8. Zoom e vista

A roda do mouse amplia no ponto do cursor, e arrastar o fundo move a bancada. Os botões do canto reduzem, voltam a
100%, ampliam e **Ajustar** mostra todo o circuito o maior possível. No teclado, `Ctrl` e `+` amplia, `Ctrl` e `−`
reduz e `Ctrl+0` faz o mesmo que **Ajustar**.

## 9. Salvar, abrir e exportar

- O circuito aberto fica guardado sozinho no navegador: fechar a janela não perde o trabalho.
- **Salvar** baixa o circuito como `circuito.json`, para guardar ou entregar trabalhos; **Abrir** carrega de volta.
- **PNG** baixa uma imagem do circuito inteiro.

## 10. Em sala de aula

- **Projetor:** use **Ajustar** e a tabela em janela (**Destacar**).
- **Para os alunos:** o arquivo `BancadaLivre-x.y.z.html` é o simulador inteiro num arquivo só. Dá para pôr no Moodle
  ou mandar por e-mail, e o aluno abre com dois cliques, sem instalar nada e sem internet.
- **Atividades:** o aluno monta o circuito, confere pela tabela-verdade e entrega o `.json` ou o PNG.

## 11. Agentes de IA

Cada ação do programa existe também como comando com nome. Um agente de IA que controla o navegador pode montar e
testar circuitos sem clicar, pelo objeto `bancadaLivre` da página (`bancadaLivre.listar()` mostra os comandos). Nada
muda para quem usa com o mouse. Detalhes na seção "Para quem desenvolve" do [README](../README.md).
