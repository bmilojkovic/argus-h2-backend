# Argus Backend

This repository contains all the code running on the Argus backend. If you just want to use the mod and extension, you shouldn't care about this code. It is provided on github for completion.

- [Argus Mod](https://github.com/bmilojkovic/argus-h2-mod)
- [Argus Twitch Extension](https://github.com/bmilojkovic/argus-h2-twitch)

If you wish to understand how Argus works, or replicate its function, then this is the place for you.

## Overview

Currently the backend is deployed at: https://argus-h2-backend.fly.dev

The backend is implemented as an express js app. It is deployed on [fly.io](https://fly.io). If you wish to do your own deployment, you can fork this repository and use the action that triggers on push, or just do `fly deploy`. You will need to make sure your environment is set up properly if you want the code to actually function.

## Deployment

If you are deploying your own version of this repo, you will also need to build and set up your version of the Argus Twitch Extension. You will probably want to search through all three repos for the backend URL (https://argus-h2-backend.fly.dev) since it appears a couple of times in code. Make sure you have both the client API secret and the extension secret generated for your version of the Argus Twitch Extension. For the backend code to work you need to have a couple of environment variables set:

- `ARGUS_TWITCH_ID` - the (public) client ID of the Twitch extension you are broadcasting to.
- `ARGUS_CLIENT_SECRET` - the Twitch client API secret for the extension you are broadcasting to.
- `ARGUS_EXTENSION_SECRET` - the Twitch Extension shared secret for the extension you are broadcasting to.

## AWS

Additionally, we use S3 storage for a couple of objects. We pull the access variables from the environment as well:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

Set these variables so that they can access your own S3 storage buckets. You will need to have a bucket called `argus-h2-backend-argus-tokens` that stores the following objects:

- `uiMappings` - this should be the full contents of the `ui_mappings.json` file. It is only read by the code, and never written to. To change it, use the `update_ui_mappings` tool.
- `pendingTwitchLogins` - can be empty initially.
- `twitchIdByArgusToken` - can be empty initially. Both of these objects are used temporarily for authentication.

## Functionality

The backend provides only a couple of endpoints:

- `/run_info` - POST handler. This endpoint is targeted by the mod to send us information that should be broadcast to the Twitch extension. This is the main reason for the backend to exist. Everything else is support. Start here if you want to dig through the main functionality of the system.
- `/get_argus_token` - POST request invoked by the mod to obtain an Argus token. Presumably the mod has initiated a Twitch authentication flow that will provide the backend with a code for obtaining the users Twitch ID.
- `/check_argus_token` - GET request invoked by the mod to see if a token (that they presumably got previously and stored in a config file) is valid.
- `/oauth_token` - GET request that is part of the OAuth flow. For the full description of the Auth flow, check out the TECH_README in the [main mod repository](https://github.com/bmilojkovic/argus-h2-mod).
- `/check_login` - GET request that is invoked by the Twitch extension. This one checks if a Twitch user has completed the OAuth flow from the mod.

The only time the mod makes an outbound request is as a part of the `/run_info` action. We broadcast data to the Twitch extension on the https://api.twitch.tv/helix/extensions/pubsub endpoint.
