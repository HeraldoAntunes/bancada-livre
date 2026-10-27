// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Marca do programa (chip BL) na barra e no Sobre: o mesmo desenho-mestre de src/assets/icone.svg,
// embutido como imagem data: (permitida pela CSP), para haver uma fonte só do desenho.
import icone from '../assets/icone.svg?raw'

const SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icone)}`

export function Marca({ size }: { size: number }) {
  return <img className="marca" src={SRC} width={size} height={size} alt="" aria-hidden="true" />
}
