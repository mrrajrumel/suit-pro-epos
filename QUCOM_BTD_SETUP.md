# Qucom BTD Thermal Printer Setup Guide

## 🖨️ Overview
This guide helps you configure and troubleshoot the **Qucom BTD-58** Bluetooth thermal printer with SUIT PRO EPOS.

---

## ✅ System Requirements

- **SUIT PRO EPOS** v1.0.0+
- **Qucom BTD-58** thermal printer (Bluetooth/USB)
- **Windows 10+**, **macOS 10.14+**, or **Ubuntu 18.04+**
- **Chrome 89+** or **Edge 89+** (for Web Serial API support)

---

## 🔌 Hardware Setup

### 1. **USB Connection (Recommended for Reliability)**

#### Windows:
1. Connect Qucom BTD via USB cable
2. Windows will auto-detect as "Qucom Thermal Printer"
3. Check Device Manager → COM Ports
4. Note the COM port number (e.g., `COM3`, `COM4`)

#### macOS:
1. Connect via USB
2. System will recognize as `/dev/tty.usbserial-*`
3. Open Terminal and run:
   ```bash
   ls /dev/tty.usbserial*
   ```
4. Note the exact port name

#### Linux:
1. Connect via USB
2. The device will appear as `/dev/ttyUSB0` or `/dev/ttyUSB1`
3. Verify with:
   ```bash
   ls /dev/ttyUSB*
   ```

### 2. **Bluetooth Connection**

#### Windows:
1. Pair Qucom BTD via Bluetooth Settings
2. Open Command Prompt (Admin):
   ```powershell
   Get-WmiObject Win32_SerialPort | Select-Object Name, DeviceID, Description
   ```
3. Find the COM port assigned to Qucom BTD

#### macOS:
1. Pair device via System Preferences → Bluetooth
2. Open Terminal and find the serial port:
   ```bash
   ls -la /dev/tty.Qucom*
   ```

#### Linux:
1. Pair device via system Bluetooth settings
2. Use `rfcomm` to bind to serial port:
   ```bash
   sudo rfcomm bind /dev/rfcomm0 <DEVICE_MAC_ADDRESS>
   ```

---

## ⚙️ Configuration

### Step 1: Update `.env` File

Edit the `.env` file in your project root and configure:

```env
# ============================================
# QUCOM BTD THERMAL PRINTER SETTINGS
# ============================================
QUCOM_BTD_PORT=/dev/ttyUSB0              # Change based on your OS:
                                          # Windows: COM3, COM4, etc.
                                          # macOS: /dev/tty.usbserial-XXXXX
                                          # Linux: /dev/ttyUSB0

QUCOM_BTD_BAUD_RATE=9600                 # Qucom standard: 9600 bps
QUCOM_BTD_TIMEOUT_MS=5000                # 5 seconds timeout
QUCOM_BTD_ENABLED=true                   # Enable Qucom printer
QUCOM_BTD_MODEL=Qucom-BTD-58             # Model identifier
QUCOM_BTD_PAPER_WIDTH=58                 # Paper width in mm
```

### Step 2: Platform-Specific Port Configuration

#### Windows Users:
```env
# If your Qucom appears as COM3:
QUCOM_BTD_PORT=COM3

# Or full path:
QUCOM_BTD_PORT=\\.\COM3
```

#### macOS Users:
```env
# Example for USB serial device:
QUCOM_BTD_PORT=/dev/tty.usbserial-1410
```

#### Linux Users:
```env
# Standard USB serial port:
QUCOM_BTD_PORT=/dev/ttyUSB0

# Or if using Bluetooth with rfcomm:
QUCOM_BTD_PORT=/dev/rfcomm0
```

---

## 🧪 Testing the Connection

### Method 1: Using SUIT PRO Terminal

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open browser console (F12)

3. Run test command:
   ```javascript
   const printer = getPrinterService();
   await printer.initialize();
   ```

4. Check console output for printer detection status

### Method 2: Direct API Test

#### Check Printer Status:
```bash
curl http://localhost:3000/api/printer/check
```

Expected response:
```json
{
  "available": true,
  "printers": [
    {
      "id": "qucom-btd-1",
      "name": "Qucom BTD Thermal Printer",
      "type": "bluetooth",
      "status": "ready",
      "model": "Qucom BTD-58",
      "port": "/dev/ttyUSB0"
    }
  ],
  "timestamp": "2026-06-16T20:30:00.000Z"
}
```

#### Check Printer Health:
```bash
curl http://localhost:3000/api/printer/health
```

#### Send Test Print:
```bash
curl -X POST http://localhost:3000/api/printer/print \
  -H "Content-Type: application/json" \
  -d '{
    "receipt": {
      "headerGreetings": "TEST RECEIPT",
      "items": [{"name": "Test Item", "qty": 1, "price": 10.00}],
      "subtotal": 10.00,
      "vat": 2.00,
      "total": 12.00,
      "timestamp": "2026-06-16T20:30:00Z",
      "invoiceId": "TEST-001",
      "salesperson": "Test User",
      "paymentMethod": "Cash"
    },
    "receiptText": "================================\nTEST RECEIPT\n================================\n\nItems:\nTest Item x1 @ £10.00\n\n--------------------------------\nSubtotal: £10.00\nVAT (20%): £2.00\nTOTAL: £12.00\n\nSalesperson: Test User\nPayment: Cash\nTime: 2026-06-16T20:30:00Z\nInvoice: TEST-001\n================================\n"
  }'
```

