// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Cada ação é um comando: toda ação da tela existe aqui com nome, descrição e parâmetros validados, e a tela
// chama o mesmo caminho. Um agente de IA usa o programa aberto sem clicar, pela página:
//   window.bancadaLivre.listar()                       → comandos, descrições e parâmetros
//   window.bancadaLivre.executar('fio.ligar', { de: 'c1:out', para: 'c2:in0' })
// Cada comando é um passo do Desfazer. Os de zoom e o "Gerar tabela" dependem da tela montada e são registrados
// pela bancada e pelo painel (registrar devolve a função que tira o registro).

import { EXAMPLES } from './examples'
import { CHIP_IDS, chipOf, icPowered } from './engine/ics'
import { allInputPins, allOutputPins } from './engine/pins'
import { propagationLevels } from './engine/propagation'
import { simulate } from './engine/simulate'
import { circuitTruthTable, outputColumns } from './engine/truthTable'
import {
  bitsDe,
  bitsPermitidos,
  CORES_LED,
  entradaUnica,
  GATE_TYPES,
  isGate,
  SINK_TYPES,
  SEQ_TYPES,
  SOURCE_TYPES,
  type CircuitComponent,
  type ComponentType,
  type CorLed,
  type DisplayMode,
} from './engine/types'
import { useCircuit, type AbaPaleta } from './state/store'
import { chipDemo } from './ui/demoDoChip'
import { exportBenchPng, exportBenchSvg } from './ui/exportPng'
import { sinaisObservados } from './engine/linhaDoTempo'
import { mapaKarnaugh } from './engine/karnaugh'
import { conferir, lerGabarito } from './engine/gabarito'
import { version } from '../package.json'

export interface Param {
  tipo: 'texto' | 'numero' | 'inteiro' | 'logico'
  descricao: string
  /** Valores aceitos (lista fechada). */
  valores?: readonly (string | number)[]
  min?: number
  max?: number
  opcional?: boolean
}

export interface Comando {
  descricao: string
  params: Record<string, Param>
  /** Devolve o resultado (ou nada); erro de uso sai como `throw new Falha('mensagem')`. */
  executar: (p: Record<string, unknown>) => unknown
}

export type Resultado = { ok: true; resultado?: unknown } | { ok: false; erro: string }

/** Erro com mensagem pronta para quem chamou (pessoa ou agente). */
export class Falha extends Error {}

const REGISTRO = new Map<string, Comando>()

/** Registra um comando; devolve a função que tira o registro (para comandos de componentes da tela). */
export function registrar(nome: string, comando: Comando): () => void {
  REGISTRO.set(nome, comando)
  return () => {
    if (REGISTRO.get(nome) === comando) REGISTRO.delete(nome)
  }
}

export function listar(): { nome: string; descricao: string; params: Record<string, Param> }[] {
  return [...REGISTRO].map(([nome, c]) => ({ nome, descricao: c.descricao, params: c.params }))
}

function validar(params: Record<string, Param>, p: Record<string, unknown>): string | null {
  for (const nome of Object.keys(p)) {
    if (!(nome in params)) return `parâmetro desconhecido: "${nome}"`
  }
  for (const [nome, def] of Object.entries(params)) {
    const v = p[nome]
    if (v === undefined || v === null) {
      if (def.opcional) continue
      return `falta o parâmetro "${nome}" (${def.descricao})`
    }
    if (def.tipo === 'texto' && typeof v !== 'string') return `"${nome}" deve ser texto`
    if ((def.tipo === 'numero' || def.tipo === 'inteiro') && (typeof v !== 'number' || !Number.isFinite(v))) {
      return `"${nome}" deve ser um número`
    }
    if (def.tipo === 'inteiro' && !Number.isInteger(v)) return `"${nome}" deve ser um número inteiro`
    if (def.tipo === 'logico' && typeof v !== 'boolean') return `"${nome}" deve ser true ou false`
    if (def.valores && !def.valores.includes(v as string | number)) {
      return `"${nome}" deve ser um destes: ${def.valores.join(', ')}`
    }
    if (typeof v === 'number' && def.min !== undefined && v < def.min) return `"${nome}" deve ser no mínimo ${def.min}`
    if (typeof v === 'number' && def.max !== undefined && v > def.max) return `"${nome}" deve ser no máximo ${def.max}`
  }
  return null
}

