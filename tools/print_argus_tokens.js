import { readStorageObject } from "../aws_storage.mjs";
import { logger } from "../argus_logger.mjs";

async function printArgusTokens() {
  var twitchIdByArgusToken = await readStorageObject("twitchIdByArgusToken");

  logger.info(JSON.stringify(twitchIdByArgusToken));
}

printArgusTokens();
