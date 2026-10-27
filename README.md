<!-- Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT -->
# Bancada Livre

Simulador **didático** de lógica digital, numa bancada que roda no navegador. O aluno arrasta componentes para a bancada (chaves e botões nas
entradas, portas lógicas e CIs no meio, LEDs e displays de 7 segmentos na saída), liga tudo com fios e **vê o sinal
propagar na hora**. A tabela-verdade automática mostra **todos os estados** de cada porta e do circuito inteiro.

É livre, gratuito, funciona sem internet e cabe num único arquivo HTML.

## Como abrir

Na página de versões (Releases), escolha um dos arquivos:

| Qual arquivo baixar? | Para quê |
|-|-|
| `Instalar-BancadaLivre-<versão>.exe` | **Instalar no computador (Windows).** Cria atalho no menu Iniciar e abre o simulador numa janela própria. Não pede administrador. |
| `BancadaLivre-<versão>-portatil.zip` | **Usar sem instalar (Windows), em pendrive.** Descompacte e abra `BancadaLivre.exe`. |
| `BancadaLivre-<versão>.html` | **Qualquer sistema, sem instalar nada.** Abra com dois cliques no navegador. É um arquivo só: dá para pôr no Moodle ou mandar por e-mail. |

Para mexer no código, veja a seção "Para quem desenvolve", mais abaixo.

Testado no Windows 11 com o Microsoft Edge. Em outros navegadores atuais (Chrome, Firefox, Safari) deve
funcionar, mas não foi verificado.

## O que dá para fazer

- **8 portas** no símbolo ANSI: AND, OR, NOT, NAND, NOR, XOR e XNOR, de 2 a 8 entradas, e o BUFFER.
- **Entradas**: chave (SWITCH), CLOCK de 0,5 a 10 Hz (com rodar, pausar e avançar meio período no próprio
  componente), NÍVEL ALTO (1), NÍVEL BAIXO (0), PUSH BUTTON, **banco de chaves** de 4 ou 8 posições e
  **contador automático** de 2 a 4 bits, que gera as combinações no ritmo escolhido.
- **Saídas**: LED (azul, vermelho, verde ou amarelo), **barra de LEDs** de 4 ou 8, display de 7 segmentos (BCD
  de 0 a 9, hexadecimal de 0 a F, ou segmento a segmento) e SONDA.
- Fios que mostram o estado pela cor e pela espessura: em 1, azul e grosso; em 0, cinza e fino.
- Estados 0, 1, X (indefinido, como uma entrada solta) e E (erro: duas saídas no mesmo ponto ou laço).
- **Tabela-verdade** automática de cada porta e do circuito. Clicar numa linha aplica aquela combinação às
  chaves. Abaixo dela aparece a **expressão booleana**.
- **CIs da série 74xx** (7400, 7402, 7404, 7408, 7432, 7486, o decodificador 7448, o decodificador 74138, o
  multiplexador 74151 e o somador de 4 bits 74283) com a pinagem real e
  alimentação VCC e GND obrigatória, como na protoboard. O **Guia de CIs** mostra a pinagem e dicas de bancada
  de cada chip.
- **Modo passo a passo**: o sinal avança uma porta de cada vez.
- **Texto livre** para anotar o circuito, nome das portas na bancada (botão `Aa`) e rótulo próprio em cada porta.
- Desfazer e refazer (Ctrl+Z e Ctrl+Y) e **30 circuitos de exemplo** em quatro grupos: Básico, Intermediário,
  Avançado e CIs, da porta AND sozinha até o semáforo com contador e o somador de 4 bits com o 74283.
- **Salvamento automático**: fechar a aba não perde o circuito.

## Primeiros passos

1. Escolha uma aba na barra superior: **ENTRADAS**, **PORTAS**, **SAÍDAS** ou **CIs**. À direita ficam os
   botões, em três grupos: **Arquivo** (Abrir, Salvar, PNG), **Editar** (desfazer, refazer, limpar) e **Aula**
   (Exemplos, Passo a passo, Tabela, Guia de CIs e nomes das portas).
