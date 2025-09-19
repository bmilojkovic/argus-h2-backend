const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write all logs with importance level of `error` or higher to `error.log`
    //   (i.e., error, fatal, but not other levels)
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    //
    // - Write all logs with importance level of `info` or higher to `combined.log`
    //   (i.e., fatal, error, warn, and info, but not trace)
    //
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Importing express module
const express = require("express");
const app = express();
app.use(express.json());

var request = require("request");

// jwt stuff
const jwt = require('jsonwebtoken');
const sharedSecret = 'Gg2CUK5Ct4RU5jwqCOTKHTkcoGvoXLgtLSATggsrngc=';
const clientId = 'sl19e3aebmadlewzt7mxfv3j3llwwv';

const uiMappings = require('./ui_mappings.json');

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

const dataSeparator = ";;";
const primaryBoonGods = ["Aphrodite", "Apollo", "Ares", "Demeter", "Haephestus", "Hera", "Hestia", "Poseidon", "Zeus"];
const primaryBoonTypes = ["Weapon", "Special", "Cast", "Sprint", "Mana"];
const boonRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary", "Duo", "Infusion"];
const weaponRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary"];

/*
* Boons should arrive in the following format:
* [rarityA];;[nameA] [rarityB];;[nameB] etc
*
* For example:
* Common;;ZeusWeaponBoon Rare;;AphroditeCastBoon
*/
function parseBoonData(boonData) {
  boonArray = boonData.split(" ");
  var parsedData = {
    "otherBoons" : [],
  };
  boonArray.forEach( (boon) => {
    splitBoon = boon.split(dataSeparator);
    if (splitBoon.length != 2) { //data should contain boon rarity and name
      console.log("Invalid boon data. Couldn't parse.");
      return {};
    } else {
      boonRarity = splitBoon[0];
      if (!(boonRarities.includes(boonRarity))) {
        boonRarity = "Common";
      }

      boonName = splitBoon[1];
    }

    if (uiMappings.boons[boonName] == null) {
      logger.warn("Got unknown boon name: " + boonName)
      return;
    }
    
    boonDetails = uiMappings.boons[boonName];
    boonDetails["codeName"] = boonName;
    boonDetails["rarity"] = boonRarity;
    if (boonDetails["slot"] != null) {
      if (parsedData[boonDetails["slot"].toLowerCase() + "Boon"] != null) {
        logger.warn("Double slot: " + boonDetails["slot"]);
      }
      parsedData[boonDetails["slot"].toLowerCase() + "Boon"] = boonDetails;
    } else {
      parsedData["otherBoons"].push(boonDetails);
    }
    boonDetails["effects"].forEach( effect => {
      effect["value"] = effect[boonRarity.toLowerCase()];
    });
    /*
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
      parsedData[foundType.toLowerCase() + "Boon"] = {}
      parsedData[foundType.toLowerCase() + "Boon"].name = foundGod + foundType + "Boon";
      parsedData[foundType.toLowerCase() + "Boon"].rarity = boonRarity;
    } else {
      parsedData["otherBoons"].push({name: boonName, rarity: boonRarity})
    }
      */
  });

  return parsedData;
}

/*
* Boons should arrive in the following format:
* [rarityA]-[nameA];;[rarityB]-[nameB];;etc
*
* For example:
* Common-ZeusWeaponBoon;;Rare-AphroditeCastBoon
*/
const emptyWeaponString = "NOWEAPON";
function parseWeaponData(weaponData) {
  if (weaponData === emptyWeaponString) {
    return {};
  }

  var parsedData = {};

  splitWeapon = weaponData.split(dataSeparator);
  if (splitWeapon.length != 2) { //data should contain rarity and name
    console.log("Invalid weapon data. Couldn't parse.");
    return {};
  } else {
    weaponRarity = splitWeapon[0];
    if (!(weaponRarities.includes(weaponRarity))) {
      weaponRarity = "Common";
    }

    weaponName = splitWeapon[1];
  }

  parsedData["name"] = weaponName;
  parsedData["codeName"] = weaponName;
  parsedData["description"] = "good weapon";
  parsedData["rarity"] = weaponRarity;
  parsedData["effects"] = [];
  return parsedData;
}

const emptyFamiliarString = "NOFAMILIAR";
function parseFamiliarData(familiarData) {
  if (familiarData === emptyFamiliarString) {
    return {};
  }

  var parsedData = {}

  parsedData["name"] = familiarData;
  parsedData["codeName"] = familiarData;
  parsedData["description"] = "good pet";
  parsedData["effects"] = [];
  parsedData["rarity"] = "Common";

  return parsedData;
}

/*
* Elements should arrive in the following format:
* [elementA]:[numberA];;[elementB]:[numberB];;etc
*
* For example:
* Fire:1;;Water:0;;Earth:3;;Air:0;;Aether:0
*/
const emptyElementsString = "NOELEMENTS";
function parseElementalData(elementalData) {
  if (elementalData === emptyElementsString) {
    return {};
  }

  var parsedData = [];
  var unorderedData = {};
  var elementsArray = elementalData.split(dataSeparator); //get all the elements
  elementsArray.forEach((element) => {
    var splitElement = element.split(":"); //0 is element name, 1 is value
    unorderedData[splitElement[0]] = splitElement[1];
  });

  var orderedElementNames = ["Earth", "Water", "Air", "Fire", "Aether"]
  orderedElementNames.forEach(element => {
    parsedData.push({name: element, value: unorderedData[element]});  
  })

  return parsedData;
}

const emptyPinsString = "NOPINS";
function parsePinData(pinData) {
  if (pinData == emptyPinsString) {
    return {};
  }

  var parsedData = [];

  parsedData = pinData.split(dataSeparator);

  return parsedData;
}

app.post("/run_info", (req, res, next) => {
  console.log("Received data: " + JSON.stringify(req.body));
  
  const broadcasterId = req.body.user;
  const boonData = parseBoonData(req.body.boonData);
  const weaponData = parseWeaponData(req.body.weaponData);
  const familiarData = parseFamiliarData(req.body.familiarData);
  const elementalData = parseElementalData(req.body.elementalData);
  const pinData = parsePinData(req.body.pinData);
  const runData = {
    boonData: boonData,
    weaponData: weaponData,
    familiarData: familiarData,
    elementalData: elementalData,
    pinData: pinData
  };
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
