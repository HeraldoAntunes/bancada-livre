# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Mede as conexões de rede do programa, por PID: o BancadaLivre.exe e os processos do WebView2 que ele abre. Num perfil de
# rascunho (LOCALAPPDATA trocado só para o programa aberto; regra C4 da bateria): nada do usuário é tocado, e no fim o que
# sobrar desse perfil é encerrado.
# Abre uma vez para o perfil existir (a conexão do WebView2 com a Microsoft só aparecia com o perfil já usado), fecha e
# abre de novo medindo, a cada segundo (ou -Intervalo), as conexões TCP e as portas UDP. Modelo: tests/conexoes_exe.ps1 do Tarja Livre.
# Uso:  pwsh -File instalador\medir-conexoes.ps1 -Exe pacote\BancadaLivre-x.y.z.exe [-Segundos 180] [-Saida pasta]
param([Parameter(Mandatory)][string]$Exe, [int]$Segundos = 180, [int]$Intervalo = 1, [string]$Saida = 'teste-conexoes')
$exe = (Resolve-Path $Exe).Path
New-Item -ItemType Directory -Force $Saida | Out-Null
$perfil = Join-Path (Resolve-Path $Saida).Path 'perfil-rascunho'
New-Item -ItemType Directory -Force (Join-Path $perfil 'Bancada Livre') | Out-Null
$contaLocal = $env:LOCALAPPDATA
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $null
$abertos = @()
function abrir { $env:LOCALAPPDATA = $perfil; $env:BANCADA_SEM_CAIXAS = (Join-Path $perfil 'caixas.txt')
  try { $p = Start-Process $exe -ArgumentList '--sem-instalar' -PassThru; $script:abertos += $p.Id; $p }
  finally { $env:LOCALAPPDATA = $contaLocal; $env:BANCADA_SEM_CAIXAS = $null } }
function arvore($raiz) {
  $todos = Get-CimInstance Win32_Process
  $ids = @($raiz); $novos = @($raiz)
  while ($novos.Count) { $novos = @($todos | Where-Object { $novos -contains $_.ParentProcessId } | ForEach-Object { [int]$_.ProcessId }); $ids += $novos }
  $tipos = @{}
  foreach ($t in $todos | Where-Object { $ids -contains [int]$_.ProcessId }) {
    $tipos[[int]$t.ProcessId] = if ($t.Name -ne 'msedgewebview2.exe') { $t.Name } elseif ($t.CommandLine -match '--type=([\w-]+)') { $Matches[1] } else { 'webview2-principal' }
  }
  $tipos
}

# 1) primeira abertura: cria o perfil
$p = abrir
Start-Sleep 15
$p.CloseMainWindow() | Out-Null
if (-not $p.WaitForExit(10000)) { Stop-Process -Id $p.Id -Force }
Start-Sleep 3

# 2) segunda abertura, medindo
$p = abrir
$vistos = [ordered]@{}
$fim = (Get-Date).AddSeconds($Segundos)
$maximo = 0
while ((Get-Date) -lt $fim -and -not $p.HasExited) {
  Start-Sleep $Intervalo
  $tipos = arvore $p.Id
  $maximo = [Math]::Max($maximo, $tipos.Count)
  $pids = [int[]]@($tipos.Keys)
  foreach ($c in @(Get-NetTCPConnection -OwningProcess $pids -ErrorAction SilentlyContinue)) {
    if ($c.RemoteAddress -in '0.0.0.0', '::') { continue }
    $chave = "TCP $($tipos[[int]$c.OwningProcess]) $($c.RemoteAddress):$($c.RemotePort) $($c.State)"
    if (-not $vistos.Contains($chave)) { $vistos[$chave] = Get-Date -Format 'HH:mm:ss' }
  }
  foreach ($u in @(Get-NetUDPEndpoint -OwningProcess $pids -ErrorAction SilentlyContinue)) {
    $chave = "UDP $($tipos[[int]$u.OwningProcess]) local $($u.LocalAddress):$($u.LocalPort)"
    if (-not $vistos.Contains($chave)) { $vistos[$chave] = Get-Date -Format 'HH:mm:ss' }
  }
}
$vivo = -not $p.HasExited
if ($vivo) { $p.CloseMainWindow() | Out-Null; if (-not $p.WaitForExit(10000)) { Stop-Process -Id $p.Id -Force } }
"processos do programa (máximo): $maximo; ficou aberto os $Segundos s: $vivo"
"Local State do perfil depois de abrir: $(Test-Path (Join-Path $perfil 'Bancada Livre\WebView2\EBWebView\Local State'))"
if ($vistos.Count -eq 0) { "nenhuma conexão TCP nem porta UDP em $Segundos s" }
else { $vistos.GetEnumerator() | ForEach-Object { "$($_.Value)  $($_.Key)" } }
# fecha o que abriu (pelo PID) e o que sobrar do WebView2 do perfil de rascunho
Get-Process -Id $abertos -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null; if (-not $_.WaitForExit(10000)) { Stop-Process -Id $_.Id -Force } }
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($perfil) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# o perfil de rascunho não serve mais: sai (o relatório fica)
Start-Sleep 1; Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue
