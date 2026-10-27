# Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
# Monta o HTML único, o executável (PyInstaller) e o instalador (Inno Setup) do Bancada Livre, verifica no
# Microsoft Defender e escreve pacote\SHA256SUMS.txt.  Uso:  powershell -ExecutionPolicy Bypass -File instalador\build.ps1
# A versão vem só do package.json: daqui ela vai para o .exe (versao.txt gerado) e para o instalador (/DAppVer).
# Tudo sai na pasta pacote\ (ignorada pelo Git). Build de distribuição só com ordem do professor.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
Set-Location $raiz
$versao = (Get-Content package.json -Raw | ConvertFrom-Json).version
if ($versao -notmatch '^\d+\.\d+\.\d+$') { throw "versão inválida no package.json: $versao" }
$partes = ($versao.Split('.') + '0') -join ', '
"Bancada Livre $versao"

# 1) o simulador: HTML único (testes e linter antes)
npm run lint | Out-Host; if ($LASTEXITCODE) { throw 'o linter acusou problemas' }
npm test | Out-Host; if ($LASTEXITCODE) { throw 'os testes falharam' }
npm run build | Out-Host; if ($LASTEXITCODE) { throw 'o build do HTML falhou' }
& python -I -m unittest discover -s instalador -p 'test_*.py' | Out-Host
if ($LASTEXITCODE) { throw 'os testes do lançador falharam' }

Remove-Item -Recurse -Force pacote -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force pacote\work | Out-Null
$html = "pacote\BancadaLivre-$versao.html"
Copy-Item dist\index.html $html
Copy-Item dist\index.html pacote\work\bancada-livre.html

# 2) ambiente de build dedicado, recriado do zero, com dependências fixadas por hash
$py313 = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'
Remove-Item -Recurse -Force .venv-build -ErrorAction SilentlyContinue
uv venv .venv-build --python $py313 | Out-Host
uv pip install --python .venv-build\Scripts\python.exe --require-hashes -r instalador\requirements-build.txt | Out-Host
if ((& .venv-build\Scripts\python.exe -c "import sys; print(sys.version_info[:2] == (3, 13))") -ne 'True') { throw 'o build precisa do Python 3.13' }
$pyver = & .venv-build\Scripts\python.exe -c "import sys; print(sys.version.split()[0])"

# 3) executável em pasta (onedir: menos alarmes falsos que onefile), sem UPX, sem console, sem módulos que o
#    lançador não usa (nem rede: ssl fica de fora)
@"
# Informações de versão do BancadaLivre.exe (gerado pelo build.ps1 a partir do package.json)
VSVersionInfo(
  ffi=FixedFileInfo(filevers=($partes), prodvers=($partes), mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('041604B0', [
      StringStruct('CompanyName', 'Heraldo Antunes Silva Filho (projeto livre)'),
      StringStruct('FileDescription', 'Bancada Livre - simulador didatico de logica digital'),
      StringStruct('FileVersion', '$versao'),
      StringStruct('InternalName', 'BancadaLivre'),
      StringStruct('LegalCopyright', 'Copyright (c) 2026 Heraldo Antunes Silva Filho - Licenca MIT'),
      StringStruct('OriginalFilename', 'BancadaLivre.exe'),
      StringStruct('ProductName', 'Bancada Livre'),
      StringStruct('ProductVersion', '$versao')])]),
    VarFileInfo([VarStruct('Translation', [1046, 1200])])
  ]
)
"@ | Set-Content pacote\work\versao.txt -Encoding UTF8
$excluir = '_bz2', 'bz2', '_lzma', 'lzma', '_decimal', 'decimal', 'tkinter', 'unittest', 'pydoc', 'ssl', '_ssl'
$pyiArgs = @('--noconfirm', '--clean', '--onedir', '--windowed', '--noupx', '--name', 'BancadaLivre',
  '--icon', "$raiz\instalador\bancada-livre.ico", '--version-file', "$raiz\pacote\work\versao.txt",
  '--add-data', "$raiz\pacote\work\bancada-livre.html;.",
  '--distpath', 'pacote', '--workpath', 'pacote\work\pyi', '--specpath', 'pacote\work')
foreach ($m in $excluir) { $pyiArgs += @('--exclude-module', $m) }
& .venv-build\Scripts\pyinstaller.exe @pyiArgs instalador\lancador.py | Out-Host
$prog = 'pacote\BancadaLivre'
if (-not (Test-Path "$prog\BancadaLivre.exe")) { throw 'PyInstaller não gerou o executável' }
# o .exe montado abre, acha o HTML e sai com 0 (--mostrar não abre janela)
$p = Start-Process "$prog\BancadaLivre.exe" -ArgumentList '--mostrar' -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "o executável montado não achou o simulador (código $($p.ExitCode))" }

# licenças que acompanham o pacote
New-Item -ItemType Directory -Force "$prog\licencas" | Out-Null
Copy-Item LICENSE, THIRD-PARTY-NOTICES.md, README.md $prog
Copy-Item (Join-Path (Split-Path $py313) 'LICENSE.txt') "$prog\licencas\python-LICENSE.txt"
Copy-Item (Get-ChildItem .venv-build\Lib\site-packages\pyinstaller-*.dist-info -Recurse -Filter COPYING.txt | Select-Object -First 1).FullName "$prog\licencas\pyinstaller-COPYING.txt"

# 4) instalador
$iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 não encontrado' }
Copy-Item (Join-Path (Split-Path $iscc) 'license.txt') "$prog\licencas\innosetup-license.txt"
& $iscc /Qp "/DAppVer=$versao" instalador\bancada-livre.iss | Out-Host
$inst = "pacote\Instalar-BancadaLivre-$versao.exe"
if (-not (Test-Path $inst)) { throw 'Inno Setup não gerou o instalador' }
# os executáveis do Inno Setup não trazem versão nos metadados; a primeira citada no whatsnew.htm é a instalada
$innover = (Select-String -Path (Join-Path (Split-Path $iscc) 'whatsnew.htm') -Pattern '\d+\.\d+\.\d+' -List).Matches[0].Value

# 5) versão portátil (pasta do programa num zip, para pendrive)
$zip = "pacote\BancadaLivre-$versao-portatil.zip"
Compress-Archive -Path "$prog\*" -DestinationPath $zip

# 6) verificação no Microsoft Defender (0 = nada encontrado)
$mp = "$env:ProgramFiles\Windows Defender\MpCmdRun.exe"
foreach ($alvo in @((Resolve-Path $inst).Path, (Resolve-Path $zip).Path, (Resolve-Path $prog).Path, (Resolve-Path $html).Path)) {
  $r = & $mp -Scan -ScanType 3 -File $alvo -DisableRemediation 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "Defender acusou algo (código $LASTEXITCODE) em $alvo`n$r" }
  "Defender OK: $alvo"
}

# 7) hashes para conferência + versões das ferramentas usadas
$linhas = Get-ChildItem pacote -File | Where-Object Name -ne 'SHA256SUMS.txt' | ForEach-Object {
  "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name
}
$linhas += "# Bancada Livre $versao - Python $pyver - PyInstaller 6.22.3 - Inno Setup $innover - gerado em $(Get-Date -Format 'yyyy-MM-dd') (PC do mantenedor)"
$linhas | Set-Content pacote\SHA256SUMS.txt -Encoding ASCII
Get-Content pacote\SHA256SUMS.txt