/** Executa um comando pelo nome. Erro de uso volta como { ok: false, erro }; defeito inesperado do programa é relançado. */
export function executar(nome: string, params: Record<string, unknown> = {}): Resultado {
  const c = REGISTRO.get(nome)
  if (!c) return { ok: false, erro: `comando desconhecido: "${nome}" (veja listar())` }
  const invalido = validar(c.params, params ?? {})
  if (invalido) return { ok: false, erro: `${nome}: ${invalido}` }
  try {
    return { ok: true, resultado: c.executar(params ?? {}) }
  } catch (e) {
    if (e instanceof Falha) return { ok: false, erro: `${nome}: ${e.message}` }
    throw e
  }
}

/** O mesmo `executar`, usado pelos botões e teclas: erro vira um aviso na tela, sem o nome do comando. */
export function executarNaTela(nome: string, params: Record<string, unknown> = {}): Resultado {
  const r = executar(nome, params)
  if (!r.ok) window.alert(r.erro.replace(/^[\w.]+: /, ''))
  return r
}

// ---------------------------------------------------------------- utilidades

const st = () => useCircuit.getState()

function comp(id: unknown, tipos?: ComponentType[]): CircuitComponent {
  const c = st().components.find((x) => x.id === id)
  if (!c) throw new Falha(`componente não encontrado: "${String(id)}"`)
  if (tipos && !tipos.includes(c.type)) throw new Falha(`"${c.id}" é ${c.type}; este comando vale para ${tipos.join(', ')}`)
  return c
}

/** "c3:in0" → { comp, pin }, conferindo que o pino existe e de que lado ele está. */
function pino(texto: unknown): { comp: string; pin: string; dir: 'in' | 'out' } {
  const [id, pin] = String(texto).split(':')
  const c = comp(id)
  if (allOutputPins(c).includes(pin)) return { comp: c.id, pin, dir: 'out' }
  if (allInputPins(c).includes(pin)) return { comp: c.id, pin, dir: 'in' }
  throw new Falha(
    `"${c.id}" (${c.type}) não tem o pino "${pin}"; entradas: ${allInputPins(c).join(', ') || 'nenhuma'}; saídas: ${allOutputPins(c).join(', ') || 'nenhuma'}`,
  )
}

function baixar(nome: string, conteudo: BlobPart, tipo: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}

function tabela() {
  const { components, wires } = st()
  const t = circuitTruthTable(components, wires, 8)
  if (t.inputs.length === 0 || t.outputs.length === 0) {
    throw new Falha('o circuito precisa de pelo menos uma entrada (chave, botão ou banco) e uma saída (LED, barra, display ou sonda)')
  }
  if (t.tooBig) throw new Falha(`no máximo 8 entradas para gerar a tabela (${t.inputs.length} no circuito)`)
  return t
}

const TIPOS: ComponentType[] = [...SOURCE_TYPES, ...GATE_TYPES, ...SEQ_TYPES, ...SINK_TYPES, 'IC', 'LABEL']
const id = { tipo: 'texto', descricao: 'id do componente (ex.: "c3"), como em circuito.ler' } as const
const nada = {} as Record<string, Param>

// ---------------------------------------------------------------- circuito e arquivos

