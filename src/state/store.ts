// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Estado da aplicação (zustand).
// Histórico de undo/redo por snapshots; clock com tempo virtual.

import { create } from 'zustand'
import { CHIPS, type ChipId } from '../engine/ics'
import { allInputPins, allOutputPins } from '../engine/pins'
import type { Gabarito } from '../engine/gabarito'
import { acrescentar, amostrar, type Amostra } from '../engine/linhaDoTempo'
import { assentar } from '../engine/sequencial'
import {
  bitsDe,
  bitsPermitidos,
  CORES_LED,
  entradaUnica,
  GATE_TYPES,
  inputPins,
  isGate,
  isSeq,
  SEQ_TYPES,
  SINK_TYPES,
  SOURCE_TYPES,
  type Circuit,
  type CircuitComponent,
  type ComponentType,
  type CorLed,
  type DisplayMode,
  type PinRef,
  type Wire,
} from '../engine/types'

let counter = 1
/** Ids em uso no circuito aberto (definido depois que o store existe). */
let idsEmUso: () => Set<string> = () => new Set()
/** Id novo, conferido contra os que já existem: um arquivo pode trazer qualquer id (auditoria de 29/10/2026). */
const nid = (prefix: string) => {
  const usados = idsEmUso()
  let id: string
  do id = `${prefix}${counter++}`
  while (usados.has(id))
  return id
}

/** Tag do último checkpoint — coalesce edições contínuas (ex.: digitação de rótulo). */
let lastTag: string | null = null
let lastTagAt = 0
let revisaoConteudo = 0
let emSimulacao = false
/** Conta alterações do conteúdo, incluindo edições agrupadas e desfazer/refazer, sem os ticks automáticos. */
export const revisaoDeEdicao = () => revisaoConteudo
/** Edições com a mesma tag além desta pausa contam como sessões distintas de undo. */
const COALESCE_MS = 2500

/** Acima disto o contador não acompanha o id do arquivo: perto de 2^53 o `counter++` para de mudar e repete ids. */
const MAIOR_ID = 1_000_000_000

function bumpCounter(ids: string[]) {
  for (const id of ids) {
    const n = parseInt(id.replace(/^\D+/, ''), 10)
    if (!Number.isNaN(n) && n >= counter && n < MAIOR_ID) counter = n + 1
  }
}

const VALID_TYPES = new Set<string>([...SOURCE_TYPES, ...GATE_TYPES, ...SINK_TYPES, ...SEQ_TYPES, 'IC', 'LABEL'])

/**
 * Valida a forma de um circuito vindo de JSON externo antes de entrar no estado —
 * dados malformados aqui derrubariam o simulate no próximo render.
 */
function validateCircuit(data: Circuit): string | null {
  const compIds = new Set<string>()
  const porId = new Map<string, CircuitComponent>()
  for (const c of data.components) {
    if (
      !c ||
      typeof c !== 'object' ||
      typeof c.id !== 'string' || !c.id || c.id.includes(':') ||
      !VALID_TYPES.has(c.type) ||
      !Number.isFinite(c.x) || Math.abs(c.x) > 1_000_000 ||
      !Number.isFinite(c.y) || Math.abs(c.y) > 1_000_000
    ) {
      return 'Arquivo inválido: componente malformado.'
    }
    if (compIds.has(c.id)) return `Arquivo inválido: id de componente duplicado (${c.id}).`
    // rótulo é desenhado como texto: outro tipo quebraria a tela; o limite é o mesmo do comando
    if (c.label !== undefined && !(typeof c.label === 'string' && c.label.length <= (c.type === 'LABEL' ? 60 : 8))) {
      return `Arquivo inválido: rótulo malformado (${c.id}).`
    }
    if (c.state !== undefined && c.state !== 0 && c.state !== 1) {
      return `Arquivo inválido: estado malformado (${c.id}).`
    }
    if (c.inputs !== undefined && !(Number.isInteger(c.inputs) && c.inputs >= 2 && c.inputs <= 8)) {
      return `Arquivo inválido: número de entradas fora da faixa (${c.id}).`
    }
    // frequência zero ou absurda pararia o clock com contas infinitas
    if (c.freq !== undefined && !(Number.isFinite(c.freq) && c.freq >= 0.5 && c.freq <= 10)) {
      return `Arquivo inválido: frequência fora da faixa (${c.id}).`
    }
    // estado guardado dos elementos de memória (2.0)
    if (c.q !== undefined && !(isSeq(c.type) && (c.q === 0 || c.q === 1 || c.q === 'X'))) {
      return `Arquivo inválido: estado do flip-flop malformado (${c.id}).`
    }
    if (c.clkVisto !== undefined && !(isSeq(c.type) && (c.clkVisto === 0 || c.clkVisto === 1))) {
      return `Arquivo inválido: clock do flip-flop malformado (${c.id}).`
    }
    if (c.estadoCi !== undefined || c.clksVistos !== undefined) {
      const seq = c.type === 'IC' && typeof c.chip === 'string' && Object.prototype.hasOwnProperty.call(CHIPS, c.chip)
        ? CHIPS[c.chip as ChipId].seq
        : undefined
      const bits = (v: unknown, n: number, aceita: unknown[]) =>
        v === undefined || (Array.isArray(v) && v.length === n && v.every((x) => aceita.includes(x)))
      if (!seq || !bits(c.estadoCi, seq.bits, [0, 1, 'X']) || !bits(c.clksVistos, seq.clocks.length, [0, 1])) {
        return `Arquivo inválido: estado do CI malformado (${c.id}).`
      }
    }
    if (c.mode !== undefined && !['bcd', 'hex', 'raw'].includes(c.mode)) {
      return `Arquivo inválido: modo do display desconhecido (${c.id}).`
    }
    // orientação (1.0): opcional; quando vem, só valores conhecidos
    if (c.espelhado !== undefined && typeof c.espelhado !== 'boolean') {
      return `Arquivo inválido: espelhamento malformado (${c.id}).`
    }
    if (c.giro !== undefined && ![0, 90, 180, 270].includes(c.giro)) {
      return `Arquivo inválido: giro malformado (${c.id}).`
    }
    if (c.cor !== undefined && !(CORES_LED as readonly unknown[]).includes(c.cor)) {
      return `Arquivo inválido: cor de LED desconhecida (${c.id}).`
    }
    if (c.bits !== undefined && !bitsPermitidos(c.type).includes(c.bits)) {
      return `Arquivo inválido: número de posições malformado (${c.id}).`
    }
    if (
      c.estados !== undefined &&
      !(
        Array.isArray(c.estados) &&
        c.estados.length === bitsDe(c) &&
        c.estados.every((v) => v === 0 || v === 1)
      )
    ) {
      return `Arquivo inválido: estados do banco de chaves malformados (${c.id}).`
    }
    if (
      c.contagem !== undefined &&
      !(Number.isInteger(c.contagem) && c.contagem >= 0 && c.contagem < 2 ** bitsDe(c))
    ) {
      return `Arquivo inválido: contagem fora da faixa (${c.id}).`
    }
    // hasOwnProperty: o operador `in` aceitaria nomes herdados como "constructor"
    if (c.type === 'IC' && !(typeof c.chip === 'string' && Object.prototype.hasOwnProperty.call(CHIPS, c.chip))) {
      return `Arquivo inválido: CI com chip desconhecido (${c.id}).`
    }
    compIds.add(c.id)
    porId.set(c.id, c)
  }
  const wireIds = new Set<string>()
  for (const w of data.wires) {
    if (!w || typeof w !== 'object' || typeof w.id !== 'string' || !w.id || w.id.includes(':')) {
      return 'Arquivo inválido: fio malformado.'
    }
    if (wireIds.has(w.id) || compIds.has(w.id)) return `Arquivo inválido: id de fio duplicado (${w.id}).`
    wireIds.add(w.id)
    for (const end of [w.from, w.to]) {
      if (!end || typeof end !== 'object' || typeof end.comp !== 'string' || typeof end.pin !== 'string') {
        return `Arquivo inválido: fio malformado (${w.id}).`
      }
      if (!compIds.has(end.comp)) {
        return `Arquivo inválido: fio ${w.id} aponta para componente inexistente.`
      }
    }
    // o fio sai de um pino de saída e chega num pino de entrada que existem no componente
    if (
      !allOutputPins(porId.get(w.from.comp)!).includes(w.from.pin) ||
      !allInputPins(porId.get(w.to.comp)!).includes(w.to.pin)
    ) {
      return `Arquivo inválido: fio ${w.id} ligado a um pino que não existe.`
    }
  }
  return null
}

