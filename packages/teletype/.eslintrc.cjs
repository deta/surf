module.exports = {
    extends: [
      '../../.svelte.eslintrc.cjs'
    ],
    ignorePatterns: ['svelte.config.js', 'vite.config.ts', 'micro/'],
    parserOptions: {
      tsconfigRootDir: __dirname,
      project: ['./tsconfig.json'],
    },
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    }
}