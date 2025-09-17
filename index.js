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

const dataSeparator = ";;";
const primaryBoonGods = ["Aphrodite", "Apollo", "Ares", "Demeter", "Haephestus", "Hera", "Hestia", "Poseidon", "Zeus"];
const primaryBoonTypes = ["Weapon", "Special", "Cast", "Sprint", "Mana"];
const boonRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary", "Duo", "Infusion"];
const weaponRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary"];

function parseBoonData(boonData) {
  var parsedData = {
    "otherBoons" : []
  };
  boonData.forEach( (boon) => {
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
  });

  return parsedData;
}

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

    weaponDescription = splitWeapon[2];
  }

  parsedData["name"] = weaponName;
  parsedData["rarity"] = weaponRarity;
  parsedData["description"] = weaponDescription;
  return parsedData;
}

const emptyFamiliarString = "NOFAMILIAR";
function parseFamiliarData(familiarData) {
  if (familiarData === emptyFamiliarString) {
    return {};
  }

  var parsedData = {}

  parsedData["name"] = familiarData;

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

app.post("/run_info", (req, res, next) => {
  console.log("Received data: " + JSON.stringify(req.body));
  
  const broadcasterId = req.body.user;
  const boonData = parseBoonData(req.body.boonData.split(" "));
  const weaponData = parseWeaponData(req.body.weaponData);
  const familiarData = parseFamiliarData(req.body.familiarData);
  const elementalData = parseElementalData(req.body.elementalData);
  const runData = {
    boonData: boonData,
    weaponData: weaponData,
    familiarData: familiarData,
    elementalData: elementalData
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
