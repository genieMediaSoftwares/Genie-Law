import '../../test-utils/httpStub';
import { setHttpHandler } from '../../test-utils/httpStub';
import { Directory, File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { clearOpenedDocuments, openDocumentOnDevice } from '../documentOpener';
import { tokenStore } from '../../api/tokenStore';

jest.mock('../../services/secureStorage', () =>
  require('../../test-utils/memorySecureStorage'),
);

// In-memory stand-ins for expo-file-system's File and Directory.
interface FakeFile {
  name: string;
  modificationTime: number;
  delete: jest.Mock;
  contentUri: string;
  uri: string;
}
let folderFiles: FakeFile[] = [];
let folderExists = true;
const folderDelete = jest.fn(() => {
  folderFiles = [];
  folderExists = false;
});

const fakeFile = (name: string, modificationTime: number): FakeFile => {
  const file = Object.create((File as unknown as jest.Mock).prototype) as FakeFile;
  Object.assign(file, {
    name,
    modificationTime,
    uri: `file:///cache/document-viewer/${name}`,
    contentUri: `content://app/document-viewer/${name}`,
    delete: jest.fn(() => {
      folderFiles = folderFiles.filter(f => f !== file);
    }),
  });
  return file;
};

beforeEach(async () => {
  folderFiles = [];
  folderExists = true;
  (Directory as unknown as jest.Mock).mockImplementation(() => ({
    create: jest.fn(() => {
      folderExists = true;
    }),
    list: () => [...folderFiles],
    delete: folderDelete,
    get exists() {
      return folderExists;
    },
  }));
  (File as unknown as jest.Mock).mockImplementation((_folder: unknown, name: string) =>
    fakeFile(name, Date.now()),
  );
  (File as unknown as { downloadFileAsync: jest.Mock }).downloadFileAsync.mockImplementation(
    async (_url: string, target: FakeFile) => {
      folderFiles.push(target);
      return target;
    },
  );
  setHttpHandler(() => ({ status: 200 }));
  await tokenStore.set('access-1', 'refresh-1');
});

const doc = {
  url: 'https://api.test.invalid/api/documents/d1/download',
  fileName: 'Rental agreement.pdf',
  mimeType: 'application/pdf',
};

const onPlatform = (os: 'android' | 'ios') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

it('on iOS, hands the downloaded file to the share/preview sheet', async () => {
  onPlatform('ios');
  await openDocumentOnDevice(doc);
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    expect.stringContaining('Rental_agreement.pdf'),
    expect.objectContaining({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }),
  );
  expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
});

it('on Android, downloads with the token and hands the file to a viewer app', async () => {
  onPlatform('android');
  await openDocumentOnDevice(doc);

  const download = (File as unknown as { downloadFileAsync: jest.Mock }).downloadFileAsync;
  expect(download).toHaveBeenCalledWith(
    doc.url,
    expect.anything(),
    expect.objectContaining({ headers: { Authorization: 'Bearer access-1' } }),
  );
  expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
    'android.intent.action.VIEW',
    expect.objectContaining({ type: 'application/pdf', flags: 1 }),
  );
});

it('never sends the token to a URL on another host', async () => {
  await openDocumentOnDevice({ ...doc, url: 'https://files.example.com/a.pdf' });
  const download = (File as unknown as { downloadFileAsync: jest.Mock }).downloadFileAsync;
  expect(download.mock.calls[0][2].headers).toEqual({});
});

it('removes copies older than an hour before downloading another', async () => {
  const old = fakeFile('old.pdf', Date.now() - 2 * 60 * 60 * 1000);
  const recent = fakeFile('recent.pdf', Date.now() - 60 * 1000);
  folderFiles.push(old, recent);

  await openDocumentOnDevice(doc);

  expect(old.delete).toHaveBeenCalled();
  expect(recent.delete).not.toHaveBeenCalled();
});

it('clears every downloaded copy at sign-out', () => {
  folderFiles.push(fakeFile('a.pdf', Date.now()));
  clearOpenedDocuments();
  expect(folderDelete).toHaveBeenCalled();
  expect(folderFiles).toHaveLength(0);
});
