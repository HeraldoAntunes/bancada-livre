<!-- Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT -->
# Arquitetura

Visão rápida do código, para quem vai ler ou contribuir.

## Três camadas

```text
src/
├── engine/   núcleo da simulação, sem interface: tipos, portas, simulação, tabela-verdade, display, CIs
├── state/    estado do programa (zustand): circuito, desfazer e refazer, clock, salvamento automático
├── ui/       interface em React e SVG: barra, paleta, bancada, fios, painéis, Sobre, Guia de CIs, ícones
├── build/    usado só no build: a política de segurança (CSP) injetada no HTML
├── comandos.ts  cada ação do programa como comando com nome (a tela e os agentes de IA usam o mesmo caminho)
└── examples.ts  os circuitos de exemplo
```

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

Desde a 1.0, cada componente pode trazer `espelhado` (true) e `giro` (90, 180 ou 270). São opcionais: arquivo
sem eles abre como antes, e valores fora disso são recusados.

O campo `version` é o compromisso com quem já tem arquivos salvos: mudança que impeça abrir circuitos antigos só
numa versão nova do primeiro número do programa. Arquivos acima de 2 milhões de caracteres são recusados, e a
estrutura é validada antes de carregar.

## Montagem e testes

- `npm run build` gera `dist/index.html`, um único arquivo com o JavaScript, o CSS, a política de segurança e o
  aviso das licenças de terceiros embutidos.
- `npm test` roda os testes do núcleo, do estado e do projeto (versão igual em todos os lugares, cabeçalhos,
  componentes de terceiros, ausência de emoji na interface, workflows fixados por hash).
- `npm run lint` roda o ESLint sem tolerar avisos.
