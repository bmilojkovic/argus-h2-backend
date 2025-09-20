
// Importing express module
const express = require("express");
const app = express();
app.use(express.json());

const { parseRunData } = require("./input_parsing");
const { broadcastInfo } = require("./twitch_broadcast");
const logger = require("./argus_logger")

// Handling GET / request
app.get("/", (req, res, next) => {
    res.send("This is the express server");
});

app.post("/run_info", (req, res, next) => {
  logger.info("Received data: " + JSON.stringify(req.body));
  
  const broadcasterId = req.body.user;
  const runData = parseRunData(req.body.runData);
  
  broadcastInfo(runData, broadcasterId);

  res.send("ok");
})

// Server setup
app.listen(3000, () => {
    logger.info("Server is Running");
});
