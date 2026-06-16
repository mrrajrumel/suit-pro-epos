# 🆘 ERROR CODE REFERENCE & QUICK TROUBLESHOOTING GUIDE

## Quick Reference by Symptom

### 🖨️ PRINTER ISSUES

#### Error: "Printer Not Found" / "Device Not Ready"
```
Error Code: PRN-001
Location: PosTerminal.tsx line 115-140
Cause: No actual printer driver connected
Solution:
  1. Install escpos-js: npm install escpos
  2. Configure printer in suitpro_system_config.json
  3. Check USB/Network cable connection
  4. Run: npm run init:printer (if available)

Workaround: Browser print dialog will appear
```

#### Error: "Thermal Receipt Stream Element Was Not Found"
```
Error Code: PRN-002
Location: PosTerminal.tsx line 115
Cause: Receipt HTML element missing from DOM
Solution:
  1. Check if receipt template is loaded
  2. Verify receipt HTML ID matches: "print-recipient-receipt"
  3. Check browser console for JS errors
  4. Clear browser cache and refresh

Code to check:
const receiptEl = document.getElementById("print-recipient-receipt");
if (!receiptEl) console.error("Missing receipt element");
```

#### Error: "Print Dialog Canceled"
```
Error Code: PRN-003
Location: PosTerminal.tsx
Cause: User cancelled browser print dialog
Solution:
  1. Try printing again
  2. Check printer is connected
  3. Use USB printer instead of network
  4. Offline receipt saved automatically

Status Check:
localStorage.getItem("suitpro_offline_receipts") // Check saved receipts
```

#### Error: "Invalid Thermal Width (58mm/80mm)"
```
Error Code: PRN-004
Location: PosTerminal.tsx line 24
Cause: Incorrect thermal printer width configuration
Solution:
  1. Edit suitpro_system_config.json
  2. Set "thermalWidth": "80mm" (or "58mm")
  3. Restart application
  4. Verify: npm run check:config

Example Config:
{
  "thermalWidth": "80mm",
  "hardwareMode": "Desktop",
  "vatRate": 0.20
}
```

---

### 🌐 NETWORK/DEVICE CONNECTION ISSUES

#### Error: "Devices Tracking Poll Failed"
```
Error Code: NET-001
Location: server.ts line 1928
Cause: Device status check endpoint error
Solution:
  1. Check server is running: npm run dev
  2. Verify server logs for exceptions
  3. Restart server: Ctrl+C then npm run dev
  4. Check firewall rules

Debug Command:
curl http://localhost:3000/api/devices
(Should return JSON array of devices)
```

#### Error: "Heartbeat Recording Failed"
```
Error Code: NET-002
Location: server.ts line 1947
Cause: Device heartbeat endpoint error
Solution:
  1. Verify device ID is provided
  2. Check IP address format (IPv4)
  3. Ensure server port 3000 is accessible
  4. Check for rate limiting

Expected Payload:
{
  "id": "device-123",
  "type": "Desktop POS",
  "os": "Windows 11",
  "ip": "192.168.1.100",
  "status": "Active"
}
```

#### Error: "Camera Device Absent or Access Blocked"
```
Error Code: NET-003
Location: NetworkScanner.tsx line 55
Cause: Browser cannot access camera
Solutions:
  a) Permission Denied:
     - Check browser camera permissions
     - Settings > Privacy > Camera > Allow
  b) Timeout (5 seconds):
     - Camera may be in use by another app
     - Close Teams/Zoom/other video apps
     - Check USB camera connection
  c) Not Supported:
     - Use keyboard scanner instead (manual barcode input)
     - Try different browser (Chrome recommended)

Debug Code:
if (navigator.mediaDevices?.getUserMedia) {
  console.log("✓ Camera API supported");
} else {
  console.log("✗ Camera API not supported");
}
```

#### Error: "Local Network Interfacing Info Missing"
```
Error Code: NET-004
Location: NetworkScanner.tsx line 20
Cause: Cannot fetch /api/config endpoint
Solution:
  1. Check server is running
  2. Check network connection
  3. Verify localhost:3000 accessible
  4. Check CORS settings

Fallback: Uses 192.168.1.144 as default
```

