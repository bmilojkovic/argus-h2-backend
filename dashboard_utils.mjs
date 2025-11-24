import cron from "node-cron";
import { readStorageObject, writeStorageObject } from "./aws_storage.mjs";

function cleanSurplus(dashboardRunData) {
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
  const dashboardRunData = await readStorageObject("dashboardRunData");

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

  await writeStorageObject("dashboardRunData", dashboardRunData);
}

async function timedClean() {
  const dashboardRunData = await readStorageObject("dashboardRunData");
  //if it is not there, we just exit
  if (dashboardRunData == null && newRunData == null) {
    return;
  }
  dashboardRunData = cleanSurplus(dashboardRunData);
  await writeStorageObject("dashboardRunData", dashboardRunData);
}

cron.schedule("* * * * *", timedClean);
