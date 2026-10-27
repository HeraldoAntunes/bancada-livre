// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Espelhar e girar componentes. Primeiro espelha (troca esquerda e direita em torno do centro do corpo),
// depois gira de 90 em 90 graus no sentido horário, também em torno do centro. O circuito salvo guarda
// os campos opcionais espelhado e giro; sem eles, nada muda.

export type Giro = 0 | 90 | 180 | 270
export interface Orientacao {
  espelhado?: boolean
  giro?: Giro
}
interface Ponto {
  x: number
  y: number
}

export function transformarPonto(caixa: { w: number; h: number }, o: Orientacao, p: Ponto): Ponto {
  const cx = caixa.w / 2
  const cy = caixa.h / 2
  let x = o.espelhado ? caixa.w - p.x : p.x
  let y = p.y
  const g = o.giro ?? 0
  if (g) {
    const a = (g * Math.PI) / 180
    const dx = x - cx
    const dy = y - cy
    x = cx + dx * Math.cos(a) - dy * Math.sin(a)
    y = cy + dx * Math.sin(a) + dy * Math.cos(a)
  }
  // arredonda o ruído do seno e do cosseno (os giros são múltiplos de 90 graus)
  return { x: Math.round(x * 1e6) / 1e6, y: Math.round(y * 1e6) / 1e6 }
}

/** Gira uma direção (vetor) junto com o componente. */
export function transformarDirecao(o: Orientacao, d: Ponto): Ponto {
  const p = transformarPonto({ w: 0, h: 0 }, o, d)
  return { x: Math.round(p.x) || 0, y: Math.round(p.y) || 0 }
}

/** Transformação SVG do desenho do componente, em coordenadas locais (antes do translate da posição). */
export function transformSvg(caixa: { w: number; h: number }, o: Orientacao): string {
  const partes: string[] = []
  if (o.giro) partes.push(`rotate(${o.giro} ${caixa.w / 2} ${caixa.h / 2})`)
  if (o.espelhado) partes.push(`translate(${caixa.w} 0) scale(-1 1)`)
  return partes.join(' ')
}

/** CSS que cada texto do componente usa para continuar de pé e sem espelho. */
export function desfazNoTexto(o: Orientacao): string {
  const partes: string[] = []
  if (o.espelhado) partes.push('scaleX(-1)')
  if (o.giro) partes.push(`rotate(-${o.giro}deg)`)
  return partes.length ? partes.join(' ') : 'none'
}

export function proximoGiro(g: Giro | undefined): Giro {
  return (((g ?? 0) + 90) % 360) as Giro
}
