import { level } from "winston";
import { logger } from "./argus_logger.mjs";
import { readStorageObject } from "./aws_storage.mjs";
import cron from "node-cron";

const DATA_SEPARATOR = ";;";
const BOON_RARITIES = [
  "Common",
  "Rare",
  "Epic",
  "Heroic",
  "Legendary",
  "Duo",
  "Infusion",
];
const WEAPON_RARITIES = ["Common", "Rare", "Epic", "Heroic", "Legendary"];
const KEEPSAKE_RARITIES = ["Common", "Rare", "Epic", "Heroic"];

var uiMappings = await readStorageObject("uiMappings");

async function refreshUIMappings() {
  logger.info("Refreshing UI mappings.");
  uiMappings = await readStorageObject("uiMappings");
}

cron.schedule("* * * * *", refreshUIMappings);

function removeSuffixes(boonName) {
  if (boonName.endsWith("_Expired")) {
    // keepsakes, hades boons
    logger.info("Cutting _Expired from: " + boonName);
    boonName = boonName.substring(boonName.length - "_Expired".length);
    logger.info("Got: " + boonName);
  }

  if (boonName.endsWith("_Inactive")) {
    // keepsakes, hades boons
    logger.info("Cutting _Inactive from: " + boonName);
    boonName = boonName.substring(boonName.length - "_Inactive".length);
    logger.info("Got: " + boonName);
  }

  if (boonName.endsWith("_Complete")) {
    // chaos blessings
    logger.info("Cutting _Inactive from: " + boonName);
    boonName = boonName.substring(boonName.length - "_Inactive".length);
    logger.info("Got: " + boonName);
  }

  return boonName;
}

function prepareBoonObject(boon, rarity) {
  var boonObject = {};
  boonObject.codeName = boon;
  boonObject.rarity = rarity;
  boonObject.name = uiMappings.boons[boon].name;
  boonObject.description = uiMappings.boons[boon].description;
  if (Object.hasOwn(uiMappings.boons[boon], "effects")) {
    boonObject.effects = [];
    uiMappings.boons[boon]["effects"].forEach((effect) => {
      var newEffect = {
        text: effect.text,
        value: effect[rarity.toLowerCase()],
      };
      boonObject.effects.push(newEffect);
    });
  }

  return boonObject;
}

/*
 * Boons should arrive in the following format:
 * [rarityA];;[nameA] [rarityB];;[nameB] etc
 *
 * For example:
 * Common;;ZeusWeaponBoon Rare;;AphroditeCastBoon
 */
