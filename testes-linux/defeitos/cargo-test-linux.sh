#!/usr/bin/env bash
# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Defeito (validação no Linux da 2.1.2): "cargo test" em src-tauri não compila no Linux, mesmo com as bibliotecas do
# Tauri para Linux (libwebkit2gtk-4.1-dev, libgtk-3-dev, librsvg2-dev, libsoup-3.0-dev). Dois motivos:
#   1. tauri::generate_context!() procura src-tauri/icons/icon.png, que não existe (o tauri.conf.json só tem o .ico);
#   2. src-tauri/src/instalacao.rs tem uma função de teste "prender" que usa std::os::windows sem #[cfg(windows)].
# ESTE TESTE FALHA na 2.1.2 de propósito: passa quando o cargo test compilar e passar no Linux.
# Os arquivos do cargo vão para uma pasta temporária, fora do repositório.
set -uo pipefail
cd "$(dirname "$0")/../../src-tauri" || exit 2
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$(mktemp -d)}"
saida="$(cargo test 2>&1)"
codigo=$?
echo "$saida" | grep -E "^error|failed to open icon|^test result" | head -10
if [ "$codigo" -ne 0 ]; then
  echo "FALHOU: cargo test em src-tauri saiu com código $codigo"
  exit 1
fi
echo passou
