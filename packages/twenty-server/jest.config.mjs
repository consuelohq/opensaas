const jestConfig = {
  // For more information please have a look to official docs https://jestjs.io/docs/configuration/#prettierpath-string
  // Prettier v3 should be supported in jest v30 https://github.com/jestjs/jest/releases/tag/v30.0.0-alpha.1
  prettierPath: null,
  // to enable logs, comment out the following line
  silent: true,
  errorOnDeprecated: true,
  clearMocks: true,
  displayName: 'twenty-server',
  rootDir: './',
  resolver: './jest.dialer-source-resolver.cjs',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./setupTests.ts'],
  transformIgnorePatterns: ['/node_modules/'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          transform: {
            decoratorMetadata: true,
            react: {
              runtime: 'automatic',
            },
          },
          experimental: {
            plugins: [
              [
                '@lingui/swc-plugin',
                {
                  stripNonEssentialFields: false,
                },
              ],
            ],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^src/(.*)': '<rootDir>/src/$1',
    '^test/(.*)': '<rootDir>/test/$1',
    '^@consuelo/dialer$': '<rootDir>/../dialer/src/index.ts',
  },
  moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
  modulePathIgnorePatterns: ['<rootDir>/dist'],
  fakeTimers: {
    enableGlobally: true,
  },
  collectCoverageFrom: ['**/*.(t|j)sx?'],
  coverageDirectory: '../coverage',
};

export default jestConfig;
