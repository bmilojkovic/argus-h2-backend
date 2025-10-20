import { logger } from "./argus_logger.mjs";
import { loadSecrets } from "./secrets.mjs";
import request from "request";

import crypto from "crypto";
import jwt from "jsonwebtoken";

const secrets = loadSecrets();
const extensionSecret = secrets.extensionSecret;
const extensionId = secrets.extensionId;

function buildToken(broadcasterId) {
  const tokenPayload = {
    exp: Math.floor(Date.now() / 1000) + 60,
    user_id: "91943834",
    channel_id: broadcasterId,
    role: "external",
    pubsub_perms: {
      send: ["broadcast"],
    },
  };

  const token = jwt.sign(tokenPayload, Buffer.from(extensionSecret, "base64"));

  return token;
}

function broadcastInfoPart(partialRunData, broadcasterId) {
  var jwtToken = buildToken(broadcasterId);

  var broadcastMessage = {
    message: partialRunData,
    broadcaster_id: broadcasterId,
    target: ["broadcast"],
  };

  var requestOptions = {
    uri: "https://api.twitch.tv/helix/extensions/pubsub",
    body: JSON.stringify(broadcastMessage),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": extensionId,
      Authorization: "Bearer " + jwtToken,
    },
  };
  logger.debug(
    "Broadcasting data: " + JSON.stringify(broadcastMessage, " ", 2)
  );
  request(requestOptions, function (error, response) {
    if (response.statusCode != 204) {
      logger.warn("Non-standard twitch reply: " + response.body);
    }
    return;
  });
}

//twitch package size limitation is 5KB
const TWITCH_PACKAGE_LIMIT = 1024 * 5;
//80% just for paranoia. 20 characters is our nonce and part number.
const TWITCH_PACKAGE_SIZE_CUTOFF = Math.floor(TWITCH_PACKAGE_LIMIT * 0.8) - 20;
const NONCE_MAX = 2 ** 32;

/**
 * This function sends data to Twitch. This might involve breaking up
 * the message into multiple smaller ones because there is a limit of
 * 5KB on the size of messages that can be broacast.
 */
export function broadcastInfo(parsedData, broadcasterId) {
  const broadcastNonce = crypto.randomInt(NONCE_MAX);

  var stringToSend = JSON.stringify(parsedData);

  var parsedDataArray = [];
  if (stringToSend.length > TWITCH_PACKAGE_SIZE_CUTOFF) {
    var startPos = 0;
    var stop = false;

    while (!stop) {
      var endingPosition = startPos + TWITCH_PACKAGE_SIZE_CUTOFF;
      if (endingPosition >= stringToSend.length) {
        endingPosition = stringToSend.length;
        stop = true;
      }
      parsedDataArray.push(stringToSend.substring(startPos, endingPosition));
      startPos = endingPosition;
    }
  } else {
    parsedDataArray.push(stringToSend);
  }

  parsedDataArray.forEach((runDataPart, ind) => {
    var partialData =
      "*" +
      broadcastNonce +
      "*" +
      ind +
      "*" +
      parsedDataArray.length +
      "*" +
      runDataPart;

    broadcastInfoPart(partialData, broadcasterId);
  });
}
