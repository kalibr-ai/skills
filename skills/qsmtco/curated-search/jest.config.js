module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: [
    '**/unit/**/*.test.js',
    '**/integration/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/crawler.js' // focus on indexer and search first, crawler complex
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true
};
