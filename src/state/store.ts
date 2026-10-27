// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Estado da aplicação (zustand) — spec §6 camada 2.
// Histórico de undo/redo por snapshots (RF-07); clock com tempo virtual (RF-02).

import { create } from 'zustand'
import { CHIPS, type ChipId } from '../engine/ics'
import { allOutputPins } from '../engine/pins'
import {
  bitsDe,
  bitsPermitidos,
  CORES_LED,
  entradaUnica,
  GATE_TYPES,
  inputPins,
  isGate,
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
const nid = (prefix: string) => `${prefix}${counter++}`

/** Tag do último checkpoint — coalesce edições contínuas (ex.: digitação de rótulo). */
let lastTag: string | null = null
let lastTagAt = 0
/** Edições com a mesma tag além desta pausa contam como sessões distintas de undo. */
const COALESCE_MS = 2500

function bumpCounter(ids: string[]) {
  for (const id of ids) {
    const n = parseInt(id.replace(/^\D+/, ''), 10)
    if (!Number.isNaN(n) && n >= counter) counter = n + 1
  }
}

const VALID_TYPES = new Set<string>([...SOURCE_TYPES, ...GATE_TYPES, ...SINK_TYPES, 'IC', 'LABEL'])

/**
 * Valida a forma de um circuito vindo de JSON externo antes de entrar no estado —
 * dados malformados aqui derrubariam o simulate no próximo render.
 */
function validateCircuit(data: Circuit): string | null {
  const compIds = new Set<string>()
  for (const c of data.components) {
    if (
      !c ||
      typeof c !== 'object' ||
      typeof c.id !== 'string' ||
      !VALID_TYPES.has(c.type) ||
      typeof c.x !== 'number' ||
      typeof c.y !== 'number'
    ) {
      return 'Arquivo inválido: componente malformado.'
    }
    if (compIds.has(c.id)) return `Arquivo inválido: id de componente duplicado (${c.id}).`
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
    if (c.type === 'IC' && !(typeof c.chip === 'string' && c.chip in CHIPS)) {
      return `Arquivo inválido: CI com chip desconhecido (${c.id}).`
    }
    compIds.add(c.id)
  }
  const wireIds = new Set<string>()
  for (const w of data.wires) {
    if (!w || typeof w !== 'object' || typeof w.id !== 'string') {
      return 'Arquivo inválido: fio malformado.'
    }
    if (wireIds.has(w.id)) return `Arquivo inválido: id de fio duplicado (${w.id}).`
    wireIds.add(w.id)
    for (const end of [w.from, w.to]) {
      if (!end || typeof end !== 'object' || typeof end.comp !== 'string' || typeof end.pin !== 'string') {
        return `Arquivo inválido: fio malformado (${w.id}).`
      }
      if (!compIds.has(end.comp)) {
        return `Arquivo inválido: fio ${w.id} aponta para componente inexistente.`
      }
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
  if (type === 'LABEL') return 'Texto'
  return undefined
}

/** Abas da paleta. */
export type AbaPaleta = 'ENTRADAS' | 'PORTAS' | 'SAIDAS' | 'CIS'

interface Snapshot {
  components: CircuitComponent[]
  wires: Wire[]
}

const HISTORY_MAX = 50
// Teto do arquivo aberto: o maior exemplo tem ~3 KB; 2 milhões de caracteres sobram para
// qualquer circuito de aula e barram arquivo errado ou malicioso antes do JSON.parse.
export const MAX_JSON_CHARS = 2_000_000
const AUTOSAVE_KEY = 'simulador-portas:autosave'
const SHOW_NAMES_KEY = 'simulador-portas:nomes'

/** Restaura o circuito salvo automaticamente (RF-08, v0.5). */
function loadAutosave(): Snapshot {
  const empty: Snapshot = { components: [], wires: [] }
  try {
    if (typeof localStorage === 'undefined') return empty
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return empty
    const data = JSON.parse(raw) as Circuit
    if (!Array.isArray(data.components) || !Array.isArray(data.wires)) return empty
    if (validateCircuit(data) !== null) return empty
    bumpCounter([...data.components.map((c) => c.id), ...data.wires.map((w) => w.id)])
    return { components: data.components, wires: data.wires }
  } catch {
    return empty
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
  components: CircuitComponent[]
  wires: Wire[]
  selectedId: string | null
  past: Snapshot[]
  future: Snapshot[]
  clockRunning: boolean
  clockMs: number
  /** Mostrar o nome do tipo sob cada porta na bancada (RF-01.4). */
  showNames: boolean
  /** Conta os circuitos carregados (exemplo ou arquivo): a bancada se enquadra a cada um. */
  carregamentos: number
  /** Tabela-verdade do circuito numa janela flutuante, fora do painel lateral. */
  tabelaSolta: boolean
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
  components: initial.components,
  wires: initial.wires,
  selectedId: null,
  past: [],
  future: [],
  clockRunning: true,
  clockMs: 0,
  showNames: loadShowNames(),
  carregamentos: 0,
  tabelaSolta: false,
  editandoId: null,
  abaPaleta: 'ENTRADAS',
  setAbaPaleta: (aba) => set({ abaPaleta: aba }),
  passo: { ativo: false, nivel: 0 },
  setPasso: (passo) => set({ passo }),
  editar: (id) => set(id ? { editandoId: id, selectedId: id } : { editandoId: null }),
  setTabelaSolta: (v) => set({ tabelaSolta: v }),

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

  // Uma entrada aceita apenas um fio (RF-04.5): fio novo substitui o existente.
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
    set({ components: [], wires: [], selectedId: null })
  },

  // Aplica apenas em SWITCH e no banco de chaves (chave `id:outN`): PUSH_BUTTON é
  // momentâneo (RF-02) e não pode ficar travado em 1 por um clique na tabela-verdade.
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

  // Tempo virtual: estado do clock = função de clockMs e da frequência.
  tickClocks: (deltaMs) =>
    set((s) => {
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
    }),

  // Avança meio período do clock mais rápido (modo passo, RF-02).
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
    set((s) => ({ components, wires, selectedId: null, editandoId: null, carregamentos: s.carregamentos + 1 }))
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
    if (text.length > MAX_JSON_CHARS) {
      return 'Arquivo grande demais para ser um circuito (limite de 2 milhões de caracteres).'
    }
    try {
      const data = JSON.parse(text) as Circuit
      if (!Array.isArray(data.components) || !Array.isArray(data.wires)) {
        return 'Arquivo inválido: faltam "components" e "wires".'
      }
      // Valida ANTES do checkpoint do loadCircuit — dados ruins não podem
      // nem derrubar o render nem poluir o histórico de undo.
      const err = validateCircuit(data)
      if (err) return err
      get().loadCircuit(data.components, data.wires)
      return null
    } catch {
      return 'Arquivo inválido: JSON malformado.'
    }
  },
}))

// Salvamento automático (RF-08, v0.5): grava o circuito no localStorage com
// debounce a cada mudança estrutural — fechar a aba não perde o trabalho.
if (typeof window !== 'undefined') {
  let timer: number | undefined
  let prev: Snapshot = { components: initial.components, wires: initial.wires }
  useCircuit.subscribe((s) => {
    if (s.components === prev.components && s.wires === prev.wires) return
    prev = { components: s.components, wires: s.wires }
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({ version: 1, components: prev.components, wires: prev.wires }),
        )
      } catch {
        /* modo privado/quota cheia: segue sem autosave */
      }
    }, 400)
  })
}

// Acesso de depuração no dev server (não existe no build de produção nem em testes node).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__circuit = useCircuit
}
