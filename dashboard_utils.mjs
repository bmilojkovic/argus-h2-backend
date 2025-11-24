import cron from "node-cron";
import { readStorageObject, writeStorageObject } from "./aws_storage.mjs";
import { logger } from "./argus_logger.mjs";

function cleanSurplus(dashboardRunData) {
  const currentTimestamp = Date.now();

  //remove any entries older than 10min
  dashboardRunData = Object.keys(dashboardRunData).reduce(
    (accumulator, key) => {
      if (dashboardRunData[key].timestamp > currentTimestamp - 10 * 60 * 1000) {
        accumulator[key] = dashboardRunData[key];
        return accumulator;
      }
    },
    {}
  );

  return dashboardRunData;
}

/**
 * Updates the object in S3 storage
 */
export async function updateDasboardRunData(newRunData, twitchProfile) {
  logger.info("Starting update dashboard");
  let dashboardRunData = await readStorageObject("dashboardRunData");

  if (newRunData == null || twitchProfile == null) {
    return;
  }
  if (dashboardRunData == null) {
    dashboardRunData = {};
  }
  logger.info("Continuing update dashboard");
  const currentTimestamp = Date.now();

  if (newRunData != null) {
    logger.info("Storing object for profile: " + JSON.stringify(twitchProfile));
    const objectToStore = {
      runData: newRunData,
      timestamp: currentTimestamp,
      twitchProfile: twitchProfile,
    };
    dashboardRunData[twitchProfile.twitchId] = objectToStore;

    await writeStorageObject("dashboardRunData", dashboardRunData);
  }
}

async function timedClean() {
  let dashboardRunData = await readStorageObject("dashboardRunData");
  //if it is not there, we just exit
  if (dashboardRunData == null) {
    return;
  }
  dashboardRunData = cleanSurplus(dashboardRunData);
  await writeStorageObject("dashboardRunData", dashboardRunData);
}

cron.schedule("* * * * *", timedClean);
