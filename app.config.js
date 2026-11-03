// Dynamic Expo config. app.json stays the single source of truth for the app
// config; this file only layers in the one value that has to come from the
// build environment.
//
// Android push (Firebase Cloud Messaging) needs google-services.json. The file
// is git-ignored — on an EAS build it arrives through the GOOGLE_SERVICES_JSON
// FILE environment variable (EAS writes the secret to a temp path and puts
// that path in the variable); on a local prebuild it's ./google-services.json
// if present. With neither, the key is simply left out: everything else still
// builds, the Android app just carries no FCM credentials.
//
// Setup (one-time): see the Pass 41 block in docs/Dev-Tracker.md —
//   eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file \
//     --value ./google-services.json --environment production --visibility secret

const fs = require('fs');
const path = require('path');

// Expo CLI runs this from the project root.
const localGoogleServices = path.resolve('google-services.json');
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync(localGoogleServices) ? './google-services.json' : undefined);

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
});
