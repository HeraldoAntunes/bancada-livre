<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Validação da migração 2.1.0 → 2.1.1 no Linux

Teste feito em 30/10/2026 sobre a tag `v2.1.1` (commit `179014c`), num computador Linux sem tela. É o registro de um
teste, não uma promessa de suporte: o programa com janela própria é só para Windows.

## Resumo

| Caso | Resultado |
|---|---|
| A) 2.1.0 → 2.1.1 em silêncio | **passou** (14 de 14 verificações) |
| B) temporário mais novo que o principal: pergunta, fechar sem escolher, escolher | **passou** (15 de 15) |
| C) cadeia 2.1.1-rc.4 → rc.5 → 2.1.1 | **não testado**: não há tag nem commit público das rc |
| Extra 1) `circuito.json` ilegível → pergunta | **passou** (5 de 5) |
| Extra 2a) localStorage **ausente** com revisão no teto → migra (BL-RC6-D01) | **passou** (11 de 11) |
| Extra 2b) localStorage **ilegível** (ler dá erro) com revisão no teto | **falhou** (8 de 11): a migração acontece, mas fica o aviso de falha. Ver o defeito 1 |
| Testes Rust do `salvamento.rs` (`cargo test`) | 24 de 25 passaram; o 25º só compila no Windows |
| Testes do Vitest na v2.1.1 | 46 arquivos, 526 testes, todos passaram |

Além disso, o defeito 2 (provável, achado pela leitura do código) trata da mensagem que aparece depois de "Fechar sem
escolher".

## Como foi feito

O programa do Windows é a página (o HTML único) dentro de uma janela do WebView2, com o Rust de `src-tauri` por trás.
No Linux, sem janela, cada **abertura do programa** foi montada assim:

1. A **ponte** (`testes-linux/migracao/ponte`) é um programa Rust pequeno que inclui o `src-tauri/src/salvamento.rs`
   **real**, pelo caminho, sem cópia. Ela monta o script de início exatamente como o `main.rs`, com
   `__BANCADA_CIRCUITO__`, `__BANCADA_RESERVAS__`, `__BANCADA_REVISOES_REINICIADAS__` e
   `__BANCADA_PERGUNTAR_MIGRACAO__` (este último vem de `salvamento::perguntar_migracao`). Ela também atende
   `salvar_circuito` e `migrar_circuitos` com o mesmo corpo dos comandos do `main.rs`. Cada abertura é um processo
   novo da ponte, como no programa, então as cópias "conhecidas" do Rust valem só naquela abertura.
2. O **Chromium 153 sem janela** abre o HTML com esse script e com um `window.__TAURI__.core.invoke` que leva cada
   pedido à ponte. O perfil do Chromium faz o papel do perfil do WebView2: o localStorage passa de uma abertura para
   a outra e da 2.1.0 para a 2.1.1.
3. Para **fechar**, o teste roda o mesmo texto `AO_FECHAR` do `main.rs` e espera a página chamar `fechar` ou
   `fechar_sem_gravar`.
4. Os **dados da 2.1.0** foram criados pela própria 2.1.0: o HTML da tag `v2.1.0` com a ponte compilada com o
   `salvamento.rs` da tag `v2.1.0`, em duas aberturas (primeiro a peça L1, depois a L2).

Ficam fora da simulação a janela, o `sistema.rs` (janela única, WebView2 órfão), o `instalacao.rs` e as caixas de
mensagem do Windows. O `main.rs` não compila no Linux sem as bibliotecas de janela do Tauri, então o script de início
e os dois comandos foram reescritos na ponte, linha por linha.

### Arquivos usados (SHA-256)

| Arquivo | SHA-256 |
|---|---|
| HTML da 2.1.0, montado no Linux | `0bf92518ab9b0b517584cef2baa28efd9bfdcc2358e6b9e807c8f2ebd5594866` (igual ao `BancadaLivre-2.1.0.html` publicado) |
| HTML da 2.1.1, montado no Linux | `47eaeab93177bc9d0aec99c984f1222c5e8a66ea4c3babed6329bb44f65a17ab` (igual ao `BancadaLivre-2.1.1.html` publicado) |
| `src-tauri/src/salvamento.rs` da v2.1.1 | `bce12cb42ff54809f6a33c626f16a6aea1d7f81e52a8a4d61e8cc5743683376b` |
| `src-tauri/src/salvamento.rs` da v2.1.0 | `91d1a39a460feb48fb89f53c1ad3d9d7bc1a2e11cf35262d59765fac1c2f866a` |

