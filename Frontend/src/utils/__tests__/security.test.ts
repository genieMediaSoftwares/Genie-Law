import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { requests, setHttpHandler } from '../../test-utils/httpStub';
import { apiClient } from '../../api/apiClient';
import { tokenStore } from '../../api/tokenStore';
import { describeError, logError } from '../log';
import { toAppError } from '../errors';

jest.mock('../../services/secureStorage', () =>
  require('../../test-utils/memorySecureStorage'),
);

const ACCESS = 'eyJhbGciOiJIUzI1NiJ9.secret-access-token.sig';
const REFRESH = 'f3a9c0ffee1234567890refresh';

beforeEach(async () => {
  await tokenStore.set(ACCESS, REFRESH);
});

describe('logging', () => {
  it('describes a failed request without its token, body or query string', async () => {
    setHttpHandler(() => ({ status: 500, data: { success: false, message: 'boom' } }));
    const error = await apiClient
      .post('/auth/login?email=asha@example.com', { password: 'hunter2-password' })
      .catch(e => e);

    const text = describeError(error);

    expect(text).toBe('POST /auth/login → 500 (ERR_BAD_RESPONSE)');
    expect(text).not.toContain(ACCESS);
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('asha@example.com');
  });

  it('logError never writes the Authorization header to the device log', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setHttpHandler(() => ({ networkError: 'ERR_NETWORK' }));
    const error = await apiClient.get('/documents').catch(e => e);

    // The raw error really does carry the token…
    expect(JSON.stringify(error.config.headers)).toContain(ACCESS);
    // …and the log line does not.
    logError('documents', error);
    const logged = warn.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toContain(ACCESS);
    expect(logged).not.toContain('Bearer');
  });

  it('hides server internals from user-facing messages', async () => {
    setHttpHandler(() => ({
      status: 500,
      data: { success: false, message: 'E11000 duplicate key error collection: users index' },
    }));
    const info = toAppError(await apiClient.get('/profile').catch(e => e));
    expect(info.message).not.toContain('E11000');
  });
});

describe('what the app persists', () => {
  it('keeps tokens out of AsyncStorage (plain text on the device)', async () => {
    await tokenStore.set('another-access', 'another-refresh');
    const keys = await AsyncStorage.getAllKeys();
    const values = await AsyncStorage.multiGet(keys);
    expect(JSON.stringify(values)).not.toContain('another-access');
    expect(JSON.stringify(values)).not.toContain('another-refresh');
  });

  it('writes to AsyncStorage only the language preference', () => {
    const srcRoot = path.join(__dirname, '..', '..');
    const writers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== 'test-utils') walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf8');
          if (/AsyncStorage\.(setItem|multiSet|mergeItem)/.test(source)) {
            writers.push(path.relative(srcRoot, full).split(path.sep).join('/'));
          }
        }
      }
    };
    walk(srcRoot);
    expect(writers).toEqual(['i18n/index.ts']);
  });

  it('has no console.log/warn/error call that passes a raw error object', () => {
    const srcRoot = path.join(__dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== 'test-utils') walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          fs.readFileSync(full, 'utf8')
            .split('\n')
            .forEach((line, index) => {
              if (/console\.(log|warn|error|info)\([^)]*,\s*(err|error|e)\s*\)/.test(line)) {
                offenders.push(`${path.relative(srcRoot, full)}:${index + 1}`);
              }
            });
        }
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  it('logs nothing about requests in a normal session', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map(level =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );
    setHttpHandler(() => ({ status: 200, data: { success: true, data: [] } }));
    await apiClient.get('/cases');
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(requests.length).toBeGreaterThan(0);
  });
});
