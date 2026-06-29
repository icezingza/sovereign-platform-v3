/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
  ],
};
