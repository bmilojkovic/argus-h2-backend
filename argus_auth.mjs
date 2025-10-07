import crypto from "crypto";
import querystring from "querystring";
import request from "request";

import { loadSecrets } from "./secrets.mjs";
import { readStorageObject, writeStorageObject } from "./aws_storage.mjs";

import { logger } from "./argus_logger.mjs";

const secrets = loadSecrets();
const extensionId = secrets.extensionId;
const apiClientSecret = secrets.apiClientSecret;

function generateRandomHex(length) {
  // `length` specifies the number of bytes, not hex characters.
  // Each byte converts to two hex characters.
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
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
              argusToken: generateRandomHex(16),
            };

            writeStorageObject("pendingTwitchLogins", pendingTwitchLogins);

            res.redirect("/auth_success.html");
          } else {
            res.redirect("/auth_fail.html");
          }
        }
      );

      return;
    });
  }
}

export async function handleCheckArgusToken(req, res) {
  if (req.query.argus_token != null) {
    var token = req.query.argus_token;
    var twitchId = await getTwitchIdByArgusToken(token);
    if (twitchId != null) {
      res.send("token_ok");
    } else {
      res.send("token_not_ok");
    }
  } else {
    res.send("token_not_ok");
  }
}

export async function handleGetArgusToken(req, res) {
  logger.info("getting token for state: " + req.body.state);
  var pendingTwitchLogins = await readStorageObject("pendingTwitchLogins");
  if (
    req.body != null &&
    req.body.state != null &&
    pendingTwitchLogins != null &&
    pendingTwitchLogins[req.body.state] != null
  ) {
    var userTwitchId = pendingTwitchLogins[req.body.state].twitchId;
    var argusToken = pendingTwitchLogins[req.body.state].argusToken;

    var twitchIdByArgusTokenMap = await readStorageObject(
      "twitchIdByArgusToken"
    );
    for (tok in twitchIdByArgusTokenMap) {
      if (twitchIdByArgusTokenMap[tok] === userTwitchId) {
        delete twitchIdByArgusTokenMap[tok];
        break;
      }
    }

    twitchIdByArgusTokenMap[argusToken] = userTwitchId;
    writeStorageObject("twitchIdByArgusToken", twitchIdByArgusTokenMap);

    delete pendingTwitchLogins[req.body.state];
    writeStorageObject("pendingTwitchLogins", pendingTwitchLogins);

    res.send(argusToken);
  } else {
    res.send("FAIL");
  }
}

export async function getTwitchIdByArgusToken(argus_token) {
  var twitchIdByArgusTokenMap = await readStorageObject("twitchIdByArgusToken");
  if (Object.hasOwn(twitchIdByArgusTokenMap, argus_token)) {
    return twitchIdByArgusTokenMap[argus_token];
  } else {
    return null;
  }
}
