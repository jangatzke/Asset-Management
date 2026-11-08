module.exports = {
  root: true,
  env: {
    es2022: true,
    browser: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/', 'vite.config.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }],
    '@typescript-eslint/no-empty-function': 'warn',
    'no-empty': ['error', { allowEmptyCatch: false }],
    'prefer-const': 'off',
    'no-extra-semi': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      // LT-2 guardrail (Stage 10a): business pages must style via Tailwind +
      // semantic tokens / recipes, not MUI `sx` overrides. The documented MUI
      // admin modules (Intune/Proxmox/VMware) are Material UI screens and are
      // exempt — see docs/phase15-design-system.md.
      files: ['src/pages/**/*.tsx'],
      excludedFiles: [
        'src/pages/AdminIntune.tsx',
        'src/pages/AdminProxmox.tsx',
        'src/pages/AdminVMware.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "JSXAttribute[name.name='sx']",
            message: 'MUI sx overrides are not allowed in pages — use Tailwind utilities from styles/tokens.ts recipes or semantic token classes instead (docs/phase15-design-system.md).',
          },
        ],
      },
    },
  ],
};
