# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Mede as conexões de rede do programa instalado, por PID: o BancadaLivre.exe e os processos do WebView2 que ele abre.
# Abre uma vez para o perfil existir (a conexão do WebView2 com a Microsoft só aparecia com o perfil já usado), fecha e
# abre de novo medindo, a cada segundo (ou -Intervalo), as conexões TCP e as portas UDP. Modelo: tests/conexoes_exe.ps1 do Tarja Livre.
# Uso:  pwsh -File instalador\medir-conexoes.ps1 [-Segundos 180]
param([int]$Segundos = 180, [int]$Intervalo = 1)
$exe = Join-Path $env:LOCALAPPDATA 'Programs\Bancada Livre\BancadaLivre.exe'
if (-not (Test-Path $exe)) { throw "o Bancada Livre não está instalado ($exe)" }
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $null
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
$p = Start-Process $exe -PassThru
Start-Sleep 15
$p.CloseMainWindow() | Out-Null
if (-not $p.WaitForExit(10000)) { Stop-Process -Id $p.Id -Force }
Start-Sleep 3

# 2) segunda abertura, medindo
$p = Start-Process $exe -PassThru
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
"Local State do perfil depois de abrir: $(Test-Path (Join-Path $env:LOCALAPPDATA 'Bancada Livre\WebView2\EBWebView\Local State'))"
if ($vistos.Count -eq 0) { "nenhuma conexão TCP nem porta UDP em $Segundos s" }
else { $vistos.GetEnumerator() | ForEach-Object { "$($_.Value)  $($_.Key)" } }
