import type { ImageCompressionStep, PickedFile } from '../types/ai';
import i18n from '../i18n';

export const asJpegName = (name: string): string =>
  `${name.replace(/\.[^./\\]+$/, '') || 'image'}.jpg`;

const loadImage = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(i18n.t('documents:files.imageUnreadable')));
    };
    image.src = url;
  });

const toJpeg = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error(i18n.t('documents:files.imageNotCompressed')))),
      'image/jpeg',
      quality,
    );
  });

export const imageCompressor = {
  async compress(file: PickedFile, step: ImageCompressionStep): Promise<PickedFile> {
    if (!(file.file instanceof Blob)) {
      throw new Error(i18n.t('documents:files.imageUnreadable'));
    }

    const image = await loadImage(file.file);
    const scale = Math.min(
      1,
      step.maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(i18n.t('documents:files.imageNotCompressed'));
    }
    // JPEG has no transparency; paper-white keeps scanned pages legible.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await toJpeg(canvas, step.quality);
    const name = asJpegName(file.name);

    return {
      uri: '',
      name,
      type: 'image/jpeg',
      size: blob.size,
      file: new File([blob], name, { type: 'image/jpeg' }),
    };
  },
};
