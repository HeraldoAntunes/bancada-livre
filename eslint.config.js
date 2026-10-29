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
      ...reactHooks.configs.recommended.rules,
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // scripts e configurações rodam no Node, não no navegador
    files: ['scripts/**/*.mjs', 'instalador/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', WebSocket: 'readonly' } },
  },
)
