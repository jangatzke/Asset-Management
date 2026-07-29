module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
