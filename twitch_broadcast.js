
const logger = require("./argus_logger")

// jwt stuff
const jwt = require('jsonwebtoken');
const sharedSecret = 'Gg2CUK5Ct4RU5jwqCOTKHTkcoGvoXLgtLSATggsrngc=';
const clientId = 'sl19e3aebmadlewzt7mxfv3j3llwwv';

var request = require("request");

function buildToken(broadcasterId) {
  const tokenPayload = {
      exp: Math.floor(Date.now() / 1000) + 60,
      user_id: '91943834',
      channel_id: broadcasterId,
      role: 'external',
      pubsub_perms: {
        send: ["broadcast"]
      }
  };

  const token = jwt.sign(tokenPayload, Buffer.from(sharedSecret, 'base64'));

  return token;
}

function broadcastInfo(runData, broadcasterId) {
    jwtToken = buildToken(broadcasterId);
    broadcastMessage = {
        message: JSON.stringify(runData),
        broadcaster_id: broadcasterId,
        target: ["broadcast"]
    };

    var requestOptions = {
        uri: 'https://api.twitch.tv/helix/extensions/pubsub',
        body: JSON.stringify(broadcastMessage),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Client-Id': clientId,
            'Authorization': 'Bearer ' + jwtToken
        }
    };
    logger.info("Broadcasting data: " + requestOptions.body)
    request(requestOptions, function (error, response) {
        
        if (response.statusCode != 204) {
            logger.warn("Non-standard twitch reply: " + response.body);
        }
        return;
    });
}

module.exports = {
    broadcastInfo
}