# Componentes de terceiros

O Bancada Livre (licença MIT, ver LICENSE) embute no seu arquivo HTML as bibliotecas abaixo, todas
de código aberto sob a licença MIT. O texto da licença de cada uma vem logo depois da tabela e também vai dentro
do próprio HTML distribuído, num comentário no fim do arquivo.

| Biblioteca | Versão | Licença | Titular | Origem |
|-|-|-|-|-|
| react | 18.3.1 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react |
| react-dom | 18.3.1 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react |
| scheduler | 0.23.2 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react |
| zustand | 5.0.16 | MIT | Paul Henschel | https://github.com/pmndrs/zustand |

## Versão para Windows (instalador)

O programa do Windows (BancadaLivre.exe) mostra o HTML acima numa janela própria.

| Componente | Versão | Licença | Para quê |
|-|-|-|-|
| Tauri e as bibliotecas Rust que ele usa | 2 | MIT ou Apache 2.0 (à escolha) | janela própria; a lista completa, com as versões, está em src-tauri/Cargo.lock |
| WebView2 (Microsoft) | o do Windows | licença da Microsoft | desenha a janela; vem no Windows ou é instalado à parte pelo instalador oficial da Microsoft (no zip "para escola sem internet", sem alteração) |

O programa se instala sozinho, sem empacotador de terceiros.

As ferramentas usadas só para montar e testar o programa (Vite, TypeScript, Vitest, ESLint e seus complementos)
não vão para o arquivo do aluno. Elas estão listadas, com as licenças, no package-lock.json.

A única imagem de terceiros é a bandeira do Brasil (`src/assets/bandeira-brasil.svg`, na janela Sobre e no README):
o arquivo `File:Flag_of_Brazil.svg` do Wikimedia Commons, sem alteração, de domínio público (símbolo nacional,
usado conforme a Lei 5.700/1971). Os demais desenhos são próprios, e as fontes de texto são as que já vêm no
sistema de quem abre o programa.

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
