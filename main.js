// Importing express module
import express from "express";

import { parseRunData } from "./input_parsing.mjs";
import { broadcastInfo } from "./twitch_broadcast.mjs";
import {
  getTwitchIdByArgusToken,
  handleCheckArgusToken,
  handleGetArgusToken,
  handleOauthToken,
} from "./argus_auth.mjs";

import { logger } from "./argus_logger.mjs";
import crypto from "crypto";
import path from "path";

const app = express();
app.use(express.json());

const NONCE_MAX = 2 ** 32;

app.post("/run_info", async function (req, res, next) {
  logger.debug("Received data: " + JSON.stringify(req.body));

  const argusToken = req.body.argusToken;
  const twitchId = await getTwitchIdByArgusToken(argusToken);
  if (twitchId == null) {
    res.send("bad_argus_token");
    return;
  }
  const broadcasterId = twitchId;
  const runDataArray = parseRunData(req.body.runData);
  const broadcastNonce = crypto.randomInt(NONCE_MAX);

  broadcastInfo(runDataArray, broadcastNonce, broadcasterId);

  res.send("ok");
});

app.get("/oauth_token", (req, res) => {
  logger.info(JSON.stringify(req.query));

  handleOauthToken(req, res);
});

app.get("/check_argus_token", (req, res) => {
  handleCheckArgusToken(req, res);
});

app.post("/get_argus_token", (req, res) => {
  handleGetArgusToken(req, res);
});

// Server setup
app.use(express.static(path.join(import.meta.dirname, "static")));
app.listen(3000, () => {
  logger.info("Server is Running");
});
