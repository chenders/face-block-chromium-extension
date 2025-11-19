import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.js'],
    plugins: {
      prettier: prettier,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        // Node.js globals (for tests)
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        // WebExtensions globals
        chrome: 'readonly',
        browser: 'readonly',
        // Test helpers and libraries
        faceapi: 'readonly',
        self: 'readonly',
        FaceStorage: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-debugger': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/',
      'extension/libs/',
      'extension/models/',
      'src/public/libs/',
      'src/public/models/',
      'playwright-report/',
      'test-results/',
      'dist/',
      '.wxt/',
    ],
  },
];
