import cron from "node-cron";
import { readStorageObject, writeStorageObject } from "./aws_storage.mjs";

/**
 * Updates the object in S3 storage
 */
export function updateDasboardRunData(newRunData, twitchProfile) {
  const dashboardRunData = readStorageObject("dashboardRunData");

  //if it is not there, we just exit
  if (dashboardRunData == null && newRunData == null) {
    return;
  }

  const currentTimestamp = Date.now();

  if (newRunData != null) {
    const objectToStore = {
      runData: newRunData,
      timestamp: currentTimestamp,
      twitchProfile: twitchProfile,
    };
    dashboardRunData[twitchProfile.twitchId] = objectToStore;
  }

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

  writeStorageObject("dashboardRunData", dashboardRunData);
}

cron.schedule("* * * * *", updateDasboardRunData);
