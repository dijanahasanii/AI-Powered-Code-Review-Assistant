/** Relaxed ESLint for existing Node backend — CI quality gate, not perfection. */
module.exports = {
  env: { node: true, es2021: true, jest: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
};
