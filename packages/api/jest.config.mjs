const jestConfig = {
  silent: true,
  clearMocks: true,
  displayName: 'api',
  rootDir: './',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: false,
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^src/(.*)': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: [
    '__mocks__',
    '__tests__',
    'testing/',
    'migrations/',
    'index\\.ts$',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      statements: 70,
      lines: 70,
      functions: 60,
    },
  },
};

export default jestConfig;