/**
 * Rótulo automático: fontes interativas A, B, C…; LEDs S1…; displays D1…;
 * sondas P1…; clocks CLK1…. Usa o primeiro rótulo LIVRE — contagem simples
 * duplicaria rótulos após deleções.
 */
function autoLabel(components: CircuitComponent[], type: ComponentType): string | undefined {
  const used = new Set(components.map((c) => c.label))
  const firstFree = (gen: (i: number) => string): string => {
    for (let i = 0; ; i++) {
      const l = gen(i)
      if (!used.has(l)) return l
    }
  }
  if (type === 'SWITCH' || type === 'PUSH_BUTTON') {
    return firstFree((i) => (i < 26 ? String.fromCharCode(65 + i) : `A${i - 25}`))
  }
  if (type === 'DIP_SWITCH') return firstFree((i) => (i < 16 ? String.fromCharCode(75 + i) : `K${i - 15}`))
  if (type === 'LED') return firstFree((i) => `S${i + 1}`)
  if (type === 'LED_BAR') return firstFree((i) => (i === 0 ? 'Y' : `Y${i + 1}`))
  if (type === 'DISPLAY') return firstFree((i) => `D${i + 1}`)
  if (type === 'PROBE') return firstFree((i) => `P${i + 1}`)
  if (type === 'CLOCK') return firstFree((i) => `CLK${i + 1}`)
  if (type === 'COUNTER') return firstFree((i) => `CT${i + 1}`)
  if (isSeq(type)) return firstFree((i) => `FF${i + 1}`)
  if (type === 'LABEL') return 'Texto'
  return undefined
}

/** Abas da paleta. */
export type AbaPaleta = 'ENTRADAS' | 'PORTAS' | 'MEMORIA' | 'SAIDAS' | 'CIS'

interface Snapshot {
  components: CircuitComponent[]
  wires: Wire[]
}

const HISTORY_MAX = 50
// Teto do arquivo aberto: o maior exemplo tem ~3 KB; 2 milhões de caracteres sobram para
// qualquer circuito de aula e barram arquivo errado ou malicioso antes do JSON.parse.
export const MAX_JSON_CHARS = 2_000_000
const AUTOSAVE_KEY = 'simulador-portas:autosave'
export const COPIAS_RECUPERADAS_KEY = 'simulador-portas:copias-recuperadas'
/** O armazenamento do navegador, ou null quando ele falta ou a política do site o bloqueia (aí até ler lança). */
function armazenamentoAcessivel(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    localStorage.getItem(AUTOSAVE_KEY)
    return localStorage
  } catch {
    return null
  }
}
let revisaoAutosave = 0
/** Onde fica guardado um salvamento que não pôde ser aberto, para não ser sobrescrito na primeira edição. */
export const AUTOSAVE_RECUSADO_KEY = 'simulador-portas:autosave-recusado'
const SHOW_NAMES_KEY = 'simulador-portas:nomes'

/**
 * Quantos passos curtos o relógio usa, no máximo, para recuperar um atraso: cerca de 100 s num CLOCK de 1 Hz e 10 s
 * num de 10 Hz, com custo de tela limitado. O que passar disso (computador suspenso) anda num salto só, com aviso.
 */
const MAX_PASSOS_ATRASO = 400
/** Tempo virtual (clockMs) até o qual o aviso de salto do relógio fica na tela. */
let avisoRelogioAte = 0

/** Um passo do tempo virtual: nível de cada CLOCK e contagem de cada COUNTER em clockMs + deltaMs. */
function avancar(s: CircuitStore, deltaMs: number): Partial<CircuitStore> {
  const clockMs = s.clockMs + deltaMs
  let changed = false
  const components = s.components.map((c) => {
    if (c.type === 'COUNTER') {
      // conta um a cada período e volta a 0 depois do último valor
      const n = Math.floor((clockMs / 1000) * (c.freq ?? 1)) % 2 ** bitsDe(c)
      if (n === (c.contagem ?? 0)) return c
      changed = true
      return { ...c, contagem: n }
    }
    if (c.type !== 'CLOCK') return c
    const st = (Math.floor((clockMs / 1000) * (c.freq ?? 1) * 2) % 2) as 0 | 1
    if (st === (c.state ?? 0)) return c
    changed = true
    return { ...c, state: st }
  })
  return changed ? { clockMs, components } : { clockMs }
}

