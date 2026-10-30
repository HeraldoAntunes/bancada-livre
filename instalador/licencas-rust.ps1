# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Inventário das bibliotecas Rust que entram no BancadaLivre.exe (alvo Windows, sem as de montagem e de teste), com
# versão e licença, tirado do Cargo.lock pelo cargo tree. Fica na seção "Bibliotecas Rust do programa" do
# THIRD-PARTY-NOTICES.md (auditoria de 30/10/2026: antes era só uma remissão ao Cargo.lock).
# Uso:  pwsh -File instalador\licencas-rust.ps1            confere; sai com 1 se a seção estiver desatualizada
#       pwsh -File instalador\licencas-rust.ps1 -Escrever  reescreve a seção
param([switch]$Escrever)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$env:Path += ";$env:USERPROFILE\.cargo\bin"
$titulo = '### Bibliotecas Rust do programa'
Push-Location (Join-Path $raiz 'src-tauri')
try {
  $saida = cargo tree --locked --target x86_64-pc-windows-msvc -e normal --prefix none --format '{p}|{l}'
  if ($LASTEXITCODE) { throw 'o cargo tree falhou' }
} finally { Pop-Location }
# ordem ordinal, a mesma no Windows PowerShell 5.1 (que roda o build) e no PowerShell 7 (Sort-Object depende do idioma)
$unicas = [string[]]($saida | ForEach-Object { $_ -replace ' \((\*|proc-macro)\)', '' } | Where-Object { $_ -notmatch '^bancada-livre ' } |
  Select-Object -Unique)
[Array]::Sort($unicas, [StringComparer]::Ordinal)
$linhas = $unicas | ForEach-Object {
    $nome, $licenca = $_ -split '\|', 2
    $partes = $nome -split ' v', 2
    "| $($partes[0]) | $($partes[1]) | $(if ($licenca) { $licenca } else { 'sem licença declarada' }) |"
  }
$secao = @(
  $titulo,
  '',
  "As $($linhas.Count) bibliotecas Rust do BancadaLivre.exe (as que vão dentro dele e as macros usadas para compilá-lo),",
  'com a versão exata do src-tauri/Cargo.lock.',
  'Gerada por instalador/licencas-rust.ps1; o build confere se ela está em dia. Quando há mais de uma licença ("MIT OR',
  'Apache-2.0"), o uso é sob qualquer uma delas. Os textos completos, como vêm em cada biblioteca, estão no',
  'THIRD-PARTY-RUST.md, que acompanha o programa. As de licença MPL-2.0 vêm sem alteração, e o código delas está no',
  'crates.io.',
  '',
  '| Biblioteca | Versão | Licença |',
  '|-|-|-|'
) + $linhas
$arquivo = Join-Path $raiz 'THIRD-PARTY-NOTICES.md'
$texto = [IO.File]::ReadAllText($arquivo)
$nova = ($secao -join "`n") + "`n"
$inicio = $texto.IndexOf($titulo)
$atual = if ($inicio -ge 0) {
  $fim = $texto.IndexOf("`n#", $inicio + $titulo.Length)
  if ($fim -lt 0) { $texto.Substring($inicio) } else { $texto.Substring($inicio, $fim - $inicio + 1) }
} else { '' }
$desatualizado = $false
if ($atual.TrimEnd() -eq $nova.TrimEnd()) { "THIRD-PARTY-NOTICES: as $($linhas.Count) bibliotecas Rust estão em dia" }
elseif (-not $Escrever) { Write-Host 'THIRD-PARTY-NOTICES: a lista das bibliotecas Rust está desatualizada (rode instalador\licencas-rust.ps1 -Escrever)'; $desatualizado = $true }
else {
  if ($inicio -ge 0) { $texto = $texto.Remove($inicio, $atual.Length).Insert($inicio, $nova + "`n") }
  else {
    # a seção entra no fim da parte do Windows, antes da próxima seção de nível 2
    $windows = $texto.IndexOf('## Versão para Windows')
    $depois = $texto.IndexOf("`n## ", $windows + 5)
    $texto = $texto.Insert($depois + 1, $nova + "`n")
  }
  [IO.File]::WriteAllText($arquivo, $texto, [Text.UTF8Encoding]::new($false))
  "THIRD-PARTY-NOTICES: seção das bibliotecas Rust reescrita ($($linhas.Count))"
}
# os textos das licenças, da mesma lista, vão para o THIRD-PARTY-RUST.md (auditoria da rc.5)
$listaArq = [IO.Path]::GetTempFileName()
try {
  [IO.File]::WriteAllText($listaArq, ($unicas -join "`n"), [Text.UTF8Encoding]::new($false))
  $argsNode = @((Join-Path $PSScriptRoot 'licencas-rust-textos.mjs'), $listaArq) + $(if ($Escrever) { '--escrever' } else { @() })
  node @argsNode
  if ($LASTEXITCODE) { $desatualizado = $true }
} finally { Remove-Item $listaArq -ErrorAction SilentlyContinue }
if ($desatualizado) { exit 1 }
