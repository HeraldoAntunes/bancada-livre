// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Frase do passo a passo: diz, em linguagem de aula, o que acontece em cada nível da onda de propagação.
import { chipOf } from '../engine/ics'
import { isGate, type CircuitComponent } from '../engine/types'

const NOME: Record<string, string> = {
  SWITCH: 'chave',
  PUSH_BUTTON: 'botão',
  CLOCK: 'clock',
  LEVEL_HIGH: 'nível alto',
  LEVEL_LOW: 'nível baixo',
  LED: 'LED',
  DISPLAY: 'display',
  PROBE: 'sonda',
}
const SAIDAS = new Set(['LED', 'DISPLAY', 'PROBE'])

function nomeDe(c: CircuitComponent): string {
  const base = c.type === 'IC' ? `CI ${chipOf(c).id}` : isGate(c.type) ? c.type : (NOME[c.type] ?? c.type)
  return c.label ? `${base} ${c.label}` : base
}

function lista(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export function descreverNivel(
  comps: CircuitComponent[],
  niveis: Map<string, number>,
  nivel: number,
  maxNivel: number,
): string {
  const doNivel = comps.filter((c) => niveis.get(c.id) === nivel && c.type !== 'LABEL')
  if (nivel === 0) {
    const nomes = doNivel.map(nomeDe)
    return nomes.length
      ? `As entradas definem os sinais: ${lista(nomes)}. Avance para ver o sinal seguir pelos fios.`
      : 'Ainda não há entradas no circuito.'
  }
  const saidas = doNivel.filter((c) => SAIDAS.has(c.type)).map(nomeDe)
  const calculam = doNivel.filter((c) => !SAIDAS.has(c.type)).map(nomeDe)
  const partes: string[] = []
  if (calculam.length) partes.push(`O sinal chega a ${lista(calculam)}, que ${calculam.length > 1 ? 'calculam suas saídas' : 'calcula a saída'}.`)
  if (saidas.length) partes.push(`O resultado aparece em ${lista(saidas)}.`)
  if (nivel === maxNivel) partes.push('Fim da propagação: todo o circuito já reagiu.')
  return partes.join(' ')
}