/** A camada nativa entrega os bytes de todas as cópias; a página decide qual circuito é válido e mais novo. */
interface ProgramaWindows {
  __BANCADA_CIRCUITO__?: string
  __BANCADA_CIRCUITO_HORA__?: number
  __BANCADA_PERGUNTAR_MIGRACAO__?: boolean
  __BANCADA_REVISOES_REINICIADAS__?: { original: string; envelope: string }[]
  __BANCADA_RESERVAS__?: { texto: string; hora?: number; origem?: string }[]
  __TAURI__?: { core: { invoke: (comando: string, args?: Record<string, unknown>) => Promise<unknown> } }
}
export const programa = (): ProgramaWindows => (typeof window === 'undefined' ? {} : (window as ProgramaWindows))
interface MetadadosSalvamento { hora: number; revisao: number }

/** Espaço limitado para os dois inteiros e a chave do envelope, sem reduzir o teto do circuito. */
const MAX_METADADOS_CHARS = 128
const ERRO_TAMANHO = 'Arquivo grande demais para ser um circuito (limite de 2 milhões de caracteres).'
function lerDadosCircuito(texto: string): Circuit & { salvamento?: MetadadosSalvamento } {
  if (texto.length > MAX_JSON_CHARS + MAX_METADADOS_CHARS ||
      (texto.length > MAX_JSON_CHARS && !texto.includes('"salvamento"'))) throw new Error(ERRO_TAMANHO)
  const data = JSON.parse(texto) as Circuit & { salvamento?: MetadadosSalvamento }
  if (!data || !Array.isArray(data.components) || !Array.isArray(data.wires)) {
    throw new Error('Arquivo inválido: faltam "components" e "wires".')
  }
  const acrescimo = data.salvamento === undefined ? 0 : JSON.stringify({ salvamento: data.salvamento }).length - 1
  if (acrescimo > MAX_METADADOS_CHARS || texto.length - acrescimo > MAX_JSON_CHARS) throw new Error(ERRO_TAMANHO)
  const meta = data.salvamento
  if (meta !== undefined && (!meta || !Number.isSafeInteger(meta.hora) || meta.hora < 0 ||
      !Number.isSafeInteger(meta.revisao) || meta.revisao < 0)) throw new Error('Arquivo inválido: metadados de salvamento.')
  return data
}

export interface CopiaRecuperacao {
  origem: string
  hora: number
  componentes: number
  fios: number
}
interface PlanoMigracao {
  texto: string
  copias: { original: string; envelope: string }[]
  reiniciarRevisao: boolean
}
interface CandidatoRecuperacao {
  nativa: boolean
  texto: string
  data: Circuit & { salvamento?: MetadadosSalvamento }
  origem: string
  hora: number
}
let copiasRecuperacao: CandidatoRecuperacao[] = []
let opcoesRecuperacao: CopiaRecuperacao[] | null = null
let precisaMigrar = false
let reiniciarRevisao = false
let corrigirLocalReiniciado = false
const AVISO_CONTAGEM = 'O contador de salvamentos atingiu o limite. As cópias serão preservadas e a contagem recomeçará em 1.'
const AVISO_CONTAGEM_REINICIADA = 'Contagem de salvamentos reiniciada; as versões anteriores foram preservadas.'

/** As propriedades podem vir em outra ordem sem mudar o conteúdo do circuito. */
function conteudoCanonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(conteudoCanonico)
  if (valor && typeof valor === 'object') return Object.fromEntries(
    Object.entries(valor).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, conteudoCanonico(v)]))
  return valor
}
const horaInformativa = (hora: number | undefined) => Number.isSafeInteger(hora) && hora! >= 0 ? hora! : 0

/** Com legado divergente, o Rust pode autorizar o principal válido; nos demais casos a pessoa escolhe. */
function loadAutosave(): Snapshot {
  const empty: Snapshot = { components: [], wires: [] }
  let recusado: { texto: string; motivo: string } | null = null
  let local: string | null = null
  let horaLocal = 0
  try {
    if (typeof localStorage !== 'undefined') {
      local = localStorage.getItem(AUTOSAVE_KEY)
      horaLocal = Number(localStorage.getItem(AUTOSAVE_KEY + '-hora'))
    }
  } catch (e) {
    console.warn('Bancada Livre: não foi possível ler o armazenamento do navegador; tentando as cópias do programa.', e)
  }
  const p = programa()
  const lista: { texto: string; origem: string; hora?: number; nativa: boolean }[] = []
  if (typeof p.__BANCADA_CIRCUITO__ === 'string' && p.__BANCADA_CIRCUITO__) {
    lista.push({ texto: p.__BANCADA_CIRCUITO__, origem: 'Arquivo principal do programa', hora: p.__BANCADA_CIRCUITO_HORA__, nativa: true })
  }
  for (const [i, r] of (p.__BANCADA_RESERVAS__ ?? []).entries()) if (typeof r?.texto === 'string') {
    lista.push({ texto: r.texto, origem: r.origem || `Cópia do programa ${i + 2}`, hora: r.hora, nativa: true })
  }
  if (local) lista.push({ texto: local, origem: 'Armazenamento do navegador', hora: horaLocal, nativa: false })
  const validos: CandidatoRecuperacao[] = []
  for (const candidato of lista) {
    try {
      let data = lerDadosCircuito(candidato.texto)
      const err = validateCircuit(data)
      if (err) throw new Error(err)
      if (!candidato.nativa) {
        // O registro durável distingue uma revisão aposentada de uma cópia realmente mais nova.
        for (const registro of p.__BANCADA_REVISOES_REINICIADAS__ ?? []) {
          if (registro.original !== candidato.texto) continue
          try {
            const convertida = lerDadosCircuito(registro.envelope)
            if (validateCircuit(convertida) || convertida.salvamento?.revisao !== 0 ||
                JSON.stringify(conteudoCanonico({ components: data.components, wires: data.wires })) !==
                JSON.stringify(conteudoCanonico({ components: convertida.components, wires: convertida.wires }))) continue
            data = convertida
            corrigirLocalReiniciado = true
            break
          } catch { /* Registro incompleto não muda a cópia original. */ }
        }
      }
      revisaoAutosave = Math.max(revisaoAutosave, data.salvamento?.revisao ?? 0)
      validos.push({ ...candidato, data, hora: data.salvamento?.hora ?? horaInformativa(candidato.hora) })
    } catch (e) {
      recusado ??= { texto: candidato.texto, motivo: String(e) }
    }
  }
  copiasRecuperacao = validos
  const temLegado = validos.some(c => c.data.salvamento === undefined)
  reiniciarRevisao = revisaoAutosave === Number.MAX_SAFE_INTEGER
  precisaMigrar = temLegado || reiniciarRevisao
  let principalSilencioso: CandidatoRecuperacao | undefined
  if (temLegado && validos.length > 1) {
    const conteudos = new Set(validos.map(c => JSON.stringify(conteudoCanonico({
      components: c.data.components, wires: c.data.wires,
    }))))
    if (conteudos.size > 1) {
      if (p.__BANCADA_PERGUNTAR_MIGRACAO__ === false) {
        principalSilencioso = validos.find(c => c.nativa && c.texto === p.__BANCADA_CIRCUITO__)
      }
      if (!principalSilencioso) {
        opcoesRecuperacao = validos.map(c => ({
          origem: c.origem, hora: c.hora, componentes: c.data.components.length, fios: c.data.wires.length,
        }))
        return empty
      }
    }
  }
  if (recusado) guardarRecusado(recusado.texto, recusado.motivo)
  const escolha = principalSilencioso?.data ?? [...validos].sort((a, b) =>
    (b.data.salvamento?.revisao ?? 0) - (a.data.salvamento?.revisao ?? 0) ||
    (b.data.salvamento?.hora ?? 0) - (a.data.salvamento?.hora ?? 0))[0]?.data
  if (!escolha) return empty
  bumpCounter([...escolha.components.map((c) => c.id), ...escolha.wires.map((w) => w.id)])
  return { components: escolha.components, wires: escolha.wires }
}

