module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    mocha: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: ["error", "always"],
    curly: ["error", "multi-line"],
    "no-throw-literal": "error",
    "no-return-await": "warn",
    "require-await": "warn",
  },
  overrides: [
    {
      files: ["tests/**/*.js", "tests/**/*.ts"],
      rules: {
        "no-unused-expressions": "off",
      },
    },
  ],
  ignorePatterns: [
    "node_modules/",
    "artifacts/",
    "cache/",
    "dist/",
    "out/",
    "sdk/dist/",
    ".indexer/node_modules/",
    ".oracle/node_modules/",
  ],
};
