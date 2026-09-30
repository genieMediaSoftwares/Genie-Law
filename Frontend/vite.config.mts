import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ENV_MODULE = '@env';
const RESOLVED_ENV_MODULE = '\0@env';

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react({ jsxImportSource: 'nativewind' }),
      {
        name: 'genie-law-env',
        resolveId(id) {
          return id === ENV_MODULE ? RESOLVED_ENV_MODULE : null;
        },
        load(id) {
          if (id !== RESOLVED_ENV_MODULE) {
            return null;
          }
          return [
            `export const API_BASE_URL = ${JSON.stringify(fileEnv.API_BASE_URL)};`,
            `export const API_TIMEOUT_MS = ${JSON.stringify(fileEnv.API_TIMEOUT_MS)};`,
            `export const SUPPORT_EMAIL = ${JSON.stringify(fileEnv.SUPPORT_EMAIL)};`,
            `export const SUPPORT_PHONE = ${JSON.stringify(fileEnv.SUPPORT_PHONE)};`,
            `export const AI_UPLOAD_MAX_MB = ${JSON.stringify(fileEnv.AI_UPLOAD_MAX_MB)};`,
            `export const AI_OPTIMIZE_MAX_MB = ${JSON.stringify(fileEnv.AI_OPTIMIZE_MAX_MB)};`,
          ].join('\n');
        },
      },
      {
        // expo-modules-core's uuid uses direct `eval('require')` to hide a Node-only
        // require from Metro. Browsers never reach it; make it an indirect eval so
        // Rolldown doesn't warn about direct eval.
        name: 'fix-expo-modules-core-uuid-eval',
        transform(code, id) {
          if (id.includes('expo-modules-core') && /[\\/]uuid[\\/]index\.web\.[jt]s$/.test(id)) {
            return {
              code: code.replace(/\beval\((['"])require\1\)/g, '(0, eval)($1require$1)'),
              map: null,
            };
          }
        },
      },
      {
        name: 'fix-expo-modules-core-declarations',
        transform(code, id) {
          if (id.includes('expo-modules-core') && id.includes('ts-declarations')) {
            return {
              code: code
                .replace("import { EventEmitter } from './EventEmitter';", "import type { EventEmitter } from './EventEmitter';")
                .replace("import { NativeModule } from './NativeModule';", "import type { NativeModule } from './NativeModule';")
                .replace("import { SharedObject } from './SharedObject';", "import type { SharedObject } from './SharedObject';")
                .replace("import { SharedRef } from './SharedRef';", "import type { SharedRef } from './SharedRef';"),
              map: null,
            };
          }
        },
      },
    ],

    resolve: {
      alias: [
        { find: /^react-native$/, replacement: 'react-native-web' },

        {
          find: /^@react-native\/assets-registry\/registry$/,
          replacement: 'react-native-web/dist/modules/AssetRegistry',
        },
      ],
      extensions: [
        '.web.tsx',
        '.web.ts',
        '.web.jsx',
        '.web.js',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.json',
      ],
    },

    define: {
      global: 'globalThis',
      __DEV__: JSON.stringify(mode !== 'production'),
    },

    server: {
      port: 5173,
      open: false,
    },
  };
});