registrar('circuito.ler', {
  descricao: 'Lê o circuito: componentes (com pinos de entrada e saída), fios, valor de cada pino e avisos',
  params: nada,
  executar: () => {
    const { components, wires } = st()
    const sim = simulate(components, wires)
    return {
      componentes: components.map((c) => ({
        ...c,
        entradas: allInputPins(c),
        saidas: allOutputPins(c),
        ...(c.type === 'IC' ? { pinos: chipOf(c).pinLabels } : {}),
      })),
      fios: wires.map((w) => ({
        id: w.id,
        de: `${w.from.comp}:${w.from.pin}`,
        para: `${w.to.comp}:${w.to.pin}`,
        valor: sim.wires.get(w.id) ?? 'X',
      })),
      valores: Object.fromEntries(sim.pins),
      avisos: {
        ciSemAlimentacao: components.filter((c) => c.type === 'IC' && !icPowered(c, sim.pins)).map((c) => c.id),
        laco: [...sim.cycleComps],
        conflito: [...sim.conflictPins],
      },
    }
  },
})

registrar('circuito.json', {
  descricao: 'Devolve o circuito no formato do arquivo salvo (.json)',
  params: nada,
  executar: () => ({ json: st().toJSON() }),
})

registrar('circuito.abrir', {
  descricao: 'Abre um circuito a partir do texto do arquivo .json (substitui a bancada; o Desfazer volta)',
  params: { json: { tipo: 'texto', descricao: 'conteúdo do arquivo .json' } },
  executar: (p) => {
    const err = st().loadJSON(p.json as string)
    if (err) throw new Falha(err)
  },
})

registrar('circuito.limpar', {
  descricao: 'Apaga todos os componentes e fios da bancada (o Desfazer volta)',
  params: nada,
  executar: () => st().clearAll(),
})

registrar('arquivo.salvar', {
  descricao: 'Baixa o circuito como arquivo .json',
  params: { arquivo: { tipo: 'texto', descricao: 'nome do arquivo (padrão circuito.json)', opcional: true } },
  executar: (p) => baixar((p.arquivo as string | undefined) ?? 'circuito.json', st().toJSON(), 'application/json'),
})

registrar('imagem.exportar', {
  descricao: 'Baixa a imagem do circuito inteiro: PNG (padrão) ou SVG, o desenho vetorial nítido em qualquer tamanho',
  params: { formato: { tipo: 'texto', descricao: 'png ou svg', valores: ['png', 'svg'], opcional: true } },
  executar: (p) => (p.formato === 'svg' ? exportBenchSvg() : exportBenchPng()),
})

registrar('exemplo.listar', {
  descricao: 'Lista os circuitos de exemplo, com o grupo de cada um',
  params: nada,
  executar: () => ({ exemplos: EXAMPLES.map((e) => ({ nome: e.name, nivel: e.level })) }),
})

registrar('exemplo.abrir', {
  descricao: 'Abre um circuito de exemplo pelo nome (substitui a bancada; o Desfazer volta)',
  params: { nome: { tipo: 'texto', descricao: 'nome do exemplo, como em exemplo.listar' } },
  executar: (p) => {
    const ex = EXAMPLES.find((e) => e.name === p.nome)
    if (!ex) throw new Falha(`exemplo não encontrado: "${String(p.nome)}"`)
    st().loadCircuit(structuredClone(ex.components), structuredClone(ex.wires))
  },
})

// ---------------------------------------------------------------- componentes

registrar('componente.adicionar', {
  descricao: 'Põe um componente na bancada e devolve o id dele',
  params: {
    tipo: { tipo: 'texto', descricao: 'tipo do componente', valores: TIPOS },
    x: { tipo: 'numero', descricao: 'posição horizontal na bancada (sem ela, perto do canto)', opcional: true },
    y: { tipo: 'numero', descricao: 'posição vertical na bancada', opcional: true },
    chip: { tipo: 'texto', descricao: 'modelo do CI, só no tipo IC (padrão 7400)', valores: CHIP_IDS, opcional: true },
  },
  executar: (p) => {
    if (p.chip !== undefined && p.tipo !== 'IC') throw new Falha('"chip" só vale no tipo IC')
    const n = st().components.length
    st().addComponent(
      p.tipo as ComponentType,
      (p.x as number | undefined) ?? 120 + (n % 6) * 40,
      (p.y as number | undefined) ?? 100 + (n % 6) * 32,
      p.chip as (typeof CHIP_IDS)[number] | undefined,
    )
    const c = st().components[st().components.length - 1]
    return { id: c.id, entradas: allInputPins(c), saidas: allOutputPins(c) }
  },
})