### O computador

Ubuntu 24.04.5 LTS (x86_64, núcleo 6.18.44, contêiner sem tela), Node.js 22.22.0, npm 10.9.4, Rust 1.97.0 (cargo
1.97.0), Chromium 153.0.8010.12 sem janela, `puppeteer-core` 25.14.0 e `serde_json` 1.0.154 (a mesma versão do
`Cargo.lock` do programa).

### Comandos

Na raiz, com a tag `v2.1.1`:

```bash
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
```

```bash
sha256sum dist/index.html
```

Depois, na pasta `testes-linux/migracao` (o `preparar.sh` monta os dois HTML e as duas pontes):

```bash
cd testes-linux/migracao && npm ci && ./preparar.sh
```

```bash
node migracao.mjs
```

O resultado de cada verificação, com o SHA-256 de cada arquivo da pasta de dados em cada etapa, fica em
`testes-linux/migracao/saida/resultado-migracao.json`. Os SHA-256 dos circuitos abaixo são os da última rodada:
mudam a cada rodada, porque o circuito leva a hora e as peças caem em posições sorteadas.

## A) 2.1.0 → 2.1.1 em silêncio: passou

Pasta de dados criada pela 2.1.0:

| Arquivo | SHA-256 | Conteúdo |
|---|---|---|
| `circuito.json` | `81c39f6b3c5e02956fef282c4778265e7557e004fbd4484d3cf51ffbbc40601b` | L1 e L2, sem envelope |
| `circuito-anterior.json` | `be0a20f9a0a70bcbc24ac6ff9293827bd38508ff98cf5b6e2d9767f269d3271a` | só L1, sem envelope |

| Verificação | Resultado |
|---|---|
| A 2.1.0 deixou os dois arquivos sem envelope e diferentes | passou |
| O localStorage da 2.1.0 chegou à 2.1.1 (mesmo perfil) | passou |
| Abre sem pergunta | passou |
| Abre o circuito do `circuito.json` (L1 e L2) | passou |
| A página pediu `migrar_circuitos` | passou |
| `circuito.json` passou a ter envelope (revisão 1) | passou |
| `circuito-anterior.json` é o anterior de antes, convertido (revisão 0, só L1) | passou |
| `copias-preservadas` tem o `circuito.json` original, com o mesmo SHA-256 | passou (`circuito-7a3456e9492a6fb9.json`) |
| `copias-preservadas` tem o `circuito-anterior.json` original, com o mesmo SHA-256 | passou (`circuito-51d9f9690eb777a0.json`) |
| Depois de 1 edição (peça L3), fechar pelo X grava e fecha (`fechar`) | passou |
| Reabre sem pergunta | passou |
| Reabre certo: L1, L2 e L3 | passou |
| `copias-preservadas` não mudou | passou |
| Nenhum erro na página | passou |

## B) Temporário mais novo que o principal: passou

A pasta foi criada pela 2.1.0 como no caso A. Uma terceira abertura da 2.1.0 gravou L1, L2 e L3. Depois disso, os
arquivos foram arrumados como a 2.1.0 deixa quando cai entre escrever o temporário e trocá-lo pelo principal:
`circuito.json.tmp` (o nome que a 2.1.0 usa) com L1, L2 e L3, e o `circuito.json` de antes (L1 e L2). A data do
temporário ficou 60 s mais nova que a do principal.

| Arquivo, antes | SHA-256 |
|---|---|
| `circuito.json` | `9b98efb266ae956c651f4ea1bba130366afc435b8bc785c05a4097250d3d63e5` |
| `circuito-anterior.json` | `933043a538d663b49bc17e9e11da2fc402f455968cfa695faaaa5a5e9be3266a` |
| `circuito.json.tmp` | `ac13ca473adadea74d3e3e19fefefd6fbcad4ea194aa09043e5b63e178820978` |

