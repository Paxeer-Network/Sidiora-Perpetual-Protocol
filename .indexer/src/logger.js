const winston = require("winston");
const fs = require("fs");
const path = require("path");

function createLogger(level = "info") {
  const logsDir = path.join(__dirname, "..", "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}`;
    })
  );

  return winston.createLogger({
    level,
    format: logFormat,
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: path.join(logsDir, "indexer.log"),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, "indexer-errors.log"),
        level: "error",
        maxsize: 5 * 1024 * 1024,
        maxFiles: 3,
      }),
    ],
  });
}

module.exports = { createLogger };
