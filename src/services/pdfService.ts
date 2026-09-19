import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfDocumentInfo {
  numPages: number;
  fileName: string;
  fileSize: number;
}

export interface RenderPageResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pageNumber: number;
}

let activePdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

/**
 * Loads a PDF document from an ArrayBuffer or URL.
 */
export async function loadPdfDocument(
  source: ArrayBuffer | string,
  fileName = 'document.pdf',
  fileSize = 0
): Promise<{ info: PdfDocumentInfo; pdfDoc: pdfjsLib.PDFDocumentProxy }> {
  if (activePdfDoc) {
    try {
      activePdfDoc.destroy();
    } catch {
      // ignore
    }
  }

  const loadingTask = typeof source === 'string'
    ? pdfjsLib.getDocument(source)
    : pdfjsLib.getDocument({ data: source });

  const pdfDoc = await loadingTask.promise;
  activePdfDoc = pdfDoc;

  return {
    info: {
      numPages: pdfDoc.numPages,
      fileName,
      fileSize,
    },
    pdfDoc,
  };
}

/**
 * Renders a specific PDF page to an HTMLCanvasElement with high DPI scaling.
 * 
 * @param pdfDoc The loaded PDF document proxy
 * @param pageNumber 1-based page index
 * @param scale Quality scale factor (default 2.5 for crisp vector rendering of barcodes and text)
 */
export async function renderPdfPage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber = 1,
  scale = 2.5
): Promise<RenderPageResult> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to create canvas 2D context');
  }

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport,
  };

  await page.render(renderContext).promise;

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    pageNumber,
  };
}
