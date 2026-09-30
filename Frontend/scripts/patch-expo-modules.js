const fs = require('fs');
const path = require('path');

// 1. Patch ts-declarations/global.ts
const globalTsFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'src',
  'ts-declarations',
  'global.ts',
);

if (fs.existsSync(globalTsFile)) {
  let content = fs.readFileSync(globalTsFile, 'utf8');
  let modified = false;

  const replacements = [
    ["import { EventEmitter } from './EventEmitter';", "import type { EventEmitter } from './EventEmitter';"],
    ["import { NativeModule } from './NativeModule';", "import type { NativeModule } from './NativeModule';"],
    ["import { SharedObject } from './SharedObject';", "import type { SharedObject } from './SharedObject';"],
    ["import { SharedRef } from './SharedRef';", "import type { SharedRef } from './SharedRef';"],
  ];

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(globalTsFile, content, 'utf8');
    console.log('[patch-expo-modules] Successfully converted runtime imports to type-only imports in global.ts');
  }
}

// 2. Patch tsconfig.json to remove missing expo-module-scripts reference
const tsconfigFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'tsconfig.json',
);

if (fs.existsSync(tsconfigFile)) {
  let content = fs.readFileSync(tsconfigFile, 'utf8');
  if (content.includes('expo-module-scripts/tsconfig.base')) {
    content = content.replace('"extends": "expo-module-scripts/tsconfig.base",', '');
    if (!content.includes('"declaration": true')) {
      content = content.replace('"emitDeclarationOnly": true', '"declaration": true,\n    "emitDeclarationOnly": true');
    }
    fs.writeFileSync(tsconfigFile, content, 'utf8');
    console.log('[patch-expo-modules] Successfully removed missing extends reference from expo-modules-core/tsconfig.json');
  }
}
