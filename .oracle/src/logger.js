const winston = require("winston");

/**
 * Create a configured Winston logger instance
 * @param {boolean} verbose - Enable debug-level logging
 * @returns {winston.Logger}
 */
function createLogger(verbose = false) {
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.printf(({ timestamp, level, message }) => {
      const lvl = level.toUpperCase().padEnd(5);
      return `[${timestamp}] ${lvl} ${message}`;
    })
  );

  const logger = winston.createLogger({
    level: verbose ? "debug" : "info",
    format: logFormat,
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: __dirname + "/../logs/oracle-node.log",
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: __dirname + "/../logs/oracle-errors.log",
        level: "error",
        maxsize: 5 * 1024 * 1024,
        maxFiles: 3,
      }),
    ],
  });

  return logger;
}

module.exports = { createLogger };
