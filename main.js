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

import { logger } from "./argus_logger.mjs";
import path from "path";

const app = express();
app.use(express.json());
app.use(cors());

const CURRENT_PROTOCOL_VERSION = "2";

app.post("/run_info", async function (req, res, next) {
  logger.debug("Received data: " + JSON.stringify(req.body));

  const argusToken = req.body.argusToken;
  const twitchId = await getTwitchIdByArgusToken(argusToken);
  if (twitchId == null) {
    res.send("bad_argus_token");
    return;
  }
  /*
   * If we receive messages with old protocol format, we just discard them.
   * The frontend will not show anything until the streamer updates
   * the mod to the newest version.
   */
  const argusProtocolVersion = req.body.argusProtocolVersion;
  if (argusProtocolVersion !== CURRENT_PROTOCOL_VERSION) {
    res.send("bad_protocol_version");
    return;
  }
  const broadcasterId = twitchId;
  const parsedData = parseRunData(req.body.runData);

  broadcastInfo(parsedData, broadcasterId);

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

app.get("/check_login", (req, res) => {
  handleCheckLogin(req, res);
});

// Server setup
app.use(express.static(path.join(import.meta.dirname, "static")));
app.listen(3000, () => {
  logger.info("Server is Running");
});
