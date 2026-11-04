// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Exporta a bancada como imagem PNG ou como desenho vetorial SVG (nítido em qualquer tamanho, bom para prova e
// slides): o circuito inteiro em tamanho real, seja qual for o zoom da tela (ver vistaDeExportacao).
import { useCircuit } from '../state/store'
import { limitesDosComponentes, vistaDeExportacao } from './vista'

/** O desenho da bancada pronto para sair do programa: SVG solto, com os estilos embutidos. */
function svgDaBancada(): { xml: string; rect: { width: number; height: number } } | null {
  const svg = document.querySelector('.bench svg') as SVGSVGElement | null
  if (!svg) return null
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
  // Os controles do CLOCK também dependem de classes que não acompanham o SVG.
  for (const fundo of clone.querySelectorAll('.clock-botao rect')) {
    fundo.setAttribute('fill', '#1b4f8a')
    fundo.setAttribute('stroke', '#0f2f52')
    fundo.setAttribute('stroke-width', '1')
  }
  for (const icon of clone.querySelectorAll('.clock-botao .icon')) icon.setAttribute('color', '#ffffff')
  // textos de componentes espelhados ou girados: o CSS que os mantém de pé vai junto, no atributo style
  const vivos = svg.querySelectorAll('text')
  clone.querySelectorAll('text').forEach((t, i) => {
    const tr = getComputedStyle(vivos[i]).transform
    if (tr && tr !== 'none') t.setAttribute('style', `transform-box: fill-box; transform-origin: center; transform: ${tr}`)
  })
  return { xml: new XMLSerializer().serializeToString(clone), rect }
}

function baixarArquivo(blob: Blob, nome: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportBenchSvg() {
  const pronto = svgDaBancada()
  if (!pronto) return
  // fundo branco embaixo de tudo: sem ele, o desenho fica transparente no editor de slides
  const xml = pronto.xml.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" fill="#ffffff"/>')
  baixarArquivo(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], { type: 'image/svg+xml;charset=utf-8' }), 'circuito.svg')
}

/**
 * Maior lado e maior área que a imagem pode ter: o Firefox não desenha um canvas com lado acima de 32767 px, e os
 * navegadores têm limite de área. Validação no Linux da 2.1.2: num circuito muito largo o PNG não saía, sem aviso.
 */
export const PNG_LADO_MAX = 16384
export const PNG_AREA_MAX = 100_000_000
const AVISO_PNG = 'Não foi possível gerar o PNG deste circuito. Use SVG, que sai em qualquer tamanho.'

/** Escala do PNG: o dobro do tamanho real para ficar nítido no projetor, menos quando passaria dos limites. */
export function escalaDoPng(largura: number, altura: number): number {
  const w = Math.max(1, largura)
  const h = Math.max(1, altura)
  return Math.min(2, PNG_LADO_MAX / w, PNG_LADO_MAX / h, Math.sqrt(PNG_AREA_MAX / (w * h)))
}

export function exportBenchPng() {
  const pronto = svgDaBancada()
  if (!pronto) return
  const { xml, rect } = pronto
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  const img = new Image()
  img.onload = () => {
    const scale = escalaDoPng(rect.width, rect.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(rect.width * scale))
    canvas.height = Math.max(1, Math.floor(rect.height * scale))
    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
    } catch (e) {
      console.warn('Bancada Livre: o PNG não pôde ser desenhado.', e)
      URL.revokeObjectURL(url)
      window.alert(AVISO_PNG)
      return
    }
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => {
      if (blob) baixarArquivo(blob, 'circuito.png')
      else window.alert(AVISO_PNG)
    })
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    window.alert(AVISO_PNG)
  }
  img.src = url
}
