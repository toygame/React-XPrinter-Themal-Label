export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;

export const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  FEED: (n: number) => [ESC, 0x64, n],
  CUT: [GS, 0x56, 0x41, 0x00], // Full cut Function A
  CUT_PARTIAL: [GS, 0x56, 0x42, 0x00], // Partial cut Function B
  LINE_SPACING_0: [ESC, 0x33, 0x00],
  LINE_SPACING_DEFAULT: [ESC, 0x32],
} as const;

export interface EscPosPrintOptions {
  feedLines?: number;
  cutPaper?: boolean;
  sliceHeight?: number; // dots per raster slice, default 256
}

/**
 * Encodes plain text string to Uint8Array using TextEncoder.
 */
export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Builds ESC/POS commands to print a 1-bit raster image (GS v 0).
 *
 * @param bitmapData Uint8Array of packed 1-bit dots (1 = black, 0 = white).
 *                   Length must be (widthDots / 8) * heightDots.
 * @param widthDots Image width in dots (must be multiple of 8, typically 576 for 80mm paper).
 * @param heightDots Image height in dots.
 * @param options Printing options (feed lines, cut, slice height).
 */
export function buildRasterImageCommands(
  bitmapData: Uint8Array,
  widthDots: number,
  heightDots: number,
  options: EscPosPrintOptions = {}
): Uint8Array {
  const { feedLines = 4, cutPaper = true, sliceHeight = 256 } = options;
  const bytesPerRow = Math.ceil(widthDots / 8);
  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;

  const chunks: number[] = [];

  // 1. Initialize printer and line spacing
  chunks.push(...CMD.INIT);
  chunks.push(...CMD.LINE_SPACING_0);
  chunks.push(...CMD.ALIGN_CENTER);

  // 2. Slice tall images into smaller vertical strips to avoid printer buffer overflow
  let yOffset = 0;
  while (yOffset < heightDots) {
    const currentSliceHeight = Math.min(sliceHeight, heightDots - yOffset);
    const yL = currentSliceHeight & 0xff;
    const yH = (currentSliceHeight >> 8) & 0xff;

    // GS v 0 0 xL xH yL yH
    chunks.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    const sliceStartByte = yOffset * bytesPerRow;
    const sliceEndByte = sliceStartByte + currentSliceHeight * bytesPerRow;
    const sliceBytes = bitmapData.subarray(sliceStartByte, sliceEndByte);

    // Push slice bytes
    for (let i = 0; i < sliceBytes.length; i++) {
      chunks.push(sliceBytes[i]);
    }

    yOffset += currentSliceHeight;
  }

  // 3. Reset line spacing & feed paper
  chunks.push(...CMD.LINE_SPACING_DEFAULT);
  if (feedLines > 0) {
    chunks.push(...CMD.FEED(feedLines));
  }

  // 4. Cut paper if requested
  if (cutPaper) {
    chunks.push(...CMD.CUT);
  }

  return new Uint8Array(chunks);
}

/**
 * Builds a test receipt to verify connection, print alignment, and auto-cut.
 */
export function buildTestReceiptCommands(): Uint8Array {
  const chunks: number[] = [];

  chunks.push(...CMD.INIT);
  chunks.push(...CMD.ALIGN_CENTER);
  chunks.push(...CMD.BOLD_ON);

  // Header
  const title = encodeText('*** XPRINTER XP80-T TEST ***\n');
  title.forEach((b) => chunks.push(b));

  chunks.push(...CMD.BOLD_OFF);
  const info1 = encodeText('Paper Width: 80mm (576 Dots)\n');
  const info2 = encodeText('Protocol: ESC/POS Raster Mode\n');
  const divider = encodeText('--------------------------------\n');

  info1.forEach((b) => chunks.push(b));
  info2.forEach((b) => chunks.push(b));
  divider.forEach((b) => chunks.push(b));

  // Alignment test
  chunks.push(...CMD.ALIGN_LEFT);
  const left = encodeText('Left-aligned text\n');
  left.forEach((b) => chunks.push(b));

  chunks.push(...CMD.ALIGN_CENTER);
  const center = encodeText('Center-aligned text\n');
  center.forEach((b) => chunks.push(b));

  chunks.push(...CMD.ALIGN_RIGHT);
  const right = encodeText('Right-aligned text\n');
  right.forEach((b) => chunks.push(b));

  chunks.push(...CMD.ALIGN_CENTER);
  divider.forEach((b) => chunks.push(b));

  // Date and status
  const now = new Date().toLocaleString();
  const timeText = encodeText(`Date: ${now}\nStatus: Ready for Shopee Labels\n\n`);
  timeText.forEach((b) => chunks.push(b));

  // Feed and cut
  chunks.push(...CMD.FEED(4));
  chunks.push(...CMD.CUT);

  return new Uint8Array(chunks);
}
