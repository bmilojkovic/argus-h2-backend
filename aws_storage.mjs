import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
const s3Client = new S3Client({});
const bucketName = "argus-h2-backend-argus-tokens";

async function readStorageString(objectName) {
  var objectParams = {
    Bucket: bucketName,
    Key: objectName,
  };

  const { Body } = await s3Client.send(new GetObjectCommand(objectParams));
  return await Body.transformToString();
}

export async function readStorageObject(objectName) {
  return JSON.parse(await readStorageString(objectName));
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
