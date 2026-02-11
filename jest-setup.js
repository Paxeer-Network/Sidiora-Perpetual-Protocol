/**
 * Jest global setup for Sidiora Perpetual Protocol
 *
 * The primary test framework is Hardhat + Mocha/Chai.
 * This Jest configuration exists for JavaScript utility tests
 * and off-chain component testing (oracle node, indexer, SDK).
 */

// Increase timeout for blockchain-related tests
jest.setTimeout(30_000);

// Suppress console.log during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: console.warn,
    error: console.error,
  };
}
