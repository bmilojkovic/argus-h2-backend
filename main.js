
// Importing express module
const express = require("express");
const app = express();
app.use(express.json());

const { parseRunData } = require("./input_parsing");
const { broadcastInfo } = require("./twitch_broadcast");

const logger = require("./argus_logger")
const request = require("request");
const querystring = require('querystring');
const crypto = require("crypto")
const fs = require("fs")

const extensionId = "sl19e3aebmadlewzt7mxfv3j3llwwv"
const apiClientSecret = "jaj66oy02as7x9kplcotsxje7lounb"

const tokenStoreFile = "argus_tokens.json"

function generateRandomHex(length) {
  // `length` specifies the number of bytes, not hex characters.
  // Each byte converts to two hex characters.
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

app.post("/run_info", (req, res, next) => {
  logger.info("Received data: " + JSON.stringify(req.body));
  
  const argusToken = req.body.argusToken;
  if (twitchIdByArgusToken[argusToken] == null) {
    res.send("bad_argus_token");
    return;
  }
  const broadcasterId = twitchIdByArgusToken[argusToken];
  const runData = parseRunData(req.body.runData);
  
  broadcastInfo(runData, broadcasterId);

  res.send("ok");
})

pendingTwitchLogins = {};
twitchIdByArgusToken = {};

app.get("/oauth_token", (req, res) => {
  logger.warn(JSON.stringify(req.query))
  
  clientState = req.query.state;

  res.send("ok");

  if (req.query != null && req.query.code != null) {
    const requestParams = {
      client_id: extensionId,
      client_secret: apiClientSecret,
      code: req.query.code,
      grant_type: "authorization_code",
      redirect_uri: "http://localhost:3000/oauth_token"
    };

    //use the auth code to get the access token
    var requestOptions = {
          uri: 'https://id.twitch.tv/oauth2/token',
          body: querystring.stringify(requestParams),
          method: 'POST'
    };

    request.post(requestOptions, function(error, response) {
      jsonResponse = JSON.parse(response.body);
      
      claimsRequestOptions = {
        
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + jsonResponse["access_token"],
        }
      }

      request.get("https://id.twitch.tv/oauth2/userinfo", claimsRequestOptions, function(error, response) {
        claimsObject = JSON.parse(response.body);
        userTwitchId = claimsObject["sub"];

        if (pendingTwitchLogins[clientState] != null) {
          delete pendingTwitchLogins[clientState];
        }

        pendingTwitchLogins[clientState] = {
          "twitchId": userTwitchId,
          "argusToken": generateRandomHex(16)
        }
      })

      return;
    });
  }
})

app.get("/check_argus_token", (req, res) => {
  if (req.query.argus_token != null) {
    token = req.query.argus_token;
    if (twitchIdByArgusToken[token] != null) {
      res.send("token_ok");
    } else {
      res.send("token_not_ok");
    }
  } else {
    res.send("token_not_ok");
  }
})

app.post("/get_argus_token", (req, res) => {
  logger.info("getting token for state: " + req.body.state);
  
  if (req.body != null && req.body.state != null && pendingTwitchLogins[req.body.state] != null) {
    userTwitchId = pendingTwitchLogins[req.body.state].twitchId;
    argusToken = pendingTwitchLogins[req.body.state].argusToken;

    for (tok in twitchIdByArgusToken) {
      if (twitchIdByArgusToken[tok] === userTwitchId) {
        delete twitchIdByArgusToken[tok];
        break;
      }
    }

    twitchIdByArgusToken[argusToken] = userTwitchId;
    delete pendingTwitchLogins[req.body.state];
    
    res.send(argusToken);

    fs.writeFile(tokenStoreFile, JSON.stringify(twitchIdByArgusToken), "utf8", (err) => {
      if (err) {
        logger.error(err);
      }
    })
  } else {
    res.send("FAIL");
  }
  
})

function readArgusTokens() {
  try {
    const rawData = fs.readFileSync(tokenStoreFile);
    twitchIdByArgusToken = JSON.parse(rawData);
  } catch (err) {
    logger.error(err);
  }
}

readArgusTokens();
// Server setup
app.listen(3000, () => {
    logger.info("Server is Running");
});
