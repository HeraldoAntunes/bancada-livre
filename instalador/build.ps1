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
# o inventário das bibliotecas Rust no THIRD-PARTY-NOTICES (que vai no HTML, no exe e nos zips) tem de estar em dia
& (Join-Path $PSScriptRoot 'licencas-rust.ps1') | Out-Host; if ($LASTEXITCODE) { throw 'THIRD-PARTY-NOTICES desatualizado' }
npm test | Out-Host; if ($LASTEXITCODE) { throw 'os testes falharam' }
npm run build | Out-Host; if ($LASTEXITCODE) { throw 'o build do HTML falhou' }

# 2) o programa: o mesmo HTML embutido numa janela própria (WebView2); testes do salvamento em arquivo antes
# os caminhos desta máquina (pasta do usuário e do projeto) não entram no exe: o Rust guarda nos textos de erro o
# caminho de cada arquivo-fonte (achado na 2.1.1-rc.1). Separador \x1f porque os caminhos têm espaço.
$env:CARGO_ENCODED_RUSTFLAGS = @(
  "--remap-path-prefix=$env:USERPROFILE\.cargo=C:\cargo",
  "--remap-path-prefix=$env:USERPROFILE\.rustup=C:\rustup",
  "--remap-path-prefix=$raiz=C:\bancada-livre"
) -join [char]0x1f
# A macro de contexto do Tauri ainda guarda a pasta src-tauri como texto, que o remapeamento não alcança: o cargo roda
# numa letra de unidade provisória (subst, só nesta sessão do Windows), desfeita no fim, também se der erro.
$letra = [char[]](70..90) | Where-Object { -not (Test-Path "${_}:\") } | Select-Object -Last 1
if (-not $letra) { throw 'nenhuma letra de unidade livre para compilar' }
subst "${letra}:" $raiz; if ($LASTEXITCODE) { throw "não foi possível criar a unidade ${letra}:" }
try {
  Push-Location "${letra}:\src-tauri"
  # --locked: as versões exatas do Cargo.lock, sem atualizar nada no caminho (auditoria de 30/10/2026)
  cargo test --release --locked | Out-Host; if ($LASTEXITCODE) { throw 'os testes do programa falharam' }
  # o cargo não percebe sozinho a versão nova no package.json: recompila o programa sempre
  cargo clean --release -p bancada-livre | Out-Host
  cargo build --release --locked | Out-Host; if ($LASTEXITCODE) { throw 'a compilação do programa falhou' }
} finally {
  Pop-Location
  subst "${letra}:" /d | Out-Null
}
$exe = 'src-tauri\target\release\BancadaLivre.exe'
if (-not (Test-Path $exe)) { throw 'o cargo não gerou o BancadaLivre.exe' }
$texto = [Text.Encoding]::GetEncoding(28591).GetString([IO.File]::ReadAllBytes((Resolve-Path $exe).Path))
foreach ($pessoal in @($env:USERPROFILE, $raiz, "$env:USERNAME\.cargo")) {
  if ($texto.IndexOf($pessoal, [StringComparison]::OrdinalIgnoreCase) -ge 0) { throw "o exe leva um caminho desta máquina: $pessoal" }
}
$exever = (Get-Item $exe).VersionInfo.ProductVersion
if ($exever -ne $versao) { throw "o BancadaLivre.exe saiu com a versão $exever, e o package.json está na $versao" }

# limpa o pacote anterior, menos as pastas dos arquivos separados para o VirusTotal e para a auditoria
Get-ChildItem pacote -ErrorAction SilentlyContinue | Where-Object Name -notin 'para-virustotal', 'para-auditoria' | Remove-Item -Recurse -Force
New-Item -ItemType Directory -Force pacote\work | Out-Null
$html = "pacote\BancadaLivre-$versao.html"
Copy-Item dist\index.html $html

# 3) o programa para baixar: o exe que se instala sozinho (ou roda sem instalar) dentro de um zip, com a licença, os
#    avisos e um LEIA-ME. Nenhum exe solto na release, como nos outros programas da família (decisão do professor,
#    29/10/2026): alguns antivírus acusam de forma oscilante um exe Tauri solto, e o zip dá zero.
$instalar = 'pacote\work\instalar'
New-Item -ItemType Directory -Force $instalar | Out-Null
Copy-Item $exe "$instalar\BancadaLivre.exe"
Copy-Item LICENSE, THIRD-PARTY-NOTICES.md $instalar
Copy-Item THIRD-PARTY-RUST.md $instalar
@"
Bancada Livre $versao

1. Extraia este zip (botão direito > Extrair tudo). Abrir o programa de dentro do zip, sem extrair, não é o caminho
   recomendado.
2. Abra o BancadaLivre.exe e responda Sim para instalar só para a sua conta (não pede senha de administrador): ele
   cria os atalhos no menu Iniciar e na Área de Trabalho. Responda Não para só usar agora, sem instalar.
3. Para atualizar, faça o mesmo com o zip da versão nova: ele atualiza por cima, e os circuitos continuam lá.

Depois de instalar, esta pasta pode ser apagada.
Licença do Bancada Livre: LICENSE. Programas de terceiros e as licenças deles: THIRD-PARTY-NOTICES.md (a lista) e THIRD-PARTY-RUST.md (os textos das licenças das bibliotecas do programa).
"@ | Set-Content "$instalar\LEIA-ME.txt" -Encoding UTF8
$programa = "pacote\Instalar-BancadaLivre-$versao.zip"
Compress-Archive -Path "$instalar\*" -DestinationPath $programa

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
Copy-Item $wv2, LICENSE, THIRD-PARTY-NOTICES.md, THIRD-PARTY-RUST.md $semInternet
# a alternativa quando o WebView2 não pode ser instalado: o simulador inteiro num arquivo, para abrir no navegador
Copy-Item dist\index.html "$semInternet\bancada-livre.html"
@"
Bancada Livre $versao - pacote para escola sem internet

1. Abra o BancadaLivre.exe. Se este computador não tiver o WebView2 da Microsoft (que desenha a janela do
   simulador), o programa oferece instalar o que vem nesta pasta (MicrosoftEdgeWebView2RuntimeInstallerX64.exe,
   o instalador oficial da Microsoft, que não precisa de internet).
2. Depois, responda Sim para instalar o Bancada Livre só para a sua conta (não pede senha de administrador),
   ou Não para só usar agora, sem instalar.
3. Se o WebView2 não puder ser instalado, abra o bancada-livre.html no navegador: é o simulador inteiro num
   arquivo só, sem instalar nada.

Os circuitos ficam guardados no computador e continuam lá se o programa for desinstalado.
Licença do Bancada Livre: LICENSE. Programas de terceiros e as licenças deles: THIRD-PARTY-NOTICES.md (a lista) e THIRD-PARTY-RUST.md (os textos das licenças das bibliotecas do programa).
"@ | Set-Content "$semInternet\LEIA-ME.txt" -Encoding UTF8
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
