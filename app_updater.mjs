const newest_app_version = "1.1.0";

export function handleGetNewestAppVersion(req, res) {
  let response_object = {};
  response_object["newest_version"] = newest_app_version;

  res.send(JSON.stringify(response_object));
}
