// Checks the configuration a release JS bundle will be built with, before the
// build starts. A release bundle inlines the values, so a wrong one is only
// fixed by rebuilding.
//
// Resolution mirrors react-native-dotenv (babel.config.js), which is what
// actually inlines `@env` into the bundle:
//   mode   = APP_ENV, else "production" (what a release bundle runs under)
//   files  .env  <  .env.<mode>  <  .env.local  <  .env.<mode>.local
//   then   a variable set in the shell/CI environment overrides the files.
// Build scripts set EXPO_NO_DOTENV=1 so Expo CLI does not load a second copy
// of the files with its own (NODE_ENV-based) mode.
//
// Every variable declared in src/types/env.d.ts must resolve to a value.
// Unless --allow-local-backend is given, API_BASE_URL must also be an https
// URL on a public host, set in a file for this mode (or the environment), so
// the development address in .env can never reach a release build.
//
//   node scripts/check-env.js [--allow-local-backend]
//   APP_ENV=staging node scripts/check-env.js

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');

const requiredKeys = () => {
  const declarations = fs.readFileSync(path.join(root, 'src', 'types', 'env.d.ts'), 'utf8');
  const block = /declare module '@env'\s*\{([\s\S]*?)\}/.exec(declarations);
  if (!block) {
    throw new Error("src/types/env.d.ts has no `declare module '@env'` block.");
  }
  return [...block[1].matchAll(/export const (\w+)/g)].map(match => match[1]);
};

const readFile = name => {
  const file = path.join(root, name);
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : null;
};

const isLocalHost = host =>
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$)/i.test(host) ||
  host.endsWith('.local');

function checkEnv({ allowLocalBackend = false } = {}) {
  const mode = process.env.APP_ENV || 'production';
  const layers = ['.env', `.env.${mode}`, '.env.local', `.env.${mode}.local`];
  const modeFiles = new Set([`.env.${mode}`, `.env.${mode}.local`]);

  const values = {};
  const source = {};
  const loaded = [];
  for (const name of layers) {
    const parsed = readFile(name);
    if (!parsed) {
      continue;
    }
    loaded.push(name);
    for (const [key, value] of Object.entries(parsed)) {
      if (value) {
        values[key] = value;
        source[key] = name;
      }
    }
  }
  for (const key of Object.keys(values)) {
    if (process.env[key]) {
      values[key] = process.env[key];
      source[key] = 'environment';
    }
  }

  const problems = [];
  for (const key of requiredKeys()) {
    const value = (values[key] ?? process.env[key] ?? '').trim();
    if (!value) {
      problems.push(`${key} is not set (mode "${mode}").`);
    } else if (!values[key]) {
      values[key] = value;
      source[key] = 'environment';
    }
  }

  const baseUrl = (values.API_BASE_URL ?? '').trim();
  let host = '';
  if (baseUrl) {
    const match = /^(https?):\/\/([^/:]+|\[[^\]]+\])/i.exec(baseUrl);
    if (!match) {
      problems.push('API_BASE_URL must be a full http(s) URL.');
    } else {
      host = match[2];
      if (!allowLocalBackend) {
        if (match[1].toLowerCase() !== 'https') {
          problems.push('API_BASE_URL must use https in a release build (Android and iOS block plain http).');
        }
        if (isLocalHost(host)) {
          problems.push(`API_BASE_URL points at a local/private address (${host}), which no user's phone can reach.`);
        }
        if (!modeFiles.has(source.API_BASE_URL) && source.API_BASE_URL !== 'environment') {
          problems.push(
            `API_BASE_URL comes from ${source.API_BASE_URL}, the development file. ` +
              `Set it in .env.${mode} (or the build environment).`,
          );
        }
      }
    }
  }

  return { mode, loaded, host, problems };
}

module.exports = { checkEnv };

if (require.main === module) {
  const allowLocalBackend = process.argv.includes('--allow-local-backend');
  const result = checkEnv({ allowLocalBackend });
  console.log(
    `[check-env] mode "${result.mode}", files: ${result.loaded.join(', ') || 'none'}, backend host: ${result.host || '-'}`,
  );
  if (result.problems.length > 0) {
    result.problems.forEach(problem => console.error(`[check-env] ${problem}`));
    process.exit(1);
  }
  console.log('[check-env] OK');
}
