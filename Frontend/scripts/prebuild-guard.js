// `npm run prebuild` regenerates android/ from app.json and would silently
// drop the production configuration that lives only in the native project:
//   android/app/build.gradle   upload-key signing (GENIELAW_UPLOAD_*),
//                              local-backend cleartext switch, R8 flags read
//   android/gradle.properties  android.enableMinifyInReleaseBuilds / shrink
//   android/app/src/main/AndroidManifest.xml
//                              RECORD_AUDIO, no SYSTEM_ALERT_WINDOW,
//                              usesCleartextTraffic placeholder
// android/ is therefore the source of truth (committed, not generated). Run
// the real prebuild only on purpose, then re-apply and diff the above:
//   npm run prebuild -- --force
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
if (!args.includes('--force')) {
  console.error(
    '[prebuild] Refused: android/ holds production configuration (signing, R8, manifest)\n' +
      'that `expo prebuild` would overwrite. See scripts/prebuild-guard.js and README\n' +
      '("Native project"). To regenerate anyway: npm run prebuild -- --force',
  );
  process.exit(1);
}

const result = spawnSync('npx', ['expo', 'prebuild', ...args.filter(a => a !== '--force')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