#### Error: "Invalid IP Address Format"
```
Error Code: NET-005
Location: server.ts line 1955
Cause: Device IP not in valid IPv4 format
Solution:
  1. Verify IP format: XXX.XXX.XXX.XXX
  2. Examples:
     - Valid: 192.168.1.100, 10.0.0.50
     - Invalid: 192.168.1, 256.256.256.256
  3. Update device IP in settings
```

---

### 🔐 SECURITY & AUTHENTICATION ERRORS

#### Error: "Invalid Username or Secret Password Credentials Supplied"
```
Error Code: AUTH-001
Location: server.ts line 1088 / 1117
Cause: Wrong login credentials
Solution:
  1. Check CAPS LOCK is off
  2. Verify password from .env file
  3. If forgot password: See SECURITY.md
  4. Account may be locked (contact admin)

For Master "Rumel" account:
  Username: Rumel
  Password: Check .env file (MASTER_PASSWORD)
```

#### Error: "Missing Login Credentials"
```
Error Code: AUTH-002
Location: server.ts line 1077
Cause: Username or password not provided
Solution:
  1. Ensure both fields filled
  2. Check form submission works
  3. Try different browser
  4. Clear browser cookies
```

#### Error: "Username Already Registered on System"
```
Error Code: AUTH-003
Location: server.ts line 1415
Cause: Cannot create duplicate user
Solution:
  1. Choose different username
  2. Or delete existing user first
  3. Cannot duplicate "Rumel" (owner account)
```

#### Error: "Token Expired - Please Login Again"
```
Error Code: AUTH-004
Location: Various (if JWT implemented)
Cause: Session token exceeded 24 hour expiration
Solution:
  1. Login again with credentials
  2. New 24-hour token will be issued
  3. Clear browser localStorage for old tokens

Debug Check:
localStorage.getItem("authToken") // Check if token exists
```

---

### 💾 DATABASE & FILE ERRORS

#### Error: "Failed to Access Products Catalog"
```
Error Code: DB-001
Location: server.ts line 283
Cause: Cannot read suitpro_products_db.json
Solution:
  1. Check file exists: suitpro_products_db.json
  2. Verify JSON syntax (use JSON validator)
  3. Check file permissions (readable)
  4. Restore from backup: /backups/

Recovery:
1. Stop server
2. Delete corrupted file
3. Restart server (will create new file)
```

#### Error: "Failed to Create Catalog Entry"
```
Error Code: DB-002
Location: server.ts line 313
Cause: Cannot save new product
Solution:
  1. Check disk space
  2. Verify write permissions on data directory
  3. Check JSON syntax in request body
  4. Try restarting server
```

#### Error: "Duplicate Barcode SKU Violates Relational Indexes Constraints"
```
Error Code: DB-003
Location: server.ts line 296
Cause: Product barcode already exists
Solution:
  1. Use unique barcode for new product
  2. Or edit existing product instead
  3. Check if duplicate was created accidentally

Check Duplicates:
grep "12345" suitpro_products_db.json
```

#### Error: "Local Spreadsheet Sync Error"
```
Error Code: DB-004
Location: server.ts line 115-140
Cause: Cannot write to C:\SuitPro\Sheets\ or fallback directory
Solution:
  1. Check directory exists or has write permissions
  2. Windows: mkdir C:\SuitPro\Sheets
  3. Unix: mkdir -p ./local-c/SuitPro/Sheets
  4. Check file system not full
```

---

### 📊 OPERATIONAL ERRORS

#### Error: "Cart Is Empty. Scan An Item First"
```
Error Code: OPS-001
Location: PosTerminal.tsx
Cause: Attempting checkout with empty cart
Solution:
  1. Scan/add products first
  2. Use barcode scanner or manual entry
  3. Check scanner is working properly
```

#### Error: "SKU/Barcode [xxxxx] Not Recognized in SUIT PRO Database"
```
Error Code: OPS-002
Location: PosTerminal.tsx
Cause: Product barcode not in system
Solution:
  1. Check barcode number is correct
  2. Add missing product: Dashboard > Add Product
  3. Verify barcode in Products list
  4. Check for leading/trailing spaces in barcode
```

#### Error: "Cannot Exceed Floor Stock Limits"
```
Error Code: OPS-003
Location: PosTerminal.tsx
Cause: Quantity requested exceeds available stock
Solution:
  1. Reduce quantity requested
  2. Check inventory: Inventory Manager
  3. Place backorder for additional stock
  4. Select alternative size/color
```