registrar('componente.remover', {
  descricao: 'Remove um componente e os fios ligados nele',
  params: { id },
  executar: (p) => {
    st().select(comp(p.id).id)
    st().deleteSelected()
  },
})

registrar('componente.mover', {
  descricao: 'Move um componente para a posição dada',
  params: { id, x: { tipo: 'numero', descricao: 'nova posição horizontal' }, y: { tipo: 'numero', descricao: 'nova posição vertical' } },
  executar: (p) => {
    const c = comp(p.id)
    st().checkpoint()
    st().moveComponent(c.id, p.x as number, p.y as number)
  },
})

registrar('componente.rotulo', {
  descricao: 'Muda o rótulo do componente (ou o texto, no TEXTO)',
  params: { id, texto: { tipo: 'texto', descricao: 'rótulo (até 8 letras) ou texto da anotação (até 60)' } },
  executar: (p) => {
    const c = comp(p.id)
    const max = c.type === 'LABEL' ? 60 : 8
    if ((p.texto as string).length > max) throw new Falha(`no máximo ${max} caracteres`)
    st().setLabel(c.id, p.texto as string)
  },
})

registrar('componente.espelhar', {
  descricao: 'Espelha o componente: troca o lado das entradas e da saída (tecla E)',
  params: { id },
  executar: (p) => st().espelhar(comp(p.id).id),
})

registrar('componente.girar', {
  descricao: 'Gira o componente 90 graus no sentido horário (tecla R)',
  params: { id },
  executar: (p) => st().girar(comp(p.id).id),
})

registrar('componente.bits', {
  descricao: 'Número de posições do banco de chaves ou da barra de LEDs (4 ou 8), ou de bits do contador (2, 3 ou 4)',
  params: { id, n: { tipo: 'inteiro', descricao: 'posições ou bits' } },
  executar: (p) => {
    const c = comp(p.id, ['DIP_SWITCH', 'LED_BAR', 'COUNTER'])
    const permitidos = bitsPermitidos(c.type)
    if (!permitidos.includes(p.n as number)) throw new Falha(`em ${c.type}, "n" deve ser ${permitidos.join(' ou ').replace(/ ou (?=.* ou )/g, ', ')}`)
    st().setBits(c.id, p.n as number)
  },
})

registrar('porta.entradas', {
  descricao: 'Número de entradas de uma porta (2 a 8; NOT e BUFFER têm uma só)',
  params: { id, n: { tipo: 'inteiro', descricao: 'número de entradas', min: 2, max: 8 } },
  executar: (p) => {
    const c = comp(p.id)
    if (!isGate(c.type) || entradaUnica(c.type)) throw new Falha(`"${c.id}" (${c.type}) não tem número de entradas ajustável`)
    st().setGateInputs(c.id, p.n as number)
  },
})

registrar('display.modo', {
  descricao: 'Modo do display: bcd (0 a 9), hex (0 a F) ou raw (segmento a segmento, a a g)',
  params: { id, modo: { tipo: 'texto', descricao: 'modo do display', valores: ['bcd', 'hex', 'raw'] } },
  executar: (p) => st().setDisplayMode(comp(p.id, ['DISPLAY']).id, p.modo as DisplayMode),
})

registrar('led.cor', {
  descricao: 'Cor do LED ou da barra de LEDs',
  params: { id, cor: { tipo: 'texto', descricao: 'cor do LED', valores: CORES_LED } },
  executar: (p) => st().setCorLed(comp(p.id, ['LED', 'LED_BAR']).id, p.cor as CorLed),
})

// ---------------------------------------------------------------- fios e seleção

