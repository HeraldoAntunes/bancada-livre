// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Gabarito: uma tabela-verdade lida de CSV (no mesmo formato do "Exportar CSV") comparada, linha a linha, com a
// tabela do circuito montado. Serve para o professor conferir o circuito do aluno sem internet.

import type { CircuitTable } from './truthTable'

export interface Gabarito {
  /** Nome de cada coluna, como na primeira linha do arquivo. */
  colunas: string[]
  linhas: string[][]
}

export interface LinhaConferida {
  /** Combinação das entradas, na ordem do circuito. */
  entradas: (0 | 1)[]
  /** Saídas que não batem nesta linha: nome, esperado e obtido. */
  erros: { saida: string; esperado: string; obtido: string }[]
}

export interface Conferencia {
  /** Linhas comparadas (as do gabarito cuja combinação existe no circuito). */
  linhas: LinhaConferida[]
  acertos: number
  /** Saídas do gabarito comparadas. */
  saidas: string[]
  /** Colunas do gabarito que não são entrada nem saída do circuito. */
  sobram: string[]
  /** Entradas do circuito que o gabarito não tem: sem elas não dá para achar a linha certa. */
  faltam: string[]
}

/** Limites para um arquivo de gabarito: uma tabela de 8 entradas tem 256 linhas. */
export const MAX_CSV_CHARS = 200_000
const MAX_LINHAS = 512
const MAX_COLUNAS = 40

/** Valor de célula como texto comparável: "1", "0", "X", ou o dígito do display em maiúscula. */
const normal = (v: string) => v.trim().toUpperCase()

/**
 * Lê o CSV. Aceita ponto e vírgula (o que o programa exporta), vírgula ou tabulação, e a marca BOM no começo.
 * Devolve o gabarito ou o motivo da recusa.
 */
export function lerGabarito(texto: string): Gabarito | string {
  if (texto.length > MAX_CSV_CHARS) return 'Arquivo grande demais para ser uma tabela-verdade.'
  const linhas = texto
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  if (linhas.length < 2) return 'O arquivo precisa da linha de nomes e de pelo menos uma linha da tabela.'
  const sep = [';', '\t', ','].find((s) => linhas[0].includes(s)) ?? ';'
  const dividir = (l: string) => l.split(sep).map((c) => c.trim())
  const colunas = dividir(linhas[0])
  if (colunas.length < 2 || colunas.length > MAX_COLUNAS) return 'A tabela precisa de 2 a 40 colunas.'
  if (colunas.some((c) => c === '') || new Set(colunas).size !== colunas.length) {
    return 'Cada coluna precisa de um nome, sem repetir.'
  }
  if (linhas.length - 1 > MAX_LINHAS) return 'A tabela tem linhas demais (no máximo 512).'
  const corpo = linhas.slice(1).map(dividir)
  const ruim = corpo.findIndex((l) => l.length !== colunas.length)
  if (ruim >= 0) return `A linha ${ruim + 2} do arquivo não tem ${colunas.length} colunas.`
  return { colunas, linhas: corpo.map((l) => l.map(normal)) }
}

/** Compara o gabarito com a tabela do circuito. */
export function conferir(g: Gabarito, t: CircuitTable): Conferencia {
  const nomesEntrada = t.inputs.map((c) => c.name)
  const nomesSaida = t.outputs.map((c) => c.name)
  const faltam = nomesEntrada.filter((n) => !g.colunas.includes(n))
  const sobram = g.colunas.filter((c) => !nomesEntrada.includes(c) && !nomesSaida.includes(c))
  const saidas = g.colunas.filter((c) => nomesSaida.includes(c))
  if (faltam.length > 0 || saidas.length === 0) return { linhas: [], acertos: 0, saidas, sobram, faltam }

  const porCombinacao = new Map(t.rows.map((r) => [r.inputs.join(''), r]))
  const linhas: LinhaConferida[] = []
  for (const l of g.linhas) {
    const chave = nomesEntrada.map((n) => l[g.colunas.indexOf(n)]).join('')
    const r = porCombinacao.get(chave)
    if (!r) continue // combinação com algo além de 0 e 1: não existe no circuito
    const erros = saidas.flatMap((s) => {
      const esperado = l[g.colunas.indexOf(s)]
      const obtido = String(r.outputs[nomesSaida.indexOf(s)]).toUpperCase()
      // "X" ou "-" no gabarito: tanto faz (o professor aceita qualquer valor nesta linha)
      return esperado === 'X' || esperado === '-' || esperado === obtido ? [] : [{ saida: s, esperado, obtido }]
    })
    linhas.push({ entradas: r.inputs, erros })
  }
  return { linhas, acertos: linhas.filter((l) => l.erros.length === 0).length, saidas, sobram, faltam }
}

/** Frase do resumo da conferência e se ela merece a cor de certo (só quando houve linhas comparadas e todas bateram). */
export function resumoConferencia(c: Conferencia): { texto: string; certo: boolean } {
  let texto: string
  if (c.faltam.length > 0) texto = `O gabarito não tem a entrada ${c.faltam.join(', ')}: confira os nomes das chaves.`
  else if (c.saidas.length === 0) texto = 'Nenhuma coluna do gabarito tem o nome de uma saída deste circuito.'
  else if (c.linhas.length === 0)
    texto = 'Nenhuma linha do gabarito tem uma combinação de entradas deste circuito: use 0 e 1 nas entradas.'
  else texto = `Gabarito: ${c.acertos} de ${c.linhas.length} linhas certas (saídas ${c.saidas.join(', ')}).`
  if (c.sobram.length > 0) texto += ` Colunas sem par no circuito: ${c.sobram.join(', ')}.`
  const certo = c.faltam.length === 0 && c.saidas.length > 0 && c.linhas.length > 0 && c.acertos === c.linhas.length
  return { texto, certo }
}
