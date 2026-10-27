# Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
# Gera instalador\bancada-livre.ico (16 a 256 px) desenhando o chip BL, o mesmo desenho de src\assets\icone.svg
# (grade de 64 × 64). Uso:  powershell -ExecutionPolicy Bypass -File instalador\gerar-icone.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$saida = Join-Path $PSScriptRoot 'bancada-livre.ico'
$pngs = @()
foreach ($n in 16, 24, 32, 48, 64, 128, 256) {
  $bmp = New-Object System.Drawing.Bitmap $n, $n
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)
  $k = $n / 64.0
  function RR($x, $y, $w, $h, $r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x, $y, 2*$r, 2*$r, 180, 90); $p.AddArc($x+$w-2*$r, $y, 2*$r, 2*$r, 270, 90)
    $p.AddArc($x+$w-2*$r, $y+$h-2*$r, 2*$r, 2*$r, 0, 90); $p.AddArc($x, $y+$h-2*$r, 2*$r, 2*$r, 90, 90); $p.CloseFigure(); $p
  }
  $cor = { param($hex) [System.Drawing.ColorTranslator]::FromHtml($hex) }
  $fundo = & $cor '#14365c'
  $g.FillPath((New-Object System.Drawing.SolidBrush $fundo), (RR (2*$k) (2*$k) (60*$k) (60*$k) (14*$k)))
  # pinos: quatro de cada lado
  $pino = New-Object System.Drawing.Pen (& $cor '#cfe0f4'), ([Math]::Max(1, 3*$k))
  $pino.StartCap = 'Round'; $pino.EndCap = 'Round'
  foreach ($y in 18, 28, 38, 48) {
    $g.DrawLine($pino, 14*$k, $y*$k, 20*$k, $y*$k)
    $g.DrawLine($pino, 44*$k, $y*$k, 50*$k, $y*$k)
  }
  # corpo do chip com borda azul
  $corpo = RR (20*$k) (11*$k) (24*$k) (44*$k) (3*$k)
  $g.FillPath((New-Object System.Drawing.SolidBrush (& $cor '#1a1a1a')), $corpo)
  $g.DrawPath((New-Object System.Drawing.Pen (& $cor '#4dabf7'), ([Math]::Max(1, 2*$k))), $corpo)
  # chanfro (meia-lua no topo) e ponto à direita dele (escolha visual da marca; os chips da bancada
  # seguem o CI real, com o pino 1 à esquerda)
  $g.FillPie((New-Object System.Drawing.SolidBrush $fundo), 28*$k, 7*$k, 8*$k, 8*$k, 0, 180)
  $g.FillEllipse([System.Drawing.Brushes]::White, 37*$k, 15*$k, 4*$k, 4*$k)
  # iniciais BL (abaixo de 24 px viram borrão: ficam só o chip e o chanfro)
  if ($n -ge 24) {
    $fonte = New-Object System.Drawing.Font -ArgumentList 'Segoe UI', ([single](12*$k)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $area = New-Object System.Drawing.RectangleF -ArgumentList ([single](20*$k)), ([single](24*$k)), ([single](24*$k)), ([single](16*$k))
    $g.DrawString('BL', $fonte, [System.Drawing.Brushes]::White, $area, $fmt)
  }
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += ,@($n, $ms.ToArray())
  $g.Dispose(); $bmp.Dispose()
}
# monta o .ico (entradas PNG)
$fs = [System.IO.File]::Create($saida)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$pngs.Count)
$off = 6 + 16 * $pngs.Count
foreach ($e in $pngs) {
  $n = $e[0]; $d = $e[1]
  $bw.Write([byte]($(if ($n -ge 256) {0} else {$n}))); $bw.Write([byte]($(if ($n -ge 256) {0} else {$n})))
  $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$d.Length); $bw.Write([UInt32]$off); $off += $d.Length
}
foreach ($e in $pngs) { $bw.Write([byte[]]$e[1]) }
$bw.Close()
"ícone gerado: $saida ($((Get-Item $saida).Length) bytes)"
