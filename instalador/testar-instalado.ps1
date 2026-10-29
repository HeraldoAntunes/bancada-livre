# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Teste do programa instalado, para rodar num Windows novo (o workflow "PC limpo") ou à mão:
#   instala em silêncio (o próprio programa se instala), confere atalhos e registro, abre e confere que fica vivo, procura o módulo do Warsaw, mede as conexões, tira um retrato
#   da janela, confere o salvamento em arquivo, desinstala e confere que o circuito do usuário ficou.
# Uso:  pwsh -File instalador\testar-instalado.ps1 -Programa pacote\BancadaLivre-x.y.z.exe [-Saida pasta]
# Sai com código 1 se algo obrigatório falhar; o resumo vai para <Saida>\resultado.md (e para o resumo do GitHub).
param([Parameter(Mandatory)][string]$Programa, [string]$Saida = 'teste-instalado', [int]$Segundos = 60)
$ErrorActionPreference = 'Stop'
$cdp = Join-Path $PSScriptRoot 'cdp.mjs'
New-Item -ItemType Directory -Force $Saida | Out-Null
$app = Join-Path $env:LOCALAPPDATA 'Programs\Bancada Livre'
$dados = Join-Path $env:LOCALAPPDATA 'Bancada Livre'
$linhas = [System.Collections.Generic.List[string]]::new()
$falhas = 0
function anotar([string]$teste, [bool]$ok, [string]$detalhe) {
  $linhas.Add("| $teste | $(if ($ok) { 'passou' } else { '**falhou**' }) | $detalhe |")
  if (-not $ok) { $script:falhas++ }
}
function processos($raiz) {
  $todos = Get-CimInstance Win32_Process
  $ids = @($raiz); $novos = @($raiz)
  while ($novos.Count) { $novos = @($todos | Where-Object { $novos -contains $_.ParentProcessId } | ForEach-Object ProcessId); $ids += $novos }
  $ids
}
$chaveWv2 = 'Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
function versaoWebView2 {
  foreach ($k in "HKLM:\SOFTWARE\WOW6432Node\$chaveWv2", "HKLM:\SOFTWARE\$chaveWv2", "HKCU:\Software\$chaveWv2") {
    $v = (Get-ItemProperty $k -ErrorAction SilentlyContinue).pv
    if ($v -and $v -ne '0.0.0.0') { return $v }
  }
  'nenhum'
}

# o teste põe uma peça no circuito salvo: guarda o do usuário antes e o devolve no fim
$guarda = Join-Path $Saida 'circuito-do-usuario'
New-Item -ItemType Directory -Force $guarda | Out-Null
$salvos = @('circuito.json', 'circuito-anterior.json') | Where-Object { Test-Path (Join-Path $dados $_) }
foreach ($n in $salvos) { Copy-Item (Join-Path $dados $n) $guarda -Force }

