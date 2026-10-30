# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Fechar a janela durante a abertura, de 0 a 1.200 ms depois de ela aparecer, e abrir de novo logo em seguida. No Giz
# Livre e no Giz na Tela (29/10/2026), fechar antes de o WebView2 terminar de criar a página deu a caixa técnica em inglês
# "failed to create webview ... 0x80070578" ou derrubou o programa. Confere, em cada rodada: o programa sai sozinho em até
# 15 s e sem nenhuma caixa de mensagem; no fim, a abertura normal funciona. Perfil de rascunho (LOCALAPPDATA trocado).
# Uso:  pwsh -File instalador\testar-abrir-e-fechar.ps1 -Exe pacote\BancadaLivre-x.y.z.exe [-Rodadas 36] [-Saida pasta]
param([Parameter(Mandatory)][string]$Exe, [int]$Rodadas = 36, [string]$Saida = 'teste-abrir-e-fechar')
$ErrorActionPreference = 'Stop'
$Exe = (Resolve-Path $Exe).Path
New-Item -ItemType Directory -Force $Saida | Out-Null
$perfil = Join-Path (Resolve-Path $Saida).Path 'perfil-rascunho'
New-Item -ItemType Directory -Force (Join-Path $perfil 'Bancada Livre') | Out-Null
$env:LOCALAPPDATA = $perfil
# avisos de erro do programa vão para este arquivo, não para caixas na tela (BANCADA_SEM_CAIXAS)
$caixasArq = Join-Path (Resolve-Path $Saida).Path 'caixas.txt'
Remove-Item $caixasArq -ErrorAction SilentlyContinue
$env:BANCADA_SEM_CAIXAS = $caixasArq
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $null
Add-Type -Namespace AF -Name U -MemberDefinition @'
public delegate bool Cb(System.IntPtr h, System.IntPtr l);
[DllImport("user32.dll")] public static extern bool EnumWindows(Cb f, System.IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(System.IntPtr h);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(System.IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(System.IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern System.IntPtr FindWindowEx(System.IntPtr p, System.IntPtr a, string c, string t);
[DllImport("user32.dll")] public static extern bool PostMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll")] public static extern System.IntPtr SendMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l);
'@
# janelas visíveis do processo: classe e identificador
function janelas([int]$processo) {
  $lista = [System.Collections.Generic.List[object]]::new()
  [AF.U]::EnumWindows({ param($h, $l)
    $dono = 0; [void][AF.U]::GetWindowThreadProcessId($h, [ref]$dono)
    if ($dono -eq $processo -and [AF.U]::IsWindowVisible($h)) {
      $c = New-Object System.Text.StringBuilder 64; [void][AF.U]::GetClassName($h, $c, 64)
      $lista.Add([pscustomobject]@{ Classe = $c.ToString(); H = $h })
    }
    $true }, [IntPtr]::Zero) | Out-Null
  $lista
}
# texto de uma caixa de mensagem (os rótulos dela)
function textoDaCaixa($h) {
  $t = @(); $f = [IntPtr]::Zero
  while (($f = [AF.U]::FindWindowEx($h, $f, 'Static', $null)) -ne [IntPtr]::Zero) { $s = New-Object System.Text.StringBuilder 1024; [void][AF.U]::GetWindowText($f, $s, 1024); if ($s.Length) { $t += $s.ToString() } }
  $t -join ' '
}
function apertar($h, [string]$nome) { $b = [AF.U]::FindWindowEx($h, [IntPtr]::Zero, 'Button', $nome); if ($b -ne [IntPtr]::Zero) { [void][AF.U]::SendMessage($b, 0xF5, [IntPtr]::Zero, [IntPtr]::Zero) } }

$atrasos = 0, 50, 100, 200, 300, 500, 800, 1200, 0, 100, 300, 600
$caixas = @(); $presos = 0; $semJanela = 0
for ($r = 0; $r -lt $Rodadas; $r++) {
  $atraso = $atrasos[$r % $atrasos.Count]
  $p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru
  # a pergunta de instalar (perfil de rascunho: nada instalado) aparece antes da janela: "Não" = só usar agora
  $janela = $null; $fim = (Get-Date).AddSeconds(30)
  while (-not $janela -and (Get-Date) -lt $fim -and -not $p.HasExited) {
    foreach ($j in janelas $p.Id) {
      if ($j.Classe -eq '#32770' -and (textoDaCaixa $j.H) -match 'Instalar o Bancada') { apertar $j.H '&Não' }
      elseif ($j.Classe -eq 'Tauri Window') { $janela = $j }
    }
    Start-Sleep -Milliseconds 20
  }
  if (-not $janela) { $semJanela++; if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }; "rodada $($r + 1): a janela não apareceu"; continue }
  Start-Sleep -Milliseconds $atraso
  [void][AF.U]::PostMessage($janela.H, 0x10, [IntPtr]::Zero, [IntPtr]::Zero)   # WM_CLOSE: o X
  $saiu = $p.WaitForExit(15000)
  $caixa = ''
  if (-not $saiu) {
    foreach ($j in janelas $p.Id) { if ($j.Classe -eq '#32770') { $caixa = textoDaCaixa $j.H; $caixas += "rodada $($r + 1) ($atraso ms): $caixa"; apertar $j.H '&Sim'; apertar $j.H 'OK' } }
    if (-not $p.WaitForExit(10000)) { $presos++; Stop-Process -Id $p.Id -Force }
  } elseif ($p.ExitCode -ne 0) { $caixas += "rodada $($r + 1) ($atraso ms): saiu com código $($p.ExitCode)" }
  "rodada $($r + 1): fechada $atraso ms depois de aparecer; saiu $(if ($saiu) { 'sozinha' } else { 'PRESA' })$(if ($caixa) { ', COM CAIXA: ' + $caixa })"
  if ($r % 2 -eq 0) { Start-Sleep -Milliseconds 300 }
}
# depois disso tudo, a abertura normal funciona
$p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru; $janela = $null; $fim = (Get-Date).AddSeconds(30)
while (-not $janela -and (Get-Date) -lt $fim) { foreach ($j in janelas $p.Id) { if ($j.Classe -eq '#32770') { apertar $j.H '&Não' } elseif ($j.Classe -eq 'Tauri Window') { $janela = $j } }; Start-Sleep -Milliseconds 100 }
Start-Sleep 5
$normal = $janela -and -not $p.HasExited
if ($janela) { [void][AF.U]::PostMessage($janela.H, 0x10, [IntPtr]::Zero, [IntPtr]::Zero) }
if (-not $p.WaitForExit(15000)) { Stop-Process -Id $p.Id -Force }
$avisos = if (Test-Path $caixasArq) { @(Get-Content $caixasArq) } else { @() }
if ($avisos) { $caixas += $avisos | ForEach-Object { "aviso do programa: $_" } }
''
"rodadas: $Rodadas; caixas ou saídas com erro: $($caixas.Count); presos: $presos; janela não apareceu: $semJanela; abertura normal depois: $normal"
$caixas
# o que sobrar do WebView2 do perfil de rascunho (só ele, conferido pela linha de comando)
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($perfil) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
# o perfil de rascunho não serve mais: sai (o relatório fica)
Start-Sleep 1; Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue
if ($caixas.Count -or $presos -or $semJanela -or -not $normal) { exit 1 }
