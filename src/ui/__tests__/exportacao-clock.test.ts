// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest'
import { exportBenchPng, exportBenchSvg } from '../exportPng'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it.each(['svg', 'png'])('exportação %s embute fundo azul e ícone branco do CLOCK', async (formato) => {
  const atributos = () => {
    const valores = new Map<string, string>()
    return { setAttribute: (k: string, v: string) => valores.set(k, v),
      xml: () => [...valores].map(([k, v]) => k + '="' + v + '"').join(' ') }
  }
  const rect = atributos(), icon = atributos(), raiz = atributos()
  const clone = { ...raiz,
    querySelectorAll: (seletor: string) => seletor === '.clock-botao rect' ? [rect] :
      seletor === '.clock-botao .icon' ? [icon] : [],
  }
  vi.stubGlobal('document', {
    querySelector: () => ({ getBoundingClientRect: () => ({ width: 800, height: 600 }),
      cloneNode: () => clone, querySelectorAll: () => [] }),
    createElement: () => ({ click: vi.fn() }),
  })
  vi.stubGlobal('XMLSerializer', class {
    serializeToString() { return '<svg ' + raiz.xml() + '><g class="clock-botao"><rect ' +
      rect.xml() + '/><svg class="icon" ' + icon.xml() + '><path fill="currentColor"/></svg></g></svg>' }
  })
  vi.stubGlobal('Image', class { onload = null; src = '' })
  const blobs: Blob[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { blobs.push(blob as Blob); return 'blob:teste' })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  if (formato === 'svg') exportBenchSvg()
  else exportBenchPng()
  expect(blobs).toHaveLength(1)
  const xml = await blobs[0].text()
  expect(xml).toMatch(/<rect[^>]*fill="#1b4f8a"/)
  expect(xml).toContain('stroke="#0f2f52"')
  expect(xml).toMatch(/class="icon"[^>]*color="#ffffff"/)
})
