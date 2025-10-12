import { writeStorageObject } from "../aws_storage.mjs";

function eraseArgusTokens() {
  writeStorageObject("twitchIdByArgusToken", {});
  writeStorageObject("pendingTwitchLogins", {});
}

eraseArgusTokens();