/** Salvamento automático que não abriu: guarda à parte e avisa no console, em vez de perder em silêncio. */
function guardarRecusado(raw: string, motivo: string) {
  console.warn(`Bancada Livre: o circuito salvo não pôde ser aberto (${motivo}); cópia guardada em ${AUTOSAVE_RECUSADO_KEY}.`)
  try {
    localStorage.setItem(AUTOSAVE_RECUSADO_KEY, raw)
  } catch (e) {
    console.warn('Bancada Livre: não foi possível guardar a cópia do circuito salvo.', e)
  }
}

function loadShowNames(): boolean {
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(SHOW_NAMES_KEY) !== '0'
  } catch {
    return true
  }
}

const initial = loadAutosave()

export interface CircuitStore {
  recuperacao: CopiaRecuperacao[] | null
  avisoRecuperacao: string
  escolherRecuperacao: (indice: number) => void
  components: CircuitComponent[]
  wires: Wire[]
  selectedId: string | null
  past: Snapshot[]
  future: Snapshot[]
  clockRunning: boolean
  /** Algum flip-flop ou trava não parou de mudar no último assentamento e ficou indefinido. */
  oscilando: boolean
  /** Texto do aviso quando o salvamento automático falha (vazio quando está gravando normalmente). */
  falhaSalvamento: string
  /** Aviso de que o relógio pulou um atraso grande sem passar borda a borda (vazio quando não pulou). */
  avisoRelogio: string
  clockMs: number
  /** Mostrar o nome do tipo sob cada porta na bancada. */
  showNames: boolean
  /** Conta os circuitos carregados (exemplo ou arquivo): a bancada se enquadra a cada um. */
  carregamentos: number
  /** Tabela-verdade do circuito numa janela flutuante, fora do painel lateral. */
  tabelaSolta: boolean
  /** Linha do tempo dos sinais aberta: enquanto aberta, cada mudança vira uma amostra. */
  linhaAtiva: boolean
  linhaDoTempo: Amostra[]
  /** Mapa de Karnaugh aberto e qual saída ele mostra (posição entre as saídas de 0 ou 1). */
  karnaughAberto: boolean
  karnaughSaida: number
  /** Tabela-verdade esperada, lida de CSV, para conferir o circuito (não vai no arquivo salvo). */
  gabarito: Gabarito | null
  /** Componente aberto na janela de edição (duplo clique), ou null. */
  editandoId: string | null
  /** Aba aberta na paleta. */
  abaPaleta: AbaPaleta
  setAbaPaleta: (aba: AbaPaleta) => void
  /** Modo passo a passo: ligado ou não, e o nível da onda de propagação mostrado. */
  passo: { ativo: boolean; nivel: number }
  setPasso: (passo: { ativo: boolean; nivel: number }) => void
  editar: (id: string | null) => void
  setTabelaSolta: (v: boolean) => void
  setLinhaAtiva: (v: boolean) => void
  limparLinhaDoTempo: () => void
  setKarnaugh: (aberto: boolean, saida?: number) => void
  setGabarito: (g: Gabarito | null) => void
  setShowNames: (v: boolean) => void

  /** Registra o estado atual no histórico antes de uma mutação estrutural. */
  checkpoint: (tag?: string) => void
  undo: () => void
  redo: () => void

  addComponent: (type: ComponentType, x: number, y: number, chip?: ChipId) => void
  /** Guia de CIs: chip aberto (null = fechado). */
  guideChip: ChipId | null
  openGuide: (chip: ChipId) => void
  closeGuide: () => void
  moveComponent: (id: string, x: number, y: number) => void
  toggleSwitch: (id: string) => void
  setPressed: (id: string, pressed: boolean) => void
  /** Liga ou desliga a posição `i` (0 = a de cima) do banco de chaves. */
  toggleChave: (id: string, i: number) => void
  /** Muda o banco de chaves ou a barra de LEDs para 4 ou 8 posições, tirando os fios das que somem. */
  setBits: (id: string, n: number) => void
  setGateInputs: (id: string, n: number) => void
  setDisplayMode: (id: string, mode: DisplayMode) => void
  /** Cor do LED; azul (o padrão) tira o campo do arquivo. */
  setCorLed: (id: string, cor: CorLed) => void
  /** Estado guardado de um flip-flop ou trava (como ligar o circuito já com um valor). */
  setEstadoMemoria: (id: string, q: 0 | 1) => void
  /** Espelha o desenho (entradas à direita, saída à esquerda), ou desfaz o espelho. */
  espelhar: (id: string) => void
  /** Gira 90 graus no sentido horário (0, 90, 180, 270 e volta). */
  girar: (id: string) => void
  setClockFreq: (id: string, hz: number) => void
  setLabel: (id: string, label: string) => void
  connect: (from: PinRef, to: PinRef) => void
  select: (id: string | null) => void
  deleteSelected: () => void
  clearAll: () => void
  applyInputs: (states: Map<string, 0 | 1>) => void

  setClockRunning: (running: boolean) => void
  tickClocks: (deltaMs: number) => void
  stepClock: () => void

  loadCircuit: (components: CircuitComponent[], wires: Wire[]) => void
  toJSON: () => string
  loadJSON: (text: string) => string | null
}

