import { useEffect, useState, useCallback, useRef } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { Header } from './components/Header';
import { FileUploader } from './components/FileUploader';
import { LabelPreview } from './components/LabelPreview';
import { PrintSettings } from './components/PrintSettings';
import { PrintActionBar } from './components/PrintActionBar';

import {
  printerService,
  type PrinterState,
} from './services/printerConnection';
import {
  loadPdfDocument,
  renderPdfPage,
  type PdfDocumentInfo,
} from './services/pdfService';
import {
  processLabelCanvas,
  type ProcessImageOptions,
  type ProcessedLabelResult,
} from './services/imageProcessor';
import {
  buildRasterImageCommands,
  buildTestReceiptCommands,
  CMD,
} from './services/escpos';

import './App.css';

const DEFAULT_OPTIONS: ProcessImageOptions = {
  targetWidthDots: 576, // 80mm roll = 72mm printable width at 203 DPI (8 dots/mm)
  autoCrop: true,
  cropPadding: 8,
  rotation: 0,
  ditheringMode: 'threshold',
  threshold: 150,
  contrast: 15,
  invert: false,
};

export default function App() {
  const [printerState, setPrinterState] = useState<PrinterState>(printerService.getState());
  const [pdfInfo, setPdfInfo] = useState<PdfDocumentInfo | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [originalCanvas, setOriginalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [processedResult, setProcessedResult] = useState<ProcessedLabelResult | null>(null);

  const [options, setOptions] = useState<ProcessImageOptions>(DEFAULT_OPTIONS);
  const [feedLines, setFeedLines] = useState<number>(4);
  const [autoCut, setAutoCut] = useState<boolean>(true);

  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [bannerAlert, setBannerAlert] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const processingTimeoutRef = useRef<number | null>(null);

  // Subscribe to printer state
  useEffect(() => {
    const unsubscribe = printerService.subscribe((state) => {
      setPrinterState(state);
      if (state.errorMessage) {
        setBannerAlert({ type: 'error', message: state.errorMessage });
      }
    });
    return unsubscribe;
  }, []);

  // Process label image whenever options or original canvas change
  const runImageProcessing = useCallback((canvas: HTMLCanvasElement, currentOpts: ProcessImageOptions) => {
    setIsProcessing(true);
    if (processingTimeoutRef.current) {
      window.clearTimeout(processingTimeoutRef.current);
    }

    // Small debounced async frame so UI doesn't hitch
    processingTimeoutRef.current = window.setTimeout(() => {
      try {
        const result = processLabelCanvas(canvas, currentOpts);
        setProcessedResult(result);
      } catch (err: unknown) {
        console.error('Failed to process image:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 40);
  }, []);

  // Render current page when pdfDoc or currentPage changes
  const renderCurrentPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    setIsLoadingPdf(true);
    try {
      const renderRes = await renderPdfPage(doc, pageNum, 2.5);
      setOriginalCanvas(renderRes.canvas);
      runImageProcessing(renderRes.canvas, options);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBannerAlert({ type: 'error', message: `Failed to render PDF page: ${msg}` });
    } finally {
      setIsLoadingPdf(false);
    }
  }, [options, runImageProcessing]);

  // Load PDF from File object
  const handleFileSelected = async (file: File) => {
    setIsLoadingPdf(true);
    setBannerAlert(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { info, pdfDoc: doc } = await loadPdfDocument(arrayBuffer, file.name, file.size);
      setPdfInfo(info);
      setPdfDoc(doc);
      setCurrentPage(1);
      await renderCurrentPage(doc, 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBannerAlert({ type: 'error', message: `Could not load PDF: ${msg}` });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Load the bundled Shopee sample label
  const handleLoadSample = useCallback(async () => {
    setIsLoadingPdf(true);
    setBannerAlert(null);
    try {
      const response = await fetch('/print-label.pdf');
      if (!response.ok) {
        throw new Error(`Failed to fetch /print-label.pdf (HTTP ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const { info, pdfDoc: doc } = await loadPdfDocument(arrayBuffer, 'print-label.pdf', arrayBuffer.byteLength);
      setPdfInfo(info);
      setPdfDoc(doc);
      setCurrentPage(1);
      await renderCurrentPage(doc, 1);
      setBannerAlert({ type: 'info', message: 'Loaded Shopee sample label (print-label.pdf)' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBannerAlert({ type: 'error', message: `Failed to load sample: ${msg}` });
    } finally {
      setIsLoadingPdf(false);
    }
  }, [renderCurrentPage]);

  // Preload sample on initial mount
  useEffect(() => {
    let isMounted = true;
    fetch('/print-label.pdf')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        if (!isMounted) return;
        const { info, pdfDoc: doc } = await loadPdfDocument(arrayBuffer, 'print-label.pdf', arrayBuffer.byteLength);
        if (!isMounted) return;
        setPdfInfo(info);
        setPdfDoc(doc);
        setCurrentPage(1);
        const renderRes = await renderPdfPage(doc, 1, 2.5);
        if (!isMounted) return;
        setOriginalCanvas(renderRes.canvas);
        const result = processLabelCanvas(renderRes.canvas, DEFAULT_OPTIONS);
        setProcessedResult(result);
      })
      .catch((err: unknown) => {
        console.warn('Initial sample load skipped or unavailable:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle page change in multi-page document
  const handlePageChange = async (newPage: number) => {
    if (!pdfDoc || newPage < 1 || newPage > (pdfInfo?.numPages ?? 1)) return;
    setCurrentPage(newPage);
    await renderCurrentPage(pdfDoc, newPage);
  };

  // Handle options change
  const handleOptionsChange = (newOpts: Partial<ProcessImageOptions>) => {
    const updated = { ...options, ...newOpts };
    setOptions(updated);
    if (originalCanvas) {
      runImageProcessing(originalCanvas, updated);
    }
  };

  // Clear loaded document
  const handleClear = () => {
    setPdfInfo(null);
    setPdfDoc(null);
    setOriginalCanvas(null);
    setProcessedResult(null);
  };

  // Printer Connections
  const handleConnectBle = async () => {
    setBannerAlert(null);
    try {
      await printerService.connectBluetooth();
      setBannerAlert({ type: 'success', message: 'Connected to XPrinter XP80-T via Bluetooth!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('cancel')) {
        setBannerAlert({ type: 'error', message: `Bluetooth connection failed: ${msg}` });
      }
    }
  };

  const handleConnectSerial = async () => {
    setBannerAlert(null);
    try {
      await printerService.connectSerial();
      setBannerAlert({ type: 'success', message: 'Connected to XPrinter XP80-T via Serial (SPP/USB)!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('cancel')) {
        setBannerAlert({ type: 'error', message: `Serial connection failed: ${msg}` });
      }
    }
  };

  const handleDisconnect = async () => {
    await printerService.disconnect();
    setBannerAlert({ type: 'info', message: 'Printer disconnected.' });
  };

  // Printing actions
  const handlePrintLabel = async () => {
    if (!processedResult) {
      setBannerAlert({ type: 'error', message: 'No label processed to print.' });
      return;
    }

    if (printerState.status !== 'connected') {
      // Prompt user to connect
      try {
        await printerService.connectBluetooth();
      } catch {
        return;
      }
    }

    try {
      const commands = buildRasterImageCommands(
        processedResult.bitmapData,
        processedResult.widthDots,
        processedResult.heightDots,
        { feedLines, cutPaper: autoCut, sliceHeight: 256 }
      );
      await printerService.send(commands);
      setBannerAlert({ type: 'success', message: 'Label sent to XPrinter XP80-T successfully!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBannerAlert({ type: 'error', message: `Print failed: ${msg}` });
    }
  };

  const handleTestPrint = async () => {
    if (printerState.status !== 'connected') return;
    try {
      const testCmds = buildTestReceiptCommands();
      await printerService.send(testCmds);
      setBannerAlert({ type: 'success', message: 'Test receipt sent successfully!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBannerAlert({ type: 'error', message: `Test print error: ${msg}` });
    }
  };

  const handleFeedPaper = async () => {
    if (printerState.status !== 'connected') return;
    try {
      await printerService.send(new Uint8Array(CMD.FEED(8)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBannerAlert({ type: 'error', message: `Feed failed: ${msg}` });
    }
  };

  const handleCutPaper = async () => {
    if (printerState.status !== 'connected') return;
    try {
      await printerService.send(new Uint8Array(CMD.CUT));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBannerAlert({ type: 'error', message: `Cut failed: ${msg}` });
    }
  };

  const handleSystemPrint = () => {
    window.print();
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <Header
        printerState={printerState}
        onConnectBle={handleConnectBle}
        onConnectSerial={handleConnectSerial}
        onDisconnect={handleDisconnect}
      />

      {/* Alert Banner */}
      {bannerAlert && (
        <div className={`app-alert alert-${bannerAlert.type}`}>
          <span>{bannerAlert.message}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setBannerAlert(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="app-main">
        {/* Left Column: Upload & Settings */}
        <section className="column-left">
          <FileUploader
            pdfInfo={pdfInfo}
            currentPage={currentPage}
            isLoading={isLoadingPdf}
            onFileSelected={handleFileSelected}
            onLoadSample={handleLoadSample}
            onPageChange={handlePageChange}
            onClear={handleClear}
          />

          <PrintSettings
            options={options}
            feedLines={feedLines}
            autoCut={autoCut}
            onOptionsChange={handleOptionsChange}
            onFeedLinesChange={setFeedLines}
            onAutoCutChange={setAutoCut}
            onResetDefaults={() => handleOptionsChange(DEFAULT_OPTIONS)}
          />
        </section>

        {/* Right Column: Label Preview & Print Actions */}
        <section className="column-right">
          <LabelPreview
            originalCanvas={originalCanvas}
            processedResult={processedResult}
            isProcessing={isProcessing}
          />

          <PrintActionBar
            printerState={printerState}
            hasLabel={Boolean(processedResult)}
            onPrintLabel={handlePrintLabel}
            onTestPrint={handleTestPrint}
            onFeedPaper={handleFeedPaper}
            onCutPaper={handleCutPaper}
            onSystemPrint={handleSystemPrint}
            onConnectPrompt={handleConnectBle}
          />
        </section>
      </main>

      {/* Hidden printable area for system print dialog */}
      <div id="print-area" className="printable-only">
        {processedResult?.previewCanvas && (
          <img
            src={processedResult.previewCanvas.toDataURL()}
            alt="Shopee Shipping Label"
            style={{ width: '80mm', display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}