registrar('fio.ligar', {
  descricao: 'Liga uma saída a uma entrada (em qualquer ordem); a entrada que já tinha fio troca de fio',
  params: {
    de: { tipo: 'texto', descricao: 'pino de uma ponta, como "c1:out" (componente:pino)' },
    para: { tipo: 'texto', descricao: 'pino da outra ponta, como "c2:in0"' },
  },
  executar: (p) => {
    const a = pino(p.de)
    const b = pino(p.para)
    if (a.dir === b.dir) throw new Falha('um fio liga uma saída a uma entrada; as duas pontas são do mesmo lado')
    const saida = a.dir === 'out' ? a : b
    const entrada = a.dir === 'in' ? a : b
    st().connect({ comp: saida.comp, pin: saida.pin }, { comp: entrada.comp, pin: entrada.pin })
    return { id: st().wires[st().wires.length - 1].id }
  },
})

registrar('fio.remover', {
  descricao: 'Remove um fio pelo id (ver circuito.ler)',
  params: { id: { tipo: 'texto', descricao: 'id do fio (ex.: "w4")' } },
  executar: (p) => {
    if (!st().wires.some((w) => w.id === p.id)) throw new Falha(`fio não encontrado: "${String(p.id)}"`)
    st().select(p.id as string)
    st().deleteSelected()
  },
})

registrar('selecao.escolher', {
  descricao: 'Seleciona um componente ou fio (o painel mostra as propriedades); sem id, desmarca',
  params: { id: { tipo: 'texto', descricao: 'id do componente ou do fio', opcional: true } },
  executar: (p) => st().select((p.id as string | undefined) ?? null),
})

registrar('selecao.remover', {
  descricao: 'Remove o componente ou fio selecionado (tecla Delete)',
  params: nada,
  executar: () => st().deleteSelected(),
})

// ---------------------------------------------------------------- entradas

registrar('chave.alternar', {
  descricao: 'Alterna a chave (SWITCH) entre 0 e 1',
  params: { id },
  executar: (p) => st().toggleSwitch(comp(p.id, ['SWITCH']).id),
})

registrar('banco.alternar', {
  descricao: 'Alterna uma posição do banco de chaves',
  params: { id, posicao: { tipo: 'inteiro', descricao: 'posição, 1 = a de cima', min: 1, max: 8 } },
  executar: (p) => {
    const c = comp(p.id, ['DIP_SWITCH'])
    if ((p.posicao as number) > bitsDe(c)) throw new Falha(`o banco "${c.id}" tem ${bitsDe(c)} posições`)
    st().toggleChave(c.id, (p.posicao as number) - 1)
  },
})

registrar('chave.definir', {
  descricao: 'Põe a chave, ou uma posição do banco de chaves, em 0 ou 1',
  params: {
    id,
    valor: { tipo: 'inteiro', descricao: '0 ou 1', valores: [0, 1] },
    posicao: { tipo: 'inteiro', descricao: 'só no banco de chaves: posição, 1 = a de cima', min: 1, max: 8, opcional: true },
  },
  executar: (p) => {
    const c = comp(p.id, ['SWITCH', 'DIP_SWITCH'])
    if (c.type === 'SWITCH') {
      if ((c.state ?? 0) !== p.valor) st().toggleSwitch(c.id)
      return
    }
    if (p.posicao === undefined) throw new Falha('no banco de chaves, diga a "posicao" (1 = a de cima)')
    const i = (p.posicao as number) - 1
    if (i >= bitsDe(c)) throw new Falha(`o banco "${c.id}" tem ${bitsDe(c)} posições`)
    if ((c.estados?.[i] ?? 0) !== p.valor) st().toggleChave(c.id, i)
  },
})

registrar('botao.pressionar', {
  descricao: 'Aperta (true) ou solta (false) o PUSH BUTTON',
  params: { id, pressionado: { tipo: 'logico', descricao: 'true aperta, false solta' } },
  executar: (p) => st().setPressed(comp(p.id, ['PUSH_BUTTON']).id, p.pressionado as boolean),
})

