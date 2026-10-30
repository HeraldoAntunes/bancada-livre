<!-- Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT -->
# Segurança e privacidade

## Como o Bancada Livre protege o computador e os dados

- **Funciona offline.** O simulador é distribuído como HTML único para o navegador e, no Windows, em zips com uma
  janela própria Tauri/WebView2. Não exige servidor nem conta para montar, simular e salvar circuitos; não tem
  telemetria da aplicação, anúncios nem rastreamento. Extraia o zip antes de abrir o executável.
- **Política de segurança no próprio arquivo.** O HTML traz uma `Content-Security-Policy` que só deixa rodar o
  script embutido (liberado pelo hash SHA-256 dele) e bloqueia requisições da página à rede, imagens externas,
  formulários e plug-ins. Essa política não controla conexões próprias do WebView2 nem serviços do navegador.
- **Privacidade do componente da janela.** O WebView2 pode abrir conexões próprias com a Microsoft, mesmo com as
  restrições configuradas pelo programa. Não há garantia de ausência total de tráfego. O botão de verificar versão
  abre a página do projeto no navegador somente quando acionado.
- **Arquivos de circuito validados.** O circuito tem teto de 2 milhões de caracteres, tanto na abertura manual
  quanto na recuperação automática. O envelope opcional `salvamento: { hora, revisao }` tem tolerância de até 128
  caracteres adicionais. Antes de interpretar JSON, a página recusa texto acima de 2.000.128 caracteres e texto acima
  de 2 milhões sem a chave de salvamento. Depois de interpretar, desconta só o tamanho compacto dos metadados
  serializados: esse acréscimo deve caber nos 128 e o restante deve continuar dentro de 2 milhões.
  Hora e revisão precisam ser inteiros seguros não negativos. Essa tolerância não amplia o espaço das peças e fios.
  A página confere tipos, pinos, fios, ids únicos entre peças e fios, sem `:`, e coordenadas finitas de até 1.000.000
  em módulo. Uma revisão só entra na seleção e no contador após validar o circuito inteiro.
  Se algo estiver errado, a abertura manual mostra aviso sem mexer na bancada. Os textos do arquivo aparecem sempre
  como texto, nunca como código.
- **Salvamento local.** No navegador, o circuito fica no localStorage. No Windows, também há o arquivo
  `%LOCALAPPDATA%\Bancada Livre\circuito.json` e uma reserva `circuito-anterior.json`. Circuito, hora e revisão do
  autosave são gravados num envelope único; formatos antigos continuam sendo lidos. Entre envelopes válidos,
  vence a maior revisão, depois a hora do envelope. Se houver legado divergente, a pessoa escolhe a versão; fechar
  sem escolher não substitui as fontes. Falha no armazenamento do navegador não impede tentar as cópias nativas.
  Na migração, originais devem ser arquivados antes de converter fontes ativas. No navegador ficam em
  `simulador-portas:copias-recuperadas`, sem participar da seleção automática. O reinício de revisão saturada também
  exige preservar os originais. No Windows, o programa faz isso pelo comando `migrar_circuitos`, conforme
  [o contrato de arquitetura](../docs/ARQUITETURA.md#migração-e-ponte-nativa): os originais vão para
  `%LOCALAPPDATA%\Bancada Livre\copias-preservadas` antes de converter as cópias ativas, e o registro do reinício fica
  na mesma pasta. Sem confirmação explícita do programa, essa gravação é bloqueada e o aviso permanece.
  Uma cópia recusada é preservada à parte quando possível.
  Salve também um `.json` para guardar ou entregar: queda de energia e encerramento forçado podem perder alterações
  ainda não gravadas. As preferências e o perfil da janela também ficam no computador.
- **CSV conferível.** A exportação protege os prefixos de fórmula `=`, `+`, `-` e `@` com apóstrofo; o leitor do
  gabarito restaura os nomes para comparação. Essa proteção não torna seguro outro conteúdo aberto numa planilha.
- **Arquivo conferível.**
  - Cada versão vem com `SHA256SUMS.txt`.
  - Cada anexo da release vem com uma assinatura do Sigstore (`<arquivo>.sigstore.json`), feita pelo workflow
    `assinar-release.yml` deste repositório. Ela confirma que o arquivo é o mesmo publicado na release. Para conferir
    (com o [cosign](https://docs.sigstore.dev/cosign/system_config/installation/)):
    `cosign verify-blob --bundle <arquivo>.sigstore.json --certificate-identity-regexp "^https://github.com/HeraldoAntunes/bancada-livre/.github/workflows/assinar-release.yml@" --certificate-oidc-issuer https://token.actions.githubusercontent.com <arquivo>`
  - A release também traz um atestado de origem (SLSA), `bancada-livre-<versão>.intoto.jsonl`, que liga cada
    anexo ao workflow que o publicou. Com o [GitHub CLI](https://cli.github.com/), basta:
    `gh attestation verify <arquivo> --repo HeraldoAntunes/bancada-livre`

## Versões com suporte

Só a versão mais recente recebe correções de segurança. A versão em uso aparece no canto superior direito do
simulador e na janela **Sobre**.

## Como relatar uma vulnerabilidade

Não abra uma *issue* pública com os detalhes da falha. Use o aviso privado do GitHub: no repositório, aba
**Security**, botão **Report a vulnerability**. Informe a versão, o passo a passo para reproduzir e o impacto.

O que esperar:
- confirmação de recebimento em até 7 dias;
- avaliação e plano de correção em até 30 dias;
- a correção sai numa versão nova, com a falha descrita no CHANGELOG e no aviso de segurança publicado depois da
  correção (divulgação coordenada). Quem relatou recebe crédito, se quiser.

Correções de segurança têm prioridade sobre qualquer outro trabalho no projeto.