# 1) instalar
$wv2Antes = versaoWebView2
$p = Start-Process $Programa -ArgumentList '--instalar' -PassThru -Wait
anotar 'Instalar em silêncio' ($p.ExitCode -eq 0 -and (Test-Path "$app\BancadaLivre.exe")) "código $($p.ExitCode); WebView2: $wv2Antes"
$chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{B3D1A6E0-5C2F-4A87-9E14-7F0C2B8D4E61}_is1'
$reg = Get-ItemProperty $chave -ErrorAction SilentlyContinue
$versao = (Get-Item $Programa).VersionInfo.ProductVersion
anotar 'Registro em Aplicativos instalados' ($reg -and $reg.DisplayVersion -eq $versao -and $reg.UninstallString -match '--desinstalar') "versão registrada: $($reg.DisplayVersion); a do programa: $versao"
$shell = New-Object -ComObject Shell.Application
foreach ($pasta in [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop')) {
  $item = $shell.NameSpace($pasta).ParseName('Bancada Livre.lnk')
  $aumid = if ($item) { $item.ExtendedProperty('System.AppUserModel.ID') } else { '' }
  anotar "Atalho em $(Split-Path $pasta -Leaf)" ($aumid -eq 'BancadaLivre') "AppUserModelID: '$aumid'"
}

# 2) abrir e ficar vivo (sem porta de depuração: é o programa como o aluno o usa)
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $null
$prog = Start-Process "$app\BancadaLivre.exe" -PassThru
$externas = @{}
for ($s = 0; $s -lt $Segundos -and -not $prog.HasExited; $s += 5) {
  Start-Sleep 5
  $ids = processos $prog.Id
  Get-NetTCPConnection -ErrorAction SilentlyContinue |
    Where-Object { $ids -contains $_.OwningProcess -and $_.State -in 'Established', 'SynSent' -and $_.RemoteAddress -notmatch '^(127\.|::1$)' } |
    ForEach-Object { $externas["$($_.RemoteAddress):$($_.RemotePort)"] = 1 }
}
$vivo = -not $prog.HasExited
$ids = if ($vivo) { processos $prog.Id } else { @() }
anotar "Abrir e ficar vivo $Segundos s" ($vivo -and $ids.Count -gt 1) "$($ids.Count) processos (o programa e os do WebView2)"

# 3) módulo do Warsaw (wslbdhm64.dll) em algum processo do programa
$comWarsaw = @($ids | Where-Object { try { (Get-Process -Id $_).Modules.ModuleName -contains 'wslbdhm64.dll' } catch { $false } })
anotar 'Sem o módulo do Warsaw' ($comWarsaw.Count -eq 0) "$($comWarsaw.Count) processo(s) com wslbdhm64.dll; Warsaw rodando: $([bool](Get-Service -DisplayName 'Warsaw*' -ErrorAction SilentlyContinue))"

# 4) conexões de rede (o simulador não tem rede; o componente WebView2 da Microsoft pode abrir a dele)
$linhas.Add("| Conexões externas | medido | $(if ($externas.Count) { $externas.Keys -join ', ' } else { 'nenhuma' }) |")

# 5) retrato da janela
if ($vivo) {
  Add-Type -AssemblyName System.Drawing
  Add-Type -Namespace T -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr h, out RECT r); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h); public struct RECT { public int L, T, R, B; }'
  $prog.Refresh(); $h = $prog.MainWindowHandle
  [T.U]::SetForegroundWindow($h) | Out-Null; Start-Sleep 1
  $r = New-Object T.U+RECT; [T.U]::GetWindowRect($h, [ref]$r) | Out-Null
  $larg = [Math]::Max(1, $r.R - $r.L); $alt = [Math]::Max(1, $r.B - $r.T)
  $bmp = New-Object System.Drawing.Bitmap $larg, $alt
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
  $bmp.Save((Join-Path $Saida 'janela.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  anotar 'Retrato da janela' (Test-Path (Join-Path $Saida 'janela.png')) "$larg x $alt"
  Stop-Process -Id $prog.Id; $prog.WaitForExit(10000) | Out-Null; Start-Sleep 2
}

# 6) salvamento em arquivo: uma peça posta pela página tem de chegar ao circuito.json
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9333'
$prog = Start-Process "$app\BancadaLivre.exe" -PassThru
Start-Sleep 10
$ok = $false; $detalhe = ''
try {
  node $cdp 9333 "window.bancadaLivre.executar('componente.adicionar', {tipo:'LED', x: 300, y: 200}).ok" | Out-Null
  Start-Sleep 2
  $n = (Get-Content (Join-Path $dados 'circuito.json') -Raw | ConvertFrom-Json).components.Count
  $ok = $n -ge 1; $detalhe = "circuito.json com $n componente(s); versão na janela: $(node $cdp 9333 'window.bancadaLivre.versao')"
} catch { $detalhe = "$_" }
anotar 'Salvamento em arquivo' $ok $detalhe
Stop-Process -Id $prog.Id -ErrorAction SilentlyContinue; $prog.WaitForExit(10000) | Out-Null; Start-Sleep 2
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $null

# 7) desinstalar: o programa sai, o circuito do usuário fica
$u = Start-Process "$app\BancadaLivre.exe" -ArgumentList '--desinstalar', '--silencioso' -PassThru -Wait
Start-Sleep 3
$limpo = -not (Test-Path $app) -and -not (Test-Path $chave) -and -not (Test-Path (Join-Path ([Environment]::GetFolderPath('Programs')) 'Bancada Livre.lnk'))
anotar 'Desinstalar sem apagar o circuito' ($u.ExitCode -eq 0 -and $limpo -and (Test-Path (Join-Path $dados 'circuito.json'))) "código $($u.ExitCode); pasta, atalhos e registro removidos: $limpo"

foreach ($n in 'circuito.json', 'circuito-anterior.json') {
  if ($salvos -contains $n) { Copy-Item (Join-Path $guarda $n) $dados -Force } else { Remove-Item (Join-Path $dados $n) -ErrorAction SilentlyContinue }
}
Remove-Item -Recurse -Force $guarda

$titulo = "## Bancada Livre instalado: $([Environment]::OSVersion.VersionString)"
$texto = @($titulo, '', '| Teste | Resultado | Detalhe |', '|---|---|---|') + $linhas
$texto | Set-Content (Join-Path $Saida 'resultado.md') -Encoding utf8
if ($env:GITHUB_STEP_SUMMARY) { $texto | Add-Content $env:GITHUB_STEP_SUMMARY -Encoding utf8 }
$texto
if ($falhas) { exit 1 }
