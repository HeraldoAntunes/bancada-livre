// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { lerGabarito, tabelaParaCsv } from '../../engine/gabarito'
import type { CircuitTable, TableColumn } from '../../engine/truthTable'

let useCircuit: typeof import('../store').useCircuit
let revisaoDeEdicao: typeof import('../store').revisaoDeEdicao
const opcoes = { numRuns: 1000, seed: 20261031 }

beforeAll(async () => {
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('localStorage', undefined)
  ;({ useCircuit, revisaoDeEdicao } = await import('../store'))
})
afterAll(() => vi.unstubAllGlobals())

function circuitoAnterior() {
  useCircuit.setState({
    components: [{ id: 'preservado', type: 'LED', x: 10, y: 20 }],
    wires: [], past: [{ components: [], wires: [] }], future: [{ components: [], wires: [] }],
    selectedId: 'preservado',
  })
  return useCircuit.getState()
}
const textoExterno = fc.oneof(
  fc.string({ maxLength: 4096 }),
  fc.jsonValue({ maxDepth: 4 }).map(v => JSON.stringify(v)),
)

it('loadJSON trata texto arbitrário sem lançar e preserva o circuito quando recusa', () => {
  fc.assert(fc.property(textoExterno, texto => {
    const antes = circuitoAnterior()
    const revisao = revisaoDeEdicao()
    const erro = useCircuit.getState().loadJSON(texto)
    expect(erro === null || typeof erro === 'string').toBe(true)
    if (erro !== null) {
      expect(erro.length).toBeGreaterThan(0)
      expect(useCircuit.getState().components).toBe(antes.components)
      expect(useCircuit.getState().wires).toBe(antes.wires)
      expect(useCircuit.getState().past).toBe(antes.past)
      expect(useCircuit.getState().future).toBe(antes.future)
      expect(revisaoDeEdicao()).toBe(revisao)
    }
  }), opcoes)
})

const led = { id: 'led', type: 'LED', x: 0, y: 0 }
const malformado = fc.oneof(
  fc.jsonValue({ maxDepth: 3 }).map(valor => ({ components: { valor }, wires: [] })),
  fc.string().map(tipo => ({ components: [{ ...led, type: 'INVALIDO-' + tipo }], wires: [] })),
  fc.string().map(id => ({ components: [{ ...led, id: 'id:' + id }], wires: [] })),
  fc.integer({ min: 1_000_001, max: 2_000_000 }).map(x => ({ components: [{ ...led, x }], wires: [] })),
  fc.string().map(pin => ({ components: [led], wires: [
    { id: 'fio', from: { comp: 'inexistente', pin }, to: { comp: 'led', pin: 'in' } },
  ] })),
  fc.integer({ max: -1 }).map(revisao => ({ components: [led], wires: [], salvamento: { hora: 0, revisao } })),
)
it('importação recusa estruturas e referências malformadas sem alterar estado ou histórico', () => {
  fc.assert(fc.property(malformado, dados => {
    const antes = circuitoAnterior()
    const revisao = revisaoDeEdicao()
    expect(typeof useCircuit.getState().loadJSON(JSON.stringify({ version: 1, ...dados }))).toBe('string')
    const depois = useCircuit.getState()
    expect(depois.components).toBe(antes.components)
    expect(depois.wires).toBe(antes.wires)
    expect(depois.past).toBe(antes.past)
    expect(depois.future).toBe(antes.future)
    expect(depois.selectedId).toBe(antes.selectedId)
    expect(revisaoDeEdicao()).toBe(revisao)
  }), opcoes)
})

it('circuitos válidos variados são aceitos e conservam peças e fios na ida e volta', () => {
  fc.assert(fc.property(
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    fc.constantFrom(0 as const, 1 as const),
    fc.string({ unit: fc.constantFrom(...'ABC xyzáç012'), maxLength: 8 }),
    (x, y, state, label) => {
      circuitoAnterior()
      const dados = { version: 1, components: [
        { id: 'entrada', type: 'SWITCH', x, y, state, label }, led,
      ], wires: [{ id: 'fio', from: { comp: 'entrada', pin: 'out' }, to: { comp: 'led', pin: 'in' } }] }
      expect(useCircuit.getState().loadJSON(JSON.stringify(dados))).toBeNull()
      const exportado = useCircuit.getState().toJSON()
      expect(JSON.parse(exportado).components).toEqual(dados.components)
      expect(JSON.parse(exportado).wires).toEqual(dados.wires)
      expect(useCircuit.getState().loadJSON(exportado)).toBeNull()
      expect(useCircuit.getState().components).toEqual(dados.components)
      expect(useCircuit.getState().wires).toEqual(dados.wires)
    },
  ), opcoes)
})

const nome = fc.string({
  unit: fc.constantFrom(...'abcXYZ012 ;,\t"\r\n\'=+-@áç', '😀'),
  minLength: 1, maxLength: 24,
}).filter(v => v.trim() !== '')
const coluna = (name: string, i: number, entrada: boolean): TableColumn => ({
  name, key: String(i), pin: entrada ? 'out' : 'in',
  comp: { id: String(i), type: entrada ? 'SWITCH' : 'LED', x: 0, y: 0 },
})
it('CSV faz ida e volta dos nomes especiais e dos valores sem perder espaços ou proteção de fórmula', () => {
  fc.assert(fc.property(
    fc.uniqueArray(nome, { minLength: 4, maxLength: 4 }),
    fc.array(fc.tuple(
      fc.constantFrom(0 as const, 1 as const), fc.constantFrom(0 as const, 1 as const),
      fc.constantFrom('0', '1', 'X', 'E', 'A', 'F'), fc.constantFrom('0', '1', 'X', 'E'),
    ), { minLength: 1, maxLength: 16 }),
    (nomes, linhas) => {
      const tabela: CircuitTable = {
        inputs: nomes.slice(0, 2).map((n, i) => coluna(n, i, true)),
        outputs: nomes.slice(2).map((n, i) => coluna(n, i + 2, false)),
        rows: linhas.map(([a, b, x, y]) => ({ inputs: [a, b], outputs: [x, y] })),
        tooBig: false,
      }
      const lido = lerGabarito(tabelaParaCsv(tabela))
      if (typeof lido === 'string') throw Error(lido)
      expect(lido.colunas).toEqual(nomes)
      expect(lido.linhas).toEqual(linhas.map(l => l.map(String)))
    },
  ), opcoes)
})

it('leitor de CSV trata texto arbitrário sem lançar nem produzir tabela fora dos limites', () => {
  fc.assert(fc.property(fc.string({ maxLength: 4096 }), texto => {
    const lido = lerGabarito(texto)
    if (typeof lido === 'string') {
      expect(lido.length).toBeGreaterThan(0)
    } else {
      expect(lido.colunas.length).toBeGreaterThanOrEqual(2)
      expect(lido.colunas.length).toBeLessThanOrEqual(40)
      expect(new Set(lido.colunas).size).toBe(lido.colunas.length)
      expect(lido.linhas.length).toBeGreaterThanOrEqual(1)
      expect(lido.linhas.length).toBeLessThanOrEqual(512)
      for (const linha of lido.linhas) expect(linha).toHaveLength(lido.colunas.length)
    }
  }), opcoes)
})
