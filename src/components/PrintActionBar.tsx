import React from 'react';
import { Printer, Loader2, Play, Scissors, MoveDown, HelpCircle, FileCheck } from 'lucide-react';
import type { PrinterState } from '../services/printerConnection';

interface PrintActionBarProps {
  printerState: PrinterState;
  hasLabel: boolean;
  onPrintLabel: () => void;
  onTestPrint: () => void;
  onFeedPaper: () => void;
  onCutPaper: () => void;
  onSystemPrint: () => void;
  onConnectPrompt: () => void;
}

export const PrintActionBar: React.FC<PrintActionBarProps> = ({
  printerState,
  hasLabel,
  onPrintLabel,
  onTestPrint,
  onFeedPaper,
  onCutPaper,
  onSystemPrint,
  onConnectPrompt,
}) => {
  const isConnected = printerState.status === 'connected' || printerState.status === 'printing';
  const isPrinting = printerState.status === 'printing';

  return (
    <div className="action-bar-container">
      {/* Bluetooth connection prompt banner if disconnected */}
      {!isConnected && (
        <div className="connection-prompt-card">
          <div className="prompt-content">
            <HelpCircle size={20} className="prompt-icon" />
            <div>
              <strong>XPrinter XP80-T is not connected</strong>
              <p>
                Turn on your XP80-T printer and connect via Bluetooth (BLE) or Serial (Bluetooth SPP / USB).
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={onConnectPrompt}>
            Connect Now
          </button>
        </div>
      )}

      {/* Printing Progress Bar */}
      {isPrinting && (
        <div className="progress-card">
          <div className="progress-info">
            <span className="progress-title">
              <Loader2 className="spin" size={16} />
              Sending raster image chunks to XPrinter XP80-T...
            </span>
            <span className="progress-value">{printerState.progress}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${printerState.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="action-buttons-row">
        {/* Main Print Button */}
        <button
          type="button"
          className="btn btn-xl btn-success print-main-btn"
          disabled={!hasLabel || isPrinting}
          onClick={onPrintLabel}
        >
          {isPrinting ? (
            <>
              <Loader2 className="spin" size={22} />
              <span>Printing to XP80-T ({printerState.progress}%)...</span>
            </>
          ) : (
            <>
              <Printer size={22} />
              <span>Print Label (80mm)</span>
            </>
          )}
        </button>

        {/* Secondary Utility Controls */}
        <div className="utility-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!isConnected || isPrinting}
            onClick={onTestPrint}
            title="Prints diagnostic test receipt to verify connection and print alignment"
          >
            <Play size={16} />
            <span>Test Print</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={!isConnected || isPrinting}
            onClick={onFeedPaper}
            title="Feed 30mm of paper roll"
          >
            <MoveDown size={16} />
            <span>Feed 30mm</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={!isConnected || isPrinting}
            onClick={onCutPaper}
            title="Trigger auto-cutter"
          >
            <Scissors size={16} />
            <span>Cut Paper</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            disabled={!hasLabel}
            onClick={onSystemPrint}
            title="Fallback: Print using system print dialog configured for 80mm roll"
          >
            <FileCheck size={16} />
            <span>System Print Dialog</span>
          </button>
        </div>
      </div>
    </div>
  );
};
