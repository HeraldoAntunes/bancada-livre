#!/usr/bin/env bash
# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Monta o HTML desta versão e os das versões antigas (v1.0.2 e v2.0.3, das tags), para o teste de arquivos antigos.
# Tudo vai para $SAIDA (padrão: testes-linux/ponta-a-ponta/saida).
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
SAIDA="${SAIDA:-$AQUI/saida}"
mkdir -p "$SAIDA/html"
(cd "$RAIZ" && npm run build --silent >/dev/null)
cp "$RAIZ/dist/index.html" "$SAIDA/html/BancadaLivre-atual.html"
for tag in v1.0.2 v2.0.3; do
  fonte="$SAIDA/fonte-$tag"
  rm -rf "$fonte"
  git -C "$RAIZ" worktree add --detach "$fonte" "$tag" >/dev/null
  (cd "$fonte" && npm ci --silent >/dev/null && npm run build --silent >/dev/null)
  cp "$fonte/dist/index.html" "$SAIDA/html/BancadaLivre-${tag#v}.html"
  git -C "$RAIZ" worktree remove --force "$fonte"
done
sha256sum "$SAIDA"/html/*.html