const EMPTY_BOON_STRING = "NOBOONS";
function parseBoonData(boonData) {
  if (boonData === EMPTY_BOON_STRING) {
    return {};
  }
  const boonArray = boonData.split(" ");
  var parsedData = {
    otherBoons: [],
    totalBoons: 0,
  };
  boonArray.forEach((boon) => {
    var [boonRarity, boonName] = boon.split(DATA_SEPARATOR);
    if (boonRarity == undefined || boonName == undefined) {
      //data should contain boon rarity and name
      logger.warn("Invalid boon data. Couldn't parse: " + boon);
      return;
    }

    if (!BOON_RARITIES.includes(boonRarity)) {
      logger.warn(
        "Couldn't recognize boon rarity: " + boonRarity + ". Using Common."
      );
      boonRarity = "Common";
    }

    boonName = removeSuffixes(boonName); //this can happen with Hades

    if (uiMappings.boons[boonName] == null) {
      logger.warn("Got unknown boon name: " + boonName);
      return;
    }

    var boonDetails = prepareBoonObject(boonName, boonRarity);
    if (Object.hasOwn(uiMappings.boons[boonName], "slot")) {
      parsedData[uiMappings.boons[boonName]["slot"].toLowerCase() + "Boon"] =
        boonDetails;
    } else {
      parsedData["otherBoons"].push(boonDetails);
    }
    parsedData.totalBoons++;
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
const EMPTY_WEAPON_STRING = "NOWEAPONS";
function parseWeaponData(weaponData) {
  if (weaponData === EMPTY_WEAPON_STRING) {
    return {};
  }

  var parsedData = {};

  var [weaponRarity, weaponName] = weaponData.split(DATA_SEPARATOR);
  if (weaponRarity == undefined || weaponName == undefined) {
    //data should contain rarity and name
    logger.warn("Invalid weapon data. Couldn't parse: " + weaponData);
    return {};
  }

  if (!WEAPON_RARITIES.includes(weaponRarity)) {
    weaponRarity = "Common";
  }

  if (uiMappings.weapons[weaponName] == null) {
    logger.warn("Got unknown weapon name: " + weaponName);
    return {};
  }

  parsedData = uiMappings.weapons[weaponName];
  parsedData["codeName"] = weaponName;
  parsedData["rarity"] = weaponRarity;
  if (parsedData["effects"] != null) {
    parsedData["effects"].forEach((effect) => {
      effect["value"] = effect[weaponRarity.toLowerCase()];
    });
  }

  return parsedData;
}

const EMPTY_FAMILIAR_STRING = "NOFAMILIARS";
function parseFamiliarData(familiarData) {
  if (familiarData === EMPTY_FAMILIAR_STRING) {
    return {};
  }

  var parsedData = {};

  const familiarLevelArray = familiarData.split(" ");
  if (familiarLevelArray.length != 4) {
    logger.warn("Invalid familiar data. Couldn't parse: " + familiarData);
    return {};
  }

  /* figure out which familiar it is and the trait levels (upgrades) for it*/
  var familiarName = null;
  var familiarLevels = {};
  familiarLevelArray.forEach((arrayItem, ind) => {
    if (ind == 0) {
      familiarName = arrayItem;
    } else {
      const splitArrayItem = arrayItem.split(DATA_SEPARATOR);
      if (splitArrayItem.length != 2) {
        logger.warn("Couldn't parse familiar trait: " + arrayItem);
        return;
      }
      familiarLevels[splitArrayItem[1]] = splitArrayItem[0];
    }
  });

  if (familiarName == null) {
    logger.warn("Couldn't parse familiar name from: " + familiarData);
    return {};
  }
  /* map levels to actual descriptions */
  if (uiMappings.familiars[familiarName] == null) {
    logger.warn("Got unknown familiar name: " + familiarData);
    return {};
  }

  parsedData["codeName"] = familiarName;
  parsedData["rarity"] = "Common";
  parsedData["name"] = uiMappings.familiars[familiarName].name;
  parsedData["description"] = uiMappings.familiars[familiarName].description;
  parsedData["effects"] = [];
  uiMappings.familiars[familiarName].effects.forEach((familiarEffect) => {
    var receivedFamilarLevel = familiarLevels[familiarEffect.codeName];
    var newEffect = {
      text: familiarEffect.text,
      value: familiarEffect[receivedFamilarLevel],
    };

    parsedData["effects"].push(newEffect);
  });

  return parsedData;
}

const ExtraType = Object.freeze({
  KEEPSAKE: "Keepsake",
  HEX: "Hex",
  CHAOS_CURSE: "Chaos Curse",
  HADES: "Hades",
  ICARUS: "Icarus",
});
function prepareExtraObject(itemName, itemRarity, extraType) {
  var parsedItem = {};
  parsedItem["extraType"] = extraType;
  parsedItem["codeName"] = itemName;
  switch (extraType) {
    case ExtraType.KEEPSAKE:
      parsedItem["name"] = uiMappings.keepsakes[itemName]["name"];
      parsedItem["description"] =
        uiMappings.keepsakes[itemName][itemRarity.toLowerCase()];
      if (!KEEPSAKE_RARITIES.includes(itemRarity)) {
        itemRarity = "Common";
      }
      parsedItem["rarity"] = itemRarity;

      break;
    case ExtraType.HEX:
      parsedItem["name"] = uiMappings.hexes[itemName]["name"];
      parsedItem["description"] = uiMappings.hexes[itemName]["description"];
      parsedItem["rarity"] = "Common";
      break;
    case ExtraType.CHAOS_CURSE:
    case ExtraType.ICARUS:
      parsedItem["name"] = uiMappings.boons[itemName]["name"];
      parsedItem["description"] = uiMappings.boons[itemName]["description"];
      parsedItem["rarity"] = "Common";
      break;
    case ExtraType.HADES:
      parsedItem["name"] = uiMappings.boons[itemName]["name"];
      parsedItem["description"] = uiMappings.boons[itemName]["description"];
      parsedItem["rarity"] = "Common";
      parsedItem["effects"] = uiMappings.boons[itemName].effects;
      break;
  }

  return parsedItem;
}

const EMPTY_EXTRA_STRING = "NOEXTRAS";
function parseExtraData(extraData) {
  if (extraData === EMPTY_EXTRA_STRING) {
    return [];
  }

  var parsedData = [];

  var foundKeepsake = null;
  var foundHex = null;
  var otherExtras = [];

  const extraArray = extraData.split(" ");

  extraArray.forEach((extraItem) => {
    var [itemRarity, itemName] = extraItem.split(DATA_SEPARATOR);
    if (itemRarity == undefined || itemName == undefined) {
      //data should contain rarity and name
      logger.warn("Invalid extra data. Couldn't parse: " + extraItem);
      return;
    }

    itemName = removeSuffixes(itemName); //this can happen with keepsakes

    if (uiMappings.keepsakes[itemName] != null) {
      foundKeepsake = prepareExtraObject(
        itemName,
        itemRarity,
        ExtraType.KEEPSAKE
      );
    } else if (uiMappings.hexes[itemName] != null) {
      foundHex = prepareExtraObject(itemName, itemRarity, ExtraType.HEX);
    } else if (
      Object.hasOwn(uiMappings.boons, itemName) &&
      uiMappings.boons[itemName].gods[0] == "Chaos"
    ) {
      otherExtras.push(
        prepareExtraObject(itemName, itemRarity, ExtraType.CHAOS_CURSE)
      );
    } else if (
      Object.hasOwn(uiMappings.boons, itemName) &&
      uiMappings.boons[itemName].gods[0] == "Icarus"
    ) {
      otherExtras.push(
        prepareExtraObject(itemName, itemRarity, ExtraType.ICARUS)
      );
    } else if (
      Object.hasOwn(uiMappings.boons, itemName) &&
      uiMappings.boons[itemName].gods[0] == "Hades"
    ) {
      otherExtras.push(
        prepareExtraObject(itemName, itemRarity, ExtraType.HADES)
      );
    } else {
      logger.warn("Unknown extra item: " + extraItem);
      return;
    }
  });
  if (foundKeepsake != null) {
    parsedData.push(foundKeepsake);
  }
  if (foundHex != null) {
    parsedData.push(foundHex);
  }
  parsedData.push(...otherExtras);

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
  var elementsArray = elementalData.split(DATA_SEPARATOR); //get all the elements
  elementsArray.forEach((element) => {
    var splitElement = element.split(":"); //0 is element name, 1 is value
    if (splitElement.length != 2) {
      logger.warn("Invalid element data. Couldn't parse: " + element);
      return;
    }
    unorderedData[splitElement[0]] = splitElement[1];
  });

  var orderedElementNames = ["Earth", "Water", "Air", "Fire", "Aether"];
  orderedElementNames.forEach((element) => {
    parsedData.push({ name: element, value: unorderedData[element] });
  });

  return parsedData;
}

function prepareRequirementRow(requirementRow, boonData) {
  var parsedRequirement = {};
  const boonList = [];

  if (boonData != null) {
    boonData.split(" ").forEach((singleBoon) => {
      if (singleBoon.split(DATA_SEPARATOR).length == 2) {
        boonList.push(singleBoon.split(DATA_SEPARATOR)[1]);
      } else {
        logger.warn("Couldn't parse boon. Invalid format: " + singleBoon);
      }
    });
  }

  if (!Object.hasOwn(requirementRow, "type")) {
    logger.warn("Found a requirement row without a type: " + requirementRow);
    return {};
  }
  parsedRequirement.type = requirementRow["type"];
  if (Object.hasOwn(requirementRow, "items")) {
    parsedRequirement.items = [];

    requirementRow.items.forEach((requiredItem) => {
      if (Object.hasOwn(uiMappings.boons, requiredItem)) {
        var requiredBoon = prepareBoonObject(requiredItem, "Common");
        requiredBoon["fulfilled"] = boonList.includes(requiredBoon.codeName);

        parsedRequirement.items.push(requiredBoon);
      } else {
        logger.warn("Missing requirement: " + requiredItem);
      }
    });
  }

  return parsedRequirement;
}

function preparePinObject(pinBoon, boonData) {
  var pinObject = {};
  pinObject.codeName = pinBoon;
  if (
    Object.hasOwn(uiMappings.boons[pinBoon], "effects") &&
    Object.hasOwn(uiMappings.boons[pinBoon]["effects"][0], "duo")
  ) {
    pinObject.rarity = "Duo";
  } else if (
    Object.hasOwn(uiMappings.boons[pinBoon], "effects") &&
    Object.hasOwn(uiMappings.boons[pinBoon]["effects"][0], "infusion")
  ) {
    pinObject.rarity = "Infusion";
  } else if (
    Object.hasOwn(uiMappings.boons[pinBoon], "effects") &&
    Object.hasOwn(uiMappings.boons[pinBoon]["effects"][0], "legendary")
  ) {
    pinObject.rarity = "Legendary";
  } else {
    pinObject.rarity = "Common";
  }
  pinObject.name = uiMappings.boons[pinBoon].name;
  pinObject.description = uiMappings.boons[pinBoon].description;
  if (Object.hasOwn(uiMappings.boons[pinBoon], "effects")) {
    pinObject.effects = uiMappings.boons[pinBoon].effects;
  }
  if (Object.hasOwn(uiMappings.boons[pinBoon], "requirements")) {
    pinObject.requirements = [];
    uiMappings.boons[pinBoon].requirements.forEach((requirementRow) => {
      pinObject.requirements.push(
        prepareRequirementRow(requirementRow, boonData)
      );
    });
  }

  return pinObject;
}

const MAX_PINS = 3;
const EMPTY_PINS_STRING = "NOPINS";
function parsePinData(pinData, boonData) {
  if (pinData == EMPTY_PINS_STRING) {
    return [];
  }

  var parsedData = [];

  const splitPinBoons = pinData.split(DATA_SEPARATOR);

  splitPinBoons.forEach((pinBoon) => {
    if (parsedData.length >= MAX_PINS) {
      return;
    }

    if (pinBoon in uiMappings.boons) {
      var parsedElement = preparePinObject(pinBoon, boonData);
      parsedData.push(parsedElement);
    } else {
      logger.warn("Invalid pin data. Couldn't parse: " + pinBoon);
      return;
    }
  });

  return parsedData;
}

const EMPTY_VOWS_STRING = "NOVOWS";
function parseVowData(vowData) {
  if (vowData === EMPTY_VOWS_STRING) {
    return {};
  }

  var parsedData = {
    vowList: [],
    totalFear: 0,
  };

  const allVows = vowData.split(" ");

  allVows.forEach((singleVow) => {
    const [vowLevel, vowCodeName] = singleVow.split(DATA_SEPARATOR);
    if (vowLevel == undefined || vowCodeName == undefined) {
      logger.warn("Invalid vow data. Couldn't parse: " + singleVow);
      return;
    }

    if (uiMappings.vows[vowCodeName] == null) {
      logger.warn("Got unknown vow name: " + vowCodeName);
      return;
    }

    var parsedVow = {
      codeName: vowCodeName,
      name: uiMappings.vows[vowCodeName].name,
      level: vowLevel,
      description:
        uiMappings.vows[vowCodeName].descriptions[parseInt(vowLevel)],
    };

    parsedData.vowList.push(parsedVow);
    parsedData.totalFear += uiMappings.vows[vowCodeName].fears[vowLevel];
    logger.debug(
      "Added " +
        uiMappings.vows[vowCodeName].fears[vowLevel] +
        " fear to total fear for " +
        vowCodeName +
        " at level " +
        vowLevel
    );
  });

  return parsedData;
}

const ARCANA_LEVEL_MAPPING = ["None", "Common", "Rare", "Epic", "Heroic"];
const EMPTY_ARCANA_STRING = "NOARCANA";
function parseArcanaData(arcanaData) {
  if (arcanaData === EMPTY_ARCANA_STRING) {
    return {};
  }

  var parsedData = {
    arcanaList: [],
    totalGrasp: 0,
  };

  const allArcana = arcanaData.split(" ");

  allArcana.forEach((singleArcana) => {
    var [arcanaLevel, arcanaCodeName] = singleArcana.split(DATA_SEPARATOR);

    if (uiMappings.arcana[arcanaCodeName] == null) {
      logger.warn("Got unknown arcana name: " + arcanaCodeName);
      return;
    }

    var parsedArcana = {
      codeName: arcanaCodeName,
      name: uiMappings.arcana[arcanaCodeName].name,
      rarity: ARCANA_LEVEL_MAPPING[arcanaLevel],
      description:
        uiMappings.arcana[arcanaCodeName].descriptions[parseInt(arcanaLevel)],
    };

    parsedData.arcanaList.push(parsedArcana);
    parsedData.totalGrasp += uiMappings.arcana[arcanaCodeName].grasp;
  });

  return parsedData;
}

function countTotalRunItems(parsedData) {
  var totalRunItems = 0;
  if (Object.keys(parsedData.boonData).length !== 0) {
    totalRunItems += parsedData.boonData.totalBoons;
  }
  if (Object.keys(parsedData.weaponData).length !== 0) {
    totalRunItems++;
  }
  if (Object.keys(parsedData.familiarData).length !== 0) {
    totalRunItems++;
  }
  if (parsedData.extraData.length > 0) {
    totalRunItems += parsedData.extraData.length;
  }

  return totalRunItems;
}

//twitch package size limitation is 5KB
const TWITCH_PACKAGE_LIMIT = 1024 * 5;
//80% just for paranoia. 20 characters is our nonce and part number.
const TWITCH_PACKAGE_SIZE_CUTOFF = Math.floor(TWITCH_PACKAGE_LIMIT * 0.8) - 20;

export function parseRunData(runData) {
  var parsedData = {
    boonData: parseBoonData(runData.boonData),
    weaponData: parseWeaponData(runData.weaponData),
    familiarData: parseFamiliarData(runData.familiarData),
    extraData: parseExtraData(runData.extraData),
    elementalData: parseElementalData(runData.elementalData),
    pinData: parsePinData(runData.pinData, runData.boonData),
    vowData: parseVowData(runData.vowData),
    arcanaData: parseArcanaData(runData.arcanaData),
  };
  logger.info(countTotalRunItems(parsedData));
  parsedData.totalRunItems = String(countTotalRunItems(parsedData));

  var stringToSend = JSON.stringify(parsedData);

  var parsedDataArray = [];
  if (stringToSend.length > TWITCH_PACKAGE_SIZE_CUTOFF) {
    var startPos = 0;
    var stop = false;

    while (!stop) {
      var endingPosition = startPos + TWITCH_PACKAGE_SIZE_CUTOFF;
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
