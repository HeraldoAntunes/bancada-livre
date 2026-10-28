// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Mapa de Karnaugh (2 a 4 variáveis) e expressão mínima em soma de produtos, a partir da tabela-verdade.
// A simplificação junta mintermos vizinhos em implicantes primos (método de Quine-McCluskey) e escolhe o menor
// conjunto que cobre todos os 1s; com no máximo 16 células, a busca exata é instantânea.
// Notação igual à da soma de mintermos: A' = negado, · = E, + = OU.

import type { CircuitTable } from './truthTable'

/** Um implicante: os bits de `valor` valem onde `mascara` tem 0; onde tem 1, a variável some do termo. */
export interface Implicante {
  valor: number
  mascara: number
}

export interface Grupo {
  implicante: Implicante
  /** Mintermos cobertos (números das linhas da tabela). */
  mintermos: number[]
  termo: string
}

export interface MapaKarnaugh {
  /** Variáveis das linhas e das colunas do mapa, da mais alta para a mais baixa. */
  varsLinha: string[]
  varsColuna: string[]
  /** Rótulos em código Gray (vizinhos diferem em um bit só). */
  rotulosLinha: string[]
  rotulosColuna: string[]
  /** Mintermo de cada célula [linha][coluna] e o valor da saída nela. */
  mintermo: number[][]
  valor: (0 | 1)[][]
  grupos: Grupo[]
  expressao: string
}

const GRAY = [0, 1, 3, 2]
const gray = (bits: number) => (bits === 1 ? [0, 1] : GRAY)
const bin = (v: number, n: number) => v.toString(2).padStart(n, '0')

/** Quantos bits a máscara apaga (tamanho do grupo = 2 elevado a isso). */
const apagados = (m: number) => m.toString(2).replace(/0/g, '').length

/** Implicantes primos dos mintermos, juntando pares que diferem em um bit até não dar mais. */
export function implicantesPrimos(mintermos: number[], n: number): Implicante[] {
  let atual: Implicante[] = mintermos.map((v) => ({ valor: v, mascara: 0 }))
  const primos: Implicante[] = []
  const chave = (i: Implicante) => `${i.valor}/${i.mascara}`
  while (atual.length > 0) {
    const usados = new Set<string>()
    const proximos = new Map<string, Implicante>()
    for (let i = 0; i < atual.length; i++) {
      for (let j = i + 1; j < atual.length; j++) {
        const a = atual[i]
        const b = atual[j]
        if (a.mascara !== b.mascara) continue
        const dif = a.valor ^ b.valor
        // juntam só se diferem em exatamente um bit
        if (dif === 0 || (dif & (dif - 1)) !== 0) continue
        const novo = { valor: a.valor & ~dif & ((1 << n) - 1), mascara: a.mascara | dif }
        proximos.set(chave(novo), novo)
        usados.add(chave(a))
        usados.add(chave(b))
      }
    }
    for (const i of atual) if (!usados.has(chave(i)) && !primos.some((p) => chave(p) === chave(i))) primos.push(i)
    atual = [...proximos.values()]
  }
  return primos
}

const cobre = (i: Implicante, m: number) => (m & ~i.mascara) === (i.valor & ~i.mascara)

/** Menor conjunto de implicantes que cobre todos os mintermos; empate: menos letras no total. */
export function coberturaMinima(primos: Implicante[], mintermos: number[], n: number): Implicante[] {
  if (mintermos.length === 0) return []
  const letras = (lista: Implicante[]) => lista.reduce((s, i) => s + n - apagados(i.mascara), 0)
  let melhor: Implicante[] | null = null
  // poucos primos com 4 variáveis: testar subconjuntos do menor para o maior basta
  const total = primos.length
  for (let k = 1; k <= total && melhor === null; k++) {
    const escolha: number[] = []
    const visitar = (inicio: number) => {
      if (escolha.length === k) {
        const lista = escolha.map((i) => primos[i])
        if (mintermos.every((m) => lista.some((p) => cobre(p, m))) && (melhor === null || letras(lista) < letras(melhor))) {
          melhor = lista
        }
        return
      }
      for (let i = inicio; i < total; i++) {
        escolha.push(i)
        visitar(i + 1)
        escolha.pop()
      }
    }
    visitar(0)
  }
  return melhor ?? primos
}

/** Termo de um implicante com os nomes das variáveis (a primeira é o bit mais alto). */
export function termo(i: Implicante, nomes: string[]): string {
  const n = nomes.length
  const partes = nomes.flatMap((nome, k) => {
    const bit = 1 << (n - 1 - k)
    if (i.mascara & bit) return []
    return [i.valor & bit ? nome : `${nome}'`]
  })
  return partes.length === 0 ? '1' : partes.join('·')
}

/**
 * Mapa de Karnaugh da saída `outIndex`. Null quando o circuito não tem de 2 a 4 entradas, quando a saída é um
 * display ou quando alguma linha não é 0/1.
 */
export function mapaKarnaugh(table: CircuitTable, outIndex: number): MapaKarnaugh | null {
  const out = table.outputs[outIndex]
  const n = table.inputs.length
  if (!out || out.comp.type === 'DISPLAY' || table.rows.length === 0) return null
  if (n < 2 || n > 4) return null
  const valores = table.rows.map((r) => r.outputs[outIndex])
  if (valores.some((v) => v !== 0 && v !== 1)) return null
  const nomes = table.inputs.map((c) => c.name)
  const uns = valores.flatMap((v, m) => (v === 1 ? [m] : []))
  const escolhidos = coberturaMinima(implicantesPrimos(uns, n), uns, n)
  const grupos: Grupo[] = escolhidos.map((i) => ({
    implicante: i,
    mintermos: uns.filter((m) => cobre(i, m)),
    termo: termo(i, nomes),
  }))
  const expressao =
    uns.length === 0 ? '0' : uns.length === table.rows.length ? '1' : grupos.map((g) => g.termo).join(' + ')

  const bitsLinha = Math.floor(n / 2)
  const bitsColuna = n - bitsLinha
  const linhas = gray(bitsLinha)
  const colunas = gray(bitsColuna)
  const mintermo = linhas.map((l) => colunas.map((c) => (l << bitsColuna) | c))
  return {
    varsLinha: nomes.slice(0, bitsLinha),
    varsColuna: nomes.slice(bitsLinha),
    rotulosLinha: linhas.map((l) => bin(l, bitsLinha)),
    rotulosColuna: colunas.map((c) => bin(c, bitsColuna)),
    mintermo,
    valor: mintermo.map((linha) => linha.map((m) => valores[m] as 0 | 1)),
    grupos,
    expressao,
  }
}
