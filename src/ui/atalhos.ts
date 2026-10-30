// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Quando os atalhos de teclado do circuito (Delete, Backspace, Ctrl+Z, Ctrl+Y, E, R) não valem.

type Documento = Pick<Document, 'activeElement' | 'querySelector'>

/**
 * `true`: o atalho é ignorado. Valem só com a bancada em uso: não ao digitar num campo, nem com uma janela modal aberta
 * (Sobre, Guia de CIs, edição de componente, mapa de Karnaugh). Antes, com a janela de edição aberta e o foco num botão
 * dela, Backspace apagava a própria peça que estava sendo editada (auditoria independente de 29/10/2026, BL-05).
 */
export function ignorarAtalho(doc: Documento): boolean {
  const t = doc.activeElement?.tagName
  if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return true
  return doc.querySelector('.modal') !== null
}
