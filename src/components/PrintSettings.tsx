import React from 'react';
import { Sliders, RotateCw, Crop, Scissors, Palette } from 'lucide-react';
import type { DitheringMode, RotationAngle, ProcessImageOptions } from '../services/imageProcessor';

interface PrintSettingsProps {
  options: ProcessImageOptions;
  feedLines: number;
  autoCut: boolean;
  onOptionsChange: (newOptions: Partial<ProcessImageOptions>) => void;
  onFeedLinesChange: (lines: number) => void;
  onAutoCutChange: (cut: boolean) => void;
  onResetDefaults: () => void;
}

export const PrintSettings: React.FC<PrintSettingsProps> = ({
  options,
  feedLines,
  autoCut,
  onOptionsChange,
  onFeedLinesChange,
  onAutoCutChange,
  onResetDefaults,
}) => {
  const rotationAngles: RotationAngle[] = [0, 90, 180, 270];

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div className="settings-title">
          <Sliders size={18} />
          <h3>Print & Optimization Settings</h3>
        </div>
        <button
          type="button"
          className="btn-link"
          onClick={onResetDefaults}
          title="Reset to recommended Shopee label defaults"
        >
          Reset Defaults
        </button>
      </div>

      <div className="settings-grid">
        {/* Auto Crop Margins */}
        <div className="setting-card">
          <div className="setting-label-row">
            <label className="setting-label">
              <Crop size={16} />
              <span>Auto-Crop Whitespace</span>
            </label>
            <input
              type="checkbox"
              className="toggle-switch"
              checked={options.autoCrop ?? true}
              onChange={(e) => onOptionsChange({ autoCrop: e.target.checked })}
            />
          </div>
          <p className="setting-hint">
            Trims empty margins around Shopee A4/A6 labels so they fill the 80mm roll.
          </p>

          {(options.autoCrop ?? true) && (
            <div className="sub-setting">
              <div className="slider-label-row">
                <span>Margin Padding</span>
                <span>{options.cropPadding ?? 8} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="2"
                value={options.cropPadding ?? 8}
                onChange={(e) => onOptionsChange({ cropPadding: Number(e.target.value) })}
                className="range-slider"
              />
            </div>
          )}
        </div>

        {/* Rotation */}
        <div className="setting-card">
          <div className="setting-label-row">
            <label className="setting-label">
              <RotateCw size={16} />
              <span>Label Rotation</span>
            </label>
          </div>
          <p className="setting-hint">Rotate if Shopee label is generated in landscape.</p>
          <div className="pill-selector">
            {rotationAngles.map((angle) => (
              <button
                key={angle}
                type="button"
                className={`pill-btn ${(options.rotation ?? 0) === angle ? 'active' : ''}`}
                onClick={() => onOptionsChange({ rotation: angle })}
              >
                {angle}&deg;
              </button>
            ))}
          </div>
        </div>

        {/* Dithering Mode */}
        <div className="setting-card">
          <div className="setting-label-row">
            <label className="setting-label">
              <Palette size={16} />
              <span>Binarization Algorithm</span>
            </label>
          </div>
          <select
            className="select-input"
            value={options.ditheringMode ?? 'threshold'}
            onChange={(e) =>
              onOptionsChange({ ditheringMode: e.target.value as DitheringMode })
            }
          >
            <option value="threshold">Threshold (Sharpest Barcodes & Thai Text)</option>
            <option value="floyd-steinberg">Floyd-Steinberg (Error Diffusion Dithering)</option>
            <option value="atkinson">Atkinson (High-Contrast Dithering)</option>
          </select>
          <p className="setting-hint">
            Threshold produces clean scan lines for 1D/2D barcodes without dither noise.
          </p>
        </div>

        {/* Binarization Threshold */}
        <div className="setting-card">
          <div className="slider-label-row">
            <label className="setting-label">
              <span>Darkness Threshold</span>
            </label>
            <span className="slider-value">{options.threshold ?? 150}</span>
          </div>
          <input
            type="range"
            min="60"
            max="220"
            step="5"
            value={options.threshold ?? 150}
            onChange={(e) => onOptionsChange({ threshold: Number(e.target.value) })}
            className="range-slider"
          />
          <div className="slider-ticks">
            <span>Lighter (60)</span>
            <span>Default (150)</span>
            <span>Darker (220)</span>
          </div>
        </div>

        {/* Paper & Cut Options */}
        <div className="setting-card">
          <div className="setting-label-row">
            <label className="setting-label">
              <Scissors size={16} />
              <span>Auto-Cut Paper</span>
            </label>
            <input
              type="checkbox"
              className="toggle-switch"
              checked={autoCut}
              onChange={(e) => onAutoCutChange(e.target.checked)}
            />
          </div>
          <p className="setting-hint">
            Sends <code>GS V 65 0</code> full cut command to the XP80-T after printing.
          </p>

          <div className="sub-setting">
            <div className="slider-label-row">
              <span>Feed Lines before Cut</span>
              <span>{feedLines} lines (~{(feedLines * 3.75).toFixed(0)}mm)</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={feedLines}
              onChange={(e) => onFeedLinesChange(Number(e.target.value))}
              className="range-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
