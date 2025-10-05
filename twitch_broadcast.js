const logger = require("./argus_logger");
const { loadSecrets } = require("./secrets");

// jwt stuff
const jwt = require("jsonwebtoken");

const secrets = loadSecrets();
const extensionSecret = secrets.extensionSecret;
const extensionId = secrets.extensionId;

var request = require("request");

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
  jwtToken = buildToken(broadcasterId);

  broadcastMessage = {
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
  logger.info("Broadcasting data: " + JSON.stringify(broadcastMessage, " ", 2));
  request(requestOptions, function (error, response) {
    if (response.statusCode != 204) {
      logger.warn("Non-standard twitch reply: " + response.body);
    }
    return;
  });
}

function broadcastInfo(runDataArray, broadcastNonce, broadcasterId) {
  runDataArray.forEach((runDataPart, ind) => {
    partialData =
      "*" +
      broadcastNonce +
      "*" +
      ind +
      "*" +
      runDataArray.length +
      "*" +
      runDataPart;

    broadcastInfoPart(partialData, broadcasterId);
  });
}

module.exports = {
  broadcastInfo,
};
