export type DitheringMode = 'threshold' | 'floyd-steinberg' | 'atkinson';
export type RotationAngle = 0 | 90 | 180 | 270;

export interface ProcessImageOptions {
  targetWidthDots?: number; // default 576 for 80mm thermal roll (72mm printable)
  autoCrop?: boolean;
  cropPadding?: number; // padding in px after auto-crop
  rotation?: RotationAngle;
  ditheringMode?: DitheringMode;
  threshold?: number; // 0 to 255, default 150
  contrast?: number; // -100 to 100, default 0
  invert?: boolean;
}

export interface ProcessedLabelResult {
  widthDots: number;
  heightDots: number;
  bitmapData: Uint8Array;
  previewCanvas: HTMLCanvasElement;
  originalWidth: number;
  originalHeight: number;
  cropBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Finds the bounding box of non-white content on a canvas.
 */
export function findContentBoundingBox(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  whiteThreshold = 245
): { x: number; y: number; width: number; height: number } | null {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // If pixel is not transparent and not white
      if (a > 30 && (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    return null; // Empty page
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Applies contrast adjustment to grayscale value (0-255).
 */
function applyContrast(val: number, contrast: number): number {
  if (contrast === 0) return val;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return Math.min(255, Math.max(0, factor * (val - 128) + 128));
}

/**
 * Processes a source canvas into a 1-bit thermal print bitmap and a preview canvas.
 */
export function processLabelCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: ProcessImageOptions = {}
): ProcessedLabelResult {
  const {
    targetWidthDots = 576,
    autoCrop = true,
    cropPadding = 8,
    rotation = 0,
    ditheringMode = 'threshold',
    threshold = 150,
    contrast = 15,
    invert = false,
  } = options;

  const srcCtx = sourceCanvas.getContext('2d')!;
  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;

  // 1. Auto-crop detection if enabled
  let cropX = 0;
  let cropY = 0;
  let cropW = srcWidth;
  let cropH = srcHeight;
  let detectedCropBox: { x: number; y: number; width: number; height: number } | undefined;

  if (autoCrop) {
    const bbox = findContentBoundingBox(srcCtx, srcWidth, srcHeight);
    if (bbox && bbox.width > 50 && bbox.height > 50) {
      detectedCropBox = bbox;
      cropX = Math.max(0, bbox.x - cropPadding);
      cropY = Math.max(0, bbox.y - cropPadding);
      cropW = Math.min(srcWidth - cropX, bbox.width + cropPadding * 2);
      cropH = Math.min(srcHeight - cropY, bbox.height + cropPadding * 2);
    }
  }

  // 2. Handle Rotation
  // When rotating 90 or 270, width and height swap
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const intermediateW = isRotated90or270 ? cropH : cropW;
  const intermediateH = isRotated90or270 ? cropW : cropH;

  // Calculate target dimensions (width scaled to targetWidthDots, preserving aspect ratio)
  const scale = targetWidthDots / intermediateW;
  const finalWidth = targetWidthDots;
  const finalHeight = Math.max(1, Math.round(intermediateH * scale));

  // Render cropped and rotated image onto offscreen canvas at final resolution
  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = finalWidth;
  renderCanvas.height = finalHeight;
  const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true })!;

  // Fill with white background
  renderCtx.fillStyle = '#FFFFFF';
  renderCtx.fillRect(0, 0, finalWidth, finalHeight);

  renderCtx.save();
  // Apply rotation
  if (rotation === 90) {
    renderCtx.translate(finalWidth, 0);
    renderCtx.rotate(Math.PI / 2);
    renderCtx.drawImage(
      sourceCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, finalHeight, finalWidth
    );
  } else if (rotation === 180) {
    renderCtx.translate(finalWidth, finalHeight);
    renderCtx.rotate(Math.PI);
    renderCtx.drawImage(
      sourceCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, finalWidth, finalHeight
    );
  } else if (rotation === 270) {
    renderCtx.translate(0, finalHeight);
    renderCtx.rotate(-Math.PI / 2);
    renderCtx.drawImage(
      sourceCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, finalHeight, finalWidth
    );
  } else {
    renderCtx.drawImage(
      sourceCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, finalWidth, finalHeight
    );
  }
  renderCtx.restore();

  // 3. Extract pixel data for grayscale conversion and binarization
  const imgData = renderCtx.getImageData(0, 0, finalWidth, finalHeight);
  const pixels = imgData.data;
  const totalPixels = finalWidth * finalHeight;

  // Create 2D float array for grayscale values to support error diffusion dithering
  const grayBuffer = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const a = pixels[idx + 3] / 255;

    // Blend with white if translucent
    const blendedR = r * a + 255 * (1 - a);
    const blendedG = g * a + 255 * (1 - a);
    const blendedB = b * a + 255 * (1 - a);

    // Standard perceived luminance
    let luma = 0.299 * blendedR + 0.587 * blendedG + 0.114 * blendedB;
    luma = applyContrast(luma, contrast);
    grayBuffer[i] = luma;
  }

