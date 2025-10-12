
import { writeStorageObject } from "../aws_storage.mjs";

import uiMappings from "../ui_mappings.json" with {"type": "json"};

function updateUIMappings() {
    writeStorageObject("uiMappings", uiMappings);
}

updateUIMappings();