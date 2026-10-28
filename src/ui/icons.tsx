// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Ícones próprios, desenhados do zero (estilo preenchido: formas cheias e traço grosso, legível no
// projetor). Substituem os emojis, que dependiam da fonte do sistema e mudavam de computador para computador.

export type IconName =
  | 'raio'
  | 'livro'
  | 'rodar'
  | 'voltar'
  | 'pausar'
  | 'avancar'
  | 'degraus'
  | 'desfazer'
  | 'refazer'
  | 'limpar'
  | 'info'
  | 'alerta'
  | 'abrir'
  | 'salvar'
  | 'imagem'
  | 'tabela'
  | 'chave'
  | 'porta'
  | 'lampada'
  | 'chip'
  | 'memoria'
  | 'onda'

// Cada ícone: as formas cheias e os traços, numa grade de 24 × 24.
const DESENHOS: Record<IconName, { cheio?: string; traco?: string; ponto?: [number, number] }> = {
  raio: { cheio: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  livro: {
    traco: 'M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5c-3-.5-6 0-8 1.5z M12 6v14.5',
  },
  rodar: { cheio: 'M7 4.5v15l12-7.5z' },
  voltar: { cheio: 'M17 4.5v15L5 12z' },
  pausar: { cheio: 'M7 5h3v14H7z M14 5h3v14h-3z' },
  avancar: { cheio: 'M5 5v14l9-7z', traco: 'M18 5v14' },
  degraus: { traco: 'M3 19h5v-5h5V9h5V4h3' },
  desfazer: { traco: 'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11' },
  refazer: { traco: 'm15 14 5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13' },
  limpar: { traco: 'M20 3 12 11 M7 17l2-2', cheio: 'm12 11-5.5 1L3 21l9-3.5 1-5.5z' },
  info: { traco: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6', ponto: [12, 7.5] },
  alerta: { cheio: 'M12 2.5 1.5 20.5h21z' },
  abrir: { traco: 'M3 7h6l2 2h10v10H3z' },
  salvar: { traco: 'M5 3h12l4 4v14H5z M8 3v6h8' },
  imagem: { traco: 'M3 5h18v14H3z M7 15l4-4 3 3 3-3' },
  tabela: { traco: 'M3 4h18v16H3z M3 10h18 M9 4v16' },
  chave: { traco: 'M8 6.5h8a5.5 5.5 0 0 1 0 11H8a5.5 5.5 0 0 1 0-11z', cheio: 'M16 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  porta: { cheio: 'M6 5h5.5a7 7 0 0 1 0 14H6z', traco: 'M2 9h4 M2 15h4 M18.5 12H22' },
  lampada: { cheio: 'M12 2.5a6.5 6.5 0 0 0-3.8 11.8V17h7.6v-2.7A6.5 6.5 0 0 0 12 2.5z', traco: 'M9 20.5h6' },
  onda: { traco: 'M2 17h4V7h5v10h5V7h4v10h2' },
  memoria: { cheio: 'M10.5 5.5h5v5h-5z', traco: 'M6 3h12v18H6z M6 13.5l3.5 2.5L6 18.5 M2 7.5h4 M2 16h4 M18 7.5h4 M18 16.5h4' },
  chip: { cheio: 'M8 3.5h8v17H8z', traco: 'M3.5 7.5H8 M3.5 12H8 M3.5 16.5H8 M16 7.5h4.5 M16 12h4.5 M16 16.5h4.5' },
}

export function Icon({ name, size = 18, x, y }: { name: IconName; size?: number; x?: number; y?: number }) {
  const d = DESENHOS[name]
  return (
    <svg
      className="icon"
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {d.cheio && (
        <path d={d.cheio} fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {d.traco && (
        <path
          d={d.traco}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {d.ponto && <circle cx={d.ponto[0]} cy={d.ponto[1]} r={1.6} fill="currentColor" />}
      {name === 'alerta' && (
        // o ponto de exclamação é recortado do triângulo com a cor de fundo da página
        <path d="M12 9v5.5 M12 17.6v.1" stroke="var(--icone-recorte, #fff)" strokeWidth={2.4} strokeLinecap="round" />
      )}
    </svg>
  )
}
