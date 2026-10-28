// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Testes do store: round-trip JSON, undo/redo, regras de conexão e clock.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EXAMPLES } from '../../examples'
import { MAX_JSON_CHARS, useCircuit } from '../store'

const st = () => useCircuit.getState()

beforeEach(() => {
  useCircuit.setState({
    components: [],
    wires: [],
    selectedId: null,
    past: [],
    future: [],
    clockRunning: true,
    clockMs: 0,
  })
})

function buildInverter() {
  st().addComponent('SWITCH', 10, 10)
  st().addComponent('NOT', 100, 10)
  st().addComponent('LED', 200, 10)
  const [sw, not, led] = st().components
  st().connect({ comp: sw.id, pin: 'out' }, { comp: not.id, pin: 'in0' })
  st().connect({ comp: not.id, pin: 'out' }, { comp: led.id, pin: 'in' })
  return { sw, not, led }
}

describe('round-trip JSON', () => {
  it('salvar → carregar reproduz componentes e fios idênticos', () => {
    buildInverter()
    const json = st().toJSON()
    const before = { components: st().components, wires: st().wires }

    st().clearAll()
    expect(st().components).toHaveLength(0)

    const err = st().loadJSON(json)
    expect(err).toBeNull()
    expect(st().components).toEqual(before.components)
    expect(st().wires).toEqual(before.wires)
  })

  it('ids novos após carregar não colidem com os carregados', () => {
    buildInverter()
    const json = st().toJSON()
    st().loadJSON(json)
    st().addComponent('LED', 300, 10)
    const ids = st().components.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('JSON malformado ou sem campos → mensagem de erro, estado preservado', () => {
    buildInverter()
    expect(st().loadJSON('{{{')).toMatch(/malformado/)
    expect(st().loadJSON('{"a":1}')).toMatch(/components/)
    expect(st().components).toHaveLength(3)
  })

  it('fio sem from/to ou apontando para componente inexistente é rejeitado', () => {
    buildInverter()
    const depth = st().past.length
    expect(st().loadJSON('{"components":[],"wires":[{"id":"w1"}]}')).toMatch(/malformado/)
    expect(
      st().loadJSON(
        '{"components":[{"id":"c1","type":"LED","x":0,"y":0}],"wires":[{"id":"w1","from":{"comp":"zz","pin":"out"},"to":{"comp":"c1","pin":"in"}}]}',
      ),
    ).toMatch(/inexistente/)
    // estado e histórico intactos: nada de checkpoint espúrio
    expect(st().components).toHaveLength(3)
    expect(st().past.length).toBe(depth)
  })

  it('ids duplicados e tipo desconhecido são rejeitados', () => {
    expect(
      st().loadJSON(
        '{"components":[{"id":"c1","type":"LED","x":0,"y":0},{"id":"c1","type":"LED","x":0,"y":0}],"wires":[]}',
      ),
    ).toMatch(/duplicado/)
    expect(
      st().loadJSON('{"components":[{"id":"c1","type":"FOO","x":0,"y":0}],"wires":[]}'),
    ).toMatch(/malformado/)
    expect(st().loadJSON('{"components":[null],"wires":[]}')).toMatch(/malformado/)
  })
})

describe('undo/redo', () => {
  it('desfaz e refaz inserção e ligação', () => {
    buildInverter()
    expect(st().wires).toHaveLength(2)

    st().undo() // desfaz 2ª ligação
    expect(st().wires).toHaveLength(1)
    st().undo() // desfaz 1ª ligação
    expect(st().wires).toHaveLength(0)
    st().undo() // desfaz LED
    expect(st().components).toHaveLength(2)

    st().redo()
    expect(st().components).toHaveLength(3)
    st().redo()
    st().redo()
    expect(st().wires).toHaveLength(2)
  })

  it('undo no fundo da pilha e redo no topo são no-ops', () => {
    st().addComponent('SWITCH', 0, 0)
    st().undo()
    expect(st().components).toHaveLength(0)
    st().undo() // pilha vazia — não explode
    expect(st().components).toHaveLength(0)
    st().redo()
    expect(st().components).toHaveLength(1)
    st().redo() // topo — no-op
    expect(st().components).toHaveLength(1)
  })

  it('nova mutação após undo descarta o futuro', () => {
    st().addComponent('SWITCH', 0, 0)
    st().addComponent('LED', 50, 0)
    st().undo()
    st().addComponent('NOT', 100, 0) // bifurca a história
    expect(st().future).toHaveLength(0)
    st().redo() // nada a refazer
    expect(st().components.map((c) => c.type)).toEqual(['SWITCH', 'NOT'])
  })

  it('edições de rótulo contínuas coalescem em um checkpoint', () => {
    st().addComponent('SWITCH', 0, 0)
    const id = st().components[0].id
    const depth = st().past.length
    st().setLabel(id, 'A')
    st().setLabel(id, 'AB')
    st().setLabel(id, 'ABC')
    expect(st().past.length).toBe(depth + 1)
    st().undo()
    expect(st().components[0].label).not.toBe('ABC')
  })

  it('coalescência expira após pausa — sessões distintas geram undos distintos', () => {
    vi.useFakeTimers()
    try {
      st().addComponent('AND', 0, 0)
      const id = st().components[0].id
      st().setGateInputs(id, 3)
      const depth = st().past.length
      vi.advanceTimersByTime(10_000)
      vi.setSystemTime(Date.now() + 10_000)
      st().setGateInputs(id, 8)
      expect(st().past.length).toBe(depth + 1)
      st().undo()
      expect(st().components[0].inputs).toBe(3) // volta ao estado intermediário
    } finally {
      vi.useRealTimers()
    }
  })

  it('deleção com seleção órfã não polui o histórico', () => {
    st().addComponent('SWITCH', 0, 0)
    st().addComponent('AND', 100, 0)
    const [sw, and] = st().components
    st().setGateInputs(and.id, 4)
    st().connect({ comp: sw.id, pin: 'out' }, { comp: and.id, pin: 'in3' })
    const wireId = st().wires[0].id
    st().select(wireId)
    st().setGateInputs(and.id, 2) // fio removido; seleção fica órfã
    const depth = st().past.length
    const future = st().future.length
    st().deleteSelected()
    expect(st().past.length).toBe(depth) // sem checkpoint vazio
    expect(st().future.length).toBe(future)
    expect(st().selectedId).toBeNull()
  })
})

describe('regras de conexão', () => {
  it('entrada aceita um único fio: novo substitui o antigo', () => {
    st().addComponent('SWITCH', 0, 0)
    st().addComponent('SWITCH', 0, 50)
    st().addComponent('LED', 100, 0)
    const [a, b, led] = st().components
    st().connect({ comp: a.id, pin: 'out' }, { comp: led.id, pin: 'in' })
    st().connect({ comp: b.id, pin: 'out' }, { comp: led.id, pin: 'in' })
    expect(st().wires).toHaveLength(1)
    expect(st().wires[0].from.comp).toBe(b.id)
  })

  it('reduzir fan-in remove fios de pinos extintos', () => {
    st().addComponent('SWITCH', 0, 0)
    st().addComponent('AND', 100, 0)
    const [sw, and] = st().components
    st().setGateInputs(and.id, 4)
    st().connect({ comp: sw.id, pin: 'out' }, { comp: and.id, pin: 'in3' })
    expect(st().wires).toHaveLength(1)
    st().setGateInputs(and.id, 2) // in3 deixa de existir
    expect(st().wires).toHaveLength(0)
  })

  it('deletar componente remove seus fios', () => {
    const { not } = buildInverter()
    st().select(not.id)
    st().deleteSelected()
    expect(st().components).toHaveLength(2)
    expect(st().wires).toHaveLength(0)
  })
})

describe('rótulos e aplicação de entradas', () => {
  it('rótulo automático não duplica após deleção', () => {
    st().addComponent('SWITCH', 0, 0) // A
    st().addComponent('SWITCH', 0, 50) // B
    st().select(st().components[0].id)
    st().deleteSelected() // remove A
    st().addComponent('SWITCH', 0, 100) // deve reusar A, não repetir B
    const labels = st().components.map((c) => c.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('applyInputs não trava PUSH_BUTTON em 1', () => {
    st().addComponent('SWITCH', 0, 0)
    st().addComponent('PUSH_BUTTON', 0, 50)
    const [sw, pb] = st().components
    st().applyInputs(new Map([[sw.id, 1], [pb.id, 1]]))
    expect(st().components.find((c) => c.id === sw.id)?.state).toBe(1)
    expect(st().components.find((c) => c.id === pb.id)?.state).toBe(0)
  })
})

describe('clock', () => {
  it('tickClocks alterna o estado a cada meio período', () => {
    st().addComponent('CLOCK', 0, 0)
    const states: (0 | 1 | undefined)[] = []
    for (let i = 0; i < 4; i++) {
      st().tickClocks(500) // 1 Hz → alterna a cada 500 ms
      states.push(st().components[0].state)
    }
    expect(states).toEqual([1, 0, 1, 0])
  })

  it('stepClock avança meio período do clock mais rápido', () => {
    st().addComponent('CLOCK', 0, 0)
    st().setClockFreq(st().components[0].id, 10) // meio período = 50 ms
    st().stepClock()
    expect(st().components[0].state).toBe(1)
    st().stepClock()
    expect(st().components[0].state).toBe(0)
  })

  it('tick não polui o histórico de undo', () => {
    st().addComponent('CLOCK', 0, 0)
    const depth = st().past.length
    st().tickClocks(500)
    st().tickClocks(500)
    expect(st().past.length).toBe(depth)
  })
})

describe('limite de tamanho do arquivo aberto', () => {
  it('recusa circuito acima do limite sem carregar nada', () => {
    buildInverter()
    const enorme = JSON.stringify({
      version: 1,
      meta: { titulo: 'x'.repeat(MAX_JSON_CHARS) },
      components: [],
      wires: [],
    })
    const err = st().loadJSON(enorme)
    expect(err).toMatch(/grande/)
    expect(st().components).toHaveLength(3)
  })

  it('aceita circuito normal', () => {
    expect(st().loadJSON(JSON.stringify({ version: 1, components: [], wires: [] }))).toBeNull()
  })
})

describe('carregar circuito', () => {
  it('conta cada carregamento, para a bancada se enquadrar', () => {
    const antes = st().carregamentos
    st().loadCircuit([], [])
    st().loadJSON(JSON.stringify({ version: 1, components: [], wires: [] }))
    expect(st().carregamentos).toBe(antes + 2)
  })
})

describe('tabela-verdade destacada', () => {
  it('sai do painel e volta, sem mexer no circuito', () => {
    buildInverter()
    const antes = st().components
    st().setTabelaSolta(true)
    expect(st().tabelaSolta).toBe(true)
    st().setTabelaSolta(false)
    expect(st().tabelaSolta).toBe(false)
    expect(st().components).toBe(antes)
  })
})

describe('janela de edição (duplo clique)', () => {
  it('abre para um componente, seleciona ele e fecha', () => {
    const { not } = buildInverter()
    st().editar(not.id)
    expect(st().editandoId).toBe(not.id)
    expect(st().selectedId).toBe(not.id)
    st().editar(null)
    expect(st().editandoId).toBeNull()
  })

  it('fecha sozinha se o componente sumir (desfazer, limpar)', () => {
    const { led } = buildInverter()
    st().editar(led.id)
    st().loadCircuit([], [])
    expect(st().editandoId).toBeNull()
  })
})

describe('espelhar e girar', () => {
  it('espelha e desespelha, e o desfazer volta', () => {
    const { not } = buildInverter()
    st().espelhar(not.id)
    expect(st().components.find((c) => c.id === not.id)?.espelhado).toBe(true)
    st().espelhar(not.id)
    expect(st().components.find((c) => c.id === not.id)?.espelhado).toBeFalsy()
    st().undo()
    expect(st().components.find((c) => c.id === not.id)?.espelhado).toBe(true)
  })

  it('gira de 90 em 90 e volta ao começo', () => {
    const { led } = buildInverter()
    const giros = [1, 2, 3, 4].map(() => {
      st().girar(led.id)
      return st().components.find((c) => c.id === led.id)?.giro ?? 0
    })
    expect(giros).toEqual([90, 180, 270, 0])
  })

  it('salvar e abrir mantém a orientação; arquivo sem os campos abre como antes', () => {
    const { not } = buildInverter()
    st().espelhar(not.id)
    st().girar(not.id)
    const json = st().toJSON()
    st().loadCircuit([], [])
    expect(st().loadJSON(json)).toBeNull()
    expect(st().components.find((c) => c.id === not.id)).toMatchObject({ espelhado: true, giro: 90 })
  })

  it('recusa orientação inválida no arquivo', () => {
    const ruim = { version: 1, components: [{ id: 'a', type: 'LED', x: 0, y: 0, giro: 45 }], wires: [] }
    expect(st().loadJSON(JSON.stringify(ruim))).toMatch(/inválido/)
    const ruim2 = { version: 1, components: [{ id: 'a', type: 'LED', x: 0, y: 0, espelhado: 'sim' }], wires: [] }
    expect(st().loadJSON(JSON.stringify(ruim2))).toMatch(/inválido/)
  })
})

describe('validação do arquivo aberto', () => {
  const sw = { id: 'a', type: 'SWITCH', x: 0, y: 0 }
  const led = { id: 'b', type: 'LED', x: 100, y: 0 }
  const abrir = (components: object[], wires: object[] = []) =>
    st().loadJSON(JSON.stringify({ version: 1, components, wires }))

  it('abre todos os exemplos sem recusa', () => {
    for (const ex of EXAMPLES) {
      expect(abrir(ex.components, ex.wires), ex.name).toBeNull()
    }
  })

  it('recusa chip com nome herdado do objeto', () => {
    for (const chip of ['constructor', 'toString', '__proto__']) {
      expect(abrir([{ id: 'c', type: 'IC', chip, x: 0, y: 0 }])).toMatch(/chip desconhecido/)
    }
  })

  it('recusa rótulo que não é texto ou é comprido demais', () => {
    expect(abrir([{ ...sw, label: { a: 1 } }])).toMatch(/rótulo/)
    expect(abrir([{ ...sw, label: 'x'.repeat(9) }])).toMatch(/rótulo/)
    expect(abrir([{ id: 't', type: 'LABEL', x: 0, y: 0, label: 'x'.repeat(60) }])).toBeNull()
  })

  it('recusa números fora da faixa', () => {
    expect(abrir([{ id: 'g', type: 'AND', x: 0, y: 0, inputs: 1e7 }])).toMatch(/entradas/)
    expect(abrir([{ id: 'k', type: 'CLOCK', x: 0, y: 0, freq: 0 }])).toMatch(/frequência/)
    expect(abrir([{ id: 'k', type: 'CLOCK', x: 0, y: 0, freq: '1' }])).toMatch(/frequência/)
    expect(abrir([{ ...sw, state: 2 }])).toMatch(/estado/)
    expect(abrir([{ id: 'd', type: 'DISPLAY', x: 0, y: 0, mode: 'oct' }])).toMatch(/modo/)
    expect(st().loadJSON('{"version":1,"components":[{"id":"a","type":"SWITCH","x":1e999,"y":0}],"wires":[]}')).toMatch(
      /malformado/,
    )
  })

  it('recusa fio ligado a pino que não existe ou no sentido errado', () => {
    const fio = (from: object, to: object) => [{ id: 'w', from, to }]
    expect(abrir([sw, led], fio({ comp: 'a', pin: 'out' }, { comp: 'b', pin: 'in' }))).toBeNull()
    expect(abrir([sw, led], fio({ comp: 'a', pin: 'out' }, { comp: 'b', pin: 'in7' }))).toMatch(/pino/)
    expect(abrir([sw, led], fio({ comp: 'b', pin: 'in' }, { comp: 'a', pin: 'out' }))).toMatch(/pino/)
  })
})

describe('flip-flop no estado do programa', () => {
  const montar = () =>
    st().loadJSON(
      JSON.stringify({
        version: 1,
        components: [
          { id: 'd', type: 'SWITCH', x: 0, y: 0, state: 1 },
          { id: 'c', type: 'SWITCH', x: 0, y: 100, state: 0 },
          { id: 'f', type: 'FF_D', x: 200, y: 0 },
        ],
        wires: [
          { id: 'w1', from: { comp: 'd', pin: 'out' }, to: { comp: 'f', pin: 'd' } },
          { id: 'w2', from: { comp: 'c', pin: 'out' }, to: { comp: 'f', pin: 'clk' } },
        ],
      }),
    )
  const qDe = () => st().components.find((c) => c.id === 'f')!.q ?? 0

  it('guarda D na borda de subida da chave de clock, sozinho, a cada mudança', () => {
    expect(montar()).toBeNull()
    expect(qDe()).toBe(0)
    st().toggleSwitch('c')
    expect(qDe()).toBe(1)
    st().toggleSwitch('d')
    expect(qDe()).toBe(1)
  })

  it('recusa estado de flip-flop malformado e estado em componente que não guarda', () => {
    const um = (c: object) => st().loadJSON(JSON.stringify({ version: 1, components: [c], wires: [] }))
    expect(um({ id: 'f', type: 'FF_JK', x: 0, y: 0, q: 2 })).toMatch(/estado do flip-flop/)
    expect(um({ id: 's', type: 'SWITCH', x: 0, y: 0, q: 1 })).toMatch(/estado do flip-flop/)
    expect(um({ id: 'f', type: 'FF_T', x: 0, y: 0, q: 'X', clkVisto: 1 })).toBeNull()
  })

  it('o novo flip-flop ganha rótulo FF1', () => {
    st().addComponent('FF_JK', 0, 0)
    expect(st().components[st().components.length - 1].label).toBe('FF1')
  })
})

describe('CI sequencial no arquivo', () => {
  const um = (c: object) => st().loadJSON(JSON.stringify({ version: 1, components: [c], wires: [] }))
  it('aceita estado do tamanho certo e recusa o resto', () => {
    expect(um({ id: 'c', type: 'IC', chip: '74161', x: 0, y: 0, estadoCi: [1, 0, 1, 'X'], clksVistos: [0] })).toBeNull()
    expect(um({ id: 'c', type: 'IC', chip: '74161', x: 0, y: 0, estadoCi: [1, 0] })).toMatch(/estado do CI/)
    expect(um({ id: 'c', type: 'IC', chip: '7400', x: 0, y: 0, estadoCi: [0] })).toMatch(/estado do CI/)
    expect(um({ id: 'c', type: 'IC', chip: '7474', x: 0, y: 0, clksVistos: [0, 2] })).toMatch(/estado do CI/)
  })
})

describe('linha do tempo no estado do programa', () => {
  it('aberta, cada mudança vira um momento; recomeçar volta a um momento só', () => {
    st().loadJSON(JSON.stringify({ version: 1, components: [{ id: 'a', type: 'SWITCH', x: 0, y: 0, label: 'A' }], wires: [] }))
    st().setLinhaAtiva(true)
    expect(st().linhaDoTempo).toHaveLength(1)
    st().toggleSwitch('a')
    st().toggleSwitch('a')
    expect(st().linhaDoTempo.map((m) => m['a:out'])).toEqual([0, 1, 0])
    st().limparLinhaDoTempo()
    expect(st().linhaDoTempo).toHaveLength(1)
    st().setLinhaAtiva(false)
    st().toggleSwitch('a')
    expect(st().linhaDoTempo).toHaveLength(1)
  })
})
