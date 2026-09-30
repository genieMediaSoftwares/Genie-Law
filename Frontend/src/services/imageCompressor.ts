import ImageResizer from '@bam.tech/react-native-image-resizer';

import type { ImageCompressionStep, PickedFile } from '../types/ai';

export const asJpegName = (name: string): string =>
  `${name.replace(/\.[^./\\]+$/, '') || 'image'}.jpg`;

export const imageCompressor = {
  async compress(file: PickedFile, step: ImageCompressionStep): Promise<PickedFile> {
    const result = await ImageResizer.createResizedImage(
      file.uri,
      step.maxDimension,
      step.maxDimension,
      'JPEG',
      Math.round(step.quality * 100),
      0,
      null,
      false,
      { mode: 'contain', onlyScaleDown: true },
    );

    return {
      uri: result.uri,
      name: asJpegName(file.name),
      type: 'image/jpeg',
      size: result.size,
    };
  },
};
