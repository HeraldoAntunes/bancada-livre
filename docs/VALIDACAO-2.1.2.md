<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Validação das correções a caminho da 2.1.2, no Linux

Teste feito em 02/11/2026 sobre a `main` pública, no commit `3d05d88` ("README: selo situação estável"). As correções
estão no commit `15b5859` ("Avisos de segurança e correções a caminho da 2.1.2"). O commit `be8f4fb`, citado no pedido,
não existe no repositório público: a cópia pública junta os commits do código privado num só. O `package.json` ainda
diz 2.1.1, porque não há versão nova.

É o registro de um teste, não uma promessa de suporte: o programa com janela própria é só para Windows. A bateria é a
mesma do ramo `migracao-2.1.1` (veja o `docs/VALIDACAO-MIGRACAO-2.1.1.md` daquele ramo), ajustada ao que mudou.

## Resumo

| Item | Resultado |
|---|---|
| `npm ci`, lint, tipos e build | **passou** |
| `npm test` (Vitest) | **passou**: 47 arquivos, 529 testes |
| `cargo test` em `src-tauri` | **falhou**: não compila no Linux (veja abaixo) |
| Testes do `salvamento.rs` sozinho, **sem nenhuma mudança** no arquivo | **passou**: 24 de 24 (o teste só do Windows fica de fora sozinho) |
| A) 2.1.0 → código da main, sem pergunta | **passou** (14 de 14) |
| B) temporário mais novo; "Fechar sem escolher" agora chama `fechar` | **passou** (15 de 15) |
| Principal ilegível → pergunta | **passou** (5 de 5) |
| localStorage **ausente**, revisão no teto | **passou** (12 de 12) |
| localStorage que **lança ao ler**, revisão no teto: sem aviso falso e sem nova tentativa a cada 5 s | **passou** (12 de 12) |

A bateria inteira teve 58 verificações e passou nas 4 rodadas contra a main. Nas 2 primeiras, a verificação "nenhuma
nova tentativa" contava só os pedidos ao disco; nas 2 últimas, conta também os acessos ao localStorage (veja abaixo). Na mesma bateria, a 2.1.1 falha nas 5
verificações que pegam os dois defeitos achados na validação dela. Isso mostra que o teste enxerga o que foi
corrigido.

## O que mudou na bateria

O roteiro `testes-linux/migracao/migracao.mjs` veio do ramo `migracao-2.1.1`, com duas mudanças:

1. No caso B, "Fechar sem escolher" agora deve chamar `fechar`. Na 2.1.1 chamava `fechar_sem_gravar`, e o programa
   perguntava "Fechar assim mesmo?".
2. No Extra 2 (os dois modos), uma verificação nova: depois de uma edição, com o circuito parado por 12 s, a página não
   pode tentar gravar de novo. A verificação conta os pedidos `salvar_circuito` à ponte e cada acesso ao
   `localStorage` (o acesso falso conta as chamadas).

O resto é igual: a ponte Rust inclui o `src-tauri/src/salvamento.rs` real, o HTML roda no Chromium sem janela e os
dados antigos são criados pela própria 2.1.0 (HTML e `salvamento.rs` da tag `v2.1.0`).

### Controle: a mesma bateria contra a 2.1.1

| Verificação | 2.1.1 (tag `v2.1.1`) | main (`3d05d88`) |
|---|---|---|
| B: "Fechar sem escolher" pede `fechar` | falhou (`fechar_sem_gravar`) | passou |
| Ilegível: aviso "Contagem de salvamentos reiniciada" | falhou | passou |
| Ilegível: nenhum aviso de falha do salvamento automático | falhou | passou |
| Ilegível: parado por 12 s, nenhuma nova tentativa de gravar | falhou (3 acessos ao localStorage em 12 s) | passou (0) |
| Ilegível: depois de 1 edição, fechar pelo X responde `fechar` | falhou (`fechar_sem_gravar`) | passou |
| Total | 53 de 58 | 58 de 58 |

## Arquivos usados (SHA-256)

| Arquivo | SHA-256 |
|---|---|
| HTML da main (`dist/index.html`), montado no Linux | `c9e054d1a2e4a2e4f6e80330dee533db39e12236aa47b8a937698a87e88c898b` (346.874 bytes) |
| HTML da 2.1.0, montado no Linux | `0bf92518ab9b0b517584cef2baa28efd9bfdcc2358e6b9e807c8f2ebd5594866` (igual ao publicado) |
| HTML da 2.1.1 (controle) | `47eaeab93177bc9d0aec99c984f1222c5e8a66ea4c3babed6329bb44f65a17ab` (igual ao publicado) |
| `src-tauri/src/salvamento.rs` da main | `b21c860fff029e02a701c7984341c08d2c865561663a4448d14d00172efa594c` |
| `src-tauri/src/salvamento.rs` da v2.1.0 | `91d1a39a460feb48fb89f53c1ad3d9d7bc1a2e11cf35262d59765fac1c2f866a` |

O HTML da main ainda não foi publicado, então não há SHA-256 publicado para comparar.

O computador: Ubuntu 24.04.5 LTS (x86_64, contêiner sem tela), Node.js 22.22.0, npm 10.9.4, Rust 1.97.0, Chromium
153.0.8010.12 sem janela, `puppeteer-core` 25.14.0. Para o `cargo test` em `src-tauri`, foram instalados os pacotes
do Ubuntu `libwebkit2gtk-4.1-dev` (2.52.6), `libgtk-3-dev` (3.24.41), `librsvg2-dev` e `libsoup-3.0-dev`.

## Comandos

