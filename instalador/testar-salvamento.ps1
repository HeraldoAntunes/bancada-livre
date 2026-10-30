# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Teste do salvamento no programa real, num perfil de rascunho (LOCALAPPDATA trocado: os circuitos do usuário não são
# tocados). Cobre o que o auditor independente achou na 2.1.0 publicada (29/10/2026):
#   1) fechar a janela logo depois de uma mudança, inclusive com a gravação já em andamento;
#   2) gravação que falha: nova tentativa sozinha e, ao reabrir, o circuito mais novo;
#   3) segunda abertura no mesmo perfil: não abre outra janela gravando por cima.
# Com -Desinstalar, também instala e desinstala de verdade (na conta) logo depois de abrir, 5 vezes (achado do Tarja).
# Uso:  pwsh -File instalador\testar-salvamento.ps1 -Exe pacote\BancadaLivre-x.y.z.exe [-Saida pasta] [-Desinstalar]
# Sai com código 1 se algo falhar; o resumo vai para <Saida>\salvamento.md.
param([Parameter(Mandatory)][string]$Exe, [string]$Saida = 'teste-salvamento', [switch]$Desinstalar)
$ErrorActionPreference = 'Stop'
$Exe = (Resolve-Path $Exe).Path
$cdp = Join-Path $PSScriptRoot 'cdp.mjs'
New-Item -ItemType Directory -Force $Saida | Out-Null
$Saida = (Resolve-Path $Saida).Path
$perfilReal = $env:LOCALAPPDATA
$perfil = Join-Path $Saida 'perfil-rascunho'
$dados = Join-Path $perfil 'Bancada Livre'
if (Test-Path $perfil) { Remove-Item -Recurse -Force $perfil }
New-Item -ItemType Directory -Force $dados | Out-Null
$linhas = [System.Collections.Generic.List[string]]::new()
$abertos = @()
$falhas = 0
function anotar([string]$teste, [bool]$ok, [string]$detalhe) {
  $linhas.Add("| $teste | $(if ($ok) { 'passou' } else { '**falhou**' }) | $detalhe |")
  Write-Host "${teste}: $(if ($ok) { 'passou' } else { 'FALHOU' }) ($detalhe)"
  if (-not $ok) { $script:falhas++ }
}
$env:LOCALAPPDATA = $perfil
# avisos de erro do programa vão para este arquivo, não para caixas na tela (BANCADA_SEM_CAIXAS)
$caixasArq = Join-Path $Saida 'caixas.txt'
Remove-Item $caixasArq -ErrorAction SilentlyContinue
$env:BANCADA_SEM_CAIXAS = $caixasArq
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,AutofillServerCommunication,OptimizationHints,MediaRouter,msEdgeTranslate --disable-background-networking --disable-component-update --disable-domain-reliability --disable-sync --no-pings --disable-client-side-phishing-detection --proxy-server=http://127.0.0.1:9 --proxy-bypass-list=<-loopback> --remote-debugging-port=9333'
Add-Type -Namespace TS -Name U -MemberDefinition @'
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern System.IntPtr FindWindowEx(System.IntPtr p, System.IntPtr a, string c, string t);
[DllImport("user32.dll")] public static extern System.IntPtr SendMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint pid);
'@
# aperta um botão na caixa de mensagem do processo; devolve se achou a caixa
function botao([int]$processo, [string]$nome) {
  $h = [IntPtr]::Zero
  while (($h = [TS.U]::FindWindowEx([IntPtr]::Zero, $h, '#32770', 'Bancada Livre')) -ne [IntPtr]::Zero) {
    $dono = 0; [void][TS.U]::GetWindowThreadProcessId($h, [ref]$dono)
    if ($dono -eq $processo) {
      $b = [TS.U]::FindWindowEx($h, [IntPtr]::Zero, 'Button', $nome)
      [void][TS.U]::SendMessage($b, 0xF5, [IntPtr]::Zero, [IntPtr]::Zero); return $true
    }
  }
  $false
}
# abre sem instalar e sem a pergunta (--sem-instalar): nenhuma caixa fica na tela
function abrir {
  $p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru
  $script:abertos += $p.Id
  Start-Sleep 7
  $p
}
function fechar($p) { if (-not $p.HasExited) { $p.CloseMainWindow() | Out-Null; if (-not $p.WaitForExit(15000)) { Stop-Process -Id $p.Id -Force } } }
function pagina($e) { node $cdp 9333 $e }
function pecas { [int](pagina "window.bancadaLivre.executar('circuito.ler').resultado.componentes.length") }
function noArquivo { try { (Get-Content "$dados\circuito.json" -Raw | ConvertFrom-Json).components.Count } catch { -1 } }

