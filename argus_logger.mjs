import winston from "winston";

const alignedWithColorsAndTime = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD hh:mm:ss" }),
  winston.format.align(),
  winston.format.simple()
);

export const logger = winston.createLogger({
  level: "info",
  //format: winston.format.json(),
  format: alignedWithColorsAndTime,
  transports: [
    //
    // - Write all logs with importance level of `error` or higher to `error.log`
    //   (i.e., error, fatal, but not other levels)
    //
    new winston.transports.File({ filename: "error.log", level: "error" }),
    //
    // - Write all logs with importance level of `info` or higher to `combined.log`
    //   (i.e., fatal, error, warn, and info, but not trace)
    //
    new winston.transports.File({ filename: "combined.log" }),
  ],
});
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "YYYY-MM-DD hh:mm:ss" }),
        winston.format.align(),
        winston.format.simple()
      ),
      level: "debug",
    })
  );
} else {
  logger.add(
    new winston.transports.Console({
      stderrLevels: ["error", "warn"],
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "YYYY-MM-DD hh:mm:ss" }),
        winston.format.align(),
        winston.format.simple()
      ),
      level: "debug",
    })
  );
}
