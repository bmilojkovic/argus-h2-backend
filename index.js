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
    console.log("Broadcasting data: " + requestOptions.body)
    request(requestOptions, function (error, response) {
        console.log(error,response.body,response.statusCode);
        return;
    });
}

const primaryBoonGods = ["Aphrodite", "Apollo", "Ares", "Demeter", "Haephestus", "Hera", "Hestia", "Poseidon", "Zeus"]
const primaryBoonTypes = ["Weapon", "Special", "Cast", "Sprint", "Mana"]
const boonRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary", "Duo", "Infusion"]

function parseBoonList(boonList) {
  runData = {
    "otherBoons" : []
  };
  boonList.forEach( (boon) => {
    splitBoon = boon.split("-");
    if (splitBoon.length == 1) { //no dash, so we assume we got only the name
      boonName = boon;
      boonRarity = "Common";
    } else {
      boonRarity = splitBoon[0];
      if (!(boonRarities.includes(boonRarity))) {
        boonRarity = "Common";
      }

      boonName = splitBoon[1];
    }
    
    foundGod = null;
    primaryBoonGods.forEach((god) => {
      if (boonName.startsWith(god)) {
        foundGod = god;
        return;
      }
    });
    foundType = null;
    if (foundGod != null) {
      primaryBoonTypes.forEach((boonType) => {
        if (boonName.substring(foundGod.length).startsWith(boonType)) {
          foundType = boonType;
          return;
        }
      });
    }

    if (foundGod != null && foundType != null) {
      runData[foundType.toLowerCase() + "Boon"] = {}
      runData[foundType.toLowerCase() + "Boon"].name = foundGod + foundType + "Boon";
      runData[foundType.toLowerCase() + "Boon"].rarity = boonRarity;
    } else {
      runData["otherBoons"].push({name: boonName, rarity: boonRarity})
    }
  });

  return runData;
}

app.post("/run_info", (req, res, next) => {
  const broadcasterId = req.body.user;
  const runData = parseBoonList(req.body.boonList.split(" "))
  jwtToken = buildToken(broadcasterId);
  broadcastMessage = {
    message: JSON.stringify(runData),
    broadcaster_id: broadcasterId,
    target: ["broadcast"]
  };
  broadcastInfo(broadcastMessage, jwtToken);

  res.send("ok");
})

// Server setup
app.listen(3000, () => {
    console.log("Server is Running");
});