export const useCircuit = create<CircuitStore>()((set, get) => ({
  recuperacao: opcoesRecuperacao,
  avisoRecuperacao: reiniciarRevisao ? AVISO_CONTAGEM : '',
  escolherRecuperacao: (indice) => {
    if (!get().recuperacao || !Number.isInteger(indice) || !copiasRecuperacao[indice]) {
      throw new Error('Escolha uma das versões apresentadas.')
    }
    const { data } = copiasRecuperacao[indice]
    bumpCounter([...data.components.map(c => c.id), ...data.wires.map(w => w.id)])
    set(s => ({ components: data.components, wires: data.wires, recuperacao: null,
      past: [], future: [], selectedId: null, carregamentos: s.carregamentos + 1 }))
  },
  components: initial.components,
  wires: initial.wires,
  selectedId: null,
  past: [],
  future: [],
  clockRunning: true,
  oscilando: false,
  falhaSalvamento: '',
  avisoRelogio: '',
  clockMs: 0,
  showNames: loadShowNames(),
  carregamentos: 0,
  tabelaSolta: false,
  linhaAtiva: false,
  linhaDoTempo: [],
  karnaughAberto: false,
  karnaughSaida: 0,
  gabarito: null,
  editandoId: null,
  abaPaleta: 'ENTRADAS',
  setAbaPaleta: (aba) => set({ abaPaleta: aba }),
  passo: { ativo: false, nivel: 0 },
  setPasso: (passo) => set({ passo }),
  editar: (id) => set(id ? { editandoId: id, selectedId: id } : { editandoId: null }),
  setTabelaSolta: (v) => set({ tabelaSolta: v }),
  // ao abrir, começa do momento atual; fechar guarda o que foi visto até lá
  setLinhaAtiva: (v) =>
    set((s) => ({
      linhaAtiva: v,
      linhaDoTempo: v && !s.linhaAtiva ? [amostrar(s.components, s.wires)] : s.linhaDoTempo,
    })),
  limparLinhaDoTempo: () => set((s) => ({ linhaDoTempo: [amostrar(s.components, s.wires)] })),
  setGabarito: (g) => set({ gabarito: g }),
  setKarnaugh: (aberto, saida) => set((s) => ({ karnaughAberto: aberto, karnaughSaida: saida ?? s.karnaughSaida })),

  setShowNames: (v) => {
    try {
      localStorage.setItem(SHOW_NAMES_KEY, v ? '1' : '0')
    } catch {
      /* modo privado/quota */
    }
    set({ showNames: v })
  },

  checkpoint: (tag) => {
    const now = Date.now()
    if (tag && tag === lastTag && now - lastTagAt < COALESCE_MS) {
      lastTagAt = now
      return
    }
    lastTag = tag ?? null
    lastTagAt = now
    set((s) => ({
      past: [...s.past.slice(-(HISTORY_MAX - 1)), { components: s.components, wires: s.wires }],
      future: [],
    }))
  },

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return s
      lastTag = null
      return {
        past: s.past.slice(0, -1),
        future: [...s.future, { components: s.components, wires: s.wires }],
        components: prev.components,
        wires: prev.wires,
        selectedId: null,
      }
    }),

  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1]
      if (!next) return s
      lastTag = null
      return {
        future: s.future.slice(0, -1),
        past: [...s.past, { components: s.components, wires: s.wires }],
        components: next.components,
        wires: next.wires,
        selectedId: null,
      }
    }),

  guideChip: null,
  openGuide: (chip) => set({ guideChip: chip }),
  closeGuide: () => set({ guideChip: null }),

  addComponent: (type, x, y, chip) => {
    get().checkpoint()
    set((s) => ({
      components: [
        ...s.components,
        {
          id: nid('c'),
          type,
          x,
          y,
          label: autoLabel(s.components, type),
          ...(type === 'SWITCH' || type === 'PUSH_BUTTON' || type === 'CLOCK'
            ? { state: 0 as const }
            : {}),
          ...(isGate(type) && !entradaUnica(type) ? { inputs: 2 } : {}),
          ...(type === 'DISPLAY' ? { mode: 'bcd' as const } : {}),
          ...(type === 'DIP_SWITCH' ? { bits: 4, estados: [0, 0, 0, 0] as (0 | 1)[] } : {}),
          ...(type === 'LED_BAR' ? { bits: 4 } : {}),
          ...(type === 'CLOCK' ? { freq: 1 } : {}),
          ...(type === 'COUNTER' ? { bits: 2, freq: 1, contagem: 0 } : {}),
          ...(type === 'IC' ? { chip: chip ?? '7400' } : {}),
        },
      ],
    }))
  },

  moveComponent: (id, x, y) =>
    set((s) => ({ components: s.components.map((c) => (c.id === id ? { ...c, x, y } : c)) })),

  toggleSwitch: (id) =>
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id && c.type === 'SWITCH' ? { ...c, state: c.state === 1 ? 0 : (1 as const) } : c,
      ),
    })),

  toggleChave: (id, i) =>
    set((s) => ({
      components: s.components.map((c) => {
        if (c.id !== id || c.type !== 'DIP_SWITCH') return c
        const estados = Array.from({ length: bitsDe(c) }, (_, j) => c.estados?.[j] ?? 0)
        estados[i] = estados[i] === 1 ? 0 : 1
        return { ...c, estados }
      }),
    })),

  setBits: (id, n) => {
    get().checkpoint()
    set((s) => {
      const comp = s.components.find((c) => c.id === id)
      if (!comp) return s
      const novo: CircuitComponent = { ...comp, bits: n }
      if (comp.type === 'COUNTER') novo.contagem = (comp.contagem ?? 0) % 2 ** n
      if (comp.type === 'DIP_SWITCH') {
        novo.estados = Array.from({ length: n }, (_, j) => comp.estados?.[j] ?? 0)
      }
      const saidas = new Set(allOutputPins(novo))
      const entradas = new Set(inputPins(novo))
      return {
        components: s.components.map((c) => (c.id === id ? novo : c)),
        wires: s.wires.filter(
          (w) => (w.from.comp !== id || saidas.has(w.from.pin)) && (w.to.comp !== id || entradas.has(w.to.pin)),
        ),
      }
    })
  },

  setPressed: (id, pressed) =>
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id && c.type === 'PUSH_BUTTON' ? { ...c, state: pressed ? 1 : (0 as const) } : c,
      ),
    })),

  setGateInputs: (id, n) => {
    get().checkpoint(`fanin:${id}`)
    set((s) => {
      const comp = s.components.find((c) => c.id === id)
      if (!comp) return s
      // Remove fios ligados a pinos de entrada que deixaram de existir.
      const keep = new Set(inputPins({ ...comp, inputs: n }))
      return {
        components: s.components.map((c) => (c.id === id ? { ...c, inputs: n } : c)),
        wires: s.wires.filter((w) => w.to.comp !== id || keep.has(w.to.pin)),
      }
    })
  },

  espelhar: (id) => {
    get().checkpoint()
    set((s) => ({
      components: s.components.map((c) => {
        if (c.id !== id) return c
        const { espelhado, ...resto } = c
        return espelhado ? resto : { ...resto, espelhado: true }
      }),
    }))
  },

  girar: (id) => {
    get().checkpoint()
    set((s) => ({
      components: s.components.map((c) => {
        if (c.id !== id) return c
        const giro = (((c.giro ?? 0) + 90) % 360) as 0 | 90 | 180 | 270
        const { giro: _velho, ...resto } = c
        void _velho
        return giro ? { ...resto, giro } : resto
      }),
    }))
  },

  setEstadoMemoria: (id, q) => {
    get().checkpoint()
    set((s) => ({ components: s.components.map((c) => (c.id === id && isSeq(c.type) ? { ...c, q } : c)) }))
  },

  setCorLed: (id, cor) => {
    get().checkpoint()
    set((s) => ({
      components: s.components.map((c) => {
        if (c.id !== id) return c
        const { cor: _velha, ...resto } = c
        void _velha
        return cor === 'azul' ? resto : { ...resto, cor }
      }),
    }))
  },

  setDisplayMode: (id, mode) => {
    get().checkpoint(`mode:${id}`)
    set((s) => {
      const comp = s.components.find((c) => c.id === id)
      if (!comp) return s
      // raw→bcd reduz de 7 para 4 pinos: descarta fios de pinos extintos.
      const keep = new Set(inputPins({ ...comp, mode }))
      return {
        components: s.components.map((c) => (c.id === id ? { ...c, mode } : c)),
        wires: s.wires.filter((w) => w.to.comp !== id || keep.has(w.to.pin)),
      }
    })
  },

  setClockFreq: (id, hz) => {
    get().checkpoint(`freq:${id}`)
    set((s) => ({
      components: s.components.map((c) => (c.id === id ? { ...c, freq: hz } : c)),
    }))
  },

  setLabel: (id, label) => {
    get().checkpoint(`label:${id}`)
    set((s) => ({
      components: s.components.map((c) => (c.id === id ? { ...c, label } : c)),
    }))
  },

  // Uma entrada aceita apenas um fio: fio novo substitui o existente.
  connect: (from, to) => {
    get().checkpoint()
    set((s) => {
      const wires = s.wires.filter((w) => !(w.to.comp === to.comp && w.to.pin === to.pin))
      return { wires: [...wires, { id: nid('w'), from, to }] }
    })
  },

  select: (id) => set({ selectedId: id }),

  deleteSelected: () => {
    const { selectedId: id, components, wires } = get()
    if (!id) return
    // Seleção órfã (ex.: fio já removido por mudança de fan-in): limpa sem
    // registrar checkpoint vazio no histórico.
    const exists = components.some((c) => c.id === id) || wires.some((w) => w.id === id)
    if (!exists) {
      set({ selectedId: null })
      return
    }
    get().checkpoint()
    set((s) => ({
      components: s.components.filter((c) => c.id !== id),
      wires: s.wires.filter((w) => w.id !== id && w.from.comp !== id && w.to.comp !== id),
      selectedId: null,
    }))
  },

  clearAll: () => {
    get().checkpoint()
    set({ components: [], wires: [], selectedId: null, linhaDoTempo: [] })
  },

  // Aplica apenas em SWITCH e no banco de chaves (chave `id:outN`): PUSH_BUTTON é
  // momentâneo e não pode ficar travado em 1 por um clique na tabela-verdade.
  applyInputs: (states) =>
    set((s) => ({
      components: s.components.map((c) => {
        if (c.type === 'SWITCH' && states.has(c.id)) return { ...c, state: states.get(c.id)! }
        if (c.type === 'DIP_SWITCH') {
          const pinos = allOutputPins(c)
          if (!pinos.some((p) => states.has(`${c.id}:${p}`))) return c
          return { ...c, estados: pinos.map((p, i) => states.get(`${c.id}:${p}`) ?? c.estados?.[i] ?? 0) }
        }
        if (c.type === 'COUNTER') {
          const n = bitsDe(c)
          if (!Array.from({ length: n }, (_, b) => `${c.id}:q${b}`).some((k) => states.has(k))) return c
          let contagem = 0
          for (let b = 0; b < n; b++) contagem |= (states.get(`${c.id}:q${b}`) ?? ((c.contagem ?? 0) >> b) & 1) << b
          return { ...c, contagem }
        }
        return c
      }),
    })),

  setClockRunning: (running) => set({ clockRunning: running }),

  // Tempo virtual: estado do clock = função de clockMs e da frequência. Um atraso maior que meio período (aba em
  // segundo plano, programa ocupado) é dividido em passos menores, e cada passo assenta os flip-flops: assim
  // nenhuma borda se perde. Só o que passar de MAX_PASSOS_ATRASO passos anda num salto só, para não travar a tela
  // recuperando o tempo; nesse caso a barra de baixo avisa que o relógio pulou.
  tickClocks: (deltaMs) => {
    const estavaSimulando = emSimulacao
    emSimulacao = true
    try {
      const passos = get().components.flatMap((c) =>
        c.type === 'CLOCK' ? [250 / (c.freq ?? 1)] : c.type === 'COUNTER' ? [500 / (c.freq ?? 1)] : [],
      )
      const passo = passos.length > 0 ? Math.min(...passos) : deltaMs
      let resta = Math.min(deltaMs, passo * MAX_PASSOS_ATRASO)
      if (deltaMs > resta) {
        const pulou = Math.round((deltaMs - resta) / 1000)
        avisoRelogioAte = get().clockMs + deltaMs + 20_000
        set((s) => ({
          ...avancar(s, deltaMs - resta),
          avisoRelogio: `O relógio pulou ${pulou} s (computador suspenso ou programa parado): os flip-flops não viram as bordas desse intervalo.`,
        }))
      }
      while (resta > 0) {
        const d = Math.min(resta, passo)
        set((s) => avancar(s, d))
        resta -= d
      }
      if (get().avisoRelogio && get().clockMs > avisoRelogioAte) set({ avisoRelogio: '' })
    } finally { emSimulacao = estavaSimulando }
  },

  // Avança meio período do clock mais rápido (modo passo).
  stepClock: () => {
    // meio período do CLOCK mais rápido, ou um período inteiro do contador mais rápido (um passo da contagem)
    const passos = get().components.flatMap((c) =>
      c.type === 'CLOCK' ? [500 / (c.freq ?? 1)] : c.type === 'COUNTER' ? [1000 / (c.freq ?? 1)] : [],
    )
    if (passos.length === 0) return
    get().tickClocks(Math.min(...passos))
  },

  loadCircuit: (components, wires) => {
    get().checkpoint()
    bumpCounter([...components.map((c) => c.id), ...wires.map((w) => w.id)])
    set((s) => ({
      components,
      wires,
      selectedId: null,
      editandoId: null,
      carregamentos: s.carregamentos + 1,
      linhaDoTempo: [],
      avisoRelogio: '',
    }))
  },

  toJSON: () => {
    const { components, wires } = get()
    const circuit: Circuit = {
      version: 1,
      meta: { criadoEm: new Date().toISOString().slice(0, 10) },
      components,
      wires,
    }
    return JSON.stringify(circuit, null, 2)
  },

  loadJSON: (text) => {
    try {
      const data = lerDadosCircuito(text)
      // Valida ANTES do checkpoint do loadCircuit — dados ruins não podem
      // nem derrubar o render nem poluir o histórico de undo.
      const err = validateCircuit(data)
      if (err) return err
      revisaoAutosave = Math.max(revisaoAutosave, data.salvamento?.revisao ?? 0)
      if (data.salvamento?.revisao === Number.MAX_SAFE_INTEGER && !copiasRecuperacao.some(c => c.texto === text)) {
        copiasRecuperacao.push({ texto: text, data, nativa: false, origem: 'Arquivo aberto', hora: data.salvamento.hora })
      }
      get().loadCircuit(data.components, data.wires)
      return null
    } catch (e) {
      return e instanceof SyntaxError ? 'Arquivo inválido: JSON malformado.' : String(e instanceof Error ? e.message : e)
    }
  },
}))

