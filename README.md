# XPrinter XP80-T &bull; Shopee Thermal Label Printer

A modern, fast web application built with React, TypeScript, and Vite to print Shopee shipping labels (AWB PDFs) directly to the **XPrinter XP80-T** thermal printer via **Bluetooth** (Web Bluetooth BLE / Web Serial SPP) on **80mm thermal paper**.

<image src="thermal-label-printer.png">

---

## Features

- **Direct Wireless Printing (No Print Server Required)**: Connects directly from Google Chrome or Microsoft Edge to your thermal printer via **Web Bluetooth (BLE)** or **Web Serial (Classic Bluetooth SPP / USB)**.
- **Shopee PDF Label Rendering**: Renders PDF airway bills with high fidelity using PDF.js, preserving crisp 1D barcodes, 2D QR codes, and Thai fonts.
- **Smart Auto-Crop Whitespace**: Automatically detects content bounds on Shopee A4/A6 shipping labels and crops excess whitespace, maximizing the 72mm printable width on 80mm paper rolls.
- **1-Bit Thermal Simulation Preview**: Displays an exact pixel-by-pixel simulation of the physical thermal printout alongside the original PDF.
- **Hardware ESC/POS Protocol**: Implements sliced `GS v 0` raster bit image generation (576 dots per row) with packet chunking and throttling to prevent buffer overflow on printer microcontrollers.
- **Auto-Cutter & Feed Controls**: Full cut command (`GS V 65 0`), configurable pre-feed lines, and manual 30mm paper feed/cut buttons.
- **Sample Label Included**: One-click test button pre-loads `print-label.pdf` for immediate out-of-the-box verification.

---

## Hardware Specifications

| Specification | Detail |
| :--- | :--- |
| **Printer Model** | XPrinter XP80-T / XP-80T |
| **Print Method** | Direct Thermal Line Printing |
| **Paper Roll Width** | 80 mm |
| **Printable Width** | 72 mm (**576 dots** at 203 DPI / 8 dots/mm) |
| **Command Set** | Standard Epson ESC/POS |
| **Wireless Interface** | Bluetooth (BLE GATT & Classic SPP) |
| **Wired Interface** | USB Serial |

---

## Verified ESC/POS Commands

```typescript
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  INIT: [ESC, 0x40],                     // Initialize printer
  ALIGN_LEFT: [ESC, 0x61, 0x00],         // Align left
  ALIGN_CENTER: [ESC, 0x61, 0x01],       // Align center
  ALIGN_RIGHT: [ESC, 0x61, 0x02],        // Align right
  BOLD_ON: [ESC, 0x45, 0x01],            // Turn bold mode on
  BOLD_OFF: [ESC, 0x45, 0x00],           // Turn bold mode off
  LINE_SPACING_0: [ESC, 0x33, 0x00],     // 0-dot line spacing (for seamless raster)
  LINE_SPACING_DEFAULT: [ESC, 0x32],     // Default line spacing
  FEED: (n: number) => [ESC, 0x64, n],   // Feed n lines
  CUT: [GS, 0x56, 0x41, 0x00],           // Full cut (Function A)
  CUT_PARTIAL: [GS, 0x56, 0x42, 0x00],   // Partial cut (Function B)
  // Sliced raster bit image: GS v 0 0 xL xH yL yH (xL = 72, xH = 0 for 576 dots)
};
```

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler & Tooling**: Vite 8, Oxlint
- **PDF Engine**: `pdfjs-dist` v6 (High-DPI canvas rendering)
- **Web APIs**: Web Bluetooth API (`navigator.bluetooth`), Web Serial API (`navigator.serial`)
- **Icons**: Lucide React

---

## Getting Started

### Prerequisites

- **Node.js**: v18 or higher (Node.js v20+ recommended)
- **Package Manager**: `pnpm` (or `npm`)
- **Browser**: Google Chrome, Microsoft Edge, Opera, or Bluefy (iOS) with Web Bluetooth / Web Serial enabled.

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd thermal-printer-shopee

# Install dependencies
pnpm install
```

### Development

```bash
# Start local development server
pnpm dev
```
Open your browser and navigate to `http://localhost:5173`.

### Production Build & Lint

```bash
# Typecheck and create production bundle
pnpm run build

# Run Oxlint
pnpm run lint

# Preview production build
pnpm run preview
```

---

## How to Use

1. **Power on the XPrinter XP80-T** and ensure an 80mm paper roll is loaded.
2. **Connect to the Printer**:
   - **Bluetooth (BLE)**: Click **"Connect Bluetooth"**. Select your printer from the browser device picker popup.
   - **Serial / USB (Classic Bluetooth SPP or USB Cable)**: If your printer is paired in your operating system's Bluetooth settings (macOS/Windows) or connected via USB, click **"Serial / USB"** and select the corresponding serial COM port.
3. **Upload or Select Label**:
   - The app automatically pre-loads the bundled Shopee label (`print-label.pdf`).
   - Or drag and drop any Shopee airway bill PDF into the upload zone.
4. **Customize Print Settings**:
   - **Auto-Crop Whitespace**: Enabled by default to trim large margins from Shopee A4 labels.
   - **Rotation**: Rotate 90° or 180° if the label was exported in landscape orientation.
   - **Darkness Threshold**: Adjust darkness slider (default: `150`) to optimize barcode scan contrast.
   - **Auto-Cut**: Enabled by default with configurable feed lines before cut.
5. **Print**:
   - Click the green **"Print Label (80mm)"** button.
   - A real-time progress bar will indicate the byte transmission status.

---

## Troubleshooting & Tips

- **Web Bluetooth Permission**: Ensure Bluetooth is enabled in your OS and that Chrome has permission to access Bluetooth.
- **macOS Bluetooth SPP**: If connecting via Bluetooth Classic on macOS, pair the printer in **System Settings > Bluetooth** first. It will appear as an incoming serial port under **"Serial / USB"**.
- **Buffer Safety**: Tall shipping labels are automatically sliced into vertical strips of 256 dots and transmitted in 100-byte packets with throttled intervals to prevent microcontroller memory buffer overflows.
- **Cutter Not Firing**: If your printer model only supports partial cut, ensure the cutter mechanism is enabled on the printer dip-switches.

---

## License

Private / MIT
