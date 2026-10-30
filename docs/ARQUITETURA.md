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

Fora de `src/`, `src-tauri/` contém o programa do Windows (Tauri 2, Rust): o mesmo HTML embutido numa janela própria
do WebView2, com o circuito guardado também em arquivo (`salvamento.rs`). O simulador funciona offline; o WebView2
pode abrir conexões próprias com a Microsoft, fora da CSP da página. Veja a [política de privacidade](../.github/SECURITY.md).

`instalador/build.ps1` monta o HTML e o executável que oferece instalar para a conta atual ou usar sem instalar.
A distribuição é `Instalar-BancadaLivre-<versão>.zip`, com o executável, a licença e os avisos; extraia antes de abrir.
Há também o zip `BancadaLivre-<versão>-sem-internet.zip`, com o instalador oficial do WebView2, e o HTML avulso para
navegadores. O executável faz parte dos zips, sem download avulso.

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
numa versão nova do primeiro número do programa. O circuito tem teto de 2 milhões de caracteres, com até 128
caracteres adicionais para o envelope de salvamento. A leitura limita o texto antes do `JSON.parse` e confere
também o teto do circuito após descontar os metadados, tanto na abertura manual quanto na recuperação automática.
A estrutura é validada antes de carregar:
ids não vazios, sem `:`, únicos entre componentes e fios, e coordenadas finitas entre -1.000.000 e 1.000.000.
O separador `:` fica reservado para referências `componente:pino`.

A leitura de um arquivo só é aplicada se ainda for a escolha mais recente e o histórico de edição não tiver mudado.
Cancelar a seleção invalida a leitura pendente; limpar, editar ou desfazer também a torna obsoleta.

## Salvamento automático e recuperação

`state/store.ts` grava na chave histórica `simulador-portas:autosave`, numa única operação de
`localStorage.setItem`. O envelope mantém `version`, `components` e `wires` na raiz e acrescenta
`salvamento: { hora, revisao }`: dois inteiros seguros não negativos, com hora em milissegundos desde 1970.
Cada conteúdo preparado recebe uma revisão maior que as revisões conhecidas de candidatos válidos.
Uma repetição do mesmo salvamento reutiliza os mesmos bytes; falhar numa fonte não confirma essa fonte.
O mesmo envelope é enviado ao arquivo nativo por `salvar_circuito({ texto })`.
O arquivo exportado pelo botão **Salvar** continua sendo o circuito, sem esses metadados automáticos.

No Windows, as fontes são `%LOCALAPPDATA%\Bancada Livre\circuito.json`, a reserva `circuito-anterior.json`
e os temporários entregues pelo Rust, além do localStorage. Uma falha ao ler o storage não impede tentar as fontes
nativas. Antes de considerar a revisão de qualquer candidato, a página faz a validação completa: tamanho, JSON,
metadados, componentes, ids, coordenadas, pinos e fios. Um candidato recusado não aumenta o contador.

Se todos os candidatos válidos têm envelope, vence a **maior revisão**; no empate, a **hora do envelope**.
A data externa do arquivo não decide essa seleção. Se algum candidato válido é legado, sem envelope, o conteúdo
das peças e fios é comparado, ignorando a ordem das propriedades dos objetos e os metadados do salvamento.
Conteúdo igual abre direto. Com conteúdo diferente, a variável booleana
`window.__BANCADA_PERGUNTAR_MIGRACAO__`, entregue pelo Rust na abertura, controla a migração:

- Abre o “Arquivo principal do programa” em silêncio somente quando há legado válido, os conteúdos divergem,
  a flag é exatamente `false` e o principal passou na validação completa do simulador.
  A presença do principal é verificada pelos bytes de `__BANCADA_CIRCUITO__` entre os candidatos nativos válidos,
  sem depender do rótulo de origem. Revisões maiores no navegador ou nas reservas não substituem essa escolha.
- Com flag `true`, principal ausente ou principal recusado, a pergunta continua aparecendo entre as cópias válidas
  divergentes, se houver algum legado.
- Sem a flag, como no HTML de navegador ou num programa antigo, permanece a regra anterior:
  legado com conteúdo divergente exige escolha. Um valor diferente dos booleanos não autoriza silêncio.
- Sem legado válido, a flag não altera a seleção por revisão e hora do envelope.
  Com conteúdos iguais, a abertura continua direta, inclusive se a flag for `true`.

Abrir em silêncio não encerra a migração: `precisaMigrar` continua `true`.
O primeiro plano usa o principal como texto, com revisão acima de todas as válidas, e conserva todas as cópias válidas,
incluindo a do navegador. A preservação dos originais e a confirmação da ponte seguem o mesmo contrato da escolha manual.

Para duas cópias, a janela pergunta exatamente: **Encontrei duas versões do seu circuito. Qual quer continuar?**
Com mais cópias, a quantidade substitui “duas”. Cada opção mostra origem, hora, número de peças e de fios.
A hora informativa vem do envelope, da chave legada `simulador-portas:autosave-hora` ou da informação de arquivo
entregue pelo Rust. Sem hora utilizável, aparece “Hora não disponível”.
O arquivo principal e o storage têm rótulos próprios; reservas usam `origem` opcional fornecida pelo Rust ou
“Cópia do programa N”. A ordem de apresentação não significa prioridade.

A escolha manual e a abertura silenciosa abrem o circuito e agendam a primeira gravação.
As outras versões continuam preservadas.
Fechar sem escolher não escreve sobre as fontes, mesmo se houver edição por comando; a pergunta volta ao reabrir.
Os comandos da janela são `recuperacao.listar`, `recuperacao.escolher({ indice })` (índice a partir de zero)
e `recuperacao.adiar`; no programa, adiar chama `fechar_sem_gravar`.

