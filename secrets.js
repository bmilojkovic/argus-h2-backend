//IMPORTANT: have the three variables below in these environment variables
function loadSecrets() {
  secrets = {
    extensionId: process.env.ARGUS_TWITCH_ID,
    apiClientSecret: process.env.ARGUS_CLIENT_SECRET,
    extensionSecret: process.env.ARGUS_EXTENSION_SECRET,
  };

  return secrets;
}

module.exports = { loadSecrets };
