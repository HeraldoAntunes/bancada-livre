#!/usr/bin/env bash
# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Prepara o teste da migração 2.1.0 → 2.1.1: monta o HTML de cada versão a partir das tags e compila a ponte duas
# vezes (com o salvamento.rs da v2.1.0 e com o desta versão). Tudo vai para $SAIDA (padrão: testes-linux/migracao/saida).
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
SAIDA="${SAIDA:-$AQUI/saida}"
mkdir -p "$SAIDA"
# HTML da 2.1.0, montado numa cópia de trabalho separada da tag
rm -rf "$SAIDA/v2.1.0-fonte"
git -C "$RAIZ" worktree add --detach "$SAIDA/v2.1.0-fonte" v2.1.0 >/dev/null
(cd "$SAIDA/v2.1.0-fonte" && npm ci --silent && npm run build --silent >/dev/null)
cp "$SAIDA/v2.1.0-fonte/dist/index.html" "$SAIDA/BancadaLivre-2.1.0.html"
git -C "$RAIZ" worktree remove --force "$SAIDA/v2.1.0-fonte"
# HTML desta versão
(cd "$RAIZ" && npm run build --silent >/dev/null)
cp "$RAIZ/dist/index.html" "$SAIDA/BancadaLivre-atual.html"
# ponte com o salvamento.rs da v2.1.0 e com o desta versão
mkdir -p "$AQUI/ponte/v2.1.0"
git -C "$RAIZ" show v2.1.0:src-tauri/src/salvamento.rs > "$AQUI/ponte/v2.1.0/salvamento.rs"
export CARGO_TARGET_DIR="$SAIDA/alvo"
(cd "$AQUI/ponte" && cargo build --release --quiet --features v210 && cp "$CARGO_TARGET_DIR/release/ponte-salvamento" "$SAIDA/ponte-2.1.0")
(cd "$AQUI/ponte" && cargo build --release --quiet && cp "$CARGO_TARGET_DIR/release/ponte-salvamento" "$SAIDA/ponte-atual")
sha256sum "$SAIDA"/BancadaLivre-*.html "$RAIZ/src-tauri/src/salvamento.rs" "$AQUI/ponte/v2.1.0/salvamento.rs"
