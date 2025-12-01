import cron from "node-cron";
import {
  readStorageObject,
  writeStorageObject,
  objectExists,
  removeStorageObject,
} from "./aws_storage.mjs";
import { logger } from "./argus_logger.mjs";

async function cleanRunDataSurplus() {
  const currentTimestamp = Date.now();

  const allProfiles = await readStorageObject("twitchIdByArgusToken");

  for (const key of Object.keys(allProfiles)) {
    const candidateObjectName = "runData" + allProfiles[key].twitchId;
    if (await objectExists(candidateObjectName)) {
      runDataObject = await readStorageObject(
        "runData" + allProfiles[key].twitchId
      );

      if (
        runDataObject != null &&
        runDataObject.timestamp < currentTimestamp - 10 * 60 * 1000
      ) {
        removeStorageObject(candidateObjectName);
      }
    }
  }
}

async function cleanDashboardSurplus() {
  const currentTimestamp = Date.now();

  let dashboardRunData = await readStorageObject("dashboardRunData");
  //if it is not there, we just exit
  if (dashboardRunData == null) {
    return;
  }

  //remove any entries older than 10min
  dashboardRunData = Object.keys(dashboardRunData).reduce(
    (accumulator, key) => {
      if (dashboardRunData[key].timestamp > currentTimestamp - 10 * 60 * 1000) {
        accumulator[key] = dashboardRunData[key];
      }
      return accumulator;
    },
    {}
  );

  writeStorageObject("dashboardRunData", dashboardRunData);
}

async function timedClean() {
  cleanRunDataSurplus();
  cleanDashboardSurplus();
}

cron.schedule("* * * * *", timedClean);

/**
 * Updates the dashboard object in S3 storage. This one has all the runners in one big bundle.
 */
async function updateDasboardRunData(
  newRunData,
  twitchProfile,
  currentTimestamp
) {
  let dashboardRunData = await readStorageObject("dashboardRunData");

  if (dashboardRunData == null) {
    dashboardRunData = {};
  }

  if (newRunData != null) {
    const objectToStore = {
      runData: newRunData,
      timestamp: currentTimestamp,
      twitchProfile: twitchProfile,
    };
    dashboardRunData[twitchProfile.twitchId] = objectToStore;

    writeStorageObject("dashboardRunData", dashboardRunData);
  }
}

/**
 * Updates the per-streamer storage object in S3
 */
async function updateStreamerRunData(
  newRunData,
  twitchProfile,
  currentTimestamp
) {
  if (newRunData != null) {
    const objectToStore = {
      runData: newRunData,
      timestamp: currentTimestamp,
    };

    writeStorageObject("runData" + twitchProfile.twitchId, objectToStore);
  }
}

/**
 * Store the streamer's data in a separate object as well as update the dashboard.
 */
export async function updateRunState(newRunData, twitchProfile) {
  if (newRunData == null || twitchProfile == null) {
    return;
  }

  const currentTimestamp = Date.now();
  updateDasboardRunData(newRunData, twitchProfile, currentTimestamp);
  updateStreamerRunData(newRunData, twitchProfile, currentTimestamp);
}
