// Importing express module
const express = require("express");
const app = express();
app.use(express.json());

var request = require("request");

// jwt stuff
const jwt = require('jsonwebtoken');
const sharedSecret = 'Gg2CUK5Ct4RU5jwqCOTKHTkcoGvoXLgtLSATggsrngc=';
const clientId = 'sl19e3aebmadlewzt7mxfv3j3llwwv';

// Handling GET / request
app.get("/", (req, res, next) => {
    res.send("This is the express server");
});

// Handling GET /hello request
app.get("/hello", (req, res, next) => {
    res.send("This is the hello response");
});

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
  console.log("token: " + token);

  return token;
}

function broadcastInfo(postData, jwtToken) {
    var requestOptions = {
        uri: 'https://api.twitch.tv/helix/extensions/pubsub',
        body: JSON.stringify(postData),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Client-Id': clientId,
            'Authorization': 'Bearer ' + jwtToken
        }
    };
    request(requestOptions, function (error, response) {
        console.log(error,response.body,response.statusCode);
        return;
    });
}

app.post("/run_info", (req, res, next) => {
  const broadcasterId = req.body.user;
  jwtToken = buildToken(broadcasterId);
  broadcastMessage = {
    message: "hello",
    broadcaster_id: broadcasterId,
    target: ["broadcast"]
  };
  broadcastInfo(broadcastMessage, jwtToken);

  return "ok";
})

// Server setup
app.listen(3000, () => {
    console.log("Server is Running");
});