try {
# 1) fechar logo depois de uma mudança, com o circuito grande (a gravação demora mais) e o X de 350 a 500 ms depois
$p = abrir
pagina "(() => { const s = window.bancadaLivre; for (let i = 0; i < 1500; i++) s.executar('componente.adicionar', {tipo:'LED', x: 40 + (i % 50) * 40, y: 40 + Math.floor(i / 50) * 40}); return 1 })()" | Out-Null
Start-Sleep 2; fechar $p
$certos = 0; $detalhes = @()
foreach ($atraso in 350, 380, 400, 410, 420, 430, 440, 460, 480, 500) {
  $p = abrir
  $n = 1 + (pecas)
  pagina "setTimeout(() => window.bancadaLivre.executar('componente.adicionar', {tipo:'SWITCH', x: 10, y: 10}), 1000); 1" | Out-Null
  $t = [Diagnostics.Stopwatch]::StartNew(); while ($t.ElapsedMilliseconds -lt (1000 + $atraso)) { }
  $p.CloseMainWindow() | Out-Null
  $fechou = $p.WaitForExit(15000); if (-not $fechou) { Stop-Process -Id $p.Id -Force }
  if ((noArquivo) -eq $n -and $fechou) { $certos++ } else { $detalhes += "$atraso ms" }
}
anotar 'Fechar logo depois de uma mudança (10 vezes, 350 a 500 ms)' ($certos -eq 10) "$certos de 10 com a mudança no arquivo$(if ($detalhes) { '; perdeu em ' + ($detalhes -join ', ') })"

# 2) gravação que falha (uma pasta com o nome do arquivo final impede a troca) e depois volta a poder. O circuito de
#    partida leva uma revisão acima de qualquer outra cópia do perfil: a página abre a de maior revisão (2.1.1-rc.5)
'{"version":1,"components":[{"id":"a1","type":"LED","x":100,"y":100}],"wires":[],"salvamento":{"hora":' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ',"revisao":1000000000}}' | Set-Content "$dados\circuito.json" -NoNewline
Remove-Item "$dados\circuito-anterior.json" -ErrorAction SilentlyContinue
$p = abrir
Remove-Item "$dados\circuito.json"
New-Item -ItemType Directory "$dados\circuito.json" | Out-Null
pagina "window.bancadaLivre.executar('componente.adicionar', {tipo:'LED', x: 200, y: 100}).ok" | Out-Null
Start-Sleep 2
$aviso = pagina "document.querySelector('.status [role=alert]')?.textContent ?? ''"
Remove-Item "$dados\circuito.json"
Start-Sleep 8
$depois = noArquivo
$avisoDepois = pagina "document.querySelector('.status [role=alert]')?.textContent ?? ''"
anotar 'Falha ao gravar: aviso, nova tentativa sozinha e o aviso some' ($aviso -match 'falhou' -and $depois -eq 2 -and $avisoDepois -match '^""$') "aviso na falha: $([bool]($aviso -match 'falhou')); arquivo 8 s depois de liberar: $depois peça(s) (esperado 2); aviso depois: $avisoDepois"
fechar $p
# a mesma falha no fechamento: o programa pergunta; "Não" mantém a janela aberta
$p = abrir
Remove-Item "$dados\circuito.json" -ErrorAction SilentlyContinue; New-Item -ItemType Directory "$dados\circuito.json" | Out-Null
pagina "window.bancadaLivre.executar('componente.adicionar', {tipo:'LED', x: 300, y: 100}).ok" | Out-Null
Start-Sleep 1
$p.CloseMainWindow() | Out-Null
$perguntou = $false; for ($i = 0; $i -lt 40 -and -not $perguntou; $i++) { Start-Sleep -Milliseconds 250; $perguntou = botao $p.Id '&Não' }
Start-Sleep 1
$aberta = -not $p.HasExited
Remove-Item "$dados\circuito.json"
fechar $p
$final = noArquivo
anotar 'Fechar sem conseguir gravar: pergunta, "Não" mantém aberta, e grava depois' ($perguntou -and $aberta -and $final -eq 3) "perguntou: $perguntou; ficou aberta: $aberta; arquivo ao fechar de novo: $final (esperado 3)"
# arquivo de versão antiga (sem revisão) com data NOVA e o localStorage com revisão maior: abre o localStorage. A data do
# arquivo não decide nada (auditoria de 30/10/2026, BL-NR-04)
'{"version":1,"components":[{"id":"velho","type":"LED","x":100,"y":100}],"wires":[]}' | Set-Content "$dados\circuito.json" -NoNewline
(Get-Item "$dados\circuito.json").LastWriteTime = (Get-Date).AddMinutes(10)
$p = abrir
$n = pecas
fechar $p
anotar 'Arquivo sem revisão, mesmo com data nova, perde para o localStorage mais novo' ($n -eq 3) "abriu com $n peça(s) (o localStorage tinha 3; o arquivo, 1)"

# 3) segunda abertura no mesmo perfil: traz a primeira janela para a frente e sai
$p1 = abrir
$antes = pecas
$p2 = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru
$abertos += $p2.Id
$saiu = $p2.WaitForExit(10000)
$paginas = @((Invoke-RestMethod http://127.0.0.1:9333/json) | Where-Object { $_.type -eq 'page' -and $_.url -like 'http://tauri.localhost*' }).Count
anotar 'Segunda abertura no mesmo perfil não abre outra janela' ($saiu -and $paginas -eq 1 -and -not $p1.HasExited) "a segunda saiu: $saiu; janelas do simulador: $paginas; a primeira seguiu aberta: $(-not $p1.HasExited)"
if (-not $p2.HasExited) { Stop-Process -Id $p2.Id -Force }
fechar $p1
# C2) queda brusca no meio da gravação: o programa morto 0,4 a 0,5 s depois de uma peça nova, 5 vezes. O arquivo fica
# íntegro, com a peça, e o programa reabre com ela
$certos = 0
for ($i = 0; $i -lt 5; $i++) {
  $p = abrir
  $n = 1 + (pecas)
  pagina "window.bancadaLivre.executar('componente.adicionar', {tipo:'LED', x: $(60 + 40 * $i), y: 500}).ok" | Out-Null
  Start-Sleep -Milliseconds (Get-Random -Minimum 400 -Maximum 500)
  Stop-Process -Id $p.Id -Force
  Start-Sleep 3
  $arquivo = noArquivo
  $q = abrir
  $reaberto = pecas
  fechar $q
  if ($arquivo -eq $n -and $reaberto -eq $n) { $certos++ }
}
anotar 'Queda brusca logo depois de uma mudança (C2, 5 vezes)' ($certos -eq 5) "$certos de 5 com a peça no arquivo e na reabertura"
# fechar e abrir de novo logo em seguida: a nova abertura não pode sumir enquanto a anterior termina de fechar
$certos = 0
for ($i = 0; $i -lt 5; $i++) {
  $p = abrir
  $p.CloseMainWindow() | Out-Null
  $q = abrir
  $resposta = pagina '1' 2>$null
  if (-not $q.HasExited -and "$resposta" -eq '1') { $certos++ }
  fechar $q; if (-not $p.HasExited) { $p.WaitForExit(10000) | Out-Null }
}
anotar 'Fechar e abrir de novo logo em seguida (5 vezes)' ($certos -eq 5) "$certos de 5 com a nova janela aberta e respondendo"
# reabrir logo depois de uma queda (o programa morto à força): até a 2.1.0, às vezes a reabertura morria sem aviso
# (0xc0000409, WebView2 ainda ocupado). Agora a janela só aparece pronta, com novas tentativas
$certos = 0
for ($i = 0; $i -lt 10; $i++) {
  $p = abrir
  Stop-Process -Id $p.Id -Force
  Start-Sleep 3
  $q = abrir
  $resposta = pagina '1' 2>$null
  if (-not $q.HasExited -and "$resposta" -eq '1') { $certos++ }
  fechar $q
}
$fatais = if (Test-Path "$dados\erro.log") { @(Select-String -Path "$dados\erro.log" -Pattern 'erro fatal').Count } else { 0 }
$tentativas = if (Test-Path "$dados\erro.log") { @(Select-String -Path "$dados\erro.log" -Pattern 'erro ao criar').Count } else { 0 }
anotar 'Reabrir logo depois de uma queda (10 vezes)' ($certos -eq 10 -and $fatais -eq 0) "$certos de 10 com a janela aberta e respondendo; erros fatais anotados: $fatais; criações refeitas: $tentativas"
$avisos = if (Test-Path $caixasArq) { @(Get-Content $caixasArq) } else { @() }
anotar 'Nenhum aviso de erro do programa' ($avisos.Count -eq 0) "$($avisos.Count) aviso(s)$(if ($avisos) { ': ' + $avisos[0] })"
anotar 'Nenhum temporário sobrando' (@(Get-ChildItem $dados -Filter '*.tmp').Count -eq 0) "$(@(Get-ChildItem $dados -Filter '*.tmp').Count) arquivo(s) .tmp"

# 4) (opcional) instalar e desinstalar de verdade, na conta, logo depois de abrir
if ($Desinstalar) {
  $env:LOCALAPPDATA = $perfilReal
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $null
  $app = Join-Path $perfilReal 'Programs\Bancada Livre\BancadaLivre.exe'
  $chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{B3D1A6E0-5C2F-4A87-9E14-7F0C2B8D4E61}_is1'
  $certos = 0
  for ($i = 1; $i -le 5; $i++) {
    $e1 = (Start-Process $Exe -ArgumentList '--instalar' -PassThru -Wait).ExitCode
    # o programa instalado abre no perfil de rascunho (só a instalação toca a conta)
    $env:LOCALAPPDATA = $perfil
    $p = Start-Process $app -ArgumentList '--sem-instalar' -PassThru
    $abertos += $p.Id
    $env:LOCALAPPDATA = $perfilReal
    Start-Sleep 3; $p.CloseMainWindow() | Out-Null; if (-not $p.WaitForExit(15000)) { Stop-Process -Id $p.Id -Force }
    $e2 = (Start-Process $app -ArgumentList '--desinstalar', '--silencioso' -PassThru -Wait).ExitCode
    if ($e1 -eq 0 -and $e2 -eq 0 -and -not (Test-Path $app) -and -not (Test-Path $chave)) { $certos++ }
  }
  anotar 'Instalar e desinstalar logo depois de abrir (5 vezes)' ($certos -eq 5) "$certos de 5 completas (código 0, sem exe e sem chave sobrando)"
}
} finally {
  # fecha o que o teste abriu, também se ele parou no meio: o programa e o WebView2 do perfil de rascunho
  $env:LOCALAPPDATA = $perfilReal
  # só o que este teste abriu (pelo PID): um Bancada que o professor esteja usando não é tocado
  Get-Process -Id $abertos -ErrorAction SilentlyContinue | ForEach-Object {
    $_.CloseMainWindow() | Out-Null; if (-not $_.WaitForExit(10000)) { Stop-Process -Id $_.Id -Force } }
  Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($perfil) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
# o perfil de rascunho não serve mais: sai (o relatório fica)
Start-Sleep 1; Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue

$texto = @("## Salvamento no programa real: $(Split-Path $Exe -Leaf) ($((Get-Item $Exe).VersionInfo.ProductVersion))", '',
  '| Teste | Resultado | Detalhe |', '|---|---|---|') + $linhas
$texto | Set-Content (Join-Path $Saida 'salvamento.md') -Encoding utf8
if ($env:GITHUB_STEP_SUMMARY) { $texto | Add-Content $env:GITHUB_STEP_SUMMARY -Encoding utf8 }
$texto
if ($falhas) { exit 1 }
