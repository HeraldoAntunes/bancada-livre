// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Cada ação é um comando: toda ação da tela existe também como comando com nome, descrição e parâmetros
// validados, para um agente de IA usar o programa sem clicar (window.bancadaLivre.executar).
import { beforeEach, describe, expect, it } from 'vitest'
import { executar, listar } from '../comandos'
import { CHIP_IDS } from '../engine/ics'
import { useCircuit } from '../state/store'

const st = () => useCircuit.getState()
/** Executa e devolve o resultado; falha o teste se o comando der erro. */
const ok = (nome: string, params: Record<string, unknown> = {}) => {
  const r = executar(nome, params)
  if (!r.ok) throw new Error(`${nome}: ${r.erro}`)
  return r.resultado as Record<string, unknown>
}
const erro = (nome: string, params: Record<string, unknown> = {}) => {
  const r = executar(nome, params)
  expect(r.ok, `${nome} devia falhar`).toBe(false)
  return r.ok ? '' : r.erro
}

beforeEach(() => {
  useCircuit.setState({
    components: [],
    wires: [],
    selectedId: null,
    past: [],
    future: [],
    clockRunning: true,
    clockMs: 0,
    passo: { ativo: false, nivel: 0 },
    abaPaleta: 'ENTRADAS',
  })
})

/** Comandos que não dependem da tela montada (os de zoom e "Gerar tabela" são registrados pela bancada e pelo painel). */
const NUCLEO = [
  'circuito.ler', 'circuito.json', 'circuito.abrir', 'circuito.limpar', 'exemplo.listar', 'exemplo.abrir',
  'componente.adicionar', 'componente.remover', 'componente.mover', 'componente.rotulo', 'componente.espelhar',
  'componente.girar', 'componente.bits', 'porta.entradas', 'display.modo', 'led.cor', 'fio.ligar', 'fio.remover',
  'selecao.escolher', 'selecao.remover', 'chave.alternar', 'chave.definir', 'banco.alternar', 'botao.pressionar',
  'clock.rodar', 'clock.pausar', 'clock.avancar', 'clock.frequencia', 'tabela.ler', 'tabela.aplicar_linha',
  'tabela.destacar', 'tabela.exportar_csv', 'historico.desfazer', 'historico.refazer', 'nomes.mostrar',
  'guia.abrir', 'guia.fechar', 'guia.carregar_exemplo', 'paleta.aba', 'passo.ligar', 'passo.sair',
  'passo.ir_para', 'passo.proximo', 'passo.anterior', 'arquivo.salvar', 'imagem.exportar',
]

describe('registro de comandos', () => {
  it('tem todos os comandos do núcleo, cada um com descrição e parâmetros descritos', () => {
    const lista = listar()
    const nomes = lista.map((c) => c.nome)
    for (const n of NUCLEO) expect(nomes, n).toContain(n)
    for (const c of lista) {
      expect(c.descricao.length, c.nome).toBeGreaterThan(10)
      for (const p of Object.values(c.params)) expect(p.descricao?.length ?? 0, c.nome).toBeGreaterThan(3)
    }
  })

  it('recusa comando desconhecido e parâmetro errado, com mensagem em português', () => {
    expect(erro('porta.inventada')).toMatch(/comando desconhecido/)
    expect(erro('componente.adicionar', {})).toMatch(/falta o parâmetro "tipo"/)
    expect(erro('componente.adicionar', { tipo: 'XOR3' })).toMatch(/"tipo"/)
    expect(erro('componente.adicionar', { tipo: 'AND', x: 'dez' })).toMatch(/"x".*número/)
    expect(erro('componente.adicionar', { tipo: 'AND', cor: 'azul' })).toMatch(/parâmetro desconhecido: "cor"/)
    expect(erro('chave.alternar', { id: 'nao-existe' })).toMatch(/componente não encontrado/)
  })
})

