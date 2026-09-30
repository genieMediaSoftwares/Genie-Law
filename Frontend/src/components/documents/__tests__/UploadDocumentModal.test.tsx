import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { UploadDocumentModal } from '../UploadDocumentModal';
import { filePicker } from '../../../services/filePicker';
import type { PickedFile } from '../../../types/ai';

jest.mock('../../../services/secureStorage', () =>
  require('../../../test-utils/memorySecureStorage'),
);
jest.mock('../../../services/filePicker', () => ({
  filePicker: { pickDocuments: jest.fn(), pickImage: jest.fn(), maxFileBytes: 10 * 1024 * 1024 },
}));

const pick = filePicker.pickDocuments as jest.Mock;
const pdf: PickedFile = {
  uri: 'content://com.android.providers.downloads/document/42',
  name: 'Sale deed.pdf',
  type: 'application/pdf',
  size: 850_000,
};

const renderModal = (onUpload: jest.Mock, onClose = jest.fn()) =>
  render(<UploadDocumentModal visible onClose={onClose} onUpload={onUpload} />);

it('shows the upload error and keeps the file for a retry', async () => {
  pick.mockResolvedValue([pdf]);
  const onUpload = jest
    .fn()
    .mockRejectedValueOnce(new Error('The file is too large to upload.'))
    .mockResolvedValueOnce(undefined);
  const onClose = jest.fn();
  await renderModal(onUpload, onClose);

  await fireEvent.press(screen.getByLabelText('Tap to upload document'));
  await fireEvent.press(await screen.findByText('Upload Now'));

  expect(await screen.findByText('The file is too large to upload.')).toBeOnTheScreen();
  expect(screen.getByText('Sale deed.pdf')).toBeOnTheScreen();
  expect(onClose).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText('Upload Now'));
  await screen.findByText('Tap to upload');
  expect(onUpload).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalled();
});

it('rejects a file over the size limit before uploading', async () => {
  pick.mockResolvedValue([{ ...pdf, size: 40 * 1024 * 1024 }]);
  const onUpload = jest.fn();
  await renderModal(onUpload);

  await fireEvent.press(screen.getByLabelText('Tap to upload document'));

  expect(await screen.findByText(/MB/)).toBeOnTheScreen();
  expect(screen.queryByText('Upload Now')).toBeNull();
  expect(onUpload).not.toHaveBeenCalled();
});

it('shows a picker failure instead of treating it as a cancel', async () => {
  pick.mockRejectedValue(new Error('Storage is not available.'));
  await renderModal(jest.fn());
  await fireEvent.press(screen.getByLabelText('Tap to upload document'));
  expect(await screen.findByText('Storage is not available.')).toBeOnTheScreen();
});

it('uploads the picked file once and closes only after the backend confirms', async () => {
  pick.mockResolvedValue([pdf]);
  let confirm!: () => void;
  const onUpload = jest.fn(() => new Promise<void>(resolve => (confirm = resolve)));
  const onClose = jest.fn();
  await renderModal(onUpload, onClose);

  await fireEvent.press(screen.getByLabelText('Tap to upload document'));
  expect(await screen.findByText('Sale deed.pdf')).toBeOnTheScreen();

  // Two taps before the screen can re-render (a fast double tap).
  const taps = Promise.all([
    fireEvent.press(screen.getByText('Upload Now')),
    fireEvent.press(screen.getByText('Upload Now')),
  ]);
  await Promise.resolve();
  expect(onUpload).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();

  confirm();
  await taps;
  await screen.findByText('Tap to upload');
  expect(onClose).toHaveBeenCalledTimes(1);
});