2. Arraste um componente da paleta (à esquerda) para a bancada, ou clique nele.
3. Ligue os pinos: arraste de um círculo de saída até um de entrada. Uma saída pode alimentar várias entradas;
   cada entrada aceita um fio só.
4. Clique nas chaves para alternar entre 0 e 1 e veja o sinal propagar.
5. No painel da direita, acompanhe a tabela-verdade. O botão **Destacar** abre a tabela numa janela que dá
   para mover e aumentar.

Para ver melhor, use a roda do mouse (amplia no ponto do cursor), arraste o fundo para mover a bancada e use
os botões do canto: menos, porcentagem (volta a 100%), mais e **Ajustar**, que mostra todo o circuito o maior
possível. Ctrl e +, Ctrl e − e Ctrl e 0 fazem o mesmo.

Para começar rápido, abra o menu **Exemplos**. Um **duplo clique** no componente abre a janela de edição dele. Com um componente selecionado, a tecla **E**
espelha e a tecla **R** gira 90 graus. A tecla **Delete** apaga o item selecionado.

## Salvar e exportar

- **Salvar** baixa o circuito como `circuito.json`, para guardar ou entregar trabalhos; **Abrir** carrega de volta.
- **PNG** baixa uma imagem da bancada.
- **Exportar CSV**, abaixo da tabela-verdade, baixa a tabela com ponto e vírgula e acentuação UTF-8, o formato que
  planilhas em português esperam.

## Privacidade

Tudo roda no seu computador. O circuito fica guardado só no navegador (salvamento automático) e nos arquivos que
você mesmo baixar. O simulador não envia nada pela internet, não usa contas nem login e não tem propaganda ou
rastreamento.

## Limitações conhecidas

- Em telas com menos de 1366 px de largura, a barra superior passa a ocupar duas linhas.
- Interface só em português.
- O display não tem ponto decimal.
- Só lógica combinacional: flip-flops e memória ficam para uma versão futura.

## Para quem desenvolve

TypeScript, React 18, SVG, Vite e zustand, com testes no Vitest. Precisa do Node.js.

```bash
npm install      # primeira vez
npm run dev      # abre em http://localhost:5173
npm test         # testes automáticos
npm run lint     # linter
npm run build    # gera dist/index.html, o arquivo único
```

### Comandos (para agentes de IA)

Cada ação da tela existe também como comando, para um agente de IA que controla o navegador usar o simulador sem
clicar. No console do navegador, com o Bancada Livre aberto:

```js
bancadaLivre.listar()                                          // comandos, descrições e parâmetros
bancadaLivre.executar('componente.adicionar', { tipo: 'AND' }) // devolve { ok, resultado } ou { ok: false, erro }
bancadaLivre.executar('fio.ligar', { de: 'c1:out', para: 'c2:in0' })
bancadaLivre.executar('tabela.ler')
```

Cada comando é um passo do Desfazer. O registro fica em `src/comandos.ts`.

## Como foi feito

O Bancada Livre foi criado e dirigido por **Heraldo Antunes Silva Filho**, para as suas aulas. Foi feito com apoio de **inteligência artificial** (Claude, da Anthropic, pelo Claude Code),
usada como ferramenta: a ideia, os requisitos, as decisões de didática, a revisão e a aprovação de cada versão são
do autor. A mesma declaração aparece na janela **Sobre** do programa, aberta pelo número da versão. As mudanças de
cada versão estão no [CHANGELOG.md](CHANGELOG.md).

## Licença

Licença **MIT** (ver [LICENSE](LICENSE)): uso, cópia, modificação e distribuição livres, inclusive por outras
instituições de ensino, mantendo o aviso de autoria. As bibliotecas de terceiros e suas licenças estão em
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

As marcas citadas pertencem aos seus donos; o Bancada Livre é um projeto independente, sem vínculo com elas.