idsEmUso = () => {
  const s = useCircuit.getState()
  return new Set([...s.components.map((c) => c.id), ...s.wires.map((w) => w.id)])
}

// Elementos de memória: a cada mudança do circuito (chave, clock, fio novo), procura as bordas do clock e atualiza
// o estado dos flip-flops até tudo parar de mudar. Não é passo do Desfazer: é o circuito reagindo.
// A marca de oscilação vale até a próxima mudança feita fora do assentamento.
let vindoDoAssentar = false
useCircuit.subscribe((s, antes) => {
  if (!emSimulacao && !vindoDoAssentar && (s.components !== antes.components || s.wires !== antes.wires)) {
    revisaoConteudo++
  }
})
useCircuit.subscribe((s, antes) => {
  if (s.components === antes.components && s.wires === antes.wires) return
  const veio = vindoDoAssentar
  vindoDoAssentar = false
  const { components, oscilando } = assentar(s.components, s.wires)
  const osc = oscilando.size > 0 || (veio && s.oscilando)
  if (components !== s.components) {
    vindoDoAssentar = true
    useCircuit.setState({ components, oscilando: osc })
    return
  }
  if (osc !== s.oscilando) useCircuit.setState({ oscilando: osc })
  // circuito assentado: com a linha do tempo aberta, vira uma amostra (só se algum sinal mudou)
  if (s.linhaAtiva) {
    const linhaDoTempo = acrescentar(s.linhaDoTempo, amostrar(s.components, s.wires))
    if (linhaDoTempo !== s.linhaDoTempo) useCircuit.setState({ linhaDoTempo })
  }
})
{
  const { components, oscilando } = assentar(useCircuit.getState().components, useCircuit.getState().wires)
  if (components !== useCircuit.getState().components) {
    vindoDoAssentar = true
    useCircuit.setState({ components, oscilando: oscilando.size > 0 })
  }
}

