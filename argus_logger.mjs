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

let twitchRequestTimestamps = {};

export function reportRequestToTwitch(broadcasterId) {
  const currentTimestamp = Date.now(); //milliseconds since epoch

  if (!Object.hasOwn(twitchRequestTimestamps, broadcasterId)) {
    twitchRequestTimestamps[broadcasterId] = [];
  }
  twitchRequestTimestamps[broadcasterId].push(currentTimestamp);
  //filter out timestamps older than 60 seconds
  twitchRequestTimestamps[broadcasterId] = twitchRequestTimestamps[
    broadcasterId
  ].filter(function (elem, ind) {
    return elem > currentTimestamp - 60 * 1000;
  });

  if (twitchRequestTimestamps[broadcasterId].length > 50) {
    logger.warn(
      "Twitch requests last minute: " +
        twitchRequestTimestamps[broadcasterId].length
    );
  } else if (twitchRequestTimestamps[broadcasterId].length > 20) {
    logger.info(
      "Twitch requests last minute: " +
        twitchRequestTimestamps[broadcasterId].length
    );
  }
}
