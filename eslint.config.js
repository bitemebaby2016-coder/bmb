// ============================================
// Bite Me Baby — ESLint flat config (QA-02)
// Baseline = 0 errors on the existing strict-TS codebase.
// Deliberately small + syntax-focused; style/strictness can be tightened in
// later phases without breaking the 0-error baseline contract.
// ============================================
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'supabase/**', 'e2e/**', '*.cjs', '*.mjs', 'vite.config.ts', 'vitest.config.ts', '.kilo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // --- error rules (syntax-level, guaranteed-safe on code that already passes tsc strict)
      'no-var': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-fallthrough': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],

      // --- baseline-off rules (debt tracked in CURRENT_STATE, tightened later)
      'no-undef': 'off',
      'no-constant-binary-expression': 'off',
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-unused-vars': 'off',
      'no-empty-pattern': 'off',
      'prefer-const': 'off',
      'no-case-declarations': 'off',
    },
  },
)