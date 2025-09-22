
const logger = require("./argus_logger")

const uiMappings = require('./ui_mappings.json');

const dataSeparator = ";;";
const boonRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary", "Duo", "Infusion"];
const weaponRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary"];
const keepsakeRarities = ["Common", "Rare", "Epic", "Heroic"];

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
      logger.warn("Invalid boon data. Couldn't parse.");
      return {};
    } else {
      boonRarity = splitBoon[0];
      if (!(boonRarities.includes(boonRarity))) {
        logger.warn("Couldn't recognize boon rarity: " + boonRarity + ". Using Common.");
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

  parsedData["name"] = weaponName;
  parsedData["codeName"] = weaponName;
  parsedData["description"] = "good weapon";
  parsedData["rarity"] = weaponRarity;
  parsedData["effects"] = [];
  return parsedData;
}

const emptyExtraString = "NOEXTRAS";
function parseExtraData(extraData) {
  if (extraData === emptyExtraString) {
    return {};
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

    if (itemName.endsWith("_Expired")) { //this can happen with keepsakes
      logger.info("Cutting _Expired from: " + itemName)
      itemName = itemName.substring(itemName.length - "_Expired".length);
      logger.info("Got: " + itemName)
    }

    if (itemName.endsWith("_Inactive")) { //this can happen with keepsakes
      logger.info("Cutting _Inactive from: " + itemName)
      itemName = itemName.substring(itemName.length - "_Inactive".length);
      logger.info("Got: " + itemName)
    }

    if (uiMappings.keepsakes[itemName] != null) {
      parsedItem = {};
      parsedItem["name"] = uiMappings.keepsakes[itemName]["name"];
      parsedItem["codeName"] = itemName;
      if (!(itemRarity in keepsakeRarities)) {
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
    } else {
      logger.warn("Unknown extra item: " + extraItem);
    }
  });
  

  return parsedData;
}

const emptyFamiliarString = "NOFAMILIARS";
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

function parseRunData(runData) {
    const parsedData = {
        boonData: parseBoonData(runData.boonData),
        weaponData: parseWeaponData(runData.weaponData),
        familiarData: parseFamiliarData(runData.familiarData),
        extraData: parseExtraData(runData.extraData),
        elementalData: parseElementalData(runData.elementalData),
        pinData: parsePinData(runData.pinData)
    };

    return parsedData;
}

module.exports = {
    parseRunData
}