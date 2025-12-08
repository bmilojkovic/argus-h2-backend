import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { logger } from "../../argus_logger.mjs";
import SJSON from "simplified-json";

function readTraitKeys(uiMappingsPath) {
  try {
    const uiMappingsData = fs.readFileSync(uiMappingsPath, "utf8");
    const uiMappings = JSON.parse(uiMappingsData);
    const resultObject = {};

    Object.keys(uiMappings).map((topLevelKey) => {
      Object.keys(uiMappings[topLevelKey]).map((traitName) => {
        resultObject[traitName] = { sjsonFound: false };
      });
    });

    return resultObject;
  } catch (err) {
    console.log("Error reading or parsing JSON:", err);
  }

  return null;
}

function readSjsonTexts(traitTextPath) {
  try {
    const sjsonData = fs.readFileSync(traitTextPath, "utf8").trim();

    const sjsonTexts = SJSON.parse(sjsonData);
    return sjsonTexts["Texts"];
  } catch (err) {
    console.log("Error reading or parsing SJSON:", err);
  }

  return null;
}

function extractKeywords(someString) {
  const regex = /{([^}]+)}/g; // Regular expression to match content within curly braces
  const matches = [];
  let match;

  // Use a loop with exec() to find all occurrences
  while ((match = regex.exec(someString)) !== null) {
    matches.push(match[1]); // The content within the first capturing group (the parentheses)
  }

  return matches;
}

function buildData(ourTraits, sjsonTexts) {
  sjsonTexts.map((sjsonItem) => {
    if (Object.hasOwn(sjsonItem, "Id")) {
      const itemId = sjsonItem["Id"];
      if (Object.hasOwn(ourTraits, itemId)) {
        ourTraits[itemId].sjsonFound = true;
        ourTraits[itemId].sjsonContent = sjsonItem;
      }
    }
  });

  const resultObject = {};
  const keywordSet = new Set();

  Object.keys(ourTraits).map((traitKey) => {
    const ourTrait = ourTraits[traitKey];

    if (!ourTrait.sjsonFound) {
      resultObject[traitKey] = ourTrait;
    } else {
      Object.keys(ourTrait.sjsonContent).map((sjsonProperty) => {
        const keywords = extractKeywords(ourTrait.sjsonContent[sjsonProperty]);

        keywords.forEach((keyword) => keywordSet.add(keyword));
      });
    }
  });

  resultObject["keywordSet"] = [...keywordSet].sort();

  //console.log(resultObject);
  return resultObject;
}

function writeParsedData(outputPath, parsedTexts) {
  try {
    fs.writeFileSync(outputPath, JSON.stringify(parsedTexts));
  } catch (err) {
    console.log("Error in writing output: ", err);
  }
}

function parseTraits(traitTextPath, uiMappingsPath, outputPath) {
  const ourTraits = readTraitKeys(uiMappingsPath);

  const sjsonTexts = readSjsonTexts(traitTextPath);

  const parsedTexts = buildData(ourTraits, sjsonTexts);

  writeParsedData(outputPath, parsedTexts);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = __dirname + "../../../data";
const gamePath = "D:/Programs/Steam/steamapps/common/Hades II/";
parseTraits(
  gamePath + "Content/Game/Text/en/TraitText.en.sjson",
  dataPath + "/ui_mappings.json",
  dataPath + "/trait_parsing_out.json"
);