registrar('clock.rodar', {
  descricao: 'Põe para rodar o CLOCK e o contador',
  params: nada,
  executar: () => st().setClockRunning(true),
})

registrar('clock.pausar', {
  descricao: 'Pausa o CLOCK e o contador',
  params: nada,
  executar: () => st().setClockRunning(false),
})

registrar('clock.avancar', {
  descricao: 'Com o clock pausado, avança meio período do CLOCK (ou um passo do contador)',
  params: nada,
  executar: () => st().stepClock(),
})

registrar('clock.frequencia', {
  descricao: 'Frequência do CLOCK ou do contador, em Hz',
  params: { id, hz: { tipo: 'numero', descricao: 'frequência', valores: [0.5, 1, 2, 5, 10] } },
  executar: (p) => st().setClockFreq(comp(p.id, ['CLOCK', 'COUNTER']).id, p.hz as number),
})

// ---------------------------------------------------------------- memória

registrar('memoria.definir', {
  descricao: 'Estado guardado de um flip-flop ou trava D (Q = 0 ou 1), sem esperar o clock',
  params: { id, q: { tipo: 'inteiro', descricao: 'novo estado', valores: [0, 1] } },
  executar: (p) => st().setEstadoMemoria(comp(p.id, [...SEQ_TYPES]).id, p.q as 0 | 1),
})

// ---------------------------------------------------------------- tabela-verdade

registrar('tabela.ler', {
  descricao: 'Tabela-verdade do circuito: nomes das entradas e saídas e todas as linhas (até 8 entradas)',
  params: nada,
  executar: () => {
    const t = tabela()
    return {
      entradas: t.inputs.map((c) => c.name),
      saidas: t.outputs.map((c) => c.name),
      linhas: t.rows.map((r) => ({ entradas: r.inputs, saidas: r.outputs })),
    }
  },
})

registrar('tabela.aplicar_linha', {
  descricao: 'Põe as chaves do circuito na combinação de uma linha da tabela-verdade',
  params: { linha: { tipo: 'inteiro', descricao: 'número da linha, a partir de 0', min: 0 } },
  executar: (p) => {
    const t = tabela()
    const r = t.rows[p.linha as number]
    if (!r) throw new Falha(`a tabela tem ${t.rows.length} linhas (0 a ${t.rows.length - 1})`)
    st().applyInputs(new Map(t.inputs.map((c, i) => [c.key, r.inputs[i]])))
  },
})

registrar('tabela.destacar', {
  descricao: 'Mostra a tabela-verdade numa janela solta (true) ou de volta no painel (false)',
  params: { solta: { tipo: 'logico', descricao: 'true solta, false no painel' } },
  executar: (p) => st().setTabelaSolta(p.solta as boolean),
})

registrar('tabela.exportar_csv', {
  descricao: 'Baixa a tabela-verdade do circuito em CSV (separador ponto e vírgula)',
  params: nada,
  executar: () => {
    const t = tabela()
    const linhas = [
      [...t.inputs, ...t.outputs].map((c) => c.name).join(';'),
      ...t.rows.map((r) => [...r.inputs, ...r.outputs].join(';')),
    ]
    // o BOM na frente faz a planilha abrir com a acentuação correta
    baixar('tabela-verdade.csv', '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8')
  },
})

// ---------------------------------------------------------------- gabarito

registrar('gabarito.importar', {
  descricao: 'Lê uma tabela-verdade esperada em CSV (mesmo formato do Exportar CSV) para conferir o circuito linha a linha',
  params: { csv: { tipo: 'texto', descricao: 'conteúdo do arquivo .csv: nomes das colunas na primeira linha' } },
  executar: (p) => {
    const g = lerGabarito(p.csv as string)
    if (typeof g === 'string') throw new Falha(g)
    st().setGabarito(g)
  },
})

