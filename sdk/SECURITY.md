# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in this SDK, please report it responsibly:

1. **Do NOT** open a public GitHub issue.
2. Send a detailed report via email or private message to the maintainers.
3. Include steps to reproduce the vulnerability.
4. Allow reasonable time for a fix before public disclosure.

## Security Best Practices

When using this SDK with smart contracts:

- **Never** commit private keys or seed phrases to version control.
- Use environment variables or a secure secrets manager for sensitive data.
- Always verify contract addresses against official sources before interacting.
- Test transactions on testnets before executing on mainnet.
- Implement proper error handling for all contract interactions.
- Keep dependencies up to date with `pnpm audit`.

## Disclaimer

This SDK is auto-generated from smart contract ABIs. While it provides type-safe wrappers, it does **not** audit or verify the underlying smart contract logic. Always perform your own due diligence on the contracts you interact with.
