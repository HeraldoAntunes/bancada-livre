<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Arquitetura

Visão rápida do código, para quem vai ler ou contribuir.

## Pastas do código

```text
src/
├── engine/   núcleo da simulação, sem interface: tipos, portas, simulação, tabela-verdade, display, CIs,
│             memória (sequencial.ts e icsSequenciais.ts), linha do tempo, mapa de Karnaugh e gabarito
├── state/    estado do programa (zustand): circuito, desfazer e refazer, clock, salvamento automático
├── ui/       interface em React e SVG: barra, paleta, bancada, fios, painéis, Sobre, Guia de CIs, ícones
├── build/    usado na montagem: a política de segurança (CSP) injetada no HTML e o ícone da página
├── assets/   o ícone do programa em SVG
├── main.tsx  ponto de entrada: monta a tela e expõe os comandos em window.bancadaLivre
├── styles.css  estilos da interface
├── comandos.ts  cada ação do programa como comando com nome (a tela e os agentes de IA usam o mesmo caminho)
└── examples.ts  os circuitos de exemplo
```

Fora de `src/`, a pasta `instalador/` monta a versão para Windows: um lançador em Python (empacotado pelo
PyInstaller) abre o HTML numa janela própria, e o Inno Setup gera o instalador.

**Memória (2.0).** A simulação continua combinacional e sem laço: a saída de cada flip-flop, trava ou CI
sequencial entra como uma fonte, que só depende do estado guardado e das entradas que agem na hora (PR, CLR). Depois
de cada mudança do circuito, `assentar()` (em `engine/sequencial.ts`) procura as bordas do clock, calcula o próximo
estado e simula de novo, até nada mais mudar; passar de 64 rodadas é oscilação, e o elemento fica indefinido. O
estado do programa chama `assentar()` sozinho a cada mudança, sem entrar no Desfazer.

A única fronteira obrigatória é a do **núcleo**: `src/engine/` não importa nada da interface e é testado sozinho.
A interface lê o estado, chama o núcleo e desenha o resultado.

**Cada ação é um comando.** Botões, teclas e cliques não mexem no estado direto: chamam `executar('nome', {...})`
de `src/comandos.ts`, que valida os parâmetros e devolve `{ ok, resultado }` ou `{ ok: false, erro }`. A página
expõe o mesmo registro em `window.bancadaLivre`, para um agente de IA que controla o navegador. Recurso novo entra
com o seu comando e o teste dele; `src/__tests__/comandos.test.ts` falha se a interface chamar uma ação do estado
sem passar por um comando (fora dos gestos contínuos, como arrastar).

## Como a simulação funciona

1. O circuito é um grafo: os componentes (e cada porta interna de um CI) são nós; os fios ligam um pino de saída a
   um pino de entrada.
2. O grafo é ordenado topologicamente. Se a ordenação falha, há laço combinacional: os pinos envolvidos ficam em `E`.
3. Cada porta calcula a saída em ordem, com lógica de três valores (`0`, `1` e `X` para indefinido). Uma entrada
   `X` só deixa a saída indefinida quando o valor dela importa (um AND com uma entrada em 0 dá 0).
4. Duas saídas ligadas ao mesmo ponto também dão `E` (conflito).
5. A tabela-verdade testa todas as combinações das entradas e guarda as saídas de cada linha.

Um CI só funciona com VCC em 1 e GND em 0; sem isso, todas as saídas ficam em `X`, como na protoboard.

## Arquivo de circuito (`.json`)

```json
{
  "version": 1,
  "components": [{ "id": "c1", "type": "SWITCH", "x": 40, "y": 80, "state": 1, "label": "A" }],
  "wires": [{ "id": "w1", "from": { "comp": "c1", "pin": "out" }, "to": { "comp": "c2", "pin": "in0" } }]
}
```

Desde a 1.0, cada componente pode trazer `espelhado` (true) e `giro` (90, 180 ou 270), e os componentes novos
trazem os seus campos: `cor` (LED), `bits` (banco de chaves, barra de LEDs e contador), `estados` (posições do banco de chaves) e
`contagem` (contador). Desde a 2.0, flip-flops e travas trazem `q` (0, 1 ou "X") e `clkVisto` (o último nível
do clock), e os CIs sequenciais trazem `estadoCi` (um item por bit guardado) e `clksVistos`. São opcionais:
arquivo sem eles abre como antes, e valores fora disso são recusados. Os tipos novos (`FF_D`, `FF_JK`, `FF_T`,
`FF_SR`, `LATCH_D` e os chips 7474, 7476, 74161 e 74164) não abrem nas versões 1.0.x.

O campo `version` é o compromisso com quem já tem arquivos salvos: mudança que impeça abrir circuitos antigos só
numa versão nova do primeiro número do programa. Arquivos acima de 2 milhões de caracteres são recusados, e a
estrutura é validada antes de carregar.

## Montagem e testes

- `npm run build` gera `dist/index.html`, um único arquivo com o JavaScript, o CSS, a política de segurança e o
  aviso das licenças de terceiros embutidos.
- `npm test` roda os testes do núcleo, do estado, da interface, dos comandos, da política de segurança e do
  projeto (versão igual em todos os lugares, cabeçalhos, componentes de terceiros, ausência de emoji na interface,
  workflows fixados por hash). O lançador do Windows tem testes próprios em Python (`instalador/test_lancador.py`).
- `npm run lint` roda o ESLint sem tolerar avisos.
