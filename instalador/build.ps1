# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Monta o HTML único e o programa do Windows (Tauri, em src-tauri) do Bancada Livre, que se instala sozinho (sem
# Inno Setup), mais o zip "para escola sem internet"; verifica no Microsoft Defender e escreve pacote\SHA256SUMS.txt.
# Uso:  powershell -ExecutionPolicy Bypass -File instalador\build.ps1
# A versão vem só do package.json e vai para o programa (tauri.conf.json lê o package.json). Tudo sai na pasta
# pacote\ (ignorada pelo Git).
# -SemDefender: para o GitHub Actions (workflow pc-limpo), onde o Defender da máquina virtual não serve de prova.
param([switch]$SemDefender)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
Set-Location $raiz
$env:Path += ";$env:USERPROFILE\.cargo\bin"
$versao = (Get-Content package.json -Raw | ConvertFrom-Json).version
if ($versao -notmatch '^\d+\.\d+\.\d+$') { throw "versão inválida no package.json: $versao" }
$cargo = (Select-String -Path src-tauri\Cargo.toml -Pattern '^version = "(.+)"').Matches[0].Groups[1].Value
if ($cargo -ne $versao) { throw "src-tauri\Cargo.toml está na versão $cargo e o package.json na $versao" }
"Bancada Livre $versao"

# 1) o simulador: HTML único (testes e linter antes)
npm run lint | Out-Host; if ($LASTEXITCODE) { throw 'o linter acusou problemas' }
npm test | Out-Host; if ($LASTEXITCODE) { throw 'os testes falharam' }
npm run build | Out-Host; if ($LASTEXITCODE) { throw 'o build do HTML falhou' }

# 2) o programa: o mesmo HTML embutido numa janela própria (WebView2); testes do salvamento em arquivo antes
Push-Location src-tauri
cargo test --release | Out-Host; if ($LASTEXITCODE) { Pop-Location; throw 'os testes do programa falharam' }
# o cargo não percebe sozinho a versão nova no package.json: recompila o programa sempre
cargo clean --release -p bancada-livre | Out-Host
cargo build --release | Out-Host; if ($LASTEXITCODE) { Pop-Location; throw 'a compilação do programa falhou' }
Pop-Location
$exe = 'src-tauri\target\release\BancadaLivre.exe'
if (-not (Test-Path $exe)) { throw 'o cargo não gerou o BancadaLivre.exe' }
$exever = (Get-Item $exe).VersionInfo.ProductVersion
if ($exever -ne $versao) { throw "o BancadaLivre.exe saiu com a versão $exever, e o package.json está na $versao" }

# limpa o pacote anterior, menos a pasta dos arquivos separados para o VirusTotal
Get-ChildItem pacote -ErrorAction SilentlyContinue | Where-Object Name -ne 'para-virustotal' | Remove-Item -Recurse -Force
New-Item -ItemType Directory -Force pacote\work | Out-Null
$html = "pacote\BancadaLivre-$versao.html"
Copy-Item dist\index.html $html

# 3) o programa para baixar: um arquivo só, que se instala sozinho (ou roda sem instalar)
$programa = "pacote\BancadaLivre-$versao.exe"
Copy-Item $exe $programa

# 4) zip "para escola sem internet": o programa e, ao lado dele, o instalador oficial do WebView2 da Microsoft
#    (completo, ~190 MB), conferido aqui pela assinatura; o programa o oferece se faltar o WebView2
$wv2 = 'pacote\work\MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
Invoke-WebRequest 'https://go.microsoft.com/fwlink/?linkid=2124701' -OutFile $wv2 -UseBasicParsing
$assin = Get-AuthenticodeSignature $wv2
if ($assin.Status -ne 'Valid' -or $assin.SignerCertificate.Subject -notmatch '^CN=Microsoft Corporation,') {
  throw "instalador do WebView2 sem assinatura válida da Microsoft ($($assin.Status))"
}
$semInternet = 'pacote\work\sem-internet'
New-Item -ItemType Directory -Force $semInternet | Out-Null
Copy-Item $exe "$semInternet\BancadaLivre.exe"
Copy-Item $wv2, LICENSE, THIRD-PARTY-NOTICES.md $semInternet
$zip = "pacote\BancadaLivre-$versao-sem-internet.zip"
Compress-Archive -Path "$semInternet\*" -DestinationPath $zip
Remove-Item -Recurse -Force pacote\work

# 5) verificação no Microsoft Defender (0 = nada encontrado)
$mp = "$env:ProgramFiles\Windows Defender\MpCmdRun.exe"
foreach ($alvo in @((Resolve-Path $programa).Path, (Resolve-Path $zip).Path, (Resolve-Path $html).Path) | Where-Object { -not $SemDefender }) {
  $r = & $mp -Scan -ScanType 3 -File $alvo -DisableRemediation 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "Defender acusou algo (código $LASTEXITCODE) em $alvo`n$r" }
  "Defender OK: $alvo"
}

# 6) hashes para conferência + versões das ferramentas usadas
$rust = (& rustc --version) -replace '^rustc (\S+).*', '$1'
$tauri = (Select-String -Path src-tauri\Cargo.lock -Pattern '^name = "tauri"$' -Context 0, 1).Context.PostContext[0] -replace '.*"(.+)"', '$1'
$linhas = Get-ChildItem pacote -File | Where-Object Name -ne 'SHA256SUMS.txt' | ForEach-Object {
  "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name
}
$linhas += "# Bancada Livre $versao - Rust $rust - Tauri $tauri - gerado em $(Get-Date -Format 'yyyy-MM-dd') (PC do mantenedor)"
$linhas | Set-Content pacote\SHA256SUMS.txt -Encoding ASCII
Get-Content pacote\SHA256SUMS.txt
