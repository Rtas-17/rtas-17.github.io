import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['netlify/functions/**', 'cloudflare-worker.js'], // Ignore server-side code
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Configuration for Netlify Functions (Node.js environment)
  {
    files: ['netlify/functions/**/*.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2020,
      sourceType: 'module',
    },
  },
  // Configuration for Cloudflare Worker (service worker environment)
  {
    files: ['cloudflare-worker.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ASSEMBLYAI_API_KEY: 'readonly', // Cloudflare Worker environment variable
      },
      ecmaVersion: 2020,
    },
  },
])
