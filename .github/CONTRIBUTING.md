<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Como contribuir

Obrigado pelo interesse! O Bancada Livre é software livre (MIT), feito para aulas de lógica digital.

- **Relatar um problema:** abra uma *issue* com a versão (aparece no canto superior direito), o navegador, o
  passo a passo e, se possível, o circuito salvo (`.json`) ou um print. Problemas de segurança vão pelo caminho
  descrito em [SECURITY.md](SECURITY.md).
- **Propor uma melhoria:** descreva a situação de aula que ela resolve.
- **Enviar código:**
  1. O núcleo de simulação (`src/engine/`) não depende da interface e tem testes próprios: mudança nele vem com
     teste. Para entender o código, leia `docs/ARQUITETURA.md`.
  2. Sem dependência nova sem discutir antes numa *issue*. O resultado precisa continuar sendo um único arquivo HTML
     que funciona offline e não acessa a rede.
  3. O formato do circuito salvo (`.json`) é compromisso com quem já tem arquivos: mudança que quebre a abertura de
     circuitos antigos só numa versão nova do primeiro número (2.0.0).
  4. Antes do *pull request*, rode `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build` (todos devem
     passar). Mudança de comportamento vem com teste que falha sem ela.
  5. Textos da interface em português do Brasil, com acentuação correta e sem travessão. Ícones novos são desenhados
     em `src/ui/icons.tsx`, sem emoji.
  6. Todo arquivo de código novo começa com a linha de cabeçalho de autoria e licença (`SPDX-License-Identifier: MIT`).

Ao contribuir, você concorda em licenciar a sua contribuição sob a licença MIT do projeto e em seguir o
[Código de Conduta](CODE_OF_CONDUCT.md).

## Uso de IA generativa

Assistentes de programação de IA podem ser usados como ferramenta, inclusive pelo autor do projeto. A regra segue a
prática de projetos como o kernel do Linux:

- **A responsabilidade é de quem envia.** A pessoa revisa e entende todo o código, confere que nada foi copiado de
  fonte com licença incompatível com a MIT e responde pela contribuição. A IA não é autora nem coautora.
- **Declare o uso no commit**, com a linha final `Assisted-by: <ferramenta>:<modelo>`, por exemplo
  `Assisted-by: Claude:claude-opus-5-5`. Não use `Co-authored-by` para ferramentas: ele é reservado a pessoas.
- **Diga no *pull request*** o que a ferramenta fez e o que foi verificado (testes rodados, comportamento conferido).
  Relato de falha encontrado com ajuda de IA precisa de passo a passo que reproduza o problema.