registrar('gabarito.conferir', {
  descricao: 'Compara o circuito com o gabarito importado: linhas certas, e em cada linha errada o esperado e o obtido',
  params: nada,
  executar: () => {
    const g = st().gabarito
    if (!g) throw new Falha('nenhum gabarito importado (use gabarito.importar)')
    const c = conferir(g, tabela())
    return {
      certas: c.acertos,
      total: c.linhas.length,
      erradas: c.linhas.filter((l) => l.erros.length > 0),
      faltam: c.faltam,
      sobram: c.sobram,
    }
  },
})

registrar('gabarito.remover', {
  descricao: 'Tira o gabarito: a tabela volta a mostrar só o circuito',
  params: nada,
  executar: () => st().setGabarito(null),
})

// ---------------------------------------------------------------- mapa de Karnaugh

/** Posição da saída pedida entre as que dão 0 ou 1 (o display fica de fora). */
function saidaDoMapa(nome: unknown): number {
  const saidas = outputColumns(st().components).filter((o) => o.comp.type !== 'DISPLAY')
  if (nome === undefined) return 0
  const i = saidas.findIndex((o) => o.name === nome)
  if (i < 0) throw new Falha(`saída "${String(nome)}" não encontrada (saídas: ${saidas.map((o) => o.name).join(', ')})`)
  return i
}

registrar('karnaugh.abrir', {
  descricao: 'Abre o mapa de Karnaugh do circuito (2 a 4 entradas), com os grupos e a expressão simplificada',
  params: { saida: { tipo: 'texto', descricao: 'nome da saída (LED, sonda...); sem ela, a primeira', opcional: true } },
  executar: (p) => st().setKarnaugh(true, saidaDoMapa(p.saida)),
})

registrar('karnaugh.fechar', { descricao: 'Fecha o mapa de Karnaugh', params: nada, executar: () => st().setKarnaugh(false) })

registrar('karnaugh.ler', {
  descricao: 'Mapa de Karnaugh de uma saída: rótulos em código Gray, valor de cada célula, grupos e expressão simplificada',
  params: { saida: { tipo: 'texto', descricao: 'nome da saída; sem ela, a primeira', opcional: true } },
  executar: (p) => {
    const t = tabela()
    const nome = outputColumns(st().components).filter((o) => o.comp.type !== 'DISPLAY')[saidaDoMapa(p.saida)]?.name
    const m = mapaKarnaugh(t, t.outputs.findIndex((o) => o.name === nome))
    if (!m) throw new Falha('o mapa vale para 2 a 4 entradas e uma saída que dá 0 ou 1 em todas as linhas')
    return {
      linhas: { variaveis: m.varsLinha, rotulos: m.rotulosLinha },
      colunas: { variaveis: m.varsColuna, rotulos: m.rotulosColuna },
      valores: m.valor,
      grupos: m.grupos.map((g) => ({ termo: g.termo, mintermos: g.mintermos })),
      expressao: m.expressao,
    }
  },
})

// ---------------------------------------------------------------- linha do tempo

registrar('linha_do_tempo.mostrar', {
  descricao: 'Abre (true) ou fecha (false) a linha do tempo dos sinais; aberta, cada mudança do circuito vira um momento',
  params: { mostrar: { tipo: 'logico', descricao: 'true abre, false fecha' } },
  executar: (p) => st().setLinhaAtiva(p.mostrar as boolean),
})

registrar('linha_do_tempo.limpar', {
  descricao: 'Apaga o que a linha do tempo guardou e recomeça do momento atual',
  params: nada,
  executar: () => st().limparLinhaDoTempo(),
})

registrar('linha_do_tempo.ler', {
  descricao: 'Os sinais da linha do tempo e o valor de cada um em cada momento guardado, do mais antigo ao mais novo',
  params: nada,
  executar: () => {
    const { components, linhaDoTempo } = st()
    return {
      sinais: sinaisObservados(components).map((s) => ({ nome: s.nome, valores: linhaDoTempo.map((a) => a[s.chave] ?? 'X') })),
    }
  },
})

// ---------------------------------------------------------------- histórico, vista e aula