/**
 * Texto do salvamento automático. O nível de cada CLOCK e a contagem de cada COUNTER saem dele: são do tempo
 * virtual, recalculados ao abrir, e mudam a cada batida. Assim o clock rodando não gera gravação nenhuma.
 */
export function textoDoAutosave(snap: Snapshot): string {
  const components = snap.components.map((c) => {
    if (c.type !== 'CLOCK' && c.type !== 'COUNTER') return c
    const copia = { ...c }
    delete copia[c.type === 'CLOCK' ? 'state' : 'contagem']
    return copia
  })
  return JSON.stringify({ version: 1, components, wires: snap.wires })
}

/** Espera entre a mudança e a gravação; mudanças seguidas não adiam a gravação além disso. */
export const ESPERA_AUTOSAVE_MS = 400

// Salvamento automático: grava o circuito no localStorage (e, no programa do Windows, também em arquivo) no máximo
// ESPERA_AUTOSAVE_MS depois de cada mudança, e só se o texto mudou. A espera não recomeça a cada mudança: com um
// circuito que muda sozinho (flip-flops num clock rápido) a gravação continua acontecendo. Ao sair da página (aba
// fechada, janela escondida) e ao fechar a janela do programa, a mudança que ainda esperava é gravada na hora.
// O texto só conta como gravado depois que a gravação deu certo: se falhar, o aviso aparece na barra de baixo, a
// gravação é tentada de novo a cada NOVA_TENTATIVA_MS e ao fechar, e o aviso só sai quando ela der certo. Uma gravação
// em arquivo nunca começa antes de a anterior terminar, e o fechamento espera a que estiver em andamento.
const FALHA_SALVAMENTO =
  'O salvamento automático falhou: use Salvar para guardar o circuito num arquivo antes de fechar.'
