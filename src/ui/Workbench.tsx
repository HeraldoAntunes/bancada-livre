// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Bancada SVG: arrastar componentes, criar fios pino-a-pino, simular em tempo real.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SimResult } from '../engine/simulate'
import type { CircuitComponent } from '../engine/types'
import { useCircuit } from '../state/store'
import { executarNaTela as cmd, registrar } from '../comandos'
import { ComponentView } from './ComponentView'
import { pinDirection, pinPosition, wirePath, type PinDef } from './geometry'
import { ouvirFimDoPonteiro } from './ponteiro'
import { VISTA_INICIAL, enquadrar, limitesDosComponentes, telaParaBancada, zoomNoPonto, type Ponto, type Vista } from './vista'
import { WireView } from './WireView'

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number; sx: number; sy: number }
  | { kind: 'wire'; from: { comp: string; pin: string; dir: 'in' | 'out' }; x: number; y: number }

const snap = (v: number) => Math.round(v / 8) * 8

interface WorkbenchProps {
  sim: SimResult
  /** Nível da onda destacado no modo passo a passo (null = modo desligado). */
  stepHighlight: number | null
  levels: Map<string, number>
}

export function Workbench({ sim, stepHighlight, levels }: WorkbenchProps) {
  const components = useCircuit((s) => s.components)
  const wires = useCircuit((s) => s.wires)
  const selectedId = useCircuit((s) => s.selectedId)
  const select = useCircuit((s) => s.select)
  const moveComponent = useCircuit((s) => s.moveComponent)
  const checkpoint = useCircuit((s) => s.checkpoint)
  const showNames = useCircuit((s) => s.showNames)
  const carregamentos = useCircuit((s) => s.carregamentos)

  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  // Flags do arrasto em ref: atualizam sincronamente, sem a janela de closure
  // obsoleta entre setState e a re-inscrição dos listeners de window.
  const dragMeta = useRef({ moved: false, checkpointed: false })

  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components])

  // Zoom e movimento (ver vista.ts): o circuito fica em coordenadas da bancada; a vista só muda o desenho.
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL)
  const vistaRef = useRef(vista)
  useEffect(() => {
    vistaRef.current = vista
  }, [vista])

  const pontoNaTela = useCallback((e: { clientX: number; clientY: number }): Ponto => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [])
  const svgPoint = useCallback(
    (e: { clientX: number; clientY: number }) => telaParaBancada(vistaRef.current, pontoNaTela(e)),
    [pontoNaTela],
  )

  const tamanho = () => {
    const r = svgRef.current?.getBoundingClientRect()
    return r && r.width > 0 ? { w: r.width, h: r.height } : { w: 800, h: 600 }
  }
  // Ajustar: mostra todo o circuito, o maior possível
  const ajustar = useCallback(() => {
    const r = limitesDosComponentes(useCircuit.getState().components)
    const t = tamanho()
    setVista(r ? enquadrar(r, t.w, t.h) : VISTA_INICIAL)
  }, [])
  const zoomNoCentro = useCallback((fator: number) => {
    const t = tamanho()
    setVista((v) => zoomNoPonto(v, { x: t.w / 2, y: t.h / 2 }, fator))
  }, [])

  // a vista (zoom) só existe com a bancada na tela: os comandos dela entram e saem com ela
  useEffect(() => {
    const tirar = [
      registrar('vista.ampliar', {
        descricao: 'Amplia (fator maior que 1) ou reduz (menor que 1) a bancada, mantendo o centro',
        params: { fator: { tipo: 'numero', descricao: 'quanto ampliar, ex.: 1.2 ou 0.8', min: 0.05, max: 20 } },
        executar: (p) => zoomNoCentro(p.fator as number),
      }),
      registrar('vista.ajustar', {
        descricao: 'Enquadra todo o circuito na bancada (botão Ajustar, Ctrl e 0)',
        params: {},
        executar: () => ajustar(),
      }),
      registrar('vista.tamanho_real', {
        descricao: 'Volta a bancada a 100%',
        params: {},
        executar: () => zoomNoCentro(1 / vistaRef.current.escala),
      }),
    ]
    return () => tirar.forEach((t) => t())
  }, [ajustar, zoomNoCentro])

  // exemplo ou arquivo aberto: enquadra o circuito novo
  useEffect(() => {
    if (carregamentos > 0) ajustar()
  }, [carregamentos, ajustar])

  // roda do mouse: amplia no ponto do cursor
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = svg.getBoundingClientRect()
      const cursor = { x: e.clientX - r.left, y: e.clientY - r.top }
      setVista((v) => zoomNoPonto(v, cursor, Math.exp(-e.deltaY * 0.0015)))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // Ctrl e +, Ctrl e −, Ctrl e 0 (e Ctrl com a roda fora da bancada): zoom do programa, nunca o do navegador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return
      if (e.key === '+' || e.key === '=') cmd('vista.ampliar', { fator: 1.2 })
      else if (e.key === '-') cmd('vista.ampliar', { fator: 1 / 1.2 })
      else if (e.key === '0') cmd('vista.ajustar')
      else return
      e.preventDefault()
    }
    const semZoomDoNavegador = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', semZoomDoNavegador, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', semZoomDoNavegador)
    }
  }, [])

  // arrastar o fundo move a vista; clique sem arrastar desmarca
  const onFundoDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    const inicio = pontoNaTela(e)
    const v0 = vistaRef.current
    let moveu = false
    const mover = (ev: PointerEvent) => {
      const p = pontoNaTela(ev)
      if (!moveu && Math.hypot(p.x - inicio.x, p.y - inicio.y) < 4) return
      moveu = true
      setVista({ ...v0, x: v0.x + p.x - inicio.x, y: v0.y + p.y - inicio.y })
    }
    const fim = () => {
      window.removeEventListener('pointermove', mover)
      if (!moveu) select(null)
    }
    window.addEventListener('pointermove', mover)
    ouvirFimDoPonteiro(window, fim, fim)
  }

  useEffect(() => {
    if (!drag) return

    const onMove = (e: PointerEvent) => {
      const p = svgPoint(e)
      if (drag.kind === 'move') {
        const isMoved = dragMeta.current.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > 4
        if (isMoved) {
          // um checkpoint por arrasto, antes do primeiro deslocamento (RF-07)
          if (!dragMeta.current.checkpointed) {
            checkpoint()
            dragMeta.current.checkpointed = true
          }
          dragMeta.current.moved = true
          moveComponent(drag.id, snap(p.x - drag.dx), snap(p.y - drag.dy))
        }
      } else {
        setDrag({ ...drag, x: p.x, y: p.y })
      }
    }

    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [drag, moveComponent, checkpoint, svgPoint])

  // Fim do arrasto, ouvido desde o pointerdown (ver ponteiro.ts): soltar sem mover
  // alterna a chave; soltar sobre um pino liga o fio.
  const terminar = (drag: Drag, e: PointerEvent) => {
    if (drag.kind === 'wire') {
      const el = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-pin]')
      if (el) {
        const comp = el.getAttribute('data-comp')!
        const pin = el.getAttribute('data-pin')!
        const dir = el.getAttribute('data-dir') as 'in' | 'out'
        // Só conecta saída→entrada (RF-04.2), em qualquer ordem de arrasto.
        if (dir !== drag.from.dir) {
          const out = drag.from.dir === 'out' ? drag.from : { comp, pin }
          const inn = drag.from.dir === 'in' ? drag.from : { comp, pin }
          cmd('fio.ligar', { de: `${out.comp}:${out.pin}`, para: `${inn.comp}:${inn.pin}` })
        }
      }
    } else if (!dragMeta.current.moved) {
      // lê o circuito direto do store: a chave pode ter sido criada neste mesmo toque
      const c = useCircuit.getState().components.find((x) => x.id === drag.id)
      if (c?.type === 'SWITCH') cmd('chave.alternar', { id: c.id })
      if (c?.type === 'DIP_SWITCH') {
        // banco de chaves: alterna só a posição que estava sob o dedo
        const el = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-chave]')
        if (el) cmd('banco.alternar', { id: c.id, posicao: Number(el.getAttribute('data-chave')) + 1 })
      }
    }
    setDrag(null)
  }

  // pointercancel (troca de janela, gesto do SO) aborta o arrasto sem efeitos.
  const iniciar = (d: Drag) => {
    setDrag(d)
    ouvirFimDoPonteiro(window, (e) => terminar(d, e), () => setDrag(null))
  }

  // Captura o ponteiro no svg: soltar FORA da janela ainda entrega o pointerup
  // (sem isso o arrasto ficaria "colado" ao cursor). Falha em eventos sintéticos.
  const capture = (e: React.PointerEvent) => {
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* ponteiro sintético/inativo */
    }
  }

  const onBodyDown = (e: React.PointerEvent, comp: CircuitComponent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    select(comp.id)
    dragMeta.current = { moved: false, checkpointed: false }
    const p = svgPoint(e)
    iniciar({ kind: 'move', id: comp.id, dx: p.x - comp.x, dy: p.y - comp.y, sx: p.x, sy: p.y })
  }

  const onPinDown = (e: React.PointerEvent, comp: CircuitComponent, pin: PinDef) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    const pos = pinPosition(comp, pin.name)
    iniciar({ kind: 'wire', from: { comp: comp.id, pin: pin.name, dir: pin.dir }, x: pos.x, y: pos.y })
  }

  const onPress = (id: string) => {
    cmd('botao.pressionar', { id, pressionado: true })
    const release = () => {
      cmd('botao.pressionar', { id, pressionado: false })
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/x-comp-type')
    if (!raw) return
    const p = svgPoint(e)
    const lugar = { x: snap(p.x - 24), y: snap(p.y - 24) }
    cmd('componente.adicionar', raw.startsWith('IC:') ? { tipo: 'IC', chip: raw.slice(3), ...lugar } : { tipo: raw, ...lugar })
  }

  const draftDir = drag?.kind === 'wire' ? drag.from.dir : null

  return (
    <div className="bench" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg ref={svgRef} className="bancada-svg" onPointerDown={onFundoDown}>
        <defs>
          <pattern
            id="grid"
            width={16}
            height={16}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${vista.x} ${vista.y}) scale(${vista.escala})`}
          >
            <circle cx={1} cy={1} r={1} fill="#dde5ec" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.escala})`}>

        {/* fios */}
        {wires.map((w) => {
          const from = byId.get(w.from.comp)
          const to = byId.get(w.to.comp)
          if (!from || !to) return null
          const p1 = pinPosition(from, w.from.pin)
          const p2 = pinPosition(to, w.to.pin)
          return (
            <WireView
              key={w.id}
              d={wirePath(p1.x, p1.y, p2.x, p2.y, pinDirection(from, w.from.pin), pinDirection(to, w.to.pin))}
              signal={sim.wires.get(w.id) ?? 'X'}
              selected={w.id === selectedId}
              onSelect={() => select(w.id)}
            />
          )
        })}

        {/* fio em criação */}
        {drag?.kind === 'wire' &&
          (() => {
            const fromComp = byId.get(drag.from.comp)
            if (!fromComp) return null
            const start = pinPosition(fromComp, drag.from.pin)
            const dir = pinDirection(fromComp, drag.from.pin)
            const oposta = { x: -dir.x, y: -dir.y }
            const d =
              drag.from.dir === 'out'
                ? wirePath(start.x, start.y, drag.x, drag.y, dir, oposta)
                : wirePath(drag.x, drag.y, start.x, start.y, oposta, dir)
            return (
              <path d={d} fill="none" stroke="#339af0" strokeWidth={3} strokeDasharray="5 4" pointerEvents="none" />
            )
          })()}

        {/* componentes */}
        {components.map((c) => (
          <ComponentView
            key={c.id}
            comp={c}
            sim={sim}
            selected={c.id === selectedId}
            showNames={showNames}
            waveHighlight={stepHighlight !== null && levels.get(c.id) === stepHighlight}
            draftDir={draftDir}
            onBodyDown={onBodyDown}
            onPinDown={onPinDown}
            onPress={onPress}
          />
        ))}
        </g>
      </svg>

      <div className="zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button title="Reduzir (Ctrl e −)" aria-label="Reduzir" onClick={() => cmd('vista.ampliar', { fator: 1 / 1.2 })}>
          −
        </button>
        <button
          className="zoom-pct"
          title="Tamanho real (100%)"
          onClick={() => cmd('vista.tamanho_real')}
        >
          {Math.round(vista.escala * 100)}%
        </button>
        <button title="Ampliar (Ctrl e +)" aria-label="Ampliar" onClick={() => cmd('vista.ampliar', { fator: 1.2 })}>
          +
        </button>
        <button className="zoom-ajustar" title="Mostrar todo o circuito (Ctrl e 0)" onClick={() => cmd('vista.ajustar')}>
          Ajustar
        </button>
      </div>
    </div>
  )
}