  // 4. Binarize and pack into 1-bit bitmap data for ESC/POS
  // 1 = black (thermal head burns), 0 = white
  const bytesPerRow = Math.ceil(finalWidth / 8);
  const bitmapData = new Uint8Array(bytesPerRow * finalHeight);

  // Also prepare preview canvas data (RGB)
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = finalWidth;
  previewCanvas.height = finalHeight;
  const previewCtx = previewCanvas.getContext('2d')!;
  const previewImgData = previewCtx.createImageData(finalWidth, finalHeight);
  const previewPixels = previewImgData.data;

  const setBitmapPixel = (x: number, y: number, isBlack: boolean) => {
    const actualIsBlack = invert ? !isBlack : isBlack;
    if (actualIsBlack) {
      const byteIdx = y * bytesPerRow + (x >> 3);
      const bitIdx = 7 - (x & 7);
      bitmapData[byteIdx] |= 1 << bitIdx;
    }

    // Set preview pixel (monochrome)
    const pIdx = (y * finalWidth + x) * 4;
    const color = actualIsBlack ? 15 : 250; // Dark charcoal vs off-white for realistic thermal preview
    previewPixels[pIdx] = color;
    previewPixels[pIdx + 1] = color;
    previewPixels[pIdx + 2] = color;
    previewPixels[pIdx + 3] = 255;
  };

  if (ditheringMode === 'threshold') {
    // Pure threshold: critical for barcodes and text sharpness
    for (let y = 0; y < finalHeight; y++) {
      for (let x = 0; x < finalWidth; x++) {
        const i = y * finalWidth + x;
        const isBlack = grayBuffer[i] < threshold;
        setBitmapPixel(x, y, isBlack);
      }
    }
  } else if (ditheringMode === 'floyd-steinberg') {
    // Floyd-Steinberg error diffusion
    for (let y = 0; y < finalHeight; y++) {
      for (let x = 0; x < finalWidth; x++) {
        const i = y * finalWidth + x;
        const oldVal = grayBuffer[i];
        const isBlack = oldVal < threshold;
        const newVal = isBlack ? 0 : 255;
        const err = oldVal - newVal;

        setBitmapPixel(x, y, isBlack);

        // Distribute error
        if (x + 1 < finalWidth) grayBuffer[i + 1] += (err * 7) / 16;
        if (x - 1 >= 0 && y + 1 < finalHeight) grayBuffer[i + finalWidth - 1] += (err * 3) / 16;
        if (y + 1 < finalHeight) grayBuffer[i + finalWidth] += (err * 5) / 16;
        if (x + 1 < finalWidth && y + 1 < finalHeight) grayBuffer[i + finalWidth + 1] += (err * 1) / 16;
      }
    }
  } else if (ditheringMode === 'atkinson') {
    // Atkinson error diffusion (diffuses 6/8 of the error for higher contrast)
    for (let y = 0; y < finalHeight; y++) {
      for (let x = 0; x < finalWidth; x++) {
        const i = y * finalWidth + x;
        const oldVal = grayBuffer[i];
        const isBlack = oldVal < threshold;
        const newVal = isBlack ? 0 : 255;
        const err = Math.round((oldVal - newVal) / 8);

        setBitmapPixel(x, y, isBlack);

        if (x + 1 < finalWidth) grayBuffer[i + 1] += err;
        if (x + 2 < finalWidth) grayBuffer[i + 2] += err;
        if (x - 1 >= 0 && y + 1 < finalHeight) grayBuffer[i + finalWidth - 1] += err;
        if (y + 1 < finalHeight) grayBuffer[i + finalWidth] += err;
        if (x + 1 < finalWidth && y + 1 < finalHeight) grayBuffer[i + finalWidth + 1] += err;
        if (y + 2 < finalHeight) grayBuffer[i + finalWidth * 2] += err;
      }
    }
  }

  previewCtx.putImageData(previewImgData, 0, 0);

  return {
    widthDots: finalWidth,
    heightDots: finalHeight,
    bitmapData,
    previewCanvas,
    originalWidth: srcWidth,
    originalHeight: srcHeight,
    cropBox: detectedCropBox,
  };
}