### Migração e ponte nativa

A ponte Rust do contrato abaixo está implementada no repositório. A montagem e o teste no executável ficam
com a equipe Bancada; testes TypeScript simulam essa ponte. Sem o comando, com rejeição ou sem a confirmação explícita
`{ ok: true }`, a gravação que depende de migração fica bloqueada, com aviso e nova tentativa.
Não há fallback para `salvar_circuito` que possa sobrescrever cópias ainda não convertidas.

```ts
migrar_circuitos({
  texto: string, // envelope do circuito escolhido, incluindo edições posteriores
  copias: [{ original: string, envelope: string }], // bytes originais e conversão de cada candidato válido
  reiniciarRevisao: boolean
}) // Promise<{ ok: true }>; erro deve rejeitar
```

Na migração comum, cada legado recebe revisão 0 e sua hora informativa; envelopes existentes mantêm seus metadados.
O circuito aberto, pela escolha manual ou pela regra silenciosa, recebe a próxima revisão, acima de todas as válidas.
Depois da confirmação nativa, o TypeScript
substitui o autosave local. Assim todas as fontes ativas têm envelope e não repetem a pergunta.

O comando Rust deve, sob a mesma exclusão mútua do salvamento comum:

1. Conferir as fontes atuais contra os bytes conhecidos; recusar mudanças concorrentes desconhecidas.
2. Arquivar integralmente todos os `original` em `copias-preservadas`, inclusive o candidato do storage,
   antes de substituir qualquer fonte.
   O arquivo de originais é inativo: não pode reaparecer na lista automática de candidatos.
3. Converter todas as fontes nativas ativas, incluindo reservas e temporários reconhecidos, sem mudar peças e fios.
4. Publicar `texto` como atual por último e só confirmar quando as etapas estiverem duráveis.
   Repetir a mesma chamada deve ser idempotente; falha parcial deve permitir retomar sem perder os originais.

Se o storage falhar depois da confirmação nativa, a repetição tenta o storage de novo e mantém o aviso até confirmar.
Se houver outra edição, ela recebe nova revisão. Sem ponte, mas com candidatos nativos presentes, o salvamento de
migração também fica bloqueado. No HTML de navegador, os originais são arquivados primeiro como lista de strings
JSON em `simulador-portas:copias-recuperadas`; uma falha de cota nessa cópia impede substituir o autosave.
Essa lista preserva também entradas anteriores e não participa da seleção automática.

### Limite do contador e interrupções

Uma revisão válida igual a `Number.MAX_SAFE_INTEGER` exibe aviso e exige reinício controlado.
Pelo mesmo comando, com `reiniciarRevisao: true`, todas as cópias ativas são rebaseadas em revisão 0,
preservando o conteúdo e arquivando os bytes anteriores; o circuito em edição recomeça na revisão 1.
Repetir sem editar conserva o plano; editar depois de uma tentativa falha avança para 2, 3 etc.
O aviso de reinício confirmado permanece visível até a próxima abertura.

Há uma fronteira entre arquivo e storage: o nativo pode confirmar e o storage falhar, deixando uma revisão antiga
saturada no navegador. Por isso o Rust deve persistir os pares `{ original, envelope }` do reinício e entregá-los na
abertura em `window.__BANCADA_REVISOES_REINICIADAS__`. Esse registro precisa estar durável antes de publicar o novo
atual e continuar disponível nas aberturas seguintes enquanto uma cópia local antiga puder existir.
A página só usa um par para o storage cujos bytes coincidam exatamente com `original`; valida novamente o envelope,
exige revisão 0 e conteúdo de peças/fios igual. O storage antigo passa a ser tratado como sua conversão, permitindo
abrir o atual novo e corrigir o storage na gravação seguinte. Registro malformado ou com conteúdo diferente é ignorado.
A implementação e a recuperação desse registro fazem parte obrigatória da integração Rust.

Uma cópia recusada é guardada em `simulador-portas:autosave-recusado`, quando disponível.
Durante uma escolha pendente, até essa escrita é adiada para garantir fechamento sem gravação.
Se o armazenamento falhar, a tentativa de recuperação não apaga os bytes originais.
Queda de energia ou encerramento forçado podem perder alterações ainda não confirmadas; a barra informa falhas.
Os testes TypeScript simulam a ponte; eles não comprovam atomicidade, durabilidade nem encerramento do executável.

## CSV e imagens exportadas

A exportação CSV prefixa com apóstrofo as células que começam com `=`, `+`, `-` ou `@`, inclusive após espaços, para
neutralizar fórmulas em planilhas. Um apóstrofo literal inicial é duplicado. A leitura do gabarito desfaz essa
proteção para conservar os nomes originais e conferir as colunas.

`ui/exportPng.ts` gera o SVG usado tanto no download SVG quanto na rasterização PNG. Ele embute os estilos dos pinos,
textos e controles do CLOCK; os botões levam fundo azul, contorno e ícone branco sem depender do CSS da página.

## Montagem e testes

- `npm run build` gera `dist/index.html`, um único arquivo com o JavaScript, o CSS, a política de segurança e o
  aviso das licenças de terceiros embutidos.
- `npm test` roda os testes do núcleo, do estado, da interface, dos comandos, da política de segurança e do
  projeto (versão igual em todos os lugares, cabeçalhos, componentes de terceiros, ausência de emoji na interface,
  workflows fixados por hash).
- `npm run lint` roda o ESLint sem tolerar avisos.