---

## 🔧 Troubleshooting

### Issue: Printer Not Detected

**Solution 1: Check Port Configuration**
```bash
# Windows PowerShell
Get-WmiObject Win32_SerialPort | Select-Object Name, DeviceID

# macOS Terminal
ls -la /dev/tty.* | grep -i usb

# Linux Terminal
ls -la /dev/ttyUSB*
```

**Solution 2: Verify Permissions**
- **Linux**: Add user to dialout group:
  ```bash
  sudo usermod -a -G dialout $USER
  sudo reboot
  ```

**Solution 3: Restart Service**
```bash
npm run dev
```

### Issue: "Printer Offline" Error

1. **Physical Check**:
   - Ensure USB cable is firmly connected
   - Check for LED indicators on printer
   - Verify power supply

2. **Driver Check**:
   - Windows: Check Device Manager for yellow warnings
   - macOS: Check System Report → USB
   - Linux: Run `dmesg | tail -20` to see kernel messages

3. **Port Conflict**:
   - Ensure no other application is using the port
   - Close any competing printer software

### Issue: Print Jobs Not Processing

**Check System Audit Log**:
```bash
cat suitpro_system_audits.log | grep -i printer
```

**Restart the Server**:
```bash
npm run dev
# Kill with Ctrl+C and restart
```

**Clear Print Queue**:
```javascript
// In browser console
fetch('/api/printer/devices').then(r => r.json()).then(d => console.log(d))
```

---

## 🌐 Browser Compatibility

### Supported Browsers for Web Serial API:
- ✅ **Chrome 89+**
- ✅ **Edge 89+**
- ✅ **Brave 1.33+**
- ⚠️ **Firefox 100+** (Experimental flag required)

### Fallback Modes:
- If Web Serial API not available → Backend serial port communication
- If backend serial fails → Browser print dialog
- If browser print fails → Offline receipt saved to localStorage

---

## 📝 Performance Notes

### Optimal Settings for Qucom BTD-58:

```env
# Fast printing (standard settings)
QUCOM_BTD_BAUD_RATE=9600

# For high-volume printing:
QUCOM_BTD_TIMEOUT_MS=3000       # Reduce timeout

# For slower networks:
QUCOM_BTD_TIMEOUT_MS=7000       # Increase timeout
```

### Print Speed:
- **Expected**: 50-100mm/sec
- **Receipt (80mm): ~15-20 seconds
- **Receipt (58mm): ~10-15 seconds

---

## 🔒 Security Considerations

1. **Serial Port Access**: 
   - Don't expose `/api/printer/print` without authentication
   - Verify JWT token before processing print jobs

2. **Web Serial API**:
   - Requires HTTPS in production (localhost OK for development)
   - User must grant permission first time

3. **Audit Logging**:
   - All print jobs logged to `suitpro_system_audits.log`
   - Check logs regularly for suspicious activity

---

## 📞 Support

### Common Error Messages:

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOENT: no such file or device` | Port doesn't exist | Check port configuration |
| `EACCES: permission denied` | Insufficient permissions | Add user to dialout group (Linux) |
| `ETIMEDOUT: connection timeout` | Printer not responding | Check power, USB cable, drivers |
| `EBUSY: device or resource busy` | Port in use | Close other applications using port |

### Diagnostic Commands:

```bash
# Check service logs
npm run dev 2>&1 | grep -i printer

# Monitor print queue
curl http://localhost:3000/api/printer/devices

# Test connectivity
ping <PRINTER_IP>  # If network printer
```

---

## ✨ Features Implemented

- ✅ **USB & Bluetooth Support**: Automatic detection of Qucom BTD
- ✅ **Multiple Connection Methods**: Web Serial API + Backend serial
- ✅ **Automatic Fallback**: Browser print if device fails
- ✅ **Offline Receipt Saving**: Saves to localStorage if printer unavailable
- ✅ **Health Monitoring**: Regular checks for printer status
- ✅ **Print Queue Management**: Tracks active print jobs
- ✅ **Audit Logging**: All printer events logged to system audit log
- ✅ **ESC/POS Protocol**: Compatible with standard thermal printers

---

## 🎉 Quick Start

```bash
# 1. Configure your port in .env
# 2. Start the development server
npm run dev

# 3. Open app in browser
# 4. Place an order and click "Print Receipt"
# 5. Select your Qucom BTD when prompted (Web Serial)
# OR automatic printing (backend)

# 6. Receipt prints!
```

---

**Last Updated**: 2026-06-16  
**Version**: 1.0  
**Status**: Production Ready ✅
