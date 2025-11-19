/**
 * Face augmentation utilities for generating synthetic variations
 * Improves matching accuracy by creating diverse training samples
 */

export interface AugmentationOptions {
  enableMirror?: boolean;
  enableBrightness?: boolean;
  enableContrast?: boolean;
  enableRotation?: boolean;
  brightnessLevels?: number[];
  contrastLevels?: number[];
  rotationAngles?: number[];
}

const defaultOptions: AugmentationOptions = {
  enableMirror: true,
  enableBrightness: true,
  enableContrast: true,
  enableRotation: true,
  brightnessLevels: [-30, 30],
  contrastLevels: [0.8, 1.2],
  rotationAngles: [-5, 5],
};

/**
 * Generate augmented versions of an image for robust face matching
 */
export async function augmentImage(
  imageDataUrl: string,
  options: AugmentationOptions = defaultOptions
): Promise<string[]> {
  const augmented: string[] = [imageDataUrl]; // Include original

  // Load image
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('Failed to get canvas context for augmentation');
    return augmented;
  }

  canvas.width = img.width;
  canvas.height = img.height;

  // Mirror (horizontal flip)
  if (options.enableMirror) {
    augmented.push(await createMirroredImage(img, canvas, ctx));
  }

  // Brightness variations
  if (options.enableBrightness && options.brightnessLevels) {
    for (const level of options.brightnessLevels) {
      augmented.push(await adjustBrightness(img, canvas, ctx, level));
    }
  }

  // Contrast variations
  if (options.enableContrast && options.contrastLevels) {
    for (const level of options.contrastLevels) {
      augmented.push(await adjustContrast(img, canvas, ctx, level));
    }
  }

  // Rotation variations (small angles to simulate different head poses)
  if (options.enableRotation && options.rotationAngles) {
    for (const angle of options.rotationAngles) {
      augmented.push(await rotateImage(img, canvas, ctx, angle));
    }
  }

  // Combined transformations for more diversity
  if (options.enableMirror && options.enableBrightness && options.brightnessLevels) {
    // Mirrored + brightness adjusted
    const mirroredBright = await createMirroredImage(img, canvas, ctx);
    const mirroredBrightImg = await loadImage(mirroredBright);
    augmented.push(
      await adjustBrightness(mirroredBrightImg, canvas, ctx, options.brightnessLevels[0])
    );
  }

  return augmented;
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Create horizontally mirrored version
 */
async function createMirroredImage(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<string> {
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Adjust image brightness
 */
async function adjustBrightness(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  adjustment: number
): Promise<string> {
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Adjust RGB values
    data[i] = Math.max(0, Math.min(255, data[i] + adjustment)); // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)); // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)); // B
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Adjust image contrast
 */
async function adjustContrast(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  factor: number
): Promise<string> {
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Adjust RGB values around midpoint
    data[i] = Math.max(0, Math.min(255, (data[i] - 128) * factor + 128)); // R
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * factor + 128)); // G
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * factor + 128)); // B
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Rotate image by small angle
 */
async function rotateImage(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  angleDegrees: number
): Promise<string> {
  const angleRadians = (angleDegrees * Math.PI) / 180;

  // Calculate new canvas size to fit rotated image
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  const newWidth = Math.abs(img.width * cos) + Math.abs(img.height * sin);
  const newHeight = Math.abs(img.width * sin) + Math.abs(img.height * cos);

  canvas.width = newWidth;
  canvas.height = newHeight;

  ctx.save();
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(angleRadians);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Generate multiple augmented descriptors from a single photo
 * This is called from the popup when adding reference faces
 */
export async function generateAugmentedDescriptors(
  imageDataUrl: string,
  extractDescriptor: (dataUrl: string) => Promise<any>,
  options?: AugmentationOptions
): Promise<any[]> {
  const descriptors: any[] = [];
  const augmentedImages = await augmentImage(imageDataUrl, options);

  console.log(`Generating ${augmentedImages.length} augmented versions`);

  for (let i = 0; i < augmentedImages.length; i++) {
    const descriptor = await extractDescriptor(augmentedImages[i]);
    if (descriptor) {
      descriptors.push(descriptor);
    }
  }

  console.log(`Successfully extracted ${descriptors.length} descriptors`);
  return descriptors;
}

/**
 * Advanced augmentation: color space transformations
 */
export async function applyColorSpaceTransform(
  imageDataUrl: string,
  transform: 'grayscale' | 'sepia' | 'hue-shift'
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return imageDataUrl;

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    switch (transform) {
      case 'grayscale':
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = data[i + 1] = data[i + 2] = gray;
        break;

      case 'sepia':
        data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        break;

      case 'hue-shift':
        // Simple hue shift by rotating RGB values
        data[i] = g;
        data[i + 1] = b;
        data[i + 2] = r;
        break;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Estimate quality of augmented image for face detection
 */
export async function estimateImageQuality(imageDataUrl: string): Promise<number> {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return 0;

  canvas.width = Math.min(200, img.width);
  canvas.height = Math.min(200, img.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Calculate basic quality metrics
  let totalVariance = 0;
  let totalBrightness = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalBrightness += brightness;
  }

  const avgBrightness = totalBrightness / pixelCount;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalVariance += Math.pow(brightness - avgBrightness, 2);
  }

  const variance = totalVariance / pixelCount;

  // Score based on brightness and contrast
  let score = 1.0;

  // Penalize very dark or very bright images
  if (avgBrightness < 50) score *= 0.7;
  else if (avgBrightness > 200) score *= 0.8;

  // Reward good contrast
  if (variance > 1000) score *= 1.2;
  else if (variance < 100) score *= 0.6;

  return Math.max(0, Math.min(1, score));
}
