// Importing express module
import express from "express";
import cors from "cors";

import { parseRunData } from "./input_parsing.mjs";
import { broadcastInfo } from "./twitch_broadcast.mjs";
import {
  getTwitchIdByArgusToken,
  handleCheckArgusToken,
  handleGetArgusToken,
  handleOauthToken,
  handleCheckLogin,
} from "./argus_auth.mjs";
import { handleGetNewestAppVersion } from "./app_updater.mjs";

import { logger } from "./argus_logger.mjs";
import path from "path";

const app = express();
app.use(express.json());
app.use(cors());

const CURRENT_PROTOCOL_VERSION = "2";

function checkProtocolVersion(argusProtocolVersion) {
  /*
   * If we receive messages with old protocol format, we just discard them.
   * The frontend will not show anything until the streamer updates
   * the mod to the newest version.
   */
  if (argusProtocolVersion !== CURRENT_PROTOCOL_VERSION) {
    logger.warn("Got a bad argus protocol version. Discarding request.");
    res.send("bad_protocol_version");
    return;
  }
}

app.post("/run_info", async function (req, res, next) {
  logger.debug("[run_info] " + JSON.stringify(req.body));

  const argusToken = req.body.argusToken;
  const twitchId = await getTwitchIdByArgusToken(argusToken);
  if (twitchId == null) {
    logger.warn("Got a bad argus token. Discarding request.");
    res.send("bad_argus_token");
    return;
  }
  checkProtocolVersion(req.body.argusProtocolVersion);

  const broadcasterId = twitchId;
  const parsedData = parseRunData(req.body.runData);

  broadcastInfo(parsedData, broadcasterId);

  res.send("ok");
});

app.get("/oauth_token", (req, res) => {
  logger.debug("[oauth_token] " + JSON.stringify(req.query));

  handleOauthToken(req, res);
});

app.get("/check_argus_token", (req, res) => {
  logger.debug("[check_argus_token] " + JSON.stringify(req.query));

  checkProtocolVersion(req.query.argusProtocolVersion);

  handleCheckArgusToken(req, res);
});

app.post("/get_argus_token", (req, res) => {
  logger.debug("[get_argus_token] " + JSON.stringify(req.body));

  checkProtocolVersion(req.body.argusProtocolVersion);

  handleGetArgusToken(req, res);
});

/*
  This request is made from the frontend. No need to check for protocol version.
*/
app.get("/check_login", (req, res) => {
  logger.debug("[check_login] " + JSON.stringify(req.headers));

  handleCheckLogin(req, res);
});

app.get("/get_newest_app_version", (req, res) => {
  logger.debug("[check_login] " + JSON.stringify(req.query));

  handleGetNewestAppVersion(req, res);
});

app.get("/ping", (req, res) => {
  logger.debug("[ping]");
  res.send("pong");
});

// Server setup
app.use(express.static(path.join(import.meta.dirname, "static")));
app.listen(3000, () => {
  logger.info("Server is Running");
});
