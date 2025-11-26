import crypto from "crypto";
import querystring from "querystring";
import request from "request";
import jwt from "jsonwebtoken";

import { loadSecrets } from "./secrets.mjs";
import { readStorageObject, writeStorageObject } from "./aws_storage.mjs";

import { logger } from "./argus_logger.mjs";

const secrets = loadSecrets();
const extensionId = secrets.extensionId;
const apiClientSecret = secrets.apiClientSecret;
const extensionSecret = secrets.extensionSecret;

function generateRandomHex(length) {
  // `length` specifies the number of bytes, not hex characters.
  // Each byte converts to two hex characters.
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

async function getAppAccessToken() {
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: extensionId,
      client_secret: apiClientSecret,
      grant_type: "client_credentials",
    }),
  });
  const data = await response.json();
  return data.access_token;
}

async function getUsernameFromTwitch(twitchId) {
  const twitchAccessToken = await getAppAccessToken();

  const response = await fetch(
    `https://api.twitch.tv/helix/users?id=${twitchId}`,
    {
      headers: {
        Authorization: `Bearer ${twitchAccessToken}`,
        "Client-Id": extensionId,
      },
    }
  );

  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0].display_name; // Or .login for the lowercase username
  }
  return null; // User not found
}

/**
 * Updates the username for this user profile in storage. Returns the updated user profile object.
 * @param {*} argus_token
 */
export async function updateUsernameFor(argus_token) {
  var twitchIdByArgusTokenMap = await readStorageObject("twitchIdByArgusToken");

  if (Object.hasOwn(twitchIdByArgusTokenMap, argus_token)) {
    if (
      !Object.hasOwn(twitchIdByArgusTokenMap[argus_token], "twitchUsername")
    ) {
      logger.info(
        "Getting username for " +
          argus_token +
          " with id " +
          twitchIdByArgusTokenMap[argus_token].twitchId
      );
      const twitchUsername = await getUsernameFromTwitch(
        twitchIdByArgusTokenMap[argus_token].twitchId
      );
      logger.info("Got username: " + twitchUsername);
      if (twitchUsername != null) {
        twitchIdByArgusTokenMap[argus_token].twitchUsername = twitchUsername;
        await writeStorageObject(
          "twitchIdByArgusToken",
          twitchIdByArgusTokenMap
        );
      }
      return twitchIdByArgusTokenMap[argus_token];
    }
  }

  return null;
}

export function handleOauthToken(req, res) {
  var clientState = req.query.state;

  if (req.query != null && req.query.code != null) {
    const requestParams = {
      client_id: extensionId,
      client_secret: apiClientSecret,
      code: req.query.code,
      grant_type: "authorization_code",
      //redirect_uri: "http://localhost:3000/oauth_token",
      redirect_uri: "https://argus-h2-backend.fly.dev/oauth_token",
    };

    var requestOptions = {
      uri: "https://id.twitch.tv/oauth2/token",
      body: querystring.stringify(requestParams),
      method: "POST",
    };

    //use the auth code to get the access token
    request.post(requestOptions, function (error, response) {
      var jsonResponse = JSON.parse(response.body);

      var claimsRequestOptions = {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + jsonResponse["access_token"],
        },
      };

      //make a claims request to get the twitch user id
      request.get(
        "https://id.twitch.tv/oauth2/userinfo",
        claimsRequestOptions,
        async function (error, response) {
          var claimsObject = JSON.parse(response.body);
          var userTwitchId = claimsObject["sub"];

          var pendingTwitchLogins = await readStorageObject(
            "pendingTwitchLogins"
          );
          if (pendingTwitchLogins != null) {
            if (pendingTwitchLogins[clientState] != null) {
              delete pendingTwitchLogins[clientState];
            }

            pendingTwitchLogins[clientState] = {
              twitchId: userTwitchId,
              twitchProfilePic: claimsObject["picture"],
              argusToken: generateRandomHex(16),
            };

            logger.debug(
              "Adding pending object: " +
                JSON.stringify(pendingTwitchLogins[clientState])
            );

            writeStorageObject("pendingTwitchLogins", pendingTwitchLogins);

            res.redirect("/auth_success.html");
          } else {
            res.redirect("/auth_fail.html");
          }
        }
      );

      return;
    });
  } else {
    res.redirect("/auth_fail.html");
  }
}

