module.exports = {
  "contracts/**/*.sol": ["prettier --write", "solhint --fix"],
  "scripts/**/*.{js,ts}": ["eslint --fix", "prettier --write"],
  "tests/**/*.{js,ts}": ["eslint --fix", "prettier --write"],
  "*.{json,yml,yaml,md}": ["prettier --write"],
};
