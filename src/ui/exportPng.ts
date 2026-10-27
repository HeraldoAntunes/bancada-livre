// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Exporta a bancada (SVG) como imagem PNG (RF-08): o circuito inteiro em tamanho real, seja qual for o
// zoom da tela (ver vistaDeExportacao).
import { useCircuit } from '../state/store'
import { limitesDosComponentes, vistaDeExportacao } from './vista'

export function exportBenchPng() {
  const svg = document.querySelector('.bench svg') as SVGSVGElement | null
  if (!svg) return
  const tela = svg.getBoundingClientRect()
  const regiao = limitesDosComponentes(useCircuit.getState().components)
  const exp = regiao ? vistaDeExportacao(regiao) : null
  const rect = exp ? { width: exp.largura, height: exp.altura } : tela
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(rect.width))
  clone.setAttribute('height', String(rect.height))
  if (exp) {
    const t = `translate(${exp.vista.x} ${exp.vista.y}) scale(1)`
    clone.querySelector(':scope > g')?.setAttribute('transform', t)
    clone.querySelector('pattern')?.setAttribute('patternTransform', t)
  }
  // O SVG serializado perde o styles.css: embute os estilos que vinham de classe.
  clone.setAttribute('font-family', "'Segoe UI', system-ui, sans-serif")
  for (const pin of clone.querySelectorAll('.pin')) {
    pin.setAttribute('fill', '#ffffff')
    pin.setAttribute('stroke', '#1a1a1a')
    pin.setAttribute('stroke-width', '2.5')
  }
  // textos de componentes espelhados ou girados: o CSS que os mantém de pé vai junto, no atributo style
  const vivos = svg.querySelectorAll('text')
  clone.querySelectorAll('text').forEach((t, i) => {
    const tr = getComputedStyle(vivos[i]).transform
    if (tr && tr !== 'none') t.setAttribute('style', `transform-box: fill-box; transform-origin: center; transform: ${tr}`)
  })
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  const img = new Image()
  img.onload = () => {
    const scale = 2 // nitidez para projeção/impressão
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(rect.width * scale)
    canvas.height = Math.round(rect.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'circuito.png'
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }
  img.src = url
}
