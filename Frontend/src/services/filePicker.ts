import { NativeModules, TurboModuleRegistry } from 'react-native';
import { UPLOAD_LIMITS } from '../api/aiApi';
import type { PickedFile } from '../types/ai';

const isRNDocumentPickerAvailable = Boolean(
  TurboModuleRegistry?.get?.('RNDocumentPicker') ||
  NativeModules?.RNDocumentPicker
);

let rnDocumentPicker: any = null;
if (isRNDocumentPickerAvailable) {
  try {
    rnDocumentPicker = require('@react-native-documents/picker');
  } catch {
    rnDocumentPicker = null;
  }
}

function getExpoDocumentPicker(): any {
  try {
    return require('expo-document-picker');
  } catch {
    return null;
  }
}

export const filePicker = {
  async pickDocuments(remainingSlots: number): Promise<PickedFile[]> {
    if (remainingSlots <= 0) {
      return [];
    }

    if (isRNDocumentPickerAvailable && rnDocumentPicker?.pick) {
      try {
        const DOCUMENT_TYPES = [
          rnDocumentPicker.types.pdf,
          rnDocumentPicker.types.docx,
          rnDocumentPicker.types.images,
          rnDocumentPicker.types.plainText,
          rnDocumentPicker.types.csv,
        ];

        const results = await rnDocumentPicker.pick({
          allowMultiSelection: remainingSlots > 1,
          type: DOCUMENT_TYPES,
        });

        return results.slice(0, remainingSlots).map((result: any) => ({
          uri: result.uri,
          name: result.name ?? 'document',
          type: result.type ?? null,
          size: result.size ?? null,
        }));
      } catch (error: any) {
        if (
          rnDocumentPicker.isErrorWithCode?.(error) &&
          error.code === rnDocumentPicker.errorCodes?.OPERATION_CANCELED
        ) {
          return [];
        }
        throw error;
      }
    } else {
      const expoPicker = getExpoDocumentPicker();
      if (!expoPicker?.getDocumentAsync) {
        return [];
      }
      // A picker failure is not a cancel: it propagates and the caller shows it.
      const result = await expoPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/*',
          'text/plain',
          'text/csv',
        ],
        multiple: remainingSlots > 1,
      });

      if (result.canceled || !result.assets) {
        return [];
      }

      return result.assets.slice(0, remainingSlots).map((asset: any) => ({
        uri: asset.uri,
        name: asset.name ?? 'document',
        type: asset.mimeType ?? null,
        size: asset.size ?? null,
      }));
    }
  },

  async pickImage(): Promise<PickedFile | null> {
    if (isRNDocumentPickerAvailable && rnDocumentPicker?.pick) {
      try {
        const [result] = await rnDocumentPicker.pick({
          allowMultiSelection: false,
          type: [rnDocumentPicker.types.images],
        });

        if (!result) {
          return null;
        }

        return {
          uri: result.uri,
          name: result.name ?? 'photo.jpg',
          type: result.type ?? 'image/jpeg',
          size: result.size ?? null,
        };
      } catch (error: any) {
        if (
          rnDocumentPicker.isErrorWithCode?.(error) &&
          error.code === rnDocumentPicker.errorCodes?.OPERATION_CANCELED
        ) {
          return null;
        }
        throw error;
      }
    } else {
      const expoPicker = getExpoDocumentPicker();
      if (!expoPicker?.getDocumentAsync) {
        return null;
      }
      // A picker failure is not a cancel: it propagates and the caller shows it.
      const result = await expoPicker.getDocumentAsync({
        type: 'image/*',
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.name ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
        size: asset.size ?? null,
      };
    }
  },

  maxFileBytes: UPLOAD_LIMITS.maxFileBytes,
};
