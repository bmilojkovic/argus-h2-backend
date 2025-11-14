import app_versions from "./app_versions.json";

export function handleGetNewestAppVersion(req) {
  response_object = {};
  response_object["newest_version"] = app_versions.newest_version;
  response_object["details"] =
    app_versions.versions[app_versions.newest_version];

  req.send(JSON.stringify(response_object));
}
