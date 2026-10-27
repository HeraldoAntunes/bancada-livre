<!-- Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT -->
# Segurança e privacidade

## Como o Bancada Livre protege o computador e os dados

- **Funciona offline e não envia nada.** É um único arquivo HTML que roda no navegador. Não tem servidor, contas,
  telemetria, anúncios nem rastreamento.
- **Política de segurança no próprio arquivo.** O HTML traz uma `Content-Security-Policy` que só deixa rodar o
  script embutido (liberado pelo hash SHA-256 dele) e bloqueia qualquer acesso à rede, imagens externas, formulários
  e plug-ins.
- **Arquivos de circuito validados.** Ao abrir um `.json`, o simulador recusa arquivo acima de 2 milhões de
  caracteres, confere a estrutura (tipos de componente, pinos e fios) antes de carregar e, se algo estiver errado,
  mostra um aviso sem mexer na bancada. Os textos do arquivo aparecem sempre como texto, nunca como código.
- **Dados só no seu navegador.** O salvamento automático usa o armazenamento local do navegador, no seu computador.
- **Arquivo conferível.**
  - Cada versão vem com `SHA256SUMS.txt`.
  - Cada anexo da release vem com uma assinatura do Sigstore (`<arquivo>.sigstore.json`), feita pelo workflow
    `assinar-release.yml` deste repositório. Ela confirma que o arquivo é o mesmo publicado na release. Para conferir
    (com o [cosign](https://docs.sigstore.dev/cosign/system_config/installation/)):
    `cosign verify-blob --bundle <arquivo>.sigstore.json --certificate-identity-regexp "^https://github.com/HeraldoAntunes/bancada-livre/.github/workflows/assinar-release.yml@" --certificate-oidc-issuer https://token.actions.githubusercontent.com <arquivo>`

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