export async function handleCheckArgusToken(req, res) {
  if (req.query.argus_token != null) {
    var token = req.query.argus_token;
    var twitchProfile = await getTwitchProfileByArgusToken(token);
    logger.debug("[check_argus_token] got profile for token: " + token);
    if (twitchProfile != null && Object.hasOwn(twitchProfile, "twitchId")) {
      logger.debug("[check_argus_token] responding ok for token: " + token);
      res.send("token_ok");
    } else {
      logger.debug("[check_argus_token] responding not ok for token: " + token);
      res.send("token_not_ok");
    }
  } else {
    logger.debug("[check_argus_token] responding not ok for token: " + token);
    res.send("token_not_ok");
  }
}

export async function handleGetArgusToken(req, res) {
  logger.info("getting token for state: " + req.body.state);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  var pendingTwitchLogins = await readStorageObject("pendingTwitchLogins");
  if (
    req.body != null &&
    req.body.state != null &&
    pendingTwitchLogins != null &&
    pendingTwitchLogins[req.body.state] != null
  ) {
    logger.info("entered if for state: " + req.body.state);
    var userTwitchId = pendingTwitchLogins[req.body.state].twitchId;
    var userTwitchProfilePic =
      pendingTwitchLogins[req.body.state].twitchProfilePic;
    var argusToken = pendingTwitchLogins[req.body.state].argusToken;

    var twitchIdByArgusTokenMap = await readStorageObject(
      "twitchIdByArgusToken"
    );
    if (twitchIdByArgusTokenMap == null) {
      twitchIdByArgusTokenMap = {};
    }
    for (var tok in twitchIdByArgusTokenMap) {
      if (twitchIdByArgusTokenMap[tok].twitchId === userTwitchId) {
        delete twitchIdByArgusTokenMap[tok];
        break;
      }
    }

    twitchIdByArgusTokenMap[argusToken] = {};
    twitchIdByArgusTokenMap[argusToken].twitchId = userTwitchId;
    twitchIdByArgusTokenMap[argusToken].twitchProfilePic = userTwitchProfilePic;

    logger.debug(
      "Writing twitchIdByArgusToken map for state " +
        req.body.state +
        ": " +
        JSON.stringify(twitchIdByArgusTokenMap)
    );

    writeStorageObject("twitchIdByArgusToken", twitchIdByArgusTokenMap);

    delete pendingTwitchLogins[req.body.state];
    writeStorageObject("pendingTwitchLogins", pendingTwitchLogins);

    logger.debug(
      "Sending reponse for state " +
        req.body.state +
        ": " +
        argusToken +
        "\n" +
        userTwitchProfilePic
    );
    res.send(argusToken + "\n" + userTwitchProfilePic);
  } else {
    logger.debug("Responding FAIL for state: " + req.body.state);
    res.send("FAIL");
  }
}

export async function getTwitchProfileByArgusToken(argus_token) {
  var twitchIdByArgusTokenMap = await readStorageObject("twitchIdByArgusToken");
  if (twitchIdByArgusTokenMap == null) {
    return null;
  }
  if (Object.hasOwn(twitchIdByArgusTokenMap, argus_token)) {
    if (
      !Object.hasOwn(twitchIdByArgusTokenMap[argus_token], "twitchUsername")
    ) {
      return await updateUsernameFor(argus_token);
    }
    return twitchIdByArgusTokenMap[argus_token];
  } else {
    return null;
  }
}

export async function handleCheckLogin(req, res) {
  try {
    var decodedPayload = jwt.verify(
      req.headers["x-extension-jwt"],
      Buffer.from(extensionSecret, "base64")
    );

    logger.info(
      "JWT verification successful. Channel ID: " + decodedPayload["channel_id"]
    );

    var userTwitchId = decodedPayload["channel_id"];
    var twitchIdByArgusTokenMap = await readStorageObject(
      "twitchIdByArgusToken"
    );
    if (twitchIdByArgusTokenMap == null) {
      res.send("FAIL");
      return;
    }
    for (var tok in twitchIdByArgusTokenMap) {
      if (twitchIdByArgusTokenMap[tok].twitchId === userTwitchId) {
        logger.info(
          "Found user nicely logged in: " + decodedPayload["channel_id"]
        );
        res.send("LOGIN_OK");
        return;
      }
    }

    logger.info("Didn't find user logged in: " + decodedPayload["channel_id"]);
    res.send("FAIL");
  } catch (error) {
    logger.warn("Error in decoding JWT token: " + error.message);
    res.send("FAIL");
  }
}