Na raiz, no ramo `validacao-2.1.2` (que parte da `main`):

```bash
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
```

```bash
sha256sum dist/index.html
```

```bash
cd src-tauri && cargo test
```

A bateria da migração:

```bash
cd testes-linux/migracao && npm ci && ./preparar.sh
```

```bash
node migracao.mjs
```

O resultado de cada verificação, com o SHA-256 de cada arquivo da pasta de dados em cada etapa, fica em
`testes-linux/migracao/saida/resultado-migracao.json`. Os SHA-256 dos circuitos mudam a cada rodada, porque o circuito
leva a hora e as peças caem em posições sorteadas.

## `cargo test` em `src-tauri`: não compila no Linux

O teste do `salvamento.rs` que só existe no Windows agora tem `#[cfg(windows)]`, como dito no pedido. Mesmo assim,
`cargo test` em `src-tauri` não compila no Linux, por dois motivos que não têm a ver com o `salvamento.rs`:

1. **Falta o ícone para Linux.** O `tauri::generate_context!()` (`src/main.rs`, linha 199) para com "failed to open
   icon .../src-tauri/icons/icon.png: No such file or directory". O `tauri.conf.json` só aponta o
   `../instalador/bancada-livre.ico`, e fora do Windows o Tauri procura `icons/icon.png`, que não está no repositório
   público.
2. **Outro teste só do Windows sem `#[cfg(windows)]`.** Em `src/instalacao.rs`, linhas 541 a 544, a função `prender`
   usa `std::os::windows::fs::OpenOptionsExt` e `share_mode`. Os testes desse módulo também usam o registro do
   Windows (`HKCU`).

Antes disso, sem as bibliotecas GTK e WebKit do Linux, o `cargo test` já parava em `gdk-sys` ("The system library
`gdk-3.0` ... was not found").

Isso não afeta o programa, que é só para Windows. Mas significa que os testes Rust de `src-tauri` só rodam no Windows.
Não corrigi: a tarefa proíbe mexer no programa.

Para rodar mesmo assim os testes do `salvamento.rs` no Linux, o arquivo foi copiado **sem nenhuma mudança** (mesmo
SHA-256) para um projeto Rust à parte, só com o `serde_json`. Resultado: **24 passaram, 0 falharam**. O teste
`atual_preso_nao_perde_nenhuma_copia` fica de fora sozinho pelo `#[cfg(windows)]`. Na 2.1.1 essa cópia não
compilava sem mexer no arquivo; agora compila.

## Casos

### A) 2.1.0 → código da main, sem pergunta: passou (14 de 14)

Os dados foram criados pela 2.1.0: `circuito.json` (L1 e L2) e `circuito-anterior.json` (só L1), sem envelope e
diferentes. Resultado: abre sem pergunta, com L1 e L2. O `circuito.json` ganha envelope (revisão 1). O anterior vira
a conversão do anterior de antes (revisão 0). Os dois originais estão em `copias-preservadas`, com o mesmo SHA-256.
Depois de 1 edição, fechar pelo X responde `fechar`, e a reabertura volta sem pergunta, com L1, L2 e L3.
`copias-preservadas` não muda, e não há erro na página.

### B) Temporário mais novo: passou (15 de 15)

Os dados da 2.1.0 vêm com um `circuito.json.tmp` íntegro, 60 s mais novo que o principal, como a 2.1.0 deixa quando cai
no meio da troca. A pergunta aparece, com as 4 versões. **"Fechar sem escolher" chama `fechar`.** Com a pergunta
aberta, nada é pedido ao disco. Depois de fechar, os 3 arquivos têm o mesmo SHA-256 de antes, e o localStorage também
não muda. Ao reabrir, a pergunta volta. Escolher a gravação interrompida abre L1, L2 e L3, faz a migração, guarda os 3
originais (e o do navegador) com o mesmo SHA-256 e tira o temporário. A reabertura volta sem pergunta.

### Principal ilegível: passou (5 de 5)

Com o `circuito.json` cortado ao meio, a pergunta aparece e lista a cópia anterior e a do navegador. Escolher a do
navegador abre L1 e L2. O arquivo estragado é guardado em `copias-preservadas` com o mesmo SHA-256, e o
`circuito.json` volta a ser legível, com envelope.

### Revisão no teto sem localStorage (BL-RC6-D01): passou nos dois modos (12 de 12 cada)

Duas gravações reais da ponte, a mais nova com `revisao` = 9007199254740991. A página abre com o `localStorage`
**ausente** (`undefined`) ou **ilegível** (ler lança `SecurityError`, como com os dados de site bloqueados por
política). Nos dois modos:

- abre sem pergunta, com T1 e T2, e pede `migrar_circuitos` com o reinício da contagem;
- o `circuito.json` fica com a revisão 1, e o original no teto vai para `copias-preservadas` com o mesmo SHA-256;
- aparece "Contagem de salvamentos reiniciada", sem aviso de falha do salvamento automático;
- depois de 1 edição, parado por 12 s: **nenhuma nova tentativa de gravar** (0 acessos);
- fechar pelo X responde `fechar`, a edição fica gravada com revisão 2, e a reabertura volta com T1, T2 e T3.

## O que não foi testado

- A janela do programa (Tauri e WebView2), as caixas de mensagem do Windows, o `sistema.rs` e o `instalacao.rs`.
- Os testes Rust de `main.rs`, `sistema.rs` e `instalacao.rs`, porque não compilam no Linux.
- A cadeia das versões rc, que não têm código público.
- O NTFS, antivírus segurando arquivo, disco cheio e queda de energia de verdade.
