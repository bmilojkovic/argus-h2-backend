import app_versions from "./app_versions.json" with { type: 'json' };

export function handleGetNewestAppVersion(req, res) {
  let response_object = {};
  response_object["newest_version"] = app_versions.newest_version;
  response_object["changelog"] =
    app_versions.changelogs[app_versions.newest_version];

  res.send(JSON.stringify(response_object));
}
