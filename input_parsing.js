
const logger = require("./argus_logger")

const uiMappings = require('./ui_mappings.json');

const dataSeparator = ";;";
const boonRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary", "Duo", "Infusion"];
const weaponRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary"];
const keepsakeRarities = ["Common", "Rare", "Epic", "Heroic"];

function removeSuffixes(boonName) {
  if (boonName.endsWith("_Expired")) { // keepsakes, hades boons
    logger.info("Cutting _Expired from: " + boonName)
    boonName = boonName.substring(boonName.length - "_Expired".length);
    logger.info("Got: " + boonName)
  }

  if (boonName.endsWith("_Inactive")) { // keepsakes, hades boons
    logger.info("Cutting _Inactive from: " + boonName)
    boonName = boonName.substring(boonName.length - "_Inactive".length);
    logger.info("Got: " + boonName)
  }

  if (boonName.endsWith("_Complete")) { // chaos blessings
    logger.info("Cutting _Inactive from: " + boonName)
    boonName = boonName.substring(boonName.length - "_Inactive".length);
    logger.info("Got: " + boonName)
  }

  return boonName;
}

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
      logger.warn("Invalid boon data. Couldn't parse: " + boon);
      return {};
    } else {
      boonRarity = splitBoon[0];
      if (!(boonRarities.includes(boonRarity))) {
        logger.warn("Couldn't recognize boon rarity: " + boonRarity + ". Using Common.");
        boonRarity = "Common";
      }

      boonName = splitBoon[1];
    }

    boonName = removeSuffixes(boonName); //this can happen with Hades
    
    if (uiMappings.boons[boonName] == null) {
      logger.warn("Got unknown boon name: " + boonName)
      return;
    }
    
    boonDetails = uiMappings.boons[boonName];
    boonDetails["codeName"] = boonName;
    boonDetails["rarity"] = boonRarity;
    if (boonDetails["effects"] != null) {
      boonDetails["effects"].forEach( effect => {
        effect["value"] = effect[boonRarity.toLowerCase()];
      });
    }
    if (boonDetails["slot"] != null) {
      if (parsedData[boonDetails["slot"].toLowerCase() + "Boon"] != null) {
        logger.warn("Double slot: " + boonDetails["slot"]);
      }
      parsedData[boonDetails["slot"].toLowerCase() + "Boon"] = boonDetails;
    } else {
      parsedData["otherBoons"].push(boonDetails);
    }
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
const emptyWeaponString = "NOWEAPONS";
function parseWeaponData(weaponData) {
  if (weaponData === emptyWeaponString) {
    return {};
  }

  var parsedData = {};

  splitWeapon = weaponData.split(dataSeparator);
  if (splitWeapon.length != 2) { //data should contain rarity and name
    logger.warn("Invalid weapon data. Couldn't parse.");
    return {};
  } else {
    weaponRarity = splitWeapon[0];
    if (!(weaponRarities.includes(weaponRarity))) {
      weaponRarity = "Common";
    }

    weaponName = splitWeapon[1];
  }

  if (uiMappings.weapons[weaponName] == null) {
    logger.warn("Got unknown weapon name: " + weaponName)
    return;
  }

  parsedData = uiMappings.weapons[weaponName];
  parsedData["codeName"] = weaponName;
  parsedData["rarity"] = weaponRarity;
  if (parsedData["effects"] != null) {
    parsedData["effects"].forEach( effect => {
      effect["value"] = effect[weaponRarity.toLowerCase()];
    });
  }
  
  return parsedData;
}

const emptyFamiliarString = "NOFAMILIARS";
function parseFamiliarData(familiarData) {
  if (familiarData === emptyFamiliarString) {
    return {};
  }

  var parsedData = {}

  if (uiMappings.familiars[familiarData] == null) {
    logger.warn("Got unknown familiar name: " + familiarData)
    return;
  }

  parsedData = uiMappings.familiars[familiarData];
  parsedData["codeName"] = familiarData;
  parsedData["rarity"] = "Common";

  return parsedData;
}

