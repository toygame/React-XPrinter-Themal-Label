import React, { useEffect, useRef, useState } from 'react';
import { Eye, Printer, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { ProcessedLabelResult } from '../services/imageProcessor';

interface LabelPreviewProps {
  originalCanvas: HTMLCanvasElement | null;
  processedResult: ProcessedLabelResult | null;
  isProcessing: boolean;
}

export const LabelPreview: React.FC<LabelPreviewProps> = ({
  originalCanvas,
  processedResult,
  isProcessing,
}) => {
  const [activeTab, setActiveTab] = useState<'thermal' | 'original'>('thermal');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const thermalCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw processed preview canvas into DOM canvas
  useEffect(() => {
    const canvas = thermalCanvasRef.current;
    if (canvas && processedResult?.previewCanvas) {
      canvas.width = processedResult.previewCanvas.width;
      canvas.height = processedResult.previewCanvas.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(processedResult.previewCanvas, 0, 0);
    }
  }, [processedResult]);

  // Draw original canvas into DOM canvas
  useEffect(() => {
    const canvas = originalCanvasRef.current;
    if (canvas && originalCanvas) {
      canvas.width = originalCanvas.width;
      canvas.height = originalCanvas.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(originalCanvas, 0, 0);
    }
  }, [originalCanvas]);

  if (!originalCanvas) {
    return (
      <div className="preview-empty">
        <Printer size={48} className="preview-empty-icon" />
        <h3>No Label Loaded</h3>
        <p>Upload a PDF shipping label or click "Load sample" to start previewing.</p>
      </div>
    );
  }

  // Calculate paper dimensions in mm (203 DPI = 8 dots/mm)
  const widthMm = processedResult ? (processedResult.widthDots / 8).toFixed(1) : '72.0';
  const heightMm = processedResult ? (processedResult.heightDots / 8).toFixed(1) : '0';

  return (
    <div className="preview-card">
      <div className="preview-header">
        <div className="preview-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'thermal' ? 'active' : ''}`}
            onClick={() => setActiveTab('thermal')}
          >
            <Printer size={16} />
            <span>Thermal 80mm Preview</span>
            <span className="badge-pill">1-Bit B&W</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'original' ? 'active' : ''}`}
            onClick={() => setActiveTab('original')}
          >
            <Eye size={16} />
            <span>Original PDF</span>
          </button>
        </div>

        <div className="preview-toolbar">
          <div className="dimension-badge" title="Thermal Print Dimensions">
            <span>Roll: 80mm</span> &bull; 
            <span>Printable: {widthMm}mm &times; {heightMm}mm</span>
            {processedResult && (
              <span className="dots-badge">
                ({processedResult.widthDots} &times; {processedResult.heightDots} px)
              </span>
            )}
          </div>

          <div className="zoom-controls">
            <button
              type="button"
              className="btn btn-icon-sm"
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.15))}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="zoom-label">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              className="btn btn-icon-sm"
              onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              className="btn btn-icon-sm"
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="preview-viewport">
        {isProcessing && (
          <div className="preview-overlay">
            <div className="loading-spinner"></div>
            <span>Updating thermal raster...</span>
          </div>
        )}

        <div
          className="roll-simulation-wrapper"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
        >
          {/* Thermal Paper Roll Simulation */}
          <div className="thermal-roll-paper">
            <div className="roll-top-edge">
              <div className="roll-feed-slot"></div>
            </div>

            <div
              style={{ display: activeTab === 'thermal' ? 'flex' : 'none' }}
              className="canvas-container"
            >
              <canvas ref={thermalCanvasRef} className="preview-canvas-element" />
            </div>

            <div
              style={{ display: activeTab === 'original' ? 'flex' : 'none' }}
              className="canvas-container"
            >
              <canvas ref={originalCanvasRef} className="preview-canvas-element" />
            </div>

            <div className="roll-bottom-tear">
              <span className="tear-label">- - - - - - - - - - Auto Cut - - - - - - - - - -</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
