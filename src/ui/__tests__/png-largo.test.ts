// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Validação no Linux da 2.1.2 (achado 1, leve): o PNG tinha sempre o dobro do tamanho do circuito; num circuito com
// mais de uns 16 mil px de largura, o canvas passava de 32767 px, o Firefox não desenhava e a pessoa não via aviso.
import { expect, it } from 'vitest'
import { escalaDoPng, PNG_AREA_MAX, PNG_LADO_MAX } from '../exportPng'

it('circuito de aula sai no dobro do tamanho', () => {
  expect(escalaDoPng(1732 / 2, 804 / 2)).toBe(2)
})

it('circuito muito largo cabe no limite do Firefox (32767 px)', () => {
  const largura = 28206 // os 56412 px do relatório, no tamanho real
  const s = escalaDoPng(largura, 926)
  expect(Math.floor(largura * s)).toBeLessThanOrEqual(PNG_LADO_MAX)
  expect(PNG_LADO_MAX).toBeLessThan(32767)
})

it('circuito grande nas duas direções respeita a área máxima', () => {
  const s = escalaDoPng(12000, 12000)
  expect(Math.floor(12000 * s) ** 2).toBeLessThanOrEqual(PNG_AREA_MAX)
})