const emptyExtraString = "NOEXTRAS";
function parseExtraData(extraData) {
  if (extraData === emptyExtraString) {
    return [];
  }

  var parsedData = [];

  extraArray = extraData.split(" ");

  extraArray.forEach( (extraItem) => {
    splitItem = extraItem.split(dataSeparator);
    if (splitItem.length != 2) { //data should contain rarity and name
      logger.warn("Invalid extra data. Couldn't parse.");
      return {};
    } else {
      itemRarity = splitItem[0];

      itemName = splitItem[1];
    }

    itemName = removeSuffixes(itemName); //this can happen with keepsakes

    if (uiMappings.keepsakes[itemName] != null) {
      parsedItem = {};
      parsedItem["name"] = uiMappings.keepsakes[itemName]["name"];
      parsedItem["codeName"] = itemName;
      if (!keepsakeRarities.includes(itemRarity)) {
        itemRarity = "Common";
      }
      parsedItem["rarity"] = itemRarity;
      parsedItem["description"] = uiMappings.keepsakes[itemName][itemRarity.toLowerCase()];
      parsedData.push(parsedItem);
    } else if (uiMappings.hexes[itemName] != null) {
      parsedItem = uiMappings.hexes[itemName];
      parsedItem["rarity"] = "Common";
      parsedItem["codeName"] = itemName;
      parsedData.push(parsedItem);
    } else if (uiMappings.boons[itemName] != null && uiMappings.boons[itemName].gods[0] == "Chaos") {
      parsedItem = uiMappings.boons[itemName];
      parsedItem["rarity"] = "Common";
      parsedItem["codeName"] = itemName;
      parsedData.push(parsedItem);
    } else {
      logger.warn("Unknown extra item: " + extraItem);
    }
  });
  

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
    return [];
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
function parsePinBoons(pinData) {
  if (pinData == emptyPinsString) {
    return [];
  }

  var parsedData = []
  
  splitPinBoons = pinData.split(dataSeparator);

  splitPinBoons.forEach(pinBoon => {
    if (pinBoon in uiMappings.boons) {
      var parsedElement = uiMappings.boons[pinBoon];
      if (parsedElement["effects"] != null && parsedElement["effects"][0]["duo"] != null) {
        parsedElement.rarity = "Duo";
      } else if (parsedElement["effects"] != null && parsedElement["effects"][0]["infusion"] != null) {
        parsedElement.rarity = "Infusion";
      } else if (parsedElement["effects"] != null && parsedElement["effects"][0]["legendary"] != null) {
        parsedElement.rarity = "Legendary";
      } else {
        parsedElement.rarity = "Common";
      }
      parsedElement.codeName = pinBoon;
      parsedData.push(parsedElement)
    }
  })

  return parsedData;
}

const emptyVowsString = "NOVOWS";
function parseVowData(vowData) {
  logger.warn("parsing vow data: " + vowData);

  return emptyVowsString;
}

const emptyArcanaString = "NOARCANA";
function parseArcanaData(arcanaData) {
  logger.warn("parsing arcana data: " + arcanaData);

  return emptyArcanaString;
}

//twitch package size limitation is 5KB
const twitchPackageLimit = 1024*5;
//80% just for paranoia. 20 characters is our nonce and part number.
const twitchPackageSizeCutoff = Math.floor(twitchPackageLimit * 0.8) - 20;

function parseRunData(runData) {
    const parsedData = {
        boonData: parseBoonData(runData.boonData),
        weaponData: parseWeaponData(runData.weaponData),
        familiarData: parseFamiliarData(runData.familiarData),
        extraData: parseExtraData(runData.extraData),
        elementalData: parseElementalData(runData.elementalData),
        pinBoons: parsePinBoons(runData.pinData),
        vowData: parseVowData(runData.vowData),
        arcanaData: parseArcanaData(runData.arcanaData)
    };

    var stringToSend = JSON.stringify(parsedData);

    var parsedDataArray = [];
    if (stringToSend.length > twitchPackageSizeCutoff) {
      var startPos = 0;
      var stop = false;

      while (!stop) {
        var endingPosition = startPos + twitchPackageSizeCutoff;
        if (endingPosition >= stringToSend.length) {
          endingPosition = stringToSend.length;
          stop = true;
        }
        parsedDataArray.push(stringToSend.substring(startPos, endingPosition));
        startPos = endingPosition;
      }
    } else {
      parsedDataArray.push(stringToSend);
    }

    return parsedDataArray;
}

module.exports = {
    parseRunData
}