registrar('historico.desfazer', { descricao: 'Desfaz a última mudança (Ctrl+Z)', params: nada, executar: () => st().undo() })
registrar('historico.refazer', { descricao: 'Refaz o que foi desfeito (Ctrl+Y)', params: nada, executar: () => st().redo() })

registrar('nomes.mostrar', {
  descricao: 'Mostra ou esconde o nome do tipo embaixo de cada porta (botão Aa)',
  params: { mostrar: { tipo: 'logico', descricao: 'true mostra, false esconde' } },
  executar: (p) => st().setShowNames(p.mostrar as boolean),
})

registrar('paleta.aba', {
  descricao: 'Abre uma aba da paleta de componentes',
  params: { aba: { tipo: 'texto', descricao: 'aba da paleta', valores: ['ENTRADAS', 'PORTAS', 'MEMORIA', 'SAIDAS', 'CIS'] } },
  executar: (p) => st().setAbaPaleta(p.aba as AbaPaleta),
})

/** Página da versão mais recente: o botão do Sobre só abre esta página, o programa nunca a consulta sozinho. */
export const PAGINA_VERSOES = 'https://github.com/HeraldoAntunes/bancada-livre/releases/latest'

registrar('versao.ver_nova', {
  descricao: 'Abre no navegador a página da versão mais recente (o programa não consulta a internet sozinho) e devolve a versão instalada',
  params: nada,
  executar: () => {
    window.open(PAGINA_VERSOES, '_blank', 'noopener,noreferrer')
    return { instalada: version, pagina: PAGINA_VERSOES }
  },
})

registrar('guia.abrir', {
  descricao: 'Abre o Guia de CIs (pinagem, função e dicas) num chip',
  params: { chip: { tipo: 'texto', descricao: 'chip mostrado (padrão 7400)', valores: CHIP_IDS, opcional: true } },
  executar: (p) => st().openGuide((p.chip as (typeof CHIP_IDS)[number] | undefined) ?? '7400'),
})

registrar('guia.fechar', { descricao: 'Fecha o Guia de CIs', params: nada, executar: () => st().closeGuide() })

registrar('guia.carregar_exemplo', {
  descricao: 'Carrega na bancada o circuito de exemplo do Guia para um chip (substitui a bancada)',
  params: { chip: { tipo: 'texto', descricao: 'modelo do CI', valores: CHIP_IDS } },
  executar: (p) => {
    const demo = chipDemo(p.chip as (typeof CHIP_IDS)[number])
    st().loadCircuit(demo.components, demo.wires)
    st().closeGuide()
  },
})

// passo a passo: o nível fica entre 0 e o último nível da onda de propagação do circuito atual
const ultimoNivel = () => propagationLevels(st().components, st().wires).maxLevel
const irAoNivel = (n: number) => st().setPasso({ ativo: true, nivel: Math.max(0, Math.min(n, ultimoNivel())) })

registrar('passo.ligar', {
  descricao: 'Liga o passo a passo: o sinal avança um nível de portas de cada vez, a partir do nível 0',
  params: nada,
  executar: () => st().setPasso({ ativo: true, nivel: 0 }),
})
registrar('passo.sair', { descricao: 'Sai do passo a passo (tecla Esc)', params: nada, executar: () => st().setPasso({ ativo: false, nivel: 0 }) })
registrar('passo.ir_para', {
  descricao: 'Vai a um nível do passo a passo (liga o modo se estiver desligado)',
  params: { nivel: { tipo: 'inteiro', descricao: 'nível, a partir de 0', min: 0 } },
  executar: (p) => irAoNivel(p.nivel as number),
})
registrar('passo.proximo', { descricao: 'Avança um nível no passo a passo (seta para a direita)', params: nada, executar: () => irAoNivel(st().passo.nivel + 1) })
registrar('passo.anterior', { descricao: 'Volta um nível no passo a passo (seta para a esquerda)', params: nada, executar: () => irAoNivel(st().passo.nivel - 1) })
