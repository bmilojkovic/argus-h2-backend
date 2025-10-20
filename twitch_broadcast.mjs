import { logger } from "./argus_logger.mjs";
import { loadSecrets } from "./secrets.mjs";
import request from "request";

import crypto from "crypto";
import jwt from "jsonwebtoken";

const secrets = loadSecrets();
const extensionSecret = secrets.extensionSecret;
const extensionId = secrets.extensionId;

/**
 * The payload for the JWT token is as follows:
 * - `exp`: expiration time
 * - `user_id`: extension owner (this is a constant in our case)
 * - `channel_id`: the streamer id (this is a variable in our case)
 * - `role`: "external" (pubsub specific)
 * - `pubsub_perms`: in our case, just "broadcast"
 *
 * General token schema: https://dev.twitch.tv/docs/extensions/reference/#jwt-schema
 * Pubsub specifics: https://dev.twitch.tv/docs/api/reference/#send-extension-pubsub-message
 *
 * @param {*} broadcasterId The Twitch ID of the streamer we are broadcasting to
 * @returns Signed JWT token
 */

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

/**
 * This function does the actual sending to Twitch. It needs a JWT token
 * that identifies our backend.
 * @param {*} partialRunData A string smaller than 5KB that we can broadcast to Twitch
 * @param {*} broadcasterId Twitch ID of the streamer we are broadcasting to
 */
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
 * @param {*} parsedData A JSON object with everything prepared for frontend.
 * @param {*} broadcasterId A string with the Twitch ID of the streamer we are broadcasting to.
 */
export function broadcastInfo(parsedData, broadcasterId) {
  //every broadcast will have a unique nonce, even if it isn't being split up
  const broadcastNonce = crypto.randomInt(NONCE_MAX);

  var stringToSend = JSON.stringify(parsedData);

  var parsedDataArray = [];
  //if we get into this block, we are splitting the broadcast into smaller "messages"
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
    //our header has the following format:
    //*NONCE*INDEX*NUMBER_OF_MESSAGES*message
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
