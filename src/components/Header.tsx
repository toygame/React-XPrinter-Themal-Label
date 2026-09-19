import React from 'react';
import { Bluetooth, Cable, Power, CheckCircle, AlertCircle, Loader2, Printer } from 'lucide-react';
import type { PrinterState } from '../services/printerConnection';

interface HeaderProps {
  printerState: PrinterState;
  onConnectBle: () => void;
  onConnectSerial: () => void;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  printerState,
  onConnectBle,
  onConnectSerial,
  onDisconnect,
}) => {
  const isConnected = printerState.status === 'connected' || printerState.status === 'printing';
  const isConnecting = printerState.status === 'connecting';

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon-wrapper">
          <Printer className="brand-icon" size={26} />
        </div>
        <div>
          <h1 className="header-title">Thermal Label Printer</h1>
          <p className="header-subtitle">
            XPrinter XP80-T &bull; 80mm Roll (576 dots) &bull; ESC/POS
          </p>
        </div>
      </div>

      <div className="header-actions">
        {/* Status Badge */}
        <div className={`status-badge status-${printerState.status}`}>
          {isConnecting && <Loader2 className="spin" size={14} />}
          {printerState.status === 'connected' && <CheckCircle size={14} />}
          {printerState.status === 'printing' && <Loader2 className="spin" size={14} />}
          {printerState.status === 'error' && <AlertCircle size={14} />}
          <span className="status-label">
            {printerState.status === 'connected' && (printerState.deviceName || 'Connected')}
            {printerState.status === 'connecting' && 'Connecting...'}
            {printerState.status === 'printing' && `Printing (${printerState.progress}%)`}
            {printerState.status === 'disconnected' && 'Disconnected'}
            {printerState.status === 'error' && 'Error'}
          </span>
          {printerState.type && (
            <span className="badge-tag">
              {printerState.type === 'bluetooth-ble' ? 'BLE' : 'SPP/USB'}
            </span>
          )}
        </div>

        {/* Connection Buttons */}
        {!isConnected ? (
          <div className="button-group">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onConnectBle}
              disabled={isConnecting}
              title="Connect directly via Web Bluetooth (BLE GATT)"
            >
              <Bluetooth size={16} />
              <span>Connect Bluetooth</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onConnectSerial}
              disabled={isConnecting}
              title="Connect via Bluetooth Serial (SPP) or USB Cable"
            >
              <Cable size={16} />
              <span>Serial / USB</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onDisconnect}
            title="Disconnect printer"
          >
            <Power size={16} />
            <span>Disconnect</span>
          </button>
        )}
      </div>
    </header>
  );
};
