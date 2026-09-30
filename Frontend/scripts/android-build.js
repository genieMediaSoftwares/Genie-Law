const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkEnv } = require('./check-env');

const args = process.argv.slice(2);
const device = args.includes('--device');
const clean = args.includes('--clean');
// --aab: the Play Store bundle (bundleRelease) instead of an APK.
const aab = args.includes('--aab');
// --allow-local-backend: a test build against an http/LAN backend. Never ship it.
const allowLocalBackend = args.includes('--allow-local-backend');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');

const findOnPath = name => {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (dir && fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
};

const removeDir = dir => fs.rmSync(dir, { recursive: true, force: true });

// The bundle inlines .env values: check them before spending minutes on Gradle.
const envCheck = checkEnv({ allowLocalBackend });
console.log(
  `[android-build] config: mode "${envCheck.mode}", files ${envCheck.loaded.join(', ') || 'none'}, backend host ${envCheck.host || '-'}`,
);
if (envCheck.problems.length > 0) {
  envCheck.problems.forEach(problem => console.error(`[android-build] ${problem}`));
  console.error('[android-build] Release build stopped: fix the configuration above (README, Setup).');
  process.exit(1);
}
if (allowLocalBackend) {
  console.warn('[android-build] --allow-local-backend: TEST BUILD against a local backend. Do not distribute it.');
}

const env = { ...process.env };
// Only react-native-dotenv (APP_ENV-aware, checked above) resolves .env files;
// Expo CLI would otherwise load them again under NODE_ENV's mode.
env.EXPO_NO_DOTENV = '1';

// Metro's transform cache does not track .env files, so a bundle could keep a
// previous build's inlined values. Release builds always transform afresh.
const metroCache = path.join(os.tmpdir(), 'metro-cache');
if (fs.existsSync(metroCache)) {
  removeDir(metroCache);
  console.log(`[android-build] cleared ${metroCache}`);
}

const ccache = findOnPath('ccache');
if (ccache) {
  const launcher = ccache.split(path.sep).join('/');
  env.CMAKE_C_COMPILER_LAUNCHER = launcher;
  env.CMAKE_CXX_COMPILER_LAUNCHER = launcher;
  console.log(`[android-build] ccache: ${launcher}`);
} else {
  console.log('[android-build] ccache not found on PATH — native code compiles uncached.');
}
console.log(
  `[android-build] GRADLE_USER_HOME: ${env.GRADLE_USER_HOME || '(Gradle default)'}`,
);

if (clean) {
  const targets = [
    path.join(androidDir, 'app', 'build'),
    path.join(androidDir, 'app', '.cxx'),
    path.join(androidDir, 'build'),
  ];
  const nm = path.join(root, 'node_modules');
  const scan = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkg = path.join(dir, entry.name);
      if (entry.name.startsWith('@')) {
        scan(pkg);
        continue;
      }
      targets.push(path.join(pkg, 'android', 'build'), path.join(pkg, 'android', '.cxx'));
    }
  };
  scan(nm);
  let removed = 0;
  for (const t of targets) {
    if (fs.existsSync(t)) {
      removeDir(t);
      removed++;
    }
  }
  console.log(`[android-build] clean: removed ${removed} build/.cxx directories`);
}

const gradleArgs = [aab ? 'bundleRelease' : 'assembleRelease'];
if (device) gradleArgs.push('-PreactNativeArchitectures=arm64-v8a');
// Lets that test build reach an http backend; production builds never set it.
if (allowLocalBackend) gradleArgs.push('-Pgenielaw.localBackendTest=true');

const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
console.log(`[android-build] ${gradlew} ${gradleArgs.join(' ')}`);

const started = Date.now();
const result = spawnSync(`"${gradlew}"`, gradleArgs, {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
const seconds = Math.round((Date.now() - started) / 1000);
if (result.error) {
  console.error(`[android-build] could not start Gradle: ${result.error.message}`);
}

console.log(
  `[android-build] ${result.status === 0 ? 'SUCCEEDED' : 'FAILED'} in ` +
    `${Math.floor(seconds / 60)}m ${seconds % 60}s (${device ? 'device: arm64-v8a' : 'production: all ABIs'})`,
);
if (result.status === 0) {
  const output = aab
    ? path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
    : path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  console.log(`[android-build] ${aab ? 'AAB' : 'APK'}: ${output}`);
}
process.exit(result.status ?? 1);
