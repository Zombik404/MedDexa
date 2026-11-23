/** @type {import('jest').Config} */
const base = { preset: 'ts-jest', testEnvironment: 'node', transform: { '^.+\\.ts$': ['ts-jest', {}] } };
module.exports = {
  projects: [
    { ...base, displayName: 'unit', roots: ['<rootDir>/src'], testMatch: ['**/*.spec.ts'] },
    {
      ...base,
      displayName: 'e2e',
      roots: ['<rootDir>/test'],
      testMatch: ['**/*.e2e-spec.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      setupFiles: ['<rootDir>/test/env.ts'],
    },
  ],
};
