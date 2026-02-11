/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  setupFilesAfterSetup: ["./jest-setup.js"],
  roots: [".oracle", ".indexer"],
  testMatch: [
    "**/__tests__/**/*.{js,ts}",
    "**/*.{spec,test}.{js,ts}",
  ],
  moduleFileExtensions: ["js", "ts", "json"],
  collectCoverageFrom: [
    ".oracle/src/**/*.js",
    ".indexer/src/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage-js",
  coverageReporters: ["text", "lcov", "clover"],
  verbose: true,
};
