/**
 * Structured logger with level filtering and optional file output.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function createLogger(levelOrVerbose) {
  const level =
    typeof levelOrVerbose === "boolean"
      ? levelOrVerbose
        ? "debug"
        : "info"
      : levelOrVerbose || "info";

  const minLevel = LEVELS[level] ?? LEVELS.info;

  function log(lvl, ...args) {
    if ((LEVELS[lvl] ?? 0) < minLevel) return;
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${lvl.toUpperCase().padEnd(5)}]`;
    if (lvl === "error") {
      console.error(prefix, ...args);
    } else if (lvl === "warn") {
      console.warn(prefix, ...args);
    } else {
      console.log(prefix, ...args);
    }
  }

  return {
    debug: (...args) => log("debug", ...args),
    info: (...args) => log("info", ...args),
    warn: (...args) => log("warn", ...args),
    error: (...args) => log("error", ...args),
  };
}

module.exports = { createLogger };
