// Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT
// Testes do projeto (não do motor): metadados que precisam andar juntos a cada versão.
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'
import changelog from '../../CHANGELOG.md?raw'
import citation from '../../CITATION.cff?raw'
import notices from '../../THIRD-PARTY-NOTICES.md?raw'
import lock from '../../package-lock.json'
import readme from '../../README.md?raw'
import indexHtml from '../../index.html?raw'
import iconeSvg from '../assets/icone.svg?raw'
import { comIcone } from '../build/icone'
import topBarFonte from '../ui/TopBar.tsx?raw'
import sobreFonte from '../ui/AboutDialog.tsx?raw'
import { EXAMPLES } from '../examples'
import { SOBRE } from '../ui/sobre'

describe('versão igual em todos os lugares', () => {
  // A tela Sobre e a barra leem a versão do package.json; os demais lugares são texto.
  it('CHANGELOG: a última versão publicada é a do package.json', () => {
    const m = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)
    expect(m?.[1]).toBe(pkg.version)
  })

  it('CITATION.cff: version é a do package.json', () => {
    const m = citation.match(/^version:\s*"([^"]+)"/m)
    expect(m?.[1]).toBe(pkg.version)
  })

  it('CITATION.cff: date-released é a data da versão publicada no CHANGELOG', () => {
    const cl = changelog.match(/^## \[\d+\.\d+\.\d+\]\D*(\d{4}-\d{2}-\d{2})/m)
    const cf = citation.match(/^date-released:\s*"([^"]+)"/m)
    expect(cf?.[1]).toBe(cl?.[1])
  })
})

