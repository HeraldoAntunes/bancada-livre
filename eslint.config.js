// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Linter: regras recomendadas do JavaScript e do TypeScript, mais as regras dos hooks do React.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'src-tauri/target/', 'src-tauri/gen/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // as duas regras do "recommended" até a versão 5 do plugin; as do React Compiler, que a versão 7 junta ao
      // "recommended", ficam para uma decisão à parte (hoje acusam 2 trechos do programa)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // scripts e configurações rodam no Node, não no navegador
    files: ['scripts/**/*.mjs', 'instalador/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', WebSocket: 'readonly' } },
  },
)
