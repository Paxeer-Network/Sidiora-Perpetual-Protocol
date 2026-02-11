module.exports = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  overrides: [
    {
      files: "*.sol",
      options: {
        printWidth: 120,
        tabWidth: 4,
        singleQuote: false,
      },
    },
  ],
};
