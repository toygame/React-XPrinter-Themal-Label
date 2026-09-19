export type ConnectionType = 'bluetooth-ble' | 'serial' | null;
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';

export interface PrinterState {
  status: ConnectionStatus;
  type: ConnectionType;
  deviceName: string | null;
  errorMessage: string | null;
  progress: number; // 0 to 100
}

export type StateChangeCallback = (state: PrinterState) => void;

// Common BLE Service UUIDs for thermal receipt/label printers
export const COMMON_BLE_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Most common Chinese BLE thermal (XPrinter, Goojprt)
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Transmission
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000af30-0000-1000-8000-00805f9b34fb',
];

class PrinterConnectionManager {
  private state: PrinterState = {
    status: 'disconnected',
    type: null,
    deviceName: null,
    errorMessage: null,
    progress: 0,
  };

  private listeners: StateChangeCallback[] = [];

  // BLE references
  private bleDevice: BluetoothDevice | null = null;
  private bleCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Serial references
  private serialPort: SerialPort | null = null;
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  public subscribe(cb: StateChangeCallback): () => void {
    this.listeners.push(cb);
    cb(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private updateState(partial: Partial<PrinterState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public getState(): PrinterState {
    return this.state;
  }

  /**
   * Checks browser capability for Web Bluetooth.
   */
  public isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Checks browser capability for Web Serial (Bluetooth SPP / USB).
   */
  public isSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /**
   * Connect to printer using Web Bluetooth (BLE GATT).
   */
  public async connectBluetooth(): Promise<void> {
    if (!this.isBluetoothSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Google Chrome, Edge, or Bluefy.');
    }

    this.updateState({ status: 'connecting', errorMessage: null, progress: 0 });

    try {
      // 1. Request Bluetooth device
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: COMMON_BLE_SERVICES,
      });

      this.bleDevice = device;
      device.addEventListener('gattserverdisconnected', this.onGattDisconnected);

      // 2. Connect to GATT Server
      if (!device.gatt) {
        throw new Error('Device GATT is not available.');
      }

      const server = await device.gatt.connect();

      // 3. Search for writable characteristic across available services
      let writableChar: BluetoothRemoteGATTCharacteristic | null = null;

      for (const serviceUuid of COMMON_BLE_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writableChar = char;
              break;
            }
          }
          if (writableChar) break;
        } catch {
          // Continue searching other services
        }
      }

      // If not found in known list, discover all primary services
      if (!writableChar) {
        try {
          const services = await server.getPrimaryServices();
          for (const service of services) {
            try {
              const characteristics = await service.getCharacteristics();
              for (const char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                  writableChar = char;
                  break;
                }
              }
              if (writableChar) break;
            } catch {
              // skip
            }
          }
        } catch {
          // skip
        }
      }

      if (!writableChar) {
        throw new Error('Could not find a writable Bluetooth characteristic on this device.');
      }

      this.bleCharacteristic = writableChar;
      this.updateState({
        status: 'connected',
        type: 'bluetooth-ble',
        deviceName: device.name || 'XP80-T (BLE)',
        errorMessage: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({
        status: 'disconnected',
        type: null,
        deviceName: null,
        errorMessage: msg === 'User cancelled the requestDevice() chooser.' ? null : msg,
      });
      throw err;
    }
  }

  /**
   * Connect to printer using Web Serial (Bluetooth SPP / USB).
   */
  public async connectSerial(baudRate = 115200): Promise<void> {
    if (!this.isSerialSupported()) {
      throw new Error('Web Serial is not supported in this browser. Please use Chrome or Edge on desktop.');
    }

    this.updateState({ status: 'connecting', errorMessage: null, progress: 0 });

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });

      this.serialPort = port;
      const writer = port.writable?.getWriter();
      if (!writer) {
        throw new Error('Failed to get writable stream from serial port.');
      }
      this.serialWriter = writer;

      this.updateState({
        status: 'connected',
        type: 'serial',
        deviceName: 'XP80-T (Serial/SPP)',
        errorMessage: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({
        status: 'disconnected',
        type: null,
        deviceName: null,
        errorMessage: msg.includes('cancel') ? null : msg,
      });
      throw err;
    }
  }

  /**
   * Disconnects any active connection.
   */
  public async disconnect(): Promise<void> {
    if (this.bleDevice?.gatt?.connected) {
      this.bleDevice.gatt.disconnect();
    }
    this.bleDevice = null;
    this.bleCharacteristic = null;

    if (this.serialWriter) {
      try {
        this.serialWriter.releaseLock();
      } catch {
        // ignore
      }
      this.serialWriter = null;
    }

    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch {
        // ignore
      }
      this.serialPort = null;
    }

    this.updateState({
      status: 'disconnected',
      type: null,
      deviceName: null,
      errorMessage: null,
      progress: 0,
    });
  }

  private onGattDisconnected = () => {
    this.bleDevice = null;
    this.bleCharacteristic = null;
    this.updateState({
      status: 'disconnected',
      type: null,
      deviceName: null,
      errorMessage: 'Bluetooth printer disconnected',
      progress: 0,
    });
  };

  /**
   * Sends raw binary commands to the printer with packet chunking and progress reporting.
   */
  public async send(data: Uint8Array): Promise<void> {
    if (this.state.status !== 'connected' && this.state.status !== 'printing') {
      throw new Error('Printer is not connected.');
    }

    this.updateState({ status: 'printing', progress: 0 });

    try {
      if (this.state.type === 'bluetooth-ble') {
        await this.sendBleChunked(data);
      } else if (this.state.type === 'serial') {
        await this.sendSerialChunked(data);
      } else {
        throw new Error('Unknown connection type');
      }

      this.updateState({ status: 'connected', progress: 100 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({
        status: 'error',
        errorMessage: `Print failed: ${msg}`,
      });
      throw err;
    }
  }

  /**
   * Chunked transmission over Web Bluetooth BLE with delay to prevent buffer overflows.
   */
  private async sendBleChunked(data: Uint8Array, chunkSize = 100, delayMs = 15): Promise<void> {
    if (!this.bleCharacteristic) {
      throw new Error('BLE Characteristic not ready.');
    }

    const totalBytes = data.length;
    let offset = 0;

    const canWriteWithoutResponse = Boolean(this.bleCharacteristic.properties.writeWithoutResponse);

    while (offset < totalBytes) {
      const slice = data.subarray(offset, Math.min(offset + chunkSize, totalBytes));
      // Ensure clean ArrayBuffer for Web Bluetooth BufferSource type requirement
      const buffer = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) as ArrayBuffer;

      if (canWriteWithoutResponse) {
        await this.bleCharacteristic.writeValueWithoutResponse(buffer);
      } else {
        await this.bleCharacteristic.writeValue(buffer);
      }

      offset += slice.length;
      const progress = Math.min(100, Math.round((offset / totalBytes) * 100));
      this.updateState({ progress });

      if (delayMs > 0 && offset < totalBytes) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Chunked transmission over Web Serial.
   */
  private async sendSerialChunked(data: Uint8Array, chunkSize = 1024): Promise<void> {
    if (!this.serialWriter) {
      throw new Error('Serial writer not available.');
    }

    const totalBytes = data.length;
    let offset = 0;

    while (offset < totalBytes) {
      const slice = data.subarray(offset, Math.min(offset + chunkSize, totalBytes));
      await this.serialWriter.write(slice);

      offset += slice.length;
      const progress = Math.min(100, Math.round((offset / totalBytes) * 100));
      this.updateState({ progress });

      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}

export const printerService = new PrinterConnectionManager();
