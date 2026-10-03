module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Some suites import the real Prisma client (lazy connection pool keeps the
  // event loop alive); force-exit so Jest does not hang on worker teardown.
  forceExit: true,
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^shared$': '<rootDir>/../shared/dist/index.js',
    '^shared/(.*)$': '<rootDir>/../shared/dist/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/test/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!@otplib/|@scure/base|@noble/hashes)',
  ],
};