describe('CHANGELOG (Keep a Changelog, linguagem de usuário)', () => {
  it('abre com a seção "Não publicado" antes de qualquer versão', () => {
    const naoPublicado = changelog.indexOf('## [Não publicado]')
    const primeiraVersao = changelog.search(/^## \[\d/m)
    expect(naoPublicado).toBeGreaterThan(-1)
    expect(naoPublicado).toBeLessThan(primeiraVersao)
  })

  it('não usa travessão nem meia-risca', () => {
    expect(changelog).not.toMatch(/[—–]/)
  })
})

describe('dependências', () => {
  // Versão exata: o build de hoje e o de daqui a um ano usam os mesmos pacotes.
  it('todas com versão fixa no package.json, sem ^ nem ~', () => {
    const todas = { ...pkg.dependencies, ...pkg.devDependencies }
    const soltas = Object.entries(todas).filter(([, v]) => !/^\d+\.\d+\.\d+$/.test(v))
    expect(soltas).toEqual([])
  })
})

describe('cabeçalho de autoria e licença', () => {
  const CABECALHO = 'Bancada Livre · © 2026 Heraldo Antunes Silva Filho · SPDX-License-Identifier: MIT'
  const proprios = {
    ...import.meta.glob(['../**/*.{ts,tsx,css}'], { query: '?raw', import: 'default', eager: true }),
    ...import.meta.glob(['../../index.html', '../../vite.config.ts', '../../eslint.config.js'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  } as Record<string, string>

  it('acha os arquivos (o teste não pode passar vazio)', () => {
    expect(Object.keys(proprios).length).toBeGreaterThan(30)
  })

  it('todo arquivo próprio começa com o cabeçalho de uma linha', () => {
    const sem = Object.entries(proprios)
      .filter(([, texto]) => {
        const linhas = texto.split(/\r?\n/)
        const primeira = /^<!doctype/i.test(linhas[0]) ? linhas[1] : linhas[0]
        return !primeira?.includes(CABECALHO)
      })
      .map(([caminho]) => caminho)
    expect(sem).toEqual([])
  })
})

describe('componentes de terceiros', () => {
  // O scheduler entra no HTML junto com o react-dom; loose-envify e js-tokens só agem no build.
  const embutidos = [...Object.keys(pkg.dependencies), 'scheduler']
  const pacotes = (lock as { packages: Record<string, { version: string; license: string }> }).packages

  it('THIRD-PARTY-NOTICES lista cada biblioteca embutida com versão e licença', () => {
    const faltando = embutidos.filter((nome) => {
      const p = pacotes[`node_modules/${nome}`]
      const linha = notices.split(/\r?\n/).find((l) => l.startsWith(`| ${nome} |`))
      return !linha || !linha.includes(p.version) || !linha.includes(p.license)
    })
    expect(faltando).toEqual([])
  })

  it('não tem "--", que quebraria o comentário embutido no HTML', () => {
    expect(notices).not.toContain('--')
  })
})

describe('README e tela Sobre', () => {
  it('README tem as seções que o padrão público pede', () => {
    for (const secao of ['## Como abrir', '## Privacidade', '## Como foi feito', '## Licença']) {
      expect(readme).toContain(secao)
    }
  })

  it('README não usa travessão e cita o número certo de exemplos', () => {
    expect(readme).not.toMatch(/[—–]/)
    expect(readme).toContain(`${EXAMPLES.length} circuitos de exemplo`)
  })

  it('README e Sobre trazem o mesmo aviso de marcas', () => {
    expect(readme).toContain(SOBRE.marcas)
  })

  it('Sobre declara privacidade, uso de IA e licença, sem travessão', () => {
    expect(SOBRE.privacidade).toMatch(/nada é enviado/i)
    expect(SOBRE.ia).toMatch(/inteligência artificial/i)
    expect(SOBRE.licenca).toMatch(/MIT/)
    expect(Object.values(SOBRE).join(' ')).not.toMatch(/[—–]/)
  })
})

describe('ícones próprios', () => {
  // Emoji depende da fonte do sistema (muda de computador para computador): a interface usa os
  // desenhos de src/ui/icons.tsx. Setas e sinais matemáticos do texto (→, ¬, ⊕, ×) continuam liberados.
  const telas = import.meta.glob(['../ui/**/*.tsx', '../ui/**/*.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{23E9}-\u{23FA}\u{21B6}\u{21B7}\u{24D8}]/u

  it('nenhum arquivo da interface usa emoji ou símbolo de fonte do sistema', () => {
    const com = Object.entries(telas)
      .filter(([, texto]) => EMOJI.test(texto))
      .map(([caminho, texto]) => `${caminho}: ${texto.match(EMOJI)?.[0]}`)
    expect(com).toEqual([])
  })
})

describe('GitHub Actions', () => {
  const workflows = import.meta.glob('../../.github/workflows/*.yml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  it('existem os workflows combinados', () => {
    const nomes = Object.keys(workflows).map((c) => c.split('/').pop())
    expect(nomes.sort()).toEqual(['assinar-release.yml', 'codeql.yml', 'scorecard.yml', 'testes.yml'])
  })

  it('toda action está fixada pelo hash do commit, com a versão no comentário', () => {
    const soltas = Object.entries(workflows).flatMap(([caminho, texto]) =>
      [...texto.matchAll(/uses:\s*(\S+)(.*)/g)]
        .filter(([, alvo, resto]) => !/@[0-9a-f]{40}$/.test(alvo) || !/#\s*v\d/.test(resto))
        .map(([linha]) => `${caminho}: ${linha}`),
    )
    expect(soltas).toEqual([])
  })

  it('nenhum workflow pede permissão de escrita no topo', () => {
    for (const texto of Object.values(workflows)) {
      expect(texto).toMatch(/^permissions:\s*(read-all|\n\s+contents: read)/m)
    }
  })
})

describe('nome do programa igual em todos os lugares', () => {
  it('Bancada Livre no pacote, na citação, na página, no README e no Sobre', () => {
    expect(pkg.name).toBe('bancada-livre')
    expect(citation).toMatch(/^title: "Bancada Livre/m)
    expect(indexHtml).toMatch(/<title>Bancada Livre<\/title>/)
    expect(readme).toMatch(/^# (<img [^>]*> )?Bancada Livre$/m)
    expect(SOBRE.nome).toBe('Bancada Livre')
  })

  it('o nome antigo não sobrou nos textos públicos', () => {
    for (const texto of [readme, citation, changelog, notices, indexHtml, ...Object.values(SOBRE)]) {
      expect(texto).not.toMatch(/Simulador de Portas Lógicas/)
    }
  })
})

describe('ícone do programa (chip BL)', () => {
  it('existe o desenho-mestre em SVG, com as iniciais BL', () => {
    expect(iconeSvg).toMatch(/<svg[^>]*viewBox="0 0 64 64"/)
    expect(iconeSvg).toContain('>BL</text>')
  })

  it('o ícone da aba vai dentro do HTML (data:), sem arquivo separado', () => {
    const saida = comIcone('<title>Bancada Livre</title>', iconeSvg)
    expect(saida).toContain('<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;charset=utf-8,%3Csvg')
    expect(indexHtml).not.toContain('rel="icon"')
  })

  it('a barra e o Sobre mostram a marca no lugar do raio', () => {
    for (const fonte of [topBarFonte, sobreFonte]) {
      expect(fonte).toContain('<Marca ')
      expect(fonte).not.toContain('name="raio"')
    }
  })

  it('o .ico do Windows tem os 7 tamanhos, de 16 a 256 px', () => {
    // ?raw lê como texto, mas os 6 bytes do cabeçalho do .ico são menores que 128 e chegam intactos
    const ico = Object.values(
      import.meta.glob('../../instalador/bancada-livre.ico', { query: '?raw', import: 'default', eager: true }),
    )[0] as string
    expect([0, 1, 2, 3, 4, 5].map((i) => ico.charCodeAt(i))).toEqual([0, 0, 1, 0, 7, 0])
  })
})

describe('executável e instalador (Windows)', () => {
  const instalador = import.meta.glob(['../../instalador/*.{iss,ps1,py,txt}'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const arq = (nome: string) => instalador[`../../instalador/${nome}`] ?? ''

  it('a versão não fica escrita no instalador: vem do package.json pelo build', () => {
    expect(arq('bancada-livre.iss')).toMatch(/#ifndef AppVer/)
    expect(arq('bancada-livre.iss')).not.toMatch(/#define AppVer "/)
    expect(arq('build.ps1')).toMatch(/Get-Content package\.json -Raw \| ConvertFrom-Json\)\.version/)
    expect(arq('build.ps1')).toContain('"/DAppVer=$versao"')
  })

  it('o lançador e o instalador usam o nome e o ícone do programa', () => {
    expect(arq('lancador.py')).toContain('NOME_HTML = "bancada-livre.html"')
    expect(arq('bancada-livre.iss')).toContain('SetupIconFile=bancada-livre.ico')
    expect(arq('build.ps1')).toContain('bancada-livre.ico')
  })

  it('THIRD-PARTY-NOTICES cita o que vai no executável e no instalador', () => {
    for (const nome of ['Python', 'PyInstaller', 'Inno Setup']) expect(notices).toContain(nome)
  })
})

describe('controles do CLOCK no próprio CLOCK', () => {
  const fontes = import.meta.glob(['../ui/TopBar.tsx', '../ui/ComponentView.tsx', '../ui/CamposDoComponente.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const de = (nome: string) => fontes[`../ui/${nome}`]

  it('saíram da barra de cima', () => {
    expect(de('TopBar.tsx')).not.toContain("'clock.avancar'")
    expect(de('TopBar.tsx')).not.toContain("'clock.rodar'")
  })

  it('estão no componente na bancada e nas propriedades do CLOCK', () => {
    // CamposDoComponente: os campos do painel de propriedades e da janela de edição
    for (const nome of ['ComponentView.tsx', 'CamposDoComponente.tsx']) {
      expect(de(nome)).toContain("'clock.avancar'")
      expect(de(nome)).toContain("'clock.rodar'")
    }
  })
})

describe('barra superior agrupada por função (opção B)', () => {
  const barra = Object.values(
    import.meta.glob('../ui/TopBar.tsx', { query: '?raw', import: 'default', eager: true }),
  )[0] as string

  it('tem os grupos Arquivo, Editar e Aula, com título', () => {
    for (const g of ['Arquivo', 'Editar', 'Aula']) {
      expect(barra).toContain(`<span className="grupo-titulo">${g}</span>`)
    }
  })

  it('a marca é texto, não botão, e o seletor de idioma sem uso saiu', () => {
    expect(barra).toMatch(/<span className="brand">/)
    expect(barra).not.toContain('title="Idioma"')
  })

  it('a tabela pode ser destacada pela barra', () => {
    expect(barra).toContain("'tabela.destacar'")
  })
})
