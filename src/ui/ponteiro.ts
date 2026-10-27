// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Ouve o fim de um toque ou clique (pointerup ou pointercancel) a partir do próprio pointerdown.
// Registrar depois, num useEffect, deixava escapar o toque instantâneo de telas de toque e lousas:
// o pointerup chegava antes de o React redesenhar.

export function ouvirFimDoPonteiro(
  alvo: EventTarget,
  aoSoltar: (e: PointerEvent) => void,
  aoCancelar: () => void,
): void {
  const soltar = (e: Event) => {
    parar()
    aoSoltar(e as PointerEvent)
  }
  const cancelar = () => {
    parar()
    aoCancelar()
  }
  const parar = () => {
    alvo.removeEventListener('pointerup', soltar)
    alvo.removeEventListener('pointercancel', cancelar)
  }
  alvo.addEventListener('pointerup', soltar)
  alvo.addEventListener('pointercancel', cancelar)
}
