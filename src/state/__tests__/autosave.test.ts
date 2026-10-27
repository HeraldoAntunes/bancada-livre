// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Salvamento automático estragado ou recusado: abre vazio, mas guarda a cópia e avisa.

import { afterEach, describe, expect, it, vi } from 'vitest'

function fakeStorage(inicial: Record<string, string>) {
  const m = new Map(Object.entries(inicial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('salvamento automático recusado', () => {
  it('abre a bancada vazia, guarda o salvo à parte e avisa', async () => {
    const ruim = JSON.stringify({ version: 1, components: [{ id: 'c', type: 'IC', chip: 'constructor', x: 0, y: 0 }], wires: [] })
    const ls = fakeStorage({ 'simulador-portas:autosave': ruim })
    vi.stubGlobal('localStorage', ls)
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { useCircuit, AUTOSAVE_RECUSADO_KEY } = await import('../store')
    expect(useCircuit.getState().components).toEqual([])
    expect(ls.m.get(AUTOSAVE_RECUSADO_KEY)).toBe(ruim)
    expect(aviso).toHaveBeenCalled()
  })

  it('JSON quebrado também é guardado', async () => {
    const ls = fakeStorage({ 'simulador-portas:autosave': '{quebrado' })
    vi.stubGlobal('localStorage', ls)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { AUTOSAVE_RECUSADO_KEY } = await import('../store')
    expect(ls.m.get(AUTOSAVE_RECUSADO_KEY)).toBe('{quebrado')
  })

  it('salvo válido abre normalmente', async () => {
    const bom = JSON.stringify({ version: 1, components: [{ id: 'a', type: 'SWITCH', x: 0, y: 0 }], wires: [] })
    vi.stubGlobal('localStorage', fakeStorage({ 'simulador-portas:autosave': bom }))
    const { useCircuit } = await import('../store')
    expect(useCircuit.getState().components).toHaveLength(1)
  })
})