describe('a tela usa os comandos (o critério não pode voltar atrás)', () => {
  const fontes = import.meta.glob('../ui/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  // gestos contínuos e coisas só da tela, que não são ações do circuito: arrastar (mover ao vivo, um passo do
  // Desfazer por arrasto), selecionar com o clique, abrir a janela de edição e o relógio do CLOCK
  const PERMITIDAS = new Set(['moveComponent', 'checkpoint', 'select', 'editar', 'tickClocks'])
  const acoes = Object.entries(useCircuit.getState())
    .filter(([, v]) => typeof v === 'function')
    .map(([k]) => k)

  it('nenhum arquivo da tela chama ação do store direto, fora dos gestos permitidos', () => {
    for (const [arquivo, fonte] of Object.entries(fontes)) {
      for (const acao of acoes) {
        if (PERMITIDAS.has(acao)) continue
        const direto = new RegExp(`s\\.${acao}\\)|getState\\(\\)\\.${acao}\\(|\\b${acao}\\s*\\}\\s*=\\s*useCircuit\\.getState`)
        expect(direto.test(fonte), `${arquivo} chama ${acao} sem passar por um comando`).toBe(false)
      }
    }
  })

  it('todo comando chamado pela tela existe no registro', () => {
    const daTela = ['vista.ampliar', 'vista.ajustar', 'vista.tamanho_real', 'tabela.gerar'] // registrados pela tela montada
    const nomes = new Set([...listar().map((c) => c.nome), ...daTela])
    for (const [arquivo, fonte] of Object.entries(fontes)) {
      for (const m of fonte.matchAll(/cmd\(\s*'([\w.]+)'/g)) expect(nomes.has(m[1]), `${arquivo}: ${m[1]}`).toBe(true)
      for (const m of fonte.matchAll(/cmd\(\s*\w+ \? '([\w.]+)' : '([\w.]+)'/g)) {
        expect(nomes.has(m[1]) && nomes.has(m[2]), `${arquivo}: ${m[1]} ou ${m[2]}`).toBe(true)
      }
    }
  })

  it('a página expõe o registro para agentes de IA', () => {
    const main = Object.values(import.meta.glob('../main.tsx', { query: '?raw', import: 'default', eager: true }))[0] as string
    expect(main).toMatch(/window\.bancadaLivre\s*=/)
  })
})

describe('montar e usar um circuito só com comandos', () => {
  it('chave, NOT e LED: liga, simula, lê a tabela e aplica uma linha', () => {
    const a = ok('componente.adicionar', { tipo: 'SWITCH', x: 0, y: 0 }).id
    const n = ok('componente.adicionar', { tipo: 'NOT', x: 120, y: 0 }).id
    const l = ok('componente.adicionar', { tipo: 'LED', x: 260, y: 0 }).id
    ok('fio.ligar', { de: `${a}:out`, para: `${n}:in0` })
    ok('fio.ligar', { de: `${l}:in`, para: `${n}:out` }) // em qualquer ordem, como arrastar na tela
    expect(erro('fio.ligar', { de: `${a}:out`, para: `${n}:out` })).toMatch(/saída.*entrada/)
    ok('chave.definir', { id: a, valor: 1 })
    const lido = ok('circuito.ler')
    expect((lido.valores as Record<string, unknown>)[`${l}:in`]).toBe(0)
    const t = ok('tabela.ler')
    expect(t.entradas).toEqual(['A'])
    expect(t.linhas).toEqual([
      { entradas: [0], saidas: [1] },
      { entradas: [1], saidas: [0] },
    ])
    ok('tabela.aplicar_linha', { linha: 0 })
    expect(st().components.find((c) => c.id === a)?.state).toBe(0)
  })

  it('banco de chaves por posição (1 = a de cima) e CI com o chip escolhido', () => {
    const k = ok('componente.adicionar', { tipo: 'DIP_SWITCH', x: 0, y: 0 }).id as string
    ok('banco.alternar', { id: k, posicao: 1 })
    ok('chave.definir', { id: k, posicao: 3, valor: 1 })
    expect(st().components[0].estados).toEqual([1, 0, 1, 0])
    expect(erro('chave.definir', { id: k, valor: 1 })).toMatch(/posicao/)
    const ic = ok('componente.adicionar', { tipo: 'IC', chip: '74283', x: 200, y: 0 }).id
    expect(st().components.find((c) => c.id === ic)?.chip).toBe('74283')
    ok('componente.bits', { id: k, n: 8 })
    expect(erro('componente.bits', { id: k, n: 3 })).toMatch(/4 ou 8/)
  })

  it('cada comando é um passo do Desfazer', () => {
    ok('componente.adicionar', { tipo: 'AND', x: 0, y: 0 })
    ok('componente.adicionar', { tipo: 'OR', x: 0, y: 100 })
    ok('historico.desfazer')
    expect(st().components.map((c) => c.type)).toEqual(['AND'])
    ok('historico.refazer')
    expect(st().components).toHaveLength(2)
  })

  it('salvar em JSON e abrir de novo; arquivo ruim volta como erro', () => {
    ok('componente.adicionar', { tipo: 'LED', x: 0, y: 0 })
    ok('led.cor', { id: st().components[0].id, cor: 'verde' })
    const json = ok('circuito.json').json as string
    ok('circuito.limpar')
    expect(st().components).toHaveLength(0)
    ok('circuito.abrir', { json })
    expect(st().components[0].cor).toBe('verde')
    expect(erro('circuito.abrir', { json: '{"version":1,"components":[{"id":"a"}],"wires":[]}' })).toMatch(/inválido/)
  })

  it('abre todos os exemplos e o exemplo do Guia de cada chip', () => {
    const exemplos = ok('exemplo.listar').exemplos as { nome: string }[]
    expect(exemplos.length).toBeGreaterThanOrEqual(30)
    for (const e of exemplos) {
      ok('exemplo.abrir', { nome: e.nome })
      expect(st().components.length, e.nome).toBeGreaterThan(0)
    }
    for (const chip of CHIP_IDS) {
      ok('guia.carregar_exemplo', { chip })
      expect(st().components.some((c) => c.chip === chip), chip).toBe(true)
    }
  })

  it('passo a passo, aba da paleta, nomes e clock', () => {
    ok('exemplo.abrir', { nome: 'Somador completo' })
    ok('passo.ligar')
    expect(st().passo).toEqual({ ativo: true, nivel: 0 })
    ok('passo.proximo')
    expect(st().passo.nivel).toBe(1)
    ok('passo.ir_para', { nivel: 999 }) // fica no último nível
    expect(st().passo.nivel).toBeGreaterThan(1)
    ok('passo.sair')
    expect(st().passo.ativo).toBe(false)
    ok('paleta.aba', { aba: 'CIS' })
    expect(st().abaPaleta).toBe('CIS')
    ok('nomes.mostrar', { mostrar: false })
    expect(st().showNames).toBe(false)
    ok('clock.pausar')
    expect(st().clockRunning).toBe(false)
  })
})