/** Intervalo entre as novas tentativas depois de uma gravação que falhou. */
export const NOVA_TENTATIVA_MS = 5000
if (typeof window !== 'undefined') {
  let timer: number | undefined
  let novaTentativa: number | undefined
  let prev: Snapshot = { components: initial.components, wires: initial.wires }
  // o que já está gravado em cada lugar (ao abrir, o circuito aberto veio de um deles)
  let noLocal = corrigirLocalReiniciado ? '' : textoDoAutosave(prev)
  let noArquivo = textoDoAutosave(prev)
  let emAndamento: Promise<void> | null = null
  let preparado: { circuito: string; envelope: string; migracao?: PlanoMigracao } | null = null
  let migrouNoNativo = false
  let guardouOriginaisWeb = false
  let reinicioIniciado = false
  const avisar = (falhou: boolean, e?: unknown) => {
    if (falhou) console.warn('Bancada Livre: o salvamento automático falhou.', e)
    const texto = falhou ? FALHA_SALVAMENTO : ''
    if (useCircuit.getState().falhaSalvamento !== texto) useCircuit.setState({ falhaSalvamento: texto })
  }
  /** Grava o que falta gravar. `true`: tudo gravado. */
  const gravar = async (): Promise<boolean> => {
    if (timer !== undefined) window.clearTimeout(timer)
    timer = undefined
    if (useCircuit.getState().recuperacao) return true
    while (emAndamento) await emAndamento
    let falhou = false
    const texto = textoDoAutosave(prev)
    const tauri = programa().__TAURI__
    let envelope: string | undefined
    if (precisaMigrar || texto !== noLocal || (tauri && texto !== noArquivo)) {
      try {
        if (texto.length > MAX_JSON_CHARS) throw new Error(ERRO_TAMANHO)
        if (!preparado || preparado.circuito !== texto) {
          if (revisaoAutosave === Number.MAX_SAFE_INTEGER) {
            // Inclui também bytes produzidos nesta sessão antes de reiniciar o contador. Armazenamento ausente ou
            // ilegível conta como fonte ausente: as cópias já validadas seguem para a migração (BL-RC6-D01).
            let local: string | null = null
            try {
              local = armazenamentoAcessivel()?.getItem(AUTOSAVE_KEY) ?? null
            } catch (e) {
              console.warn('Bancada Livre: armazenamento do navegador ilegível; reinício segue com as outras cópias.', e)
            }
            for (const original of [preparado?.envelope, local]) {
              if (!original || copiasRecuperacao.some(c => c.texto === original)) continue
              try {
                const data = lerDadosCircuito(original)
                if (validateCircuit(data)) continue
                copiasRecuperacao.push({ texto: original, data, nativa: false,
                  origem: 'Salvamento desta sessão', hora: data.salvamento?.hora ?? 0 })
              } catch { /* cópia ilegível não entra entre as preservadas, como na abertura */ }
            }
          }
          if (revisaoAutosave === Number.MAX_SAFE_INTEGER && !reiniciarRevisao) {
            reiniciarRevisao = true
            precisaMigrar = true
            migrouNoNativo = false
            guardouOriginaisWeb = false
            reinicioIniciado = false
            useCircuit.setState({ avisoRecuperacao: AVISO_CONTAGEM })
          }
          const revisao = reiniciarRevisao && !reinicioIniciado ? 1 : revisaoAutosave + 1
          preparado = { circuito: texto, envelope: JSON.stringify({
            ...JSON.parse(texto), salvamento: { hora: Date.now(), revisao },
          }) }
          if (precisaMigrar) preparado.migracao = {
            texto: preparado.envelope,
            copias: copiasRecuperacao.map(c => ({
              original: c.texto, envelope: JSON.stringify({ ...c.data,
                salvamento: reiniciarRevisao ? { hora: c.hora, revisao: 0 } : c.data.salvamento ?? { hora: c.hora, revisao: 0 } }),
            })),
            reiniciarRevisao,
          }
          if (reiniciarRevisao) reinicioIniciado = true
          revisaoAutosave = revisao
          noLocal = ''
          noArquivo = ''
        }
        envelope = preparado.envelope
      } catch (e) { falhou = true; avisar(true, e) }
    }
    if (envelope && precisaMigrar && !migrouNoNativo) {
      if (tauri) {
        emAndamento = tauri.core.invoke('migrar_circuitos', { ...preparado!.migracao! })
          .then(resposta => {
            if (!resposta || typeof resposta !== 'object' || (resposta as { ok?: unknown }).ok !== true) {
              throw new Error('A migração não confirmou que todas as cópias foram preservadas.')
            }
            migrouNoNativo = true
            noArquivo = texto
          })
          .catch((e: unknown) => { falhou = true; avisar(true, e) })
          .finally(() => (emAndamento = null))
        await emAndamento
      } else {
        try {
          if (copiasRecuperacao.some(c => c.nativa)) throw new Error('A ponte do programa não está disponível para migrar as cópias.')
          if (!guardouOriginaisWeb) {
            const anterior = localStorage.getItem(COPIAS_RECUPERADAS_KEY)
            let existentes: string[] = []
            if (anterior) {
              try {
                const lista: unknown = JSON.parse(anterior)
                existentes = Array.isArray(lista) && lista.every(c => typeof c === 'string') ? lista : [anterior]
              } catch { existentes = [anterior] }
            }
            localStorage.setItem(COPIAS_RECUPERADAS_KEY, JSON.stringify([...new Set([
              ...existentes, ...copiasRecuperacao.map(c => c.texto),
            ])]))
            guardouOriginaisWeb = true
          }
        } catch (e) { falhou = true; avisar(true, e) }
      }
    }
    if (envelope && !falhou && texto !== noLocal) {
      try {
        // no programa, sem armazenamento do navegador o arquivo é a única fonte (BL-RC6-D01); quando a política do PC
        // bloqueia os dados do site, até ler `localStorage` lança, e isso também é "sem armazenamento" (validação da
        // 2.1.1). Quota na escrita, com o armazenamento acessível, continua sendo falha avisada.
        const local = tauri ? armazenamentoAcessivel() : localStorage
        if (local) local.setItem(AUTOSAVE_KEY, envelope)
        noLocal = texto
      } catch (e) { falhou = true; avisar(true, e) }
    }
    if (envelope && tauri && texto !== noArquivo && (!precisaMigrar || migrouNoNativo)) {
      emAndamento = tauri.core.invoke('salvar_circuito', { texto: envelope })
        .then(() => void (noArquivo = texto))
        .catch((e: unknown) => { falhou = true; avisar(true, e) })
        .finally(() => (emAndamento = null))
      await emAndamento
    }
    if (falhou) {
      if (novaTentativa === undefined) {
        novaTentativa = window.setTimeout(() => {
          novaTentativa = undefined
          void gravar()
        }, NOVA_TENTATIVA_MS)
      }
      return false
    }
    if (envelope) {
      precisaMigrar = false
      if (reiniciarRevisao) {
        reiniciarRevisao = false
        useCircuit.setState({ avisoRecuperacao: AVISO_CONTAGEM_REINICIADA })
      }
    }
    avisar(false)
    return true
  }
  useCircuit.subscribe((s) => {
    if (s.components === prev.components && s.wires === prev.wires) return
    prev = { components: s.components, wires: s.wires }
    if (timer !== undefined) return
    timer = window.setTimeout(() => void gravar(), ESPERA_AUTOSAVE_MS)
  })
  if ((precisaMigrar || corrigirLocalReiniciado) && !useCircuit.getState().recuperacao) timer = window.setTimeout(() => void gravar(), ESPERA_AUTOSAVE_MS)
  const descarregar = () => {
    if (timer !== undefined) void gravar()
  }
  window.addEventListener?.('pagehide', descarregar)
  window.addEventListener?.('visibilitychange', () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') descarregar()
  })
  // o programa do Windows chama isto ao fechar a janela: espera a gravação em andamento, grava o que faltar e diz se
  // conseguiu (se não, o programa pergunta antes de fechar)
  ;(window as unknown as { __bancadaAoFechar?: () => Promise<boolean> }).__bancadaAoFechar = () => gravar()
}

// Acesso de depuração no dev server (não existe no build de produção nem em testes node).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__circuit = useCircuit
}