#### Error: "Out of Stock Error"
```
Error Code: OPS-004
Location: PosTerminal.tsx
Cause: Product has zero stock
Solution:
  1. Select different product/size
  2. Check Inventory Manager for backorders
  3. Restock product first
  4. Note: Cannot sell out-of-stock items
```

#### Error: "Insufficient Funds. Cash Payment Shortfall"
```
Error Code: OPS-005
Location: PosTerminal.tsx
Cause: Cash tendered less than total due
Solution:
  1. Customer provides more cash
  2. Use alternative payment method (card)
  3. Use split payment option
  4. Cancel transaction and retry
```

---

### 🔧 SYSTEM/STARTUP ERRORS

#### Error: "[MYSQL-PROD] Startup Database Initialization Suffered Error"
```
Error Code: SYS-001
Location: server.ts line 1983
Cause: MySQL connection failed at startup
Solution:
  1. Verify MySQL server running
  2. Check connection string in .env
  3. Verify credentials correct
  4. Check firewall allows MySQL port 3306
  5. System will fall back to JSON storage

Check MySQL:
mysql -u root -p (test connection)
```

#### Error: "[Python Sync Daemon] Could not execute Python sheets synchronizer"
```
Error Code: SYS-002
Location: server.ts line 1993
Cause: Python sync_sheets.py failed
Solution:
  1. Verify Python 3 installed: python3 --version
  2. Check sync_sheets.py exists
  3. Install dependencies: pip install -r requirements.txt
  4. Check file permissions
  5. System continues without sync daemon
```

#### Error: "CRITICAL LOW STOCK ALERT"
```
Error Code: SYS-003
Location: server.ts line 637
Cause: Product stock fell below 5 units
Solution:
  1. Check Inventory Manager
  2. Reorder stock for product
  3. Update stock count
  4. Configure low stock threshold if needed
```

---

## 📞 CRITICAL ERRORS TO REPORT

### 🔴 MUST REPORT IMMEDIATELY:

1. **Error Code: SEC-001 - Security Credentials Exposed**
   - Hardcoded passwords in source code
   - Action: Follow SECURITY_ERROR_REPORT.md

2. **Error Code: DB-101 - Database Corruption**
   - Corrupted JSON files
   - Action: Restore from backup immediately

3. **Error Code: AUTH-101 - Unauthorized Access Detected**
   - Unexpected admin logins
   - Action: Review audit logs, change passwords

4. **Error Code: NET-101 - Unusual Device Activity**
   - Spoof IP addresses or suspicious devices
   - Action: Check /api/devices list, investigate IPs

---

## 🛠️ TROUBLESHOOTING WORKFLOW

```
┌─ Does app start? ─No─→ Check server logs, verify npm install
│                        └─ Fix: npm run dev
│                Yes
└─ Can you login? ─No─→ Check credentials in .env
                        └─ Fix: Verify MASTER_PASSWORD
           Yes
           └─ Can you scan items? ─No─→ Check camera/scanner
                                        └─ Fix: Test /api/devices
                          Yes
                          └─ Can you print? ─No─→ Check printer
                                              └─ Fix: Check PRN-001
                               Yes
                               └─ ✓ SYSTEM OPERATIONAL
```

---

## 📋 LOG INSPECTION COMMANDS

```bash
# View recent system logs
tail -f suitpro_system_audits.log

# Search for errors
grep "CRITICAL" suitpro_system_audits.log

# Check last 20 lines
tail -20 suitpro_system_audits.log

# Export logs to file
cp suitpro_system_audits.log backup_$(date +%s).log

# Check printer errors
grep -i "printer\|print" suitpro_system_audits.log

# Check device errors
grep -i "device\|connection" suitpro_system_audits.log
```

---

## 🆘 When Nothing Works

1. **Clear all caches:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Reset to defaults:**
   - Use API endpoint: `POST /api/system/reset`
   - Master key: `5566` (for factory reset)

3. **Restore from backup:**
   - Get backup list: `GET /api/pos/restore`
   - Restore: `POST /api/pos/restore` with fileName

4. **Emergency contact:**
   - Check Devmode.md for support contacts
   - Review README.md for known issues

---

**Last Updated:** 2026-06-16
**Version:** 1.0
**Maintained By:** GitHub Copilot