| Verificação | Resultado |
|---|---|
| Aparece a pergunta | passou |
| A pergunta mostra as 4 versões: principal (2 peças), cópia anterior (1), gravação interrompida (3) e navegador (3) | passou |
| "Fechar sem escolher" pede ao programa `fechar_sem_gravar` | passou (ver o defeito 2) |
| Com a pergunta aberta, nada foi pedido ao disco | passou |
| Fechar sem escolher não grava nada: os 3 arquivos têm o mesmo SHA-256 de antes, e não surgiu `copias-preservadas` | passou |
| O localStorage também não mudou | passou |
| Ao reabrir, a pergunta volta | passou |
| Escolher a gravação interrompida abre L1, L2 e L3 | passou |
| Escolher migra (`migrar_circuitos`) | passou |
| Os 3 originais estão em `copias-preservadas`, com o mesmo SHA-256 | passou (mais o original do navegador, `81e1f174…a89c`) |
| O temporário saiu das cópias ativas | passou |
| `circuito.json` é o escolhido, com envelope | passou |
| Reabre sem pergunta, com L1, L2 e L3 | passou |

## C) Cadeia 2.1.1-rc.4 → rc.5 → 2.1.1: não testado

No repositório público não existe tag nem commit das versões rc. As tags são de `v1.0.0` a `v2.1.1`, e o histórico
vai direto do commit da 2.1.0 (`442d7e1`) para o da 2.1.1 (`179014c`). O CHANGELOG também não cita as rc. Sem o
código delas, não dá para gerar os dados que elas deixavam no disco. Inventar esses dados seria testar uma
suposição, por isso o caso ficou de fora.

O que existe sobre o assunto: os testes Rust do `salvamento.rs` cobrem a sobra da rc.4
(`circuito-anterior.json.<processo>-<n>.tmp`, no teste `ao_abrir_todas_as_copias_vao_para_a_pagina_e_nada_e_apagado`)
e passaram no Linux. Para validar a cadeia de verdade, é preciso publicar as tags das rc ou entregar pastas de dados
gravadas por elas.

## Extra 1) `circuito.json` ilegível → pergunta: passou

Pasta da 2.1.0 como no caso A, com o `circuito.json` cortado ao meio (como numa queda de energia durante a escrita).

| Verificação | Resultado |
|---|---|
| Aparece a pergunta | passou |
| A pergunta lista a cópia anterior e o navegador | passou |
| Escolher a do navegador abre L1 e L2 | passou |
| O `circuito.json` ilegível foi guardado em `copias-preservadas`, com o mesmo SHA-256 (`52243452…8583`) | passou |
| `circuito.json` voltou a ser legível, com envelope | passou |

## Extra 2) Revisão no teto sem localStorage (BL-RC6-D01)

Duas gravações reais da 2.1.1 (pela ponte), a mais nova com `revisao` = 9007199254740991 (`Number.MAX_SAFE_INTEGER`).
A página abriu sem localStorage, de dois jeitos: **ausente** (`localStorage` é `undefined`) e **ilegível** (ler
`localStorage` lança `SecurityError`, como acontece no Chromium quando os dados de site estão bloqueados por
política).

| Verificação | Ausente | Ilegível |
|---|---|---|
| A 2.1.1 gravou as cópias com revisão no teto | passou | passou |
| A página não vê o localStorage | passou | passou |
| Abre sem pergunta, com T1 e T2 | passou | passou |
| Pede `migrar_circuitos` com o reinício da contagem | passou | passou |
| A contagem recomeçou (`circuito.json` com revisão 1) | passou | passou |
| O original no teto foi guardado em `copias-preservadas`, com o mesmo SHA-256 | passou | passou |
| Aviso "Contagem de salvamentos reiniciada" na tela | passou | **falhou** |
| Nenhum aviso de falha do salvamento automático | passou | **falhou** |
| Depois de 1 edição, fechar pelo X grava e fecha (`fechar`) | passou | **falhou**: `fechar_sem_gravar` |
| A edição foi gravada com revisão 2 | passou | passou |
| Reabre sem pergunta, com T1, T2 e T3 | passou | passou |

O caso pedido (localStorage ausente) passou. O caso ilegível falhou do mesmo jeito nas 4 rodadas.

## Defeitos

### Defeito 1: com o localStorage ilegível, o programa diz que o salvamento falhou, mas o arquivo foi gravado

O comentário do BL-RC6-D01 em `src/state/store.ts` (linha 1015) diz que armazenamento "ausente ou ilegível" conta como
fonte ausente. A leitura segue essa regra, mas a gravação não. Na linha 1096, a conta
`typeof localStorage === 'undefined'` lê o `localStorage`, e essa leitura lança o mesmo erro. O erro cai no `catch`, e
a gravação inteira é marcada como falha, embora a migração e o `salvar_circuito` no arquivo tenham dado certo. O
resultado:

- a barra de baixo mostra "O salvamento automático falhou: use Salvar para guardar o circuito num arquivo antes de
  fechar.", e o programa tenta de novo a cada 5 s, para sempre;
