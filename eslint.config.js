// ESLint v9 flat configuration for AetherTerra 3D (TypeScript + React 19)
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'warn',
    },
  },
];
