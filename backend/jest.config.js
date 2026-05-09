module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['./src/__tests__/setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/__tests__/**', '!src/config/migrate.js'],
  coverageReporters: ['text', 'lcov'],
  forceExit: true,
  clearMocks: true,
};
