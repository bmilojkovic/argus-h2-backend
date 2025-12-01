import cron from "node-cron";
import jwt from "jsonwebtoken";
import {
  readStorageObject,
  writeStorageObject,
  storageObjectExists,
  removeStorageObject,
} from "./aws_storage.mjs";
import { logger } from "./argus_logger.mjs";

const secrets = loadSecrets();
const extensionSecret = secrets.extensionSecret;

let runDataCache = {};

async function cleanRunDataSurplus() {
  const currentTimestamp = Date.now();

  const allProfiles = await readStorageObject("twitchIdByArgusToken");

  for (const key of Object.keys(allProfiles)) {
    const currentId = allProfiles[key].twitchId;
    const candidateObjectName = "runData" + currentId;
    if (await storageObjectExists(candidateObjectName)) {
      const runDataObject = await readStorageObject(candidateObjectName);

      if (
        runDataObject != null &&
        runDataObject.timestamp < currentTimestamp - 10 * 60 * 1000
      ) {
        removeStorageObject(candidateObjectName);
        if (Object.hasOwn(runDataCache, currentId)) {
          delete runDataCache[currentId];
        }
      }
    }
  }
}

async function refreshRunDataCache() {
  for (const key of Object.keys(runDataCache)) {
    const storageName = "runData" + key;
    if (await storageObjectExists(storageName)) {
      logger.debug("Updating run data cache for " + key);
      runDataCache[key] = await readStorageObject(storageName);
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
  cleanDashboardSurplus();

  await cleanRunDataSurplus();
  refreshRunDataCache();
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
    runDataCache[twitchProfile.twitchId] = newRunData;
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

async function getRunState(twitchId) {
  if (Object.hasOwn(runDataCache, twitchId)) {
    return runDataCache[twitchId];
  }

  const storageObjectName = "runData" + twitchId;
  if (await storageObjectExists(storageObjectName)) {
    const stateFromStorage = await readStorageObject(storageObjectName);
    runDataCache[twitchId] = stateFromStorage;
    return stateFromStorage;
  }

  return null;
}

export async function handleGetStreamerRunData(req, res) {
  try {
    var decodedPayload = jwt.verify(
      req.headers["x-extension-jwt"],
      Buffer.from(extensionSecret, "base64")
    );

    var userTwitchId = decodedPayload["channel_id"];
    const runState = await getRunState(userTwitchId);
    if (runState != null) {
      res.send(JSON.stringify(runState));
    } else {
      res.send("NO_DATA");
    }
  } catch (error) {
    logger.warn("Error in decoding JWT token: " + error.message);
    res.send("NO_DATA");
  }
}