- o aviso "Contagem de salvamentos reiniciada" não aparece;
- ao fechar pelo X, a página responde `fechar_sem_gravar`, e o programa pergunta "O circuito não pôde ser gravado
  agora... Fechar assim mesmo?", embora o arquivo esteja gravado.

Nada se perde: o arquivo tem tudo, e a reabertura volta certo. O problema é o aviso falso e a pergunta ao fechar.

Passo a passo para reproduzir (com este teste):

1. `cd testes-linux/migracao && npm ci && ./preparar.sh`
2. `node migracao.mjs` e veja o caso "Extra 2) localStorage ilegível".

Passo a passo no Windows (não feito aqui): numa máquina em que o WebView2 bloqueia os dados de site (por exemplo, a
política do Edge "bloquear todos os cookies"), abra a 2.1.1, ponha uma peça e espere 1 s. A barra de baixo mostra o
aviso de falha, embora o `%LOCALAPPDATA%\Bancada Livre\circuito.json` tenha a peça nova. Clique no X: aparece a
pergunta "Fechar assim mesmo?".

Não corrigi: a tarefa proíbe mexer no código do programa.

### Defeito 2 (provável, pelo código): "Fechar sem escolher" mostra a mensagem de gravação que falhou

Na pergunta de qual versão continuar, o botão "Fechar sem escolher" chama `fechar_sem_gravar`
(`src/ui/JanelaRecuperacao.tsx`, linha 19). No `main.rs` (linha 76), esse comando mostra a caixa "O circuito não pôde
ser gravado agora, e a última mudança pode se perder se o Bancada Livre fechar. Fechar assim mesmo?". Mas, nesse
caso, ninguém tentou gravar e nada se perde, porque a pessoa decidiu adiar. A mensagem assusta sem motivo. Se a
pessoa responder "Não", a janela fica aberta, com a pergunta das versões.

O teste confirmou a primeira metade: o botão chama `fechar_sem_gravar`. A caixa de mensagem é do Windows e não aparece
no Linux, então a segunda metade vem da leitura do código.

Passo a passo no Windows (não feito aqui):

1. Com a 2.1.0, crie um circuito e feche.
2. Na pasta `%LOCALAPPDATA%\Bancada Livre`, copie o `circuito.json` para `circuito.json.tmp`, ponha uma peça a mais no
   `.tmp` e salve, para ele ficar mais novo.
3. Abra a 2.1.1: aparece a pergunta das versões.
4. Clique em "Fechar sem escolher".
5. Esperado: o programa fecha, ou pergunta algo como "Fechar sem escolher? A pergunta volta na próxima abertura".
   Obtido, pelo código: "O circuito não pôde ser gravado agora... Fechar assim mesmo?".

## Testes Rust do `salvamento.rs` no Linux

`cargo test` sobre o `salvamento.rs` da v2.1.1 **não compila no Linux**. O teste `atual_preso_nao_perde_nenhuma_copia`
usa a função `prender`, que usa `std::os::windows::fs::OpenOptionsExt`. Isso não afeta o programa, que é só para
Windows. Mas os testes Rust só rodam no Windows: um `cargo test` no Ubuntu do GitHub Actions falharia.

Para rodar o resto no Linux, uma cópia do arquivo **fora do repositório** recebeu `#[cfg(windows)]` só nesse teste e
na função `prender`. Resultado: **24 de 25 passaram**, e o 25º ficou de fora por ser só do Windows. Isso inclui todos
os testes da migração: `migracao_silenciosa_pelo_atual_mantem_a_reserva_de_antes`,
`so_pergunta_sem_atual_bom_ou_com_temporario_mais_novo`,
`falha_no_meio_da_migracao_nao_perde_original_e_a_repeticao_completa`,
`reinicio_registra_o_par_do_navegador_e_a_repeticao_nao_duplica` e os outros.

## O que não foi testado

- A janela do programa (Tauri e WebView2), as caixas de mensagem do Windows, o `sistema.rs` e o `instalacao.rs`.
- A cadeia das rc (caso C), porque não há código público delas.
- Disco cheio, antivírus segurando arquivo, queda de energia de verdade e o NTFS: o disco foi o do Linux (ext4 ou
  overlay), onde a troca de nome também é atômica, mas não é o mesmo sistema de arquivos.
- Migração de pastas com muitas cópias ou circuitos grandes.
