# Componentes de terceiros

O Bancada Livre (licença MIT, ver LICENSE) embute no seu arquivo HTML as bibliotecas abaixo, todas
de código aberto sob a licença MIT. O texto da licença de cada uma vem logo depois da tabela e também vai dentro
do próprio HTML distribuído, num comentário no fim do arquivo.

| Biblioteca | Versão | Licença | Titular | Origem |
|-|-|-|-|-|
| react | 18.3.1 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react |
| react-dom | 18.3.1 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react |
| scheduler | 0.23.2 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react |
| zustand | 5.0.14 | MIT | Paul Henschel | https://github.com/pmndrs/zustand |

## Versão para Windows (executável e instalador)

O executável e o instalador levam, além do HTML acima:

| Componente | Versão | Licença | Para quê |
|-|-|-|-|
| Python | 3.13 | PSF License | roda o lançador que abre o simulador numa janela própria |
| PyInstaller | 6.22.3 | GPL 2.0 com exceção para o executável gerado (runtime hooks Apache 2.0) | transforma o lançador em BancadaLivre.exe |
| Inno Setup | 6 | licença do Inno Setup (livre, permite uso comercial) | monta o instalador |

A exceção da licença do PyInstaller permite distribuir o executável gerado sob a licença do próprio programa (MIT).
Os textos completos dessas licenças vão na pasta licencas, instalada junto com o programa.

As ferramentas usadas só para montar e testar o programa (Vite, TypeScript, Vitest, ESLint e seus complementos)
não vão para o arquivo do aluno. Elas estão listadas, com as licenças, no package-lock.json.

Nenhum ícone, fonte ou imagem de terceiros é distribuído: os desenhos são próprios e as fontes de texto são as
que já vêm no sistema de quem abre o programa.

## Licença MIT: react, react-dom e scheduler

MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Licença MIT: zustand

MIT License

Copyright (c) 2019 Paul Henschel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
