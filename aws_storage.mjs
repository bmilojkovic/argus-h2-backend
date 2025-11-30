import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { logger } from "./argus_logger.mjs";
const s3Client = new S3Client({});
//const bucketName = "argus-h2-backend-argus-tokens";
const bucketName = "argus-h2-backend-argus-tokens-test";

async function readStorageString(objectName) {
  try {
    var objectParams = {
      Bucket: bucketName,
      Key: objectName,
    };
    const { Body } = await s3Client.send(new GetObjectCommand(objectParams));
    return await Body.transformToString();
  } catch (error) {
    logger.error(
      `Reading storage key ${objectName} from bucket ${bucketName} failed.`
    );
  }
  return null;
}

export async function readStorageObject(objectName) {
  const result = await readStorageString(objectName);
  if (result != null && result !== "") {
    try {
      return JSON.parse(result);
    } catch (error) {
      logger.error(
        `Problem while parsing JSON object from storage: ${objectName}`
      );
      return null;
    }
  }

  return null;
}

async function writeStorageString(objectName, stringToWrite) {
  var objectParams = {
    Bucket: bucketName,
    Key: objectName,
    Body: stringToWrite,
  };

  await s3Client.send(new PutObjectCommand(objectParams));
}

export async function writeStorageObject(objectName, objectToWrite) {
  await writeStorageString(objectName, JSON.stringify(objectToWrite));
